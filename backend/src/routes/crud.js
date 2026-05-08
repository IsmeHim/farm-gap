import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

// Generic CRUD scoped by user_id
export function crudRouter(table, fields) {
  const r = Router();
  r.use(authRequired);

  r.get('/', async (req, res) => {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE user_id=? ORDER BY id DESC`, [req.user.id]);
    res.json(rows);
  });

  r.post('/', async (req, res) => {
    const cols = ['user_id', ...fields];
    const vals = [req.user.id, ...fields.map(f => req.body[f] ?? null)];
    const placeholders = cols.map(() => '?').join(',');
    try {
      const [result] = await pool.query(
        `INSERT INTO \`${table}\` (${cols.map(c=>`\`${c}\``).join(',')}) VALUES (${placeholders})`,
        vals
      );
      const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id=?`, [result.insertId]);
      res.json(rows[0]);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.put('/:id', async (req, res) => {
    const sets = fields.map(f => `\`${f}\`=?`).join(',');
    const vals = [...fields.map(f => req.body[f] ?? null), req.params.id, req.user.id];
    await pool.query(`UPDATE \`${table}\` SET ${sets} WHERE id=? AND user_id=?`, vals);
    res.json({ ok: true });
  });

  r.delete('/:id', async (req, res) => {
    await pool.query(`DELETE FROM \`${table}\` WHERE id=? AND user_id=?`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  });

  return r;
}
