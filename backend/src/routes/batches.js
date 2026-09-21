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
      start_date = new Date().toISOString().split('T')[0],
      auto_water = true,
      notes = '',
      soil_recipe = ''
    } = req.body;

    if (!plot_id || !crop_id) {
      return res.status(400).json({ error: 'plot_id และ crop_id จำเป็นต้องระบุ' });
    }

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

    // 3. บันทึกลง planting_batches พร้อม soil_recipe ของรอบนี้
    const [ins] = await pool.query(
      `INSERT INTO planting_batches (user_id, batch_code, plot_id, crop_id, start_date, expected_harvest_date, status, auto_water, water_schedule, notes, soil_recipe)
       VALUES (?, ?, ?, ?, ?, ?, 'growing', ?, 'เช้า-เย็น (น้ำสะอาดมาตรฐาน GAP)', ?, ?)`,
      [req.user.id, batch_code, plot_id, crop_id, start_date, expected_harvest_date, auto_water ? 1 : 0, notes, effectiveSoilRecipe]
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

    // 5. บันทึกลง crop_activities ให้สอดคล้องกับ Timeline ต้นน้ำ GAP
    await pool.query(
      `INSERT INTO crop_activities (user_id, plot_id, activity_date, stage, title, details, materials_used, operator_name)
       VALUES (?, ?, ?, 'planting', ?, ?, ?, ?)`,
      [
        req.user.id,
        plot_id,
        start_date,
        `เริ่มรอบการปลูก ${crop.name} (${batch_code})`,
        notes || `เริ่มลงแปลง/เพาะกล้า คาดเก็บเกี่ยว ${expected_harvest_date}`,
        effectiveSoilRecipe ? `สูตรดิน: ${effectiveSoilRecipe}` : null,
        req.user.display_name || 'เจ้าของฟาร์ม'
      ]
    );

    const [created] = await pool.query('SELECT * FROM planting_batches WHERE id = ?', [batchId]);
    res.status(201).json({
      success: true,
      batch: created[0],
      message: `เริ่มรอบการปลูก ${crop.name} ใน ${plot.name} เรียบร้อยแล้ว!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/batches/:id - แก้ไขรอบการปลูก
batchesRouter.put('/:id', async (req, res) => {
  try {
    const { status, notes, auto_water, expected_harvest_date, soil_recipe } = req.body;
    await pool.query(
      `UPDATE planting_batches 
       SET status = COALESCE(?, status),
           notes = COALESCE(?, notes),
           auto_water = COALESCE(?, auto_water),
           expected_harvest_date = COALESCE(?, expected_harvest_date),
           soil_recipe = COALESCE(?, soil_recipe)
       WHERE id = ? AND user_id = ?`,
      [status, notes, auto_water, expected_harvest_date, soil_recipe, req.params.id, req.user.id]
    );
    const [updated] = await pool.query('SELECT * FROM planting_batches WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default batchesRouter;
