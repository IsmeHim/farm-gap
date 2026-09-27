import { Router } from 'express';
import { crudRouter } from './crud.js';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const plotsRouter = Router();
plotsRouter.use(authRequired);

// Ensure soil_prep_date, seed_prep_date, seed_notes, seed_crop_id columns exist on plots
pool.query('ALTER TABLE plots ADD COLUMN soil_prep_date DATE NULL AFTER soil_recipe').catch(() => {});
pool.query('ALTER TABLE plots ADD COLUMN seed_prep_date DATE NULL AFTER soil_prep_date').catch(() => {});
pool.query('ALTER TABLE plots ADD COLUMN seed_notes TEXT NULL AFTER seed_prep_date').catch(() => {});
pool.query('ALTER TABLE plots ADD COLUMN seed_crop_id INT NULL AFTER seed_notes').catch(() => {});


// 1. ดึงรายการแปลงปลูกทั้งหมด เรียงจากแคร่ที่ 1 -> 2 -> 3 -> 4 -> 5 -> 6 (Ascending Order)
plotsRouter.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*,
              sc.name AS seed_crop_name,
              COALESCE(b.id, ab.id) AS batch_id,
              COALESCE(b.batch_code, ab.batch_code) AS batch_code,
              COALESCE(b.initial_count, ab.initial_count) AS initial_count,
              COALESCE(b.remaining_count, ab.remaining_count) AS remaining_count,
              COALESCE(b.planting_unit, ab.planting_unit) AS planting_unit,
              COALESCE(b.total_damaged_count, ab.total_damaged_count, 0) AS total_damaged_count,
              COALESCE(b.total_harvested_count, ab.total_harvested_count, 0) AS total_harvested_count,
              COALESCE(b.notes, ab.notes) AS batch_notes
       FROM plots p
       LEFT JOIN crops sc ON sc.id = p.seed_crop_id
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

    // รีเซ็ตสถานะแปลงให้กลับมาว่าง
    await pool.query(
      `UPDATE plots 
       SET status = 'empty',
           crop_name = '-',
           planting_date = NULL,
           expected_harvest_date = NULL,
           current_batch_id = NULL,
           seed_prep_date = NULL,
           seed_notes = NULL,
           seed_crop_id = NULL,
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
  'field_safety_status',
  'soil_recipe',
  'soil_prep_date',
  'seed_prep_date',
  'seed_notes',
  'seed_crop_id',
  'dimension',
  'plot_number',
  'status',
  'notes',
  'default_worker_name',
  'cycle_number',
  'auto_water_enabled',
]));
