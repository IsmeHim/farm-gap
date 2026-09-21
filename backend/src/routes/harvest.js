import { Router } from 'express';
import { crudRouter } from './crud.js';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const harvestRouter = Router();
harvestRouter.use(authRequired);

// 1. บันทึกเก็บเกี่ยวอัจฉริยะ พร้อมคำนวณจำนวนถุง (30 กก. -> 75 ถุง) และซิงค์สต็อกหน้าร้าน LINE
harvestRouter.post('/smart-record', async (req, res) => {
  try {
    const {
      plot_id,
      batch_id,
      harvest_date,
      total_weight_kg,
      quantity, // support both total_weight_kg and quantity
      weight_per_unit_kg = 0.4,
      package_type,
      price_per_unit,
      price, // support both price_per_unit and price
      sale_channel = 'ขายปลีกหน้าฟาร์ม + ตลาดนัดชุมชน + LINE Shop',
      quality_grade = 'A',
      worker_name,
      notes,
      postharvest_handling,
      lot_code: customLot,
      sync_to_stock = true,
      image_url,
      is_available = true,
      product_id,
    } = req.body;

    let targetPlotId = plot_id;
    let activeBatch = null;

    if (batch_id) {
      const [bRows] = await pool.query('SELECT * FROM planting_batches WHERE id = ?', [batch_id]);
      if (bRows[0]) {
        activeBatch = bRows[0];
        targetPlotId = activeBatch.plot_id;
      }
    }

    if (!targetPlotId) return res.status(400).json({ error: 'กรุณาเลือกแปลงปลูกที่เก็บเกี่ยว' });

    const [plots] = await pool.query('SELECT * FROM plots WHERE id = ? AND user_id = ?', [targetPlotId, req.user.id]);
    if (!plots[0]) return res.status(404).json({ error: 'ไม่พบแปลงปลูกนี้' });
    const plot = plots[0];

    if (!activeBatch) {
      const [bRows] = await pool.query(
        'SELECT * FROM planting_batches WHERE plot_id = ? AND status IN ("growing", "harvest_ready") ORDER BY id DESC LIMIT 1',
        [targetPlotId]
      );
      if (bRows[0]) activeBatch = bRows[0];
    }

    const weightKg = Number(total_weight_kg || quantity || 0);
    if (weightKg <= 0) return res.status(400).json({ error: 'จำนวนหรือน้ำหนักที่เก็บเกี่ยวต้องมากกว่า 0' });

    const unitWeight = Number(weight_per_unit_kg) || 0.400; // 4 ขีด
    const totalPacks = Math.max(1, Math.floor(weightKg / unitWeight));
    const unitPrice = Number(price_per_unit || price || 20);
    const totalRevenue = totalPacks * unitPrice;
    const bagType = package_type || 'ถุงใสขนาด 9x18 นิ้ว (4 ขีด)';

    const hDate = harvest_date || new Date().toISOString().split('T')[0];
    const dateNum = hDate.replace(/-/g, '');
    const cleanPlotCode = (plot.name || 'PLOT').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || `P${plot.id}`;
    const lotCode = customLot || `LOT-${cleanPlotCode}-${dateNum}-${Math.floor(100 + Math.random() * 900)}`;

    // ตรวจสอบระยะปลอดภัยของสารเคมี/ชีวภัณฑ์ (PHI - Pre-Harvest Interval Check)
    let phiWarning = null;
    const [chemLogs] = await pool.query(
      `SELECT * FROM chemical_logs WHERE plot_id = ? AND phi_days > 0 ORDER BY log_date DESC LIMIT 1`,
      [targetPlotId]
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

    let worker = worker_name || plot.default_worker_name || req.user.display_name;
    if (!worker) {
      const [u] = await pool.query('SELECT display_name FROM users WHERE id = ?', [req.user.id]);
      worker = u[0]?.display_name || 'เจ้าของฟาร์ม';
    }
    const postHarvestText = postharvest_handling || notes || 'ตัดแต่งราก คัดแยกใบเหลือง ล้างด้วยน้ำสะอาด บรรจุถุงเจาะรูระบายอากาศ มาตรฐาน GAP';
    const logNotes = `เก็บเกี่ยว ${weightKg} กก. บรรจุ ${bagType} ได้ ${totalPacks} ถุง ราคาถุงละ ${unitPrice} บาท (รวม ฿${totalRevenue.toLocaleString()}) ช่องทาง: ${sale_channel}`;

    // บันทึกลงตาราง harvest_logs
    const [hResult] = await pool.query(
      `INSERT INTO harvest_logs (user_id, plot_id, harvest_date, quantity, unit, quality_grade, lot_code, revenue, harvest_hygiene, postharvest_handling, worker_name, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, 'กก.', ?, ?, ?, 'สะอาด', ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        targetPlotId,
        hDate,
        weightKg,
        quality_grade,
        lotCode,
        totalRevenue,
        postHarvestText,
        worker,
        logNotes,
        req.user.email,
        req.user.email,
      ]
    );

    // ซิงค์เข้าสต็อกหน้าร้าน products (หน่วยเป็น 'ถุง')
    let syncedProduct = null;
    if (sync_to_stock) {
      let existingProd = null;
      if (product_id) {
        const [pRows] = await pool.query('SELECT * FROM products WHERE id = ?', [product_id]);
        if (pRows[0]) existingProd = pRows[0];
      }
      if (!existingProd) {
        const [pRows] = await pool.query(
          `SELECT * FROM products WHERE plot_id = ? OR name LIKE ? OR ? LIKE CONCAT('%', name, '%') LIMIT 1`,
          [targetPlotId, `%${plot.crop_name}%`, plot.crop_name]
        );
        if (pRows[0]) existingProd = pRows[0];
      }

      if (existingProd) {
        const newStock = Number(existingProd.stock_quantity || 0) + totalPacks;
        const updateStatus = is_available ? 'available' : existingProd.status;
        const newPrice = unitPrice > 0 ? unitPrice : existingProd.price;
        const newImg = image_url || existingProd.image_url;

        await pool.query(
          `UPDATE products SET stock_quantity = ?, price = ?, unit = 'ถุง', image_url = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [newStock, newPrice, newImg, updateStatus, existingProd.id]
        );
        const [upd] = await pool.query('SELECT * FROM products WHERE id = ?', [existingProd.id]);
        syncedProduct = { ...upd[0], is_new: false, previous_stock: existingProd.stock_quantity, added_stock: totalPacks, package_type: bagType };
      } else {
        const prodImg = image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80';
        const prodStatus = is_available ? 'available' : 'out_of_stock';

        const [pIns] = await pool.query(
          `INSERT INTO products (plot_id, name, category, price, unit, stock_quantity, image_url, status)
           VALUES (?, ?, 'ผักสด GAP', ?, 'ถุง', ?, ?, ?)`,
          [targetPlotId, `${plot.crop_name} สด GAP (4 ขีด)`, unitPrice, totalPacks, prodImg, prodStatus]
        );
        const [newP] = await pool.query('SELECT * FROM products WHERE id = ?', [pIns.insertId]);
        syncedProduct = { ...newP[0], is_new: true, added_stock: totalPacks, package_type: bagType };
      }
    }

    // ปรับสถานะรอบการปลูก planting_batches เป็น 'harvested'
    if (activeBatch) {
      await pool.query(
        `UPDATE planting_batches SET status = 'harvested', actual_harvest_date = ? WHERE id = ?`,
        [hDate, activeBatch.id]
      );
    }

    // บันทึกลง crop_activities (Timeline ตามมาตรฐาน GAP)
    await pool.query(
      `INSERT INTO crop_activities (user_id, plot_id, activity_date, stage, title, details, operator_name)
       VALUES (?, ?, ?, 'harvest', ?, ?, ?)`,
      [
        req.user.id,
        targetPlotId,
        hDate,
        `เก็บเกี่ยวผลผลิต ${plot.crop_name} (เข้าสต็อก ${totalPacks} ถุง)`,
        logNotes,
        worker
      ]
    );

    // ปรับปรุงสถานะแปลงเป็น 'empty' หรือ 'resting' เพื่อเตรียมรอบถัดไป
    await pool.query(
      `UPDATE plots 
       SET status = 'empty', 
           crop_name = '-', 
           planting_date = NULL, 
           expected_harvest_date = NULL, 
           current_batch_id = NULL,
           updated_by = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [req.user.email, targetPlotId]
    );

    // อัปเดตข้อมูลผลผลิตใน crop_cycles (ถ้ามี)
    await pool.query(
      `UPDATE crop_cycles SET 
        status = 'harvested',
        harvest_date = ?,
        harvest_quantity = ?,
        harvest_unit = 'กก.',
        quality_grade = ?,
        lot_code = ?
       WHERE plot_id = ? AND user_id = ? AND status = 'active'
       ORDER BY id DESC LIMIT 1`,
      [hDate, weightKg, quality_grade, lotCode, targetPlotId, req.user.id]
    );

    const [hRow] = await pool.query('SELECT * FROM harvest_logs WHERE id = ?', [hResult.insertId]);

    res.json({
      success: true,
      harvest: hRow[0],
      lot_code: lotCode,
      product: syncedProduct,
      phi_warning: phiWarning,
      summary: {
        cropName: plot.crop_name,
        lotNumber: lotCode,
        totalWeightKg: weightKg,
        totalPacks,
        unitPrice,
        totalValue: totalRevenue,
        packageType: bagType
      },
      message: `เก็บเกี่ยว ${plot.crop_name} น้ำหนัก ${weightKg} กก. บรรจุได้ ${totalPacks} ถุง (มูลค่า ฿${totalRevenue.toLocaleString()}) นำเข้าสต็อกเรียบร้อย!`
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
