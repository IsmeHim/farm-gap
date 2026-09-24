import { Router } from 'express';
import { crudRouter } from './crud.js';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const plotsRouter = Router();
plotsRouter.use(authRequired);

// รายการรอบการปลูกทั้งหมด (All Crop Cycles History)
plotsRouter.get('/cycles', async (req, res) => {
  try {
    const { plot_id } = req.query;
    let query = `
      SELECT c.*, p.name as plot_name, p.water_source, p.area_sqm
      FROM crop_cycles c
      JOIN plots p ON p.id = c.plot_id
      WHERE c.user_id = ?
    `;
    const params = [req.user.id];
    if (plot_id) {
      query += ' AND c.plot_id = ?';
      params.push(plot_id);
    }
    query += ' ORDER BY c.id DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// เริ่มรอบการปลูกใหม่บนแปลงเดิม (Start New Crop Cycle on existing plot)
plotsRouter.post('/:id/new-crop', async (req, res) => {
  try {
    const {
      crop_name,
      planting_date,
      expected_harvest_date,
      area_sqm,
      default_water_liters,
      default_worker_name,
      water_source,
      water_source_type,
      soil_notes,
      notes,
    } = req.body;

    if (!crop_name) return res.status(400).json({ error: 'กรุณาระบุชื่อพืชที่จะปลูกรอบใหม่' });

    const [plots] = await pool.query('SELECT * FROM plots WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!plots[0]) return res.status(404).json({ error: 'ไม่พบแปลงปลูกนี้' });
    const current = plots[0];

    // Archive current/previous crop into previous_crop_history text
    const prevHistory = current.previous_crop_history || '';
    const oldPlantDate = current.planting_date ? new Date(current.planting_date).toISOString().split('T')[0] : '-';
    const archiveEntry = `[รอบที่ ${current.cycle_number || 1}] ${current.crop_name} (วันปลูก: ${oldPlantDate} | สถานะเดิม: ${current.status})`;
    const updatedHistory = prevHistory ? `${prevHistory}\n${archiveEntry}` : archiveEntry;

    const newCycle = (current.cycle_number || 1) + 1;
    const pDate = planting_date || new Date().toISOString().split('T')[0];

    // Close any previous active cycle for this plot in crop_cycles and sync harvest info if available
    const [lastHarvest] = await pool.query(
      'SELECT quantity, unit, quality_grade, lot_code, harvest_date FROM harvest_logs WHERE plot_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
      [req.params.id, req.user.id]
    );

    if (lastHarvest.length > 0) {
      const h = lastHarvest[0];
      await pool.query(
        `UPDATE crop_cycles 
         SET status = 'harvested',
             harvest_quantity = COALESCE(harvest_quantity, ?),
             harvest_unit = COALESCE(harvest_unit, ?),
             quality_grade = COALESCE(quality_grade, ?),
             lot_code = COALESCE(lot_code, ?),
             harvest_date = COALESCE(harvest_date, ?)
         WHERE plot_id = ? AND user_id = ? AND status = 'active'`,
        [h.quantity, h.unit, h.quality_grade, h.lot_code, h.harvest_date, req.params.id, req.user.id]
      );
    } else {
      await pool.query(
        `UPDATE crop_cycles SET status = 'harvested' WHERE plot_id = ? AND user_id = ? AND status = 'active'`,
        [req.params.id, req.user.id]
      );
    }

    // Insert new cycle into crop_cycles
    const cleanName = (current.name || '').replace(/แปลง|\s|\(.*?\)/g, '').trim() || (`P${current.id}`);
    const cycleCode = `BATCH-${cleanName}-R${newCycle}`;
    await pool.query(
      `INSERT INTO crop_cycles (user_id, plot_id, cycle_number, cycle_code, crop_name, planting_date, expected_harvest_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        req.user.id,
        req.params.id,
        newCycle,
        cycleCode,
        crop_name,
        pDate,
        expected_harvest_date || null,
        notes || null
      ]
    );

    await pool.query(
      `UPDATE plots SET 
        crop_name = ?,
        planting_date = ?,
        expected_harvest_date = ?,
        area_sqm = COALESCE(?, area_sqm),
        default_water_liters = COALESCE(?, default_water_liters),
        default_worker_name = COALESCE(?, default_worker_name),
        water_source = COALESCE(?, water_source),
        water_source_type = COALESCE(?, water_source_type),
        soil_notes = COALESCE(?, soil_notes),
        soil_recipe = COALESCE(?, soil_recipe),
        previous_crop_history = ?,
        status = 'active',
        cycle_number = ?,
        notes = COALESCE(?, notes),
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        crop_name,
        pDate,
        expected_harvest_date || null,
        area_sqm || null,
        default_water_liters || null,
        default_worker_name || null,
        water_source || null,
        water_source_type || null,
        soil_notes || null,
        soil_recipe || null,
        updatedHistory,
        newCycle,
        notes || null,
        req.user.email,
        req.params.id,
        req.user.id,
      ]
    );

    const [updatedRows] = await pool.query('SELECT * FROM plots WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      plot: updatedRows[0],
      message: `เริ่มรอบการปลูกใหม่ (${crop_name} - รอบที่ ${newCycle}) บนแปลง ${current.name} สำเร็จ!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. ดึงรายการแปลงปลูกทั้งหมด เรียงจากแคร่ที่ 1 -> 2 -> 3 -> 4 -> 5 -> 6 (Ascending Order)
plotsRouter.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*,
              COALESCE(b.id, ab.id) AS batch_id,
              COALESCE(b.batch_code, ab.batch_code) AS batch_code,
              COALESCE(b.initial_count, ab.initial_count) AS initial_count,
              COALESCE(b.remaining_count, ab.remaining_count) AS remaining_count,
              COALESCE(b.planting_unit, ab.planting_unit) AS planting_unit,
              COALESCE(b.total_damaged_count, ab.total_damaged_count, 0) AS total_damaged_count,
              COALESCE(b.total_harvested_count, ab.total_harvested_count, 0) AS total_harvested_count,
              COALESCE(b.notes, ab.notes) AS batch_notes
       FROM plots p
       LEFT JOIN planting_batches b ON b.id = p.current_batch_id
       LEFT JOIN (
         SELECT b1.*
         FROM planting_batches b1
         INNER JOIN (
           SELECT plot_id, MAX(id) AS max_id
           FROM planting_batches
           WHERE status IN ('growing', 'harvest_ready')
           GROUP BY plot_id
         ) b2 ON b1.id = b2.max_id
       ) ab ON ab.plot_id = p.id
       WHERE p.user_id = ?
       ORDER BY COALESCE(p.plot_number, p.id) ASC, p.id ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. เพิ่มแปลง/แคร่ปลูกใหม่ (Add New Plot / Tray)
plotsRouter.post('/', async (req, res) => {
  try {
    let {
      name,
      plot_number,
      dimension,
      area_sqm,
      soil_recipe,
      water_source,
      water_source_type,
      notes,
    } = req.body;

    // หาเลขแปลงถัดไปอัตโนมัติหากไม่ได้ระบุ
    if (!plot_number || isNaN(Number(plot_number))) {
      const [maxPlot] = await pool.query(
        'SELECT MAX(plot_number) as max_num FROM plots WHERE user_id = ?',
        [req.user.id]
      );
      plot_number = (maxPlot[0]?.max_num || 0) + 1;
    } else {
      plot_number = Number(plot_number);
    }

    if (!name || !name.trim()) {
      name = `แปลง/แคร่ที่ ${plot_number}`;
    }

    dimension = dimension?.trim() || 'แคร่ 2 x 6 เมตร';
    area_sqm = Number(area_sqm) || 12.00;
    soil_recipe = soil_recipe?.trim() || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)';
    water_source = water_source?.trim() || 'น้ำประปา/บ่อพักน้ำมาตรฐาน GAP';
    water_source_type = water_source_type?.trim() || 'tap';

    const [result] = await pool.query(
      `INSERT INTO plots (
        user_id, plot_number, name, dimension, area_sqm, 
        soil_recipe, crop_name, status, water_source, water_source_type, 
        notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, '-', 'empty', ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        plot_number,
        name,
        dimension,
        area_sqm,
        soil_recipe,
        water_source,
        water_source_type,
        notes || null,
        req.user.email,
        req.user.email,
      ]
    );

    const [newPlot] = await pool.query('SELECT * FROM plots WHERE id = ?', [result.insertId]);
    res.status(201).json(newPlot[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. ลบแปลงปลูก (Delete Plot - ลบได้เฉพาะแปลงที่ว่าง)
plotsRouter.delete('/:id', async (req, res) => {
  try {
    const [plots] = await pool.query('SELECT * FROM plots WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!plots[0]) return res.status(404).json({ error: 'ไม่พบแปลงปลูกนี้' });
    const plot = plots[0];

    if (plot.status === 'growing' || plot.status === 'harvest_ready') {
      return res.status(400).json({
        error: `ไม่สามารถลบ "${plot.name}" ได้ เนื่องจากยังมีผักที่กำลังปลูกอยู่ (${plot.crop_name}) กรุณาเก็บเกี่ยวก่อนลบแปลง`,
      });
    }

    // ลบรอบการปลูกที่เกี่ยวข้องใน crop_cycles (ถ้ามี)
    await pool.query('DELETE FROM crop_cycles WHERE plot_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    // ลบแปลง
    await pool.query('DELETE FROM plots WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    res.json({
      success: true,
      message: `ลบ "${plot.name}" เรียบร้อยแล้ว`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. รีเซ็ตแปลงปลูกกลับเป็นสถานะว่าง และยกเลิกรอบปลูกที่กำลังปลูก (Reset Plot to Empty)
plotsRouter.post('/:id/reset', async (req, res) => {
  try {
    const [plots] = await pool.query('SELECT * FROM plots WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!plots[0]) return res.status(404).json({ error: 'ไม่พบแปลงปลูกนี้' });
    const plot = plots[0];

    // ลบ planting_batches ที่กำลังปลูกหรือพร้อมเก็บเกี่ยวของแปลงนี้
    await pool.query(
      `DELETE FROM planting_batches 
       WHERE plot_id = ? AND user_id = ? AND status IN ('growing', 'harvest_ready')`,
      [req.params.id, req.user.id]
    );

    // ลบ crop_cycles ที่ยัง active
    await pool.query(
      `DELETE FROM crop_cycles WHERE plot_id = ? AND user_id = ? AND status = 'active'`,
      [req.params.id, req.user.id]
    );

    // รีเซ็ตสถานะแปลงให้กลับมาว่าง
    await pool.query(
      `UPDATE plots 
       SET status = 'empty',
           crop_name = '-',
           planting_date = NULL,
           expected_harvest_date = NULL,
           current_batch_id = NULL,
           updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    res.json({
      success: true,
      message: `รีเซ็ต "${plot.name}" กลับเป็นแปลงว่างเรียบร้อยแล้ว`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware to auto-calculate expected_harvest_date if growth_days is passed
plotsRouter.use('/', (req, res, next) => {
  if (['POST', 'PUT'].includes(req.method) && req.body) {
    const { planting_date, growth_days, days, expected_harvest_date } = req.body;
    const daysNum = parseInt(growth_days || days, 10);
    if (planting_date && daysNum && !expected_harvest_date) {
      const d = new Date(planting_date);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + daysNum);
        req.body.expected_harvest_date = d.toISOString().split('T')[0];
      }
    }
  }
  next();
});

// Standard CRUD fallback with all fields included
plotsRouter.use('/', crudRouter('plots', [
  'name',
  'crop_name',
  'area_sqm',
  'planting_date',
  'expected_harvest_date',
  'water_source',
  'water_source_type',
  'soil_test_date',
  'soil_test_result',
  'previous_crop_history',
  'field_safety_status',
  'soil_notes',
  'soil_recipe',
  'dimension',
  'plot_number',
  'status',
  'notes',
  'default_water_liters',
  'default_worker_name',
  'cycle_number',
  'auto_water_enabled',
]));
