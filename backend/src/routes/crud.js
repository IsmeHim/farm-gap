import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

// Generic CRUD scoped by user_id
export function crudRouter(table, fields) {
  const r = Router();
  r.use(authRequired);

  const logAudit = async (action, recordId, userEmail, oldRow, newRow) => {
    try {
      await pool.query(
        'INSERT INTO audit_logs (table_name, record_id, action, user_email, old_values, new_values) VALUES (?,?,?,?,?,?)',
        [table, recordId, action, userEmail, oldRow ? JSON.stringify(oldRow) : null, newRow ? JSON.stringify(newRow) : null]
      );
    } catch (e) {
      console.warn('Failed to write audit log:', e.message);
    }
  };

  r.get('/', async (req, res) => {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE user_id=? ORDER BY id DESC`, [req.user.id]);
    res.json(rows);
  });

  r.post('/', async (req, res) => {
    const cols = ['user_id', 'created_by', 'updated_by', ...fields];
    const vals = [req.user.id, req.user.email, req.user.email, ...fields.map(f => req.body[f] ?? null)];
    const placeholders = cols.map(() => '?').join(',');
    try {
      const [result] = await pool.query(
        `INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(',')}) VALUES (${placeholders})`,
        vals
      );
      const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id=?`, [result.insertId]);
      await logAudit('insert', result.insertId, req.user.email, null, rows[0]);
      res.json(rows[0]);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.put('/:id', async (req, res) => {
    const [oldRows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id=? AND user_id=?`, [req.params.id, req.user.id]);
    if (!oldRows[0]) return res.status(404).json({ error: 'not found' });

    const sets = [...fields.map(f => `\`${f}\`=?`), '`updated_by`=?', '`updated_at`=CURRENT_TIMESTAMP'].join(',');
    const vals = [...fields.map(f => req.body[f] ?? null), req.user.email, req.params.id, req.user.id];
    await pool.query(`UPDATE \`${table}\` SET ${sets} WHERE id=? AND user_id=?`, vals);

    const [newRows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id=?`, [req.params.id]);
    await logAudit('update', req.params.id, req.user.email, oldRows[0], newRows[0]);
    res.json(newRows[0]);
  });

  r.delete('/:id', async (req, res) => {
    const [oldRows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id=? AND user_id=?`, [req.params.id, req.user.id]);
    if (!oldRows[0]) return res.status(404).json({ error: 'not found' });
    await pool.query(`DELETE FROM \`${table}\` WHERE id=? AND user_id=?`, [req.params.id, req.user.id]);
    await logAudit('delete', req.params.id, req.user.email, oldRows[0], null);
    res.json({ ok: true });
  });

  return r;
}
