import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const batchesRouter = Router();
batchesRouter.use(authRequired);

// Ensure soil_recipe column exists on planting_batches
pool.query('ALTER TABLE planting_batches ADD COLUMN soil_recipe TEXT NULL AFTER notes').catch(() => {});

// GET /api/batches - ดึงรายการรอบการปลูกทั้งหมด
batchesRouter.get('/', async (req, res) => {
  try {
    const { plot_id, status } = req.query;
    let sql = `
      SELECT b.*, 
             COALESCE(NULLIF(b.soil_recipe, ''), p.soil_recipe) AS soil_recipe,
             p.name AS plot_name, p.dimension AS plot_dimension,
             c.name AS crop_name, c.category AS crop_category, c.growth_days, c.default_bag_size, c.default_price
      FROM planting_batches b
      JOIN plots p ON p.id = b.plot_id
      JOIN crops c ON c.id = b.crop_id
      WHERE b.user_id = ?
    `;
    const params = [req.user.id];

    if (plot_id) {
      sql += ' AND b.plot_id = ?';
      params.push(plot_id);
    }
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY b.id DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/batches/:id - ดึงข้อมูลรอบการปลูกรายอัน
batchesRouter.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, 
              COALESCE(NULLIF(b.soil_recipe, ''), p.soil_recipe) AS soil_recipe,
              p.name AS plot_name, p.dimension AS plot_dimension,
              c.name AS crop_name, c.category AS crop_category, c.growth_days, c.default_bag_size, c.default_price
       FROM planting_batches b
       JOIN plots p ON p.id = b.plot_id
       JOIN crops c ON c.id = b.crop_id
       WHERE b.id = ? AND b.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Batch not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/batches - เริ่มรอบการปลูกใหม่ (Start New Planting Batch)
batchesRouter.post('/', async (req, res) => {
  try {
    const {
      plot_id,
      crop_id,
      initial_count = null,
      planting_unit = 'ต้น',
      start_date = new Date().toISOString().split('T')[0],
      auto_water = true,
      notes = '',
      soil_recipe = ''
    } = req.body;

    if (!plot_id || !crop_id) {
      return res.status(400).json({ error: 'plot_id และ crop_id จำเป็นต้องระบุ' });
    }

    const initCount = initial_count !== null && initial_count !== '' && !isNaN(Number(initial_count)) ? Number(initial_count) : null;
    const unit = planting_unit?.trim() || 'ต้น';

    // 1. ตรวจสอบแปลงปลูก
    const [plots] = await pool.query('SELECT * FROM plots WHERE id = ? AND user_id = ?', [plot_id, req.user.id]);
    if (!plots[0]) return res.status(404).json({ error: 'ไม่พบแปลงปลูกที่เลือก' });
    const plot = plots[0];

    // 2. ตรวจสอบชนิดผัก
    const [crops] = await pool.query('SELECT * FROM crops WHERE id = ?', [crop_id]);
    if (!crops[0]) return res.status(404).json({ error: 'ไม่พบชนิดผักที่เลือก' });
    const crop = crops[0];

    // สูตรดินสำหรับรอบนี้ (ถ้าไม่กรอกให้ใช้ของแปลงเดิม)
    const effectiveSoilRecipe = (soil_recipe || '').trim() || plot.soil_recipe || 'ดินผสม 8 กระบะปูน (กากยางพารา 4 กระบะ + แกลบดำ/แกลบดิบ 2 กระบะ + มูลวัวหมัก 2 กระบะ)';

    // คำนวณวันคาดการณ์เก็บเกี่ยว
    const startDateObj = new Date(start_date);
    const expectedDateObj = new Date(startDateObj.getTime() + (crop.growth_days || 30) * 24 * 60 * 60 * 1000);
    const expected_harvest_date = expectedDateObj.toISOString().split('T')[0];

    // สร้าง Batch Code เช่น BATCH-260919-P1-123
    const datePart = start_date.replace(/-/g, '').slice(2);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const batch_code = `BATCH-${datePart}-P${plot.plot_number || plot.id}-${randomSuffix}`;

    // 3. บันทึกลง planting_batches พร้อม initial_count, remaining_count และ soil_recipe ของรอบนี้
    const [ins] = await pool.query(
      `INSERT INTO planting_batches (user_id, batch_code, plot_id, crop_id, initial_count, remaining_count, planting_unit, total_damaged_count, total_harvested_count, start_date, expected_harvest_date, status, auto_water, water_schedule, notes, soil_recipe)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 'growing', ?, 'เช้า-เย็น (น้ำสะอาดมาตรฐาน GAP)', ?, ?)`,
      [req.user.id, batch_code, plot_id, crop_id, initCount, initCount, unit, start_date, expected_harvest_date, auto_water ? 1 : 0, notes, effectiveSoilRecipe]
    );
    const batchId = ins.insertId;

    // 4. อัปเดตสถานะของแปลงเป็น 'growing' พร้อมปรับปรุง soil_recipe ล่าสุด
    await pool.query(
      `UPDATE plots 
       SET status = 'growing',
           crop_name = ?,
           planting_date = ?,
           expected_harvest_date = ?,
           current_batch_id = ?,
           soil_recipe = ?,
           updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [crop.name, start_date, expected_harvest_date, batchId, effectiveSoilRecipe, plot_id, req.user.id]
    );

    // Sync with crop_cycles for Crop Diary Timeline
    await pool.query(
      `UPDATE crop_cycles SET status = 'harvested' WHERE plot_id = ? AND user_id = ? AND status = 'active'`,
      [plot_id, req.user.id]
    );
    const [prevCycles] = await pool.query(
      `SELECT MAX(cycle_number) as max_c FROM crop_cycles WHERE plot_id = ? AND user_id = ?`,
      [plot_id, req.user.id]
    );
    const newCycleNum = (prevCycles[0]?.max_c || 0) + 1;
    const [cycleIns] = await pool.query(
      `INSERT INTO crop_cycles (user_id, plot_id, cycle_number, cycle_code, crop_name, planting_date, expected_harvest_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [req.user.id, plot_id, newCycleNum, batch_code, crop.name, start_date, expected_harvest_date, notes || 'รอบปลูกใหม่']
    );
    const cycleId = cycleIns.insertId;

    // 5. บันทึกลง crop_activities ให้สอดคล้องกับ Timeline ต้นน้ำ GAP
    const countInfo = initCount ? ` จำนวน ${initCount.toLocaleString()} ${unit}` : '';
    await pool.query(
      `INSERT INTO crop_activities (user_id, plot_id, cycle_id, activity_date, stage, title, details, materials_used, operator_name)
       VALUES (?, ?, ?, ?, 'planting', ?, ?, ?, ?)`,
      [
        req.user.id,
        plot_id,
        cycleId,
        start_date,
        `เริ่มรอบการปลูก ${crop.name}${countInfo} (${batch_code})`,
        notes || `เริ่มลงแปลง/เพาะกล้า${countInfo} คาดเก็บเกี่ยว ${expected_harvest_date}`,
        effectiveSoilRecipe ? `สูตรดิน: ${effectiveSoilRecipe}` : null,
        req.user.display_name || 'เจ้าของฟาร์ม'
      ]
    );

    const [created] = await pool.query('SELECT * FROM planting_batches WHERE id = ?', [batchId]);
    res.status(201).json({
      success: true,
      batch: created[0],
      message: `เริ่มรอบการปลูก ${crop.name}${countInfo} ใน ${plot.name} เรียบร้อยแล้ว!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/batches/:id - แก้ไขข้อมูลรอบการปลูก (Edit Planting Batch)
batchesRouter.put('/:id', async (req, res) => {
  try {
    const {
      crop_id,
      start_date,
      notes,
      auto_water,
      expected_harvest_date,
      soil_recipe,
      initial_count,
      planting_unit,
    } = req.body;

    // 1. ตรวจสอบว่ามีรอบการปลูกนี้และเป็นของผู้ใช้คนนี้หรือไม่
    const [batches] = await pool.query(
      'SELECT * FROM planting_batches WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!batches[0]) return res.status(404).json({ error: 'ไม่พบรอบการปลูกนี้' });
    const currentBatch = batches[0];

    if (currentBatch.status === 'harvested') {
      return res.status(400).json({ error: 'ไม่สามารถแก้ไขรอบที่เก็บเกี่ยวเข้าคลังแล้วได้' });
    }

    // 2. ถ้ามีการเปลี่ยน crop_id ให้ดึงข้อมูลชนิดผักใหม่
    let effectiveCropId = currentBatch.crop_id;
    let cropName = null;
    let growthDays = 30;

    if (crop_id && Number(crop_id) !== currentBatch.crop_id) {
      effectiveCropId = Number(crop_id);
    }
    const [crops] = await pool.query('SELECT * FROM crops WHERE id = ?', [effectiveCropId]);
    if (crops[0]) {
      cropName = crops[0].name;
      growthDays = Number(crops[0].growth_days) || 30;
    }

    // 3. จัดการวันที่เริ่มปลูก และคำนวณวันคาดการณ์เก็บเกี่ยวใหม่
    const effectiveStartDate = start_date || currentBatch.start_date;
    let effectiveExpectedDate = expected_harvest_date;
    if (!effectiveExpectedDate) {
      const startDateObj = new Date(effectiveStartDate);
      const expectedDateObj = new Date(startDateObj.getTime() + growthDays * 24 * 60 * 60 * 1000);
      effectiveExpectedDate = !isNaN(expectedDateObj.getTime())
        ? expectedDateObj.toISOString().split('T')[0]
        : currentBatch.expected_harvest_date;
    }

    const effectiveAutoWater = auto_water !== undefined ? (auto_water ? 1 : 0) : currentBatch.auto_water;
    const effectiveNotes = notes !== undefined ? notes : currentBatch.notes;
    const effectiveSoilRecipe = soil_recipe !== undefined ? soil_recipe : currentBatch.soil_recipe;

    // คำนวณจำนวนต้นใหม่หากมีการส่งมา
    let effectiveInitCount = currentBatch.initial_count;
    let effectiveRemainingCount = currentBatch.remaining_count;
    let effectivePlantingUnit = currentBatch.planting_unit || 'ต้น';

    if (initial_count !== undefined) {
      if (initial_count !== null && initial_count !== '' && !isNaN(Number(initial_count))) {
        effectiveInitCount = Number(initial_count);
        effectiveRemainingCount = Math.max(
          0,
          effectiveInitCount - (currentBatch.total_damaged_count || 0) - (currentBatch.total_harvested_count || 0)
        );
      } else {
        effectiveInitCount = null;
        effectiveRemainingCount = null;
      }
    }
    if (planting_unit !== undefined) {
      effectivePlantingUnit = planting_unit?.trim() || 'ต้น';
    }

    // 4. อัปเดต planting_batches
    await pool.query(
      `UPDATE planting_batches 
       SET crop_id = ?,
           start_date = ?,
           expected_harvest_date = ?,
           auto_water = ?,
           notes = ?,
           soil_recipe = ?,
           initial_count = ?,
           remaining_count = ?,
           planting_unit = ?,
           updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        effectiveCropId,
        effectiveStartDate,
        effectiveExpectedDate,
        effectiveAutoWater,
        effectiveNotes,
        effectiveSoilRecipe,
        effectiveInitCount,
        effectiveRemainingCount,
        effectivePlantingUnit,
        req.params.id,
        req.user.id
      ]
    );

    // 5. อัปเดตแปลง plots ที่เกี่ยวข้องให้ข้อมูลสอดคล้องกันทันที
    if (currentBatch.plot_id) {
      await pool.query(
        `UPDATE plots 
         SET crop_name = COALESCE(?, crop_name),
             planting_date = ?,
             expected_harvest_date = ?,
             soil_recipe = COALESCE(?, soil_recipe),
             updated_at = NOW()
         WHERE id = ? AND user_id = ?`,
        [
          cropName,
          effectiveStartDate,
          effectiveExpectedDate,
          effectiveSoilRecipe,
          currentBatch.plot_id,
          req.user.id
        ]
      );
    }

    // 6. อัปเดตข้อมูลกิจกรรมใน crop_activities ให้ตรงกัน (ถ้ามี)
    if (cropName && currentBatch.plot_id) {
      await pool.query(
        `UPDATE crop_activities 
         SET title = ?,
             materials_used = ?,
             activity_date = ?
         WHERE user_id = ? AND plot_id = ? AND stage = 'planting' AND title LIKE ?`,
        [
          `เริ่มรอบการปลูก ${cropName} (${currentBatch.batch_code})`,
          effectiveSoilRecipe ? `สูตรดิน: ${effectiveSoilRecipe}` : null,
          effectiveStartDate,
          req.user.id,
          currentBatch.plot_id,
          `%${currentBatch.batch_code}%`
        ]
      );
    }

    const [updated] = await pool.query(
      `SELECT b.*, 
              p.name AS plot_name,
              c.name AS crop_name, c.category AS crop_category, c.growth_days
       FROM planting_batches b
       JOIN plots p ON p.id = b.plot_id
       JOIN crops c ON c.id = b.crop_id
       WHERE b.id = ? AND b.user_id = ?`,
      [req.params.id, req.user.id]
    );

    res.json({
      success: true,
      batch: updated[0],
      message: `แก้ไขข้อมูลรอบการปลูก "${cropName || currentBatch.batch_code}" เรียบร้อยแล้ว`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/batches/:id - ยกเลิก/ลบรอบการปลูก และรีเซ็ตแปลงกลับเป็นสถานะว่าง (Cancel & Reset Plot)
batchesRouter.delete('/:id', async (req, res) => {
  try {
    const [batches] = await pool.query(
      `SELECT b.*, p.name AS plot_name 
       FROM planting_batches b
       LEFT JOIN plots p ON p.id = b.plot_id
       WHERE b.id = ? AND b.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!batches[0]) return res.status(404).json({ error: 'ไม่พบรอบการปลูกนี้' });
    const batch = batches[0];

    if (batch.status === 'harvested') {
      return res.status(400).json({
        error: 'ไม่สามารถยกเลิกรอบการปลูกที่เก็บเกี่ยวเข้าคลังสินค้าแล้วได้'
      });
    }

    // 1. รีเซ็ตแปลงปลูกให้กลับมาเป็นสถานะว่าง ('empty') ทันที
    if (batch.plot_id) {
      await pool.query(
        `UPDATE plots 
         SET status = 'empty',
             crop_name = '-',
             planting_date = NULL,
             expected_harvest_date = NULL,
             current_batch_id = NULL,
             updated_at = NOW()
         WHERE id = ? AND user_id = ?`,
        [batch.plot_id, req.user.id]
      );

      // ลบ crop_cycles ที่ยัง active ของแปลงนี้ถ้ามี
      await pool.query(
        `DELETE FROM crop_cycles WHERE plot_id = ? AND user_id = ? AND status = 'active'`,
        [batch.plot_id, req.user.id]
      ).catch(() => {});
    }

    // 2. ลบ crop_activities ที่เกี่ยวข้องกับรอบการปลูกนี้
    await pool.query(
      `DELETE FROM crop_activities 
       WHERE user_id = ? AND plot_id = ? AND stage = 'planting' AND title LIKE ?`,
      [req.user.id, batch.plot_id, `%${batch.batch_code}%`]
    ).catch(() => {});

    // 3. ลบรอบการปลูกออกจาก planting_batches
    await pool.query(
      'DELETE FROM planting_batches WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    res.json({
      success: true,
      message: `ยกเลิกรอบการปลูก (${batch.batch_code}) และรีเซ็ต "${batch.plot_name || 'แปลง'}" กลับเป็นแปลงว่างเรียบร้อยแล้ว`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default batchesRouter;
