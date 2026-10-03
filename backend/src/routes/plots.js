import { Router } from 'express';
import { crudRouter } from './crud.js';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const plotsRouter = Router();
plotsRouter.use(authRequired);

// Ensure soil_prep_date, seed_prep_date, seed_notes, seed_crop_id columns exist on plots, and batch_id on crop_activities
pool.query('ALTER TABLE plots ADD COLUMN soil_prep_date DATE NULL AFTER soil_recipe').catch(() => {});
pool.query('ALTER TABLE plots ADD COLUMN seed_prep_date DATE NULL AFTER soil_prep_date').catch(() => {});
pool.query('ALTER TABLE plots ADD COLUMN seed_notes TEXT NULL AFTER seed_prep_date').catch(() => {});
pool.query('ALTER TABLE plots ADD COLUMN seed_crop_id INT NULL AFTER seed_notes').catch(() => {});
pool.query('ALTER TABLE crop_activities ADD COLUMN batch_id INT NULL AFTER plot_id').catch(() => {});
pool.query('ALTER TABLE planting_batches ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP').catch(() => {});


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
              COALESCE(b.notes, ab.notes) AS batch_notes,
              COALESCE(b.seed_prep_date, ab.seed_prep_date, p.seed_prep_date) AS batch_seed_prep_date,
              COALESCE(bc.growth_days, sc.growth_days, 30) AS growth_days
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
       LEFT JOIN crops bc ON bc.id = COALESCE(b.crop_id, ab.crop_id)
        WHERE p.user_id = ?
        ORDER BY COALESCE(p.plot_number, p.id) ASC, p.id ASC`,
      [req.user.id]
    );

    const [activities] = await pool.query(
      `SELECT a.* FROM crop_activities a WHERE a.user_id = ? ORDER BY a.activity_date ASC, a.id ASC`,
      [req.user.id]
    );

    rows.forEach(p => {
      p.activities = activities.filter(a => a.plot_id === p.id);
    });

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

// 5. บันทึกกิจกรรมต้นกล้า / เตรียมแปลง (Add Plot Nursery Activity)
plotsRouter.post('/:id/activities', async (req, res) => {
  try {
    const plotId = Number(req.params.id);
    const { activity_date, stage, title, details, materials_used, operator_name, seed_crop_id } = req.body;
    if (!title || !activity_date) {
      return res.status(400).json({ error: 'กรุณาระบุวันที่และหัวข้อกิจกรรม' });
    }

    // Check if plot has an active batch
    const [plotRows] = await pool.query(
      'SELECT current_batch_id, seed_prep_date FROM plots WHERE id = ? AND user_id = ?',
      [plotId, req.user.id]
    );
    const currentBatchId = plotRows[0]?.current_batch_id || null;

    const [result] = await pool.query(
      `INSERT INTO crop_activities (user_id, plot_id, batch_id, activity_date, stage, title, details, materials_used, operator_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        plotId,
        currentBatchId,
        activity_date,
        stage || 'seeding',
        title,
        details || null,
        materials_used || null,
        operator_name || req.user.display_name || 'เจ้าของฟาร์ม'
      ]
    );

    // If plot is empty and seed_crop_id provided, sync plot's seed_crop_id and seed_prep_date
    if (seed_crop_id) {
      await pool.query(
        `UPDATE plots 
         SET seed_crop_id = ?, 
             seed_prep_date = COALESCE(seed_prep_date, ?),
             updated_at = NOW() 
         WHERE id = ? AND user_id = ?`,
        [seed_crop_id, activity_date, plotId, req.user.id]
      );
    }

    const [newAct] = await pool.query('SELECT * FROM crop_activities WHERE id = ?', [result.insertId]);
    res.status(201).json({
      success: true,
      activity: newAct[0],
      message: 'บันทึกกิจกรรมต้นกล้าเรียบร้อยแล้ว!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. แก้ไขกิจกรรมต้นกล้า (Edit Plot Nursery Activity)
plotsRouter.put('/activities/:activityId', async (req, res) => {
  try {
    const actId = Number(req.params.activityId);
    const { activity_date, stage, title, details, materials_used, operator_name } = req.body;
    await pool.query(
      `UPDATE crop_activities 
       SET activity_date = ?, stage = ?, title = ?, details = ?, materials_used = ?, operator_name = ?
       WHERE id = ? AND user_id = ?`,
      [
        activity_date,
        stage || 'seeding',
        title,
        details || null,
        materials_used || null,
        operator_name || 'เจ้าของฟาร์ม',
        actId,
        req.user.id
      ]
    );
    const [updated] = await pool.query('SELECT * FROM crop_activities WHERE id = ?', [actId]);
    res.json({
      success: true,
      activity: updated[0],
      message: 'แก้ไขกิจกรรมต้นกล้าเรียบร้อยแล้ว!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. ลบกิจกรรมต้นกล้า (Delete Plot Nursery Activity)
plotsRouter.delete('/activities/:activityId', async (req, res) => {
  try {
    const actId = Number(req.params.activityId);
    await pool.query('DELETE FROM crop_activities WHERE id = ? AND user_id = ?', [actId, req.user.id]);
    res.json({ success: true, message: 'ลบกิจกรรมเรียบร้อยแล้ว' });
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

// Sync soil_recipe and soil_prep_date to active planting_batches if updated on plot
plotsRouter.put('/:id', async (req, res, next) => {
  try {
    const plotId = Number(req.params.id);
    const { soil_recipe, soil_prep_date } = req.body;

    if (soil_recipe !== undefined || soil_prep_date !== undefined) {
      const sets = [];
      const vals = [];
      if (soil_recipe !== undefined) {
        sets.push('soil_recipe = ?');
        vals.push(soil_recipe);
      }
      if (soil_prep_date !== undefined) {
        sets.push('soil_prep_date = ?');
        vals.push(soil_prep_date || null);
      }
      if (sets.length > 0) {
        sets.push('updated_at = NOW()');
        vals.push(plotId, req.user.id);
        await pool.query(
          `UPDATE planting_batches 
           SET ${sets.join(', ')} 
           WHERE plot_id = ? AND user_id = ? AND status IN ('growing', 'harvest_ready')`,
          vals
        );
      }
    }
  } catch (err) {
    console.error('Error syncing soil update to batch:', err);
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
