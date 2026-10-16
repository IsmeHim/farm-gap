import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const pestsRouter = Router();
pestsRouter.use(authRequired);

// Ensure source_type and source_id exist on crop_activities
pool.query('ALTER TABLE crop_activities ADD COLUMN source_type VARCHAR(32) NULL').catch(() => {});
pool.query('ALTER TABLE crop_activities ADD COLUMN source_id INT NULL').catch(() => {});

const logAudit = async (action, recordId, userEmail, oldRow, newRow) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (table_name, record_id, action, user_email, old_values, new_values) VALUES (?,?,?,?,?,?)',
      ['pest_logs', recordId, action, userEmail, oldRow ? JSON.stringify(oldRow) : null, newRow ? JSON.stringify(newRow) : null]
    );
  } catch (e) {
    console.warn('Failed to write audit log in pestsRouter:', e.message);
  }
};

function formatPestActivity(row) {
  const mainTitle = row.pest_or_disease || row.damage_cause || 'สำรวจแปลง/ศัตรูพืช';
  const lossCount = Number(row.damaged_count) || 0;
  const unit = row.damage_unit || 'ต้น';
  const severity = row.severity || 'น้อย';

  const title =
    lossCount > 0
      ? `บันทึกความเสียหาย/ศัตรูพืช: ${mainTitle} (เสียหาย ${lossCount} ${unit})`
      : `สำรวจ/จัดการศัตรูพืชและโรค: ${mainTitle} (ความรุนแรง: ${severity})`;

  const detailParts = [
    `สาเหตุ/อาการ: ${row.damage_cause || mainTitle}`,
    `ความรุนแรง: ${severity}`,
    lossCount > 0 ? `จำนวนที่เสียหาย: ${lossCount} ${unit}` : 'ไม่พบต้นเสียหาย (0 ต้น)',
  ];
  if (row.notes) detailParts.push(`หมายเหตุ: ${row.notes}`);

  const details = detailParts.join(' | ');
  const materials_used = row.treatment_method
    ? `วิธีจัดการ/การรักษา: ${row.treatment_method}`
    : null;

  return { title, details, materials_used };
}

