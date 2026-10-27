import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const chemicalsRouter = Router();
chemicalsRouter.use(authRequired);

// Ensure source_type and source_id exist on crop_activities, and batch_id on chemical_logs
pool.query('ALTER TABLE crop_activities ADD COLUMN source_type VARCHAR(32) NULL').catch(() => {});
pool.query('ALTER TABLE crop_activities ADD COLUMN source_id INT NULL').catch(() => {});
pool.query('ALTER TABLE chemical_logs ADD COLUMN batch_id INT NULL AFTER plot_id').catch(() => {});

const logAudit = async (action, recordId, userEmail, oldRow, newRow) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (table_name, record_id, action, user_email, old_values, new_values) VALUES (?,?,?,?,?,?)',
      ['chemical_logs', recordId, action, userEmail, oldRow ? JSON.stringify(oldRow) : null, newRow ? JSON.stringify(newRow) : null]
    );
  } catch (e) {
    console.warn('Failed to write audit log in chemicalsRouter:', e.message);
  }
};

// Helper to build activity title, details, and materials_used from a chemical_log row
function formatChemicalActivity(row) {
  const chemType = row.chem_type || 'ปุ๋ย/ชีวภัณฑ์';
  const prodName = row.product_name || 'ปัจจัยการผลิต';
  const amountStr = row.amount ? ` ${row.amount} ${row.unit || 'ml'}` : '';
  const methodStr = row.application_method ? ` (${row.application_method})` : '';

  const title = `ให้${chemType}: ${prodName}${amountStr}${methodStr}`;

  const detailParts = [];
  if (row.application_method) detailParts.push(`วิธีการใช้: ${row.application_method}`);
  if (row.reason) detailParts.push(`วัตถุประสงค์: ${row.reason}`);
  const phi = Number(row.phi_days) || 0;
  detailParts.push(`ระยะปลอดภัยก่อนเก็บเกี่ยว (PHI): ${phi} วัน`);
  if (row.notes) detailParts.push(`หมายเหตุ: ${row.notes}`);

  const details = detailParts.join(' | ');
  const ppeText = row.safety_ppe ? ' [สวมอุปกรณ์ป้องกัน PPE]' : '';
  const materials_used = `${prodName}${amountStr}${ppeText}`;

  return { title, details, materials_used };
}

// Helper to resolve active batch_id for a plot
async function resolveTargetBatchId(plotId, userId, explicitBatchId = null) {
  if (explicitBatchId) return explicitBatchId;
  if (!plotId) return null;

  const [plotRows] = await pool.query(
    'SELECT current_batch_id FROM plots WHERE id = ? AND user_id = ?',
    [plotId, userId]
  );
  if (plotRows[0]?.current_batch_id) {
    return plotRows[0].current_batch_id;
  }

  const [activeBatches] = await pool.query(
    'SELECT id FROM planting_batches WHERE plot_id = ? AND user_id = ? AND status IN ("growing", "harvest_ready") ORDER BY id DESC LIMIT 1',
    [plotId, userId]
  );
  return activeBatches[0]?.id || null;
}

// Backfill existing chemical_logs into crop_activities on startup if not yet synced
export async function syncExistingChemicalLogsToActivities() {
  try {
    const [unlinked] = await pool.query(`
      SELECT c.*
      FROM chemical_logs c
      LEFT JOIN crop_activities a
        ON a.source_type = 'chemical' AND a.source_id = c.id
      WHERE a.id IS NULL AND c.plot_id IS NOT NULL
    `);

    for (const row of unlinked) {
      const batchId = row.batch_id || (await resolveTargetBatchId(row.plot_id, row.user_id));
      const { title, details, materials_used } = formatChemicalActivity(row);
      await pool.query(
        `INSERT INTO crop_activities
          (user_id, plot_id, batch_id, activity_date, stage, title, details, materials_used, operator_name, source_type, source_id)
         VALUES (?, ?, ?, ?, 'maintenance', ?, ?, ?, ?, 'chemical', ?)`,
        [
          row.user_id,
          row.plot_id,
          batchId,
          row.log_date,
          title,
          details,
          materials_used,
          row.worker_name || 'เจ้าของฟาร์ม',
          row.id,
        ]
      );
    }
  } catch (err) {
    console.warn('Backfill chemical_logs to crop_activities warning:', err.message);
  }
}

