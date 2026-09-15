import { Router } from 'express';
import { crudRouter } from './crud.js';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const harvestRouter = Router();
harvestRouter.use(authRequired);

// 1. บันทึกเก็บเกี่ยวอัจฉริยะ พร้อมซิงค์เข้าสต็อกหน้าร้าน LINE (Smart Harvest & Auto Stock Sync)
harvestRouter.post('/smart-record', async (req, res) => {
  try {
    const {
      plot_id,
      harvest_date,
      quantity,
      unit = 'kg',
      quality_grade = 'A',
      worker_name,
      notes,
      lot_code: customLot,
      // Auto-stock sync options
      sync_to_stock = true,
      price,
      image_url,
      is_available = true,
      product_id,
    } = req.body;

    if (!plot_id) return res.status(400).json({ error: 'กรุณาเลือกแปลงปลูกที่เก็บเกี่ยว' });
    if (!quantity || Number(quantity) <= 0) return res.status(400).json({ error: 'จำนวนที่เก็บเกี่ยวต้องมากกว่า 0' });

    const [plots] = await pool.query('SELECT * FROM plots WHERE id = ? AND user_id = ?', [plot_id, req.user.id]);
    if (!plots[0]) return res.status(404).json({ error: 'ไม่พบแปลงปลูกนี้' });
    const plot = plots[0];

    const hDate = harvest_date || new Date().toISOString().split('T')[0];
    const dateNum = hDate.replace(/-/g, '');
    const cleanPlotCode = (plot.name || 'PLOT').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || `P${plot.id}`;
    const lotCode = customLot || `LOT-${cleanPlotCode}-${dateNum}-${Math.floor(100 + Math.random() * 900)}`;

    // ตรวจสอบระยะปลอดภัยของสารเคมี/ชีวภัณฑ์ (PHI - Pre-Harvest Interval Check)
    let phiWarning = null;
    const [chemLogs] = await pool.query(
      `SELECT * FROM chemical_logs WHERE plot_id = ? AND phi_days > 0 ORDER BY log_date DESC LIMIT 1`,
      [plot_id]
    );
    if (chemLogs[0]) {
      const chem = chemLogs[0];
      const chemDate = new Date(chem.log_date);
      const safeDate = new Date(chemDate);
      safeDate.setDate(safeDate.getDate() + Number(chem.phi_days));
      const targetHarvestDate = new Date(hDate);
      if (targetHarvestDate < safeDate) {
        const diffMs = safeDate - targetHarvestDate;
        const daysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        phiWarning = `⚠️ แปลงนี้มีประวัติใช้ "${chem.product_name || 'สารชีวภัณฑ์/เคมี'}" เมื่อ ${new Date(chem.log_date).toISOString().split('T')[0]} (ระยะปลอดภัย ${chem.phi_days} วัน) ยังเหลืออีก ${daysLeft} วันจึงจะพ้นระยะปลอดภัยตามมาตรฐาน GAP`;
      }
    }

    const worker = worker_name || plot.default_worker_name || req.user.display_name || 'ผู้ดูแลแปลง';

    // บันทึกลงตาราง harvest_logs
    const [hResult] = await pool.query(
      `INSERT INTO harvest_logs (user_id, plot_id, harvest_date, quantity, unit, quality_grade, lot_code, harvest_hygiene, postharvest_handling, worker_name, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'สะอาด', 'ตัดแต่ง คัดเกรด และบรรจุมาตรฐาน GAP', ?, ?, ?, ?)`,
      [
        req.user.id,
        plot_id,
        hDate,
        Number(quantity),
        unit,
        quality_grade,
        lotCode,
        worker,
        notes || 'บันทึกผ่านระบบ Smart Harvest',
        req.user.email,
        req.user.email,
      ]
    );

    let syncedProduct = null;
    if (sync_to_stock) {
      let existingProd = null;
      if (product_id) {
        const [pRows] = await pool.query('SELECT * FROM products WHERE id = ?', [product_id]);
        if (pRows[0]) existingProd = pRows[0];
      }
      if (!existingProd) {
        // ค้นหาสินค้าเดิมที่ตรงกับ plot_id หรือตรงกับชื่อพืช crop_name
        const [pRows] = await pool.query(
          `SELECT * FROM products WHERE plot_id = ? OR name LIKE ? OR ? LIKE CONCAT('%', name, '%') LIMIT 1`,
          [plot_id, `%${plot.crop_name}%`, plot.crop_name]
        );
        if (pRows[0]) existingProd = pRows[0];
      }

      if (existingProd) {
        // อัปเดตสต็อกสินค้าเดิม
        const newStock = Number(existingProd.stock_quantity || 0) + Number(quantity);
        const updateStatus = is_available ? 'available' : existingProd.status;
        const newPrice = price !== undefined && Number(price) > 0 ? Number(price) : existingProd.price;
        const newImg = image_url || existingProd.image_url;

        await pool.query(
          `UPDATE products SET stock_quantity = ?, price = ?, image_url = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [newStock, newPrice, newImg, updateStatus, existingProd.id]
        );
        const [upd] = await pool.query('SELECT * FROM products WHERE id = ?', [existingProd.id]);
        syncedProduct = { ...upd[0], is_new: false, previous_stock: existingProd.stock_quantity, added_stock: Number(quantity) };
      } else {
        // สร้างรายการสินค้าใหม่ในคลังหน้าร้าน
        const prodPrice = price !== undefined && Number(price) > 0 ? Number(price) : 45;
        const prodImg = image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80';
        const prodStatus = is_available ? 'available' : 'out_of_stock';

        const [pIns] = await pool.query(
          `INSERT INTO products (plot_id, name, category, price, unit, stock_quantity, image_url, status)
           VALUES (?, ?, 'ผักสด GAP', ?, ?, ?, ?, ?)`,
          [plot_id, `${plot.crop_name} สด GAP`, prodPrice, unit, Number(quantity), prodImg, prodStatus]
        );
        const [newP] = await pool.query('SELECT * FROM products WHERE id = ?', [pIns.insertId]);
        syncedProduct = { ...newP[0], is_new: true, added_stock: Number(quantity) };
      }
    }

    // ปรับปรุงสถานะแปลงเป็น 'harvested'
    await pool.query(
      `UPDATE plots SET status = 'harvested', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.user.email, plot_id]
    );

    // อัปเดตข้อมูลผลผลิตใน crop_cycles รอบปัจจุบัน
    await pool.query(
      `UPDATE crop_cycles SET 
        status = 'harvested',
        harvest_date = ?,
        harvest_quantity = ?,
        harvest_unit = ?,
        quality_grade = ?,
        lot_code = ?
       WHERE plot_id = ? AND user_id = ? AND status = 'active'
       ORDER BY id DESC LIMIT 1`,
      [hDate, Number(quantity), unit, quality_grade, lotCode, plot_id, req.user.id]
    );

    const [hRow] = await pool.query('SELECT * FROM harvest_logs WHERE id = ?', [hResult.insertId]);

    res.json({
      success: true,
      harvest: hRow[0],
      lot_code: lotCode,
      product: syncedProduct,
      phi_warning: phiWarning,
      message: `บันทึกการเก็บเกี่ยว ${plot.crop_name} (${quantity} ${unit}) สำเร็จ! ${syncedProduct ? `และอัปเดตสต็อกหน้าร้านเรียบร้อย` : ''}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Standard CRUD fallback
harvestRouter.use('/', crudRouter('harvest_logs', [
  'plot_id',
  'harvest_date',
  'quantity',
  'unit',
  'quality_grade',
  'lot_code',
  'revenue',
  'harvest_hygiene',
  'postharvest_handling',
  'worker_name',
  'notes',
]));
