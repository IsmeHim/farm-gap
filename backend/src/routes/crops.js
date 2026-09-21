import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const cropsRouter = Router();
cropsRouter.use(authRequired);

// GET /api/crops - ดึงรายการผักทั้งหมด (รวมผักกลางและที่ผู้ใช้เพิ่ม)
cropsRouter.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM crops WHERE user_id IS NULL OR user_id = ? ORDER BY id ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/crops/:id - ดึงข้อมูลผักรายชนิด
cropsRouter.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM crops WHERE id = ? AND (user_id IS NULL OR user_id = ?)`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Crop not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crops - เพิ่มชนิดผักใหม่
cropsRouter.post('/', async (req, res) => {
  try {
    const {
      name,
      scientific_name,
      category = 'ผักสลัด / ผักใบ',
      growth_days = 30,
      nursery_days = 14,
      harvest_unit = 'กก.',
      default_bag_size = 'ถุงใส 4 ขีด (9x18)',
      default_price = 20.00,
      icon = 'leaf',
      notes = ''
    } = req.body;

    if (!name) return res.status(400).json({ error: 'กรุณาระบุชื่อชนิดผัก' });

    const [result] = await pool.query(
      `INSERT INTO crops (user_id, name, scientific_name, category, growth_days, nursery_days, harvest_unit, default_bag_size, default_price, icon, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, scientific_name || null, category, growth_days, nursery_days, harvest_unit, default_bag_size, default_price, icon, notes]
    );

    const [created] = await pool.query('SELECT * FROM crops WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/crops/:id - แก้ไขชนิดผัก
cropsRouter.put('/:id', async (req, res) => {
  try {
    const {
      name,
      scientific_name,
      category,
      growth_days,
      nursery_days,
      harvest_unit,
      default_bag_size,
      default_price,
      icon,
      notes
    } = req.body;

    await pool.query(
      `UPDATE crops 
       SET name = COALESCE(?, name),
           scientific_name = COALESCE(?, scientific_name),
           category = COALESCE(?, category),
           growth_days = COALESCE(?, growth_days),
           nursery_days = COALESCE(?, nursery_days),
           harvest_unit = COALESCE(?, harvest_unit),
           default_bag_size = COALESCE(?, default_bag_size),
           default_price = COALESCE(?, default_price),
           icon = COALESCE(?, icon),
           notes = COALESCE(?, notes)
       WHERE id = ? AND (user_id = ? OR user_id IS NULL)`,
      [name, scientific_name, category, growth_days, nursery_days, harvest_unit, default_bag_size, default_price, icon, notes, req.params.id, req.user.id]
    );

    const [updated] = await pool.query('SELECT * FROM crops WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/crops/:id - ลบชนิดผัก
cropsRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM crops WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Deleted crop successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default cropsRouter;