// GET /api/chemicals
chemicalsRouter.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM chemical_logs WHERE user_id = ? ORDER BY log_date DESC, id DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chemicals/:id
chemicalsRouter.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM chemical_logs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'ไม่พบบันทึก' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chemicals - บันทึกปุ๋ย/สารเคมี/ชีวภัณฑ์ พร้อม Sync ลงไทม์ไลน์กิจกรรมแปลงปลูก (crop_activities) อัตโนมัติ
chemicalsRouter.post('/', async (req, res) => {
  try {
    const {
      plot_id,
      batch_id,
      log_date = new Date().toISOString().split('T')[0],
      chem_type = 'ปุ๋ย',
      product_name,
      amount = null,
      unit = 'ml',
      reason = null,
      application_method = 'พ่น',
      safety_ppe = 1,
      manufacturer = null,
      chemical_label = null,
      phi_days = 0,
      worker_name,
      notes = null,
    } = req.body;

    if (!plot_id) {
      return res.status(400).json({ error: 'กรุณาเลือกแปลงปลูก' });
    }
    if (!product_name) {
      return res.status(400).json({ error: 'กรุณาระบุชื่อผลิตภัณฑ์/ปุ๋ย/ชีวภัณฑ์' });
    }

    let worker = (worker_name || '').trim();
    if (!worker || worker === 'เจ้าของฟาร์ม') {
      const [uRows] = await pool.query('SELECT display_name FROM users WHERE id = ?', [req.user.id]);
      worker = uRows[0]?.display_name || req.user.display_name || 'เจ้าของฟาร์ม';
    }
    const targetBatchId = await resolveTargetBatchId(plot_id, req.user.id, batch_id);

    const [result] = await pool.query(
      `INSERT INTO chemical_logs (
        user_id, plot_id, batch_id, log_date, chem_type, product_name,
        amount, unit, reason, application_method, safety_ppe,
        manufacturer, chemical_label, phi_days, worker_name, notes,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        plot_id,
        targetBatchId,
        log_date,
        chem_type,
        product_name,
        amount ?? null,
        unit || 'ml',
        reason || null,
        application_method || 'พ่น',
        safety_ppe ? 1 : 0,
        manufacturer || null,
        chemical_label || null,
        Number(phi_days) || 0,
        worker,
        notes || null,
        req.user.email,
        req.user.email,
      ]
    );

    const [newRows] = await pool.query('SELECT * FROM chemical_logs WHERE id = ?', [result.insertId]);
    const newRow = newRows[0];

    // Auto-Sync ลงตาราง crop_activities เพื่อแสดงในไทม์ไลน์ของแปลงปลูกทันที
    const { title, details, materials_used } = formatChemicalActivity(newRow);
    await pool.query(
      `INSERT INTO crop_activities (
        user_id, plot_id, batch_id, activity_date, stage,
        title, details, materials_used, operator_name, source_type, source_id
      ) VALUES (?, ?, ?, ?, 'maintenance', ?, ?, ?, ?, 'chemical', ?)`,
      [
        req.user.id,
        plot_id,
        targetBatchId,
        log_date,
        title,
        details,
        materials_used,
        worker,
        newRow.id,
      ]
    );

    await logAudit('insert', newRow.id, req.user.email, null, newRow);
    res.status(201).json(newRow);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/chemicals/:id - แก้ไขบันทึกปุ๋ย/สารเคมี พร้อม Sync แก้ไขในไทม์ไลน์กิจกรรมแปลงปลูก
chemicalsRouter.put('/:id', async (req, res) => {
  try {
    const [oldRows] = await pool.query(
      'SELECT * FROM chemical_logs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!oldRows[0]) return res.status(404).json({ error: 'ไม่พบบันทึกนี้' });
    const oldRow = oldRows[0];

    const fields = [
      'plot_id',
      'batch_id',
      'log_date',
      'chem_type',
      'product_name',
      'amount',
      'unit',
      'reason',
      'application_method',
      'safety_ppe',
      'manufacturer',
      'chemical_label',
      'phi_days',
      'worker_name',
      'notes',
    ];

    const updatedValues = fields.map((f) =>
      req.body[f] !== undefined ? req.body[f] : oldRow[f]
    );

    const sets = [
      ...fields.map((f) => `\`${f}\` = ?`),
      '`updated_by` = ?',
      '`updated_at` = CURRENT_TIMESTAMP',
    ].join(', ');

    await pool.query(
      `UPDATE chemical_logs SET ${sets} WHERE id = ? AND user_id = ?`,
      [...updatedValues, req.user.email, req.params.id, req.user.id]
    );

    const [newRows] = await pool.query('SELECT * FROM chemical_logs WHERE id = ?', [req.params.id]);
    const newRow = newRows[0];

    // Sync update to crop_activities
    const targetBatchId =
      newRow.batch_id || (await resolveTargetBatchId(newRow.plot_id, req.user.id));
    const { title, details, materials_used } = formatChemicalActivity(newRow);

    const [existingAct] = await pool.query(
      "SELECT id FROM crop_activities WHERE source_type = 'chemical' AND source_id = ? AND user_id = ?",
      [newRow.id, req.user.id]
    );

    if (existingAct[0]) {
      await pool.query(
        `UPDATE crop_activities
         SET plot_id = ?, batch_id = ?, activity_date = ?, title = ?, details = ?, materials_used = ?, operator_name = ?
         WHERE id = ? AND user_id = ?`,
        [
          newRow.plot_id,
          targetBatchId,
          newRow.log_date,
          title,
          details,
          materials_used,
          newRow.worker_name || 'เจ้าของฟาร์ม',
          existingAct[0].id,
          req.user.id,
        ]
      );
    } else if (newRow.plot_id) {
      await pool.query(
        `INSERT INTO crop_activities (
          user_id, plot_id, batch_id, activity_date, stage,
          title, details, materials_used, operator_name, source_type, source_id
        ) VALUES (?, ?, ?, ?, 'maintenance', ?, ?, ?, ?, 'chemical', ?)`,
        [
          req.user.id,
          newRow.plot_id,
          targetBatchId,
          newRow.log_date,
          title,
          details,
          materials_used,
          newRow.worker_name || 'เจ้าของฟาร์ม',
          newRow.id,
        ]
      );
    }

    await logAudit('update', newRow.id, req.user.email, oldRow, newRow);
    res.json(newRow);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/chemicals/:id - ลบบันทึกปุ๋ย/สารเคมี พร้อมลบรายการในไทม์ไลน์กิจกรรมแปลงปลูก
chemicalsRouter.delete('/:id', async (req, res) => {
  try {
    const [oldRows] = await pool.query(
      'SELECT * FROM chemical_logs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!oldRows[0]) return res.status(404).json({ error: 'ไม่พบบันทึกนี้' });

    await pool.query('DELETE FROM chemical_logs WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);

    // ลบรายการที่ซิงค์ไว้ใน crop_activities ด้วย
    await pool.query(
      "DELETE FROM crop_activities WHERE source_type = 'chemical' AND source_id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );

    await logAudit('delete', req.params.id, req.user.email, oldRows[0], null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default chemicalsRouter;