// Backfill existing pest_logs into crop_activities on startup if not yet synced
export async function syncExistingPestLogsToActivities() {
  try {
    // 1. Link legacy crop_activities that were created from pest_logs before source_type existed
    await pool.query(`
      UPDATE crop_activities a
      INNER JOIN pest_logs p
        ON a.plot_id = p.plot_id
       AND a.activity_date = p.log_date
       AND a.title LIKE CONCAT('บันทึกความเสียหาย/ศัตรูพืช: ', p.pest_or_disease, '%')
      SET a.source_type = 'pest', a.source_id = p.id
      WHERE a.source_type IS NULL
    `);

    // 2. Insert any remaining unlinked pest_logs into crop_activities
    const [unlinked] = await pool.query(`
      SELECT p.*
      FROM pest_logs p
      LEFT JOIN crop_activities a
        ON a.source_type = 'pest' AND a.source_id = p.id
      WHERE a.id IS NULL AND p.plot_id IS NOT NULL
    `);

    for (const row of unlinked) {
      const { title, details, materials_used } = formatPestActivity(row);
      await pool.query(
        `INSERT INTO crop_activities
          (user_id, plot_id, batch_id, activity_date, stage, title, details, materials_used, operator_name, source_type, source_id)
         VALUES (?, ?, ?, ?, 'maintenance', ?, ?, ?, ?, 'pest', ?)`,
        [
          row.user_id,
          row.plot_id,
          row.batch_id || null,
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
    console.warn('Backfill pest_logs to crop_activities warning:', err.message);
  }
}

// GET /api/pests - ดึงรายการบันทึกศัตรูพืชและผลผลิตเสียหาย
pestsRouter.get('/', async (req, res) => {
  try {
    const { plot_id } = req.query;
    let sql = `
      SELECT p.*,
             pl.name AS plot_name,
             pl.crop_name,
             b.batch_code,
             b.initial_count AS batch_initial_count,
             b.remaining_count AS batch_remaining_count
      FROM pest_logs p
      LEFT JOIN plots pl ON pl.id = p.plot_id
      LEFT JOIN planting_batches b ON b.id = p.batch_id
      WHERE p.user_id = ?
    `;
    const params = [req.user.id];
    if (plot_id) {
      sql += ' AND p.plot_id = ?';
      params.push(plot_id);
    }
    sql += ' ORDER BY p.log_date DESC, p.id DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pests/:id
pestsRouter.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, pl.name AS plot_name, pl.crop_name, b.batch_code
       FROM pest_logs p
       LEFT JOIN plots pl ON pl.id = p.plot_id
       LEFT JOIN planting_batches b ON b.id = p.batch_id
       WHERE p.id = ? AND p.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'ไม่พบบันทึก' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pests - บันทึกโรค/ศัตรูพืช/ความเสียหาย พร้อมตัดยอดจำนวนต้นในรอบปลูกอัตโนมัติ และ Sync ลงไทม์ไลน์กิจกรรมทุกครั้ง
pestsRouter.post('/', async (req, res) => {
  try {
    const {
      plot_id,
      batch_id,
      log_date = new Date().toISOString().split('T')[0],
      pest_or_disease,
      damaged_count = 0,
      damage_cause = null,
      damage_unit = 'ต้น',
      severity = 'น้อย',
      treatment_method = '',
      worker_name,
      notes = '',
    } = req.body;

    if (!plot_id) {
      return res.status(400).json({ error: 'กรุณาเลือกแปลงปลูก' });
    }
    if (!pest_or_disease && !damage_cause) {
      return res.status(400).json({ error: 'กรุณาระบุชื่อโรค ศัตรูพืช หรือสาเหตุความเสียหาย' });
    }

    const lossCount = Number(damaged_count) || 0;
    const worker = worker_name || req.user.display_name || 'เจ้าของฟาร์ม';
    const mainTitle = pest_or_disease || damage_cause || 'พบความเสียหาย';

    // 1. ตรวจสอบรอบการปลูกที่เกี่ยวข้อง
    let targetBatchId = batch_id;
    let targetBatch = null;

    if (targetBatchId) {
      const [bRows] = await pool.query(
        'SELECT * FROM planting_batches WHERE id = ? AND user_id = ?',
        [targetBatchId, req.user.id]
      );
      if (bRows[0]) targetBatch = bRows[0];
    }

    if (!targetBatch) {
      const [activeBatches] = await pool.query(
        'SELECT * FROM planting_batches WHERE plot_id = ? AND user_id = ? AND status IN ("growing", "harvest_ready") ORDER BY id DESC LIMIT 1',
        [plot_id, req.user.id]
      );
      if (activeBatches[0]) {
        targetBatch = activeBatches[0];
        targetBatchId = targetBatch.id;
      }
    }

    // 2. บันทึกลง pest_logs
    const [result] = await pool.query(
      `INSERT INTO pest_logs (
        user_id, plot_id, batch_id, log_date, pest_or_disease,
        damaged_count, damage_cause, damage_unit, severity,
        treatment_method, worker_name, notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        plot_id,
        targetBatchId || null,
        log_date,
        mainTitle,
        lossCount,
        damage_cause || null,
        damage_unit || 'ต้น',
        severity || 'น้อย',
        treatment_method || null,
        worker,
        notes || null,
        req.user.email,
        req.user.email,
      ]
    );

    // 3. หากมีความเสียหายและพบ active batch ให้ตัดยอดคงเหลือใน planting_batches ทันที
    if (lossCount > 0 && targetBatch) {
      await pool.query(
        `UPDATE planting_batches
         SET total_damaged_count = COALESCE(total_damaged_count, 0) + ?,
             remaining_count = GREATEST(0, COALESCE(remaining_count, initial_count, 0) - ?),
             updated_at = NOW()
         WHERE id = ?`,
        [lossCount, lossCount, targetBatch.id]
      );
    }

    const [newRow] = await pool.query('SELECT * FROM pest_logs WHERE id = ?', [result.insertId]);

    // 4. บันทึกลง crop_activities ทุกครั้ง (ไม่ว่าจะมีต้นเสียหาย > 0 หรือ = 0 ก็ตาม)
    const { title, details, materials_used } = formatPestActivity(newRow[0]);
    await pool.query(
      `INSERT INTO crop_activities (
        user_id, plot_id, batch_id, activity_date, stage,
        title, details, materials_used, operator_name, source_type, source_id
      ) VALUES (?, ?, ?, ?, 'maintenance', ?, ?, ?, ?, 'pest', ?)`,
      [
        req.user.id,
        plot_id,
        targetBatchId || null,
        log_date,
        title,
        details,
        materials_used,
        worker,
        result.insertId,
      ]
    );

    await logAudit('insert', result.insertId, req.user.email, null, newRow[0]);

    res.status(201).json({
      success: true,
      log: newRow[0],
      auto_deducted: lossCount > 0 && !!targetBatch,
      message:
        lossCount > 0 && targetBatch
          ? `บันทึกสำเร็จ ซิงค์ลงไทม์ไลน์กิจกรรม และตัดยอดความเสียหาย ${lossCount} ${damage_unit || 'ต้น'} ออกจากรอบปลูก ${targetBatch.batch_code} เรียบร้อยแล้ว`
          : 'บันทึกข้อมูลศัตรูพืช/โรค และซิงค์ลงไทม์ไลน์กิจกรรมแปลงปลูกสำเร็จ',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pests/:id - แก้ไขบันทึก พร้อมปรับยอดส่วนต่างและ Sync ไทม์ไลน์กิจกรรมอัตโนมัติ
pestsRouter.put('/:id', async (req, res) => {
  try {
    const [oldRows] = await pool.query(
      'SELECT * FROM pest_logs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!oldRows[0]) return res.status(404).json({ error: 'ไม่พบบันทึกนี้' });
    const oldRow = oldRows[0];

    const {
      plot_id = oldRow.plot_id,
      batch_id = oldRow.batch_id,
      log_date = oldRow.log_date,
      pest_or_disease = oldRow.pest_or_disease,
      damaged_count = oldRow.damaged_count,
      damage_cause = oldRow.damage_cause,
      damage_unit = oldRow.damage_unit,
      severity = oldRow.severity,
      treatment_method = oldRow.treatment_method,
      worker_name = oldRow.worker_name,
      notes = oldRow.notes,
    } = req.body;

    const newLossCount = Number(damaged_count) || 0;
    const oldLossCount = Number(oldRow.damaged_count) || 0;
    const diff = newLossCount - oldLossCount;

    // อัปเดตตาราง pest_logs
    await pool.query(
      `UPDATE pest_logs SET
        plot_id = ?,
        batch_id = ?,
        log_date = ?,
        pest_or_disease = ?,
        damaged_count = ?,
        damage_cause = ?,
        damage_unit = ?,
        severity = ?,
        treatment_method = ?,
        worker_name = ?,
        notes = ?,
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        plot_id,
        batch_id || null,
        log_date,
        pest_or_disease,
        newLossCount,
        damage_cause || null,
        damage_unit || 'ต้น',
        severity || 'น้อย',
        treatment_method || null,
        worker_name || req.user.display_name,
        notes || null,
        req.user.email,
        req.params.id,
        req.user.id,
      ]
    );

    // ปรับยอดใน planting_batches หากมียอดส่วนต่าง diff
    const effectiveBatchId = batch_id || oldRow.batch_id;
    if (diff !== 0 && effectiveBatchId) {
      await pool.query(
        `UPDATE planting_batches
         SET total_damaged_count = GREATEST(0, COALESCE(total_damaged_count, 0) + ?),
             remaining_count = GREATEST(0, COALESCE(remaining_count, initial_count, 0) - ?),
             updated_at = NOW()
         WHERE id = ?`,
        [diff, diff, effectiveBatchId]
      );
    }

    const [updatedRows] = await pool.query('SELECT * FROM pest_logs WHERE id = ?', [req.params.id]);
    const updatedRow = updatedRows[0];

    // Sync update to crop_activities
    const { title, details, materials_used } = formatPestActivity(updatedRow);
    const [existingAct] = await pool.query(
      "SELECT id FROM crop_activities WHERE source_type = 'pest' AND source_id = ? AND user_id = ?",
      [updatedRow.id, req.user.id]
    );

    if (existingAct[0]) {
      await pool.query(
        `UPDATE crop_activities
         SET plot_id = ?, batch_id = ?, activity_date = ?, title = ?, details = ?, materials_used = ?, operator_name = ?
         WHERE id = ? AND user_id = ?`,
        [
          updatedRow.plot_id,
          effectiveBatchId || null,
          updatedRow.log_date,
          title,
          details,
          materials_used,
          updatedRow.worker_name || 'เจ้าของฟาร์ม',
          existingAct[0].id,
          req.user.id,
        ]
      );
    } else if (updatedRow.plot_id) {
      await pool.query(
        `INSERT INTO crop_activities (
          user_id, plot_id, batch_id, activity_date, stage,
          title, details, materials_used, operator_name, source_type, source_id
        ) VALUES (?, ?, ?, ?, 'maintenance', ?, ?, ?, ?, 'pest', ?)`,
        [
          req.user.id,
          updatedRow.plot_id,
          effectiveBatchId || null,
          updatedRow.log_date,
          title,
          details,
          materials_used,
          updatedRow.worker_name || 'เจ้าของฟาร์ม',
          updatedRow.id,
        ]
      );
    }

    await logAudit('update', req.params.id, req.user.email, oldRow, updatedRow);

    res.json({
      success: true,
      log: updatedRow,
      message: 'แก้ไขบันทึกและอัปเดตไทม์ไลน์กิจกรรมสำเร็จ',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pests/:id - ลบบันทึก พร้อมคืนยอดจำนวนต้นกลับเข้ารอบปลูก และลบจากไทม์ไลน์กิจกรรม
pestsRouter.delete('/:id', async (req, res) => {
  try {
    const [oldRows] = await pool.query(
      'SELECT * FROM pest_logs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!oldRows[0]) return res.status(404).json({ error: 'ไม่พบบันทึกนี้' });
    const oldRow = oldRows[0];

    // คืนยอดจำนวนต้นที่เคยหักไปกลับเข้า batch
    const lossCount = Number(oldRow.damaged_count) || 0;
    if (lossCount > 0 && oldRow.batch_id) {
      await pool.query(
        `UPDATE planting_batches
         SET total_damaged_count = GREATEST(0, COALESCE(total_damaged_count, 0) - ?),
             remaining_count = COALESCE(remaining_count, 0) + ?,
             updated_at = NOW()
         WHERE id = ?`,
        [lossCount, lossCount, oldRow.batch_id]
      );
    }

    await pool.query('DELETE FROM pest_logs WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);

    // ลบรายการที่ซิงค์ไว้ใน crop_activities ด้วย
    await pool.query(
      "DELETE FROM crop_activities WHERE source_type = 'pest' AND source_id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );

    await logAudit('delete', req.params.id, req.user.email, oldRow, null);

    res.json({ success: true, message: 'ลบบันทึกเรียบร้อย' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default pestsRouter;
