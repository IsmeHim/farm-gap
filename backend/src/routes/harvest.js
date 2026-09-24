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
      is_partial = false,
      harvested_plants_count = 0,
      destination = 'cold_storage', // 'cold_storage' or 'direct_stock'
    } = req.body;

    const isPartialHarvest = Boolean(is_partial);
    const plantsHarvested = Number(harvested_plants_count) || 0;
    const dest = destination || 'cold_storage';

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
    const destLabel = dest === 'cold_storage' ? '❄️ เข้าห้องเย็น/ตู้เย็นพักผัก' : '🛒 วางขายหน้าร้าน LINE';
    const partialLabel = isPartialHarvest ? ` (ทยอยเก็บเกี่ยว ${plantsHarvested > 0 ? `${plantsHarvested} ต้น` : ''})` : ' (ปิดรอบแปลง)';
    const postHarvestText = postharvest_handling || notes || 'ตัดแต่งราก คัดแยกใบเหลือง ล้างด้วยน้ำสะอาด บรรจุถุงเจาะรูระบายอากาศ มาตรฐาน GAP';
    const logNotes = `เก็บเกี่ยว ${weightKg} กก.${partialLabel} บรรจุ ${bagType} ได้ ${totalPacks} ถุง ราคาถุงละ ${unitPrice} บาท (รวม ฿${totalRevenue.toLocaleString()}) ปลายทาง: ${destLabel} ช่องทาง: ${sale_channel}`;

    // บันทึกลงตาราง harvest_logs
    const initialStocked = sync_to_stock ? totalPacks : 0;
    const initialStatus = sync_to_stock ? 'fully_stocked' : 'unstocked';

    const [hResult] = await pool.query(
      `INSERT INTO harvest_logs (
        user_id, plot_id, batch_id, harvest_date, quantity, unit,
        is_partial, harvested_plants_count, destination,
        total_packs, stocked_quantity, stock_status, product_id,
        quality_grade, lot_code, revenue, harvest_hygiene,
        postharvest_handling, worker_name, notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, 'กก.', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'สะอาด', ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        targetPlotId,
        activeBatch?.id || null,
        hDate,
        weightKg,
        isPartialHarvest ? 1 : 0,
        plantsHarvested,
        dest,
        totalPacks,
        initialStocked,
        initialStatus,
        product_id || null,
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

    // ถ้าเลือกเก็บเข้าห้องเย็น/ตู้เย็นพักผัก ให้บันทึกลง storage_logs อัตโนมัติ
    if (dest === 'cold_storage') {
      await pool.query(
        `INSERT INTO storage_logs (
          user_id, harvest_id, log_date, storage_location,
          storage_conditions, notes, worker_name, created_by, updated_by
        ) VALUES (?, ?, ?, 'ห้องเย็น / ตู้เย็นพักผลผลิตฟาร์ม', 'อุณหภูมิควบคุม 4-8°C ความชื้นสัมพัทธ์ 90-95%', ?, ?, ?, ?)`,
        [
          req.user.id,
          hResult.insertId,
          hDate,
          `พักผักรอแพ็ก/คัดเกรด: ${plot.crop_name} ${weightKg} กก. (${totalPacks} ถุง) ล็อต ${lotCode}`,
          worker,
          req.user.email,
          req.user.email,
        ]
      ).catch(e => console.warn('Failed to insert storage_log:', e.message));
    }

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

      const effectiveProdStatus = (dest === 'cold_storage' && !is_available) ? 'out_of_stock' : (is_available ? 'available' : 'out_of_stock');

      if (existingProd) {
        const newStock = Number(existingProd.stock_quantity || 0) + totalPacks;
        const newPrice = unitPrice > 0 ? unitPrice : existingProd.price;
        const newImg = image_url || existingProd.image_url;

        await pool.query(
          `UPDATE products SET stock_quantity = ?, price = ?, unit = 'ถุง', image_url = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [newStock, newPrice, newImg, effectiveProdStatus, existingProd.id]
        );
        const [upd] = await pool.query('SELECT * FROM products WHERE id = ?', [existingProd.id]);
        syncedProduct = { ...upd[0], is_new: false, previous_stock: existingProd.stock_quantity, added_stock: totalPacks, package_type: bagType };
      } else {
        const prodImg = image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80';

        const [pIns] = await pool.query(
          `INSERT INTO products (plot_id, name, category, price, unit, stock_quantity, image_url, status)
           VALUES (?, ?, 'ผักสด GAP', ?, 'ถุง', ?, ?, ?)`,
          [targetPlotId, `${plot.crop_name} สด GAP (4 ขีด)`, unitPrice, totalPacks, prodImg, effectiveProdStatus]
        );
        const [newP] = await pool.query('SELECT * FROM products WHERE id = ?', [pIns.insertId]);
        syncedProduct = { ...newP[0], is_new: true, added_stock: totalPacks, package_type: bagType };
      }
      if (syncedProduct) {
        await pool.query('UPDATE harvest_logs SET product_id = ? WHERE id = ?', [syncedProduct.id, hResult.insertId]);
      }
    }

    // จัดการ planting_batches และ plots ตามเงื่อนไข isPartialHarvest
    if (activeBatch) {
      if (plantsHarvested > 0) {
        await pool.query(
          `UPDATE planting_batches
           SET total_harvested_count = COALESCE(total_harvested_count, 0) + ?,
               remaining_count = GREATEST(0, COALESCE(remaining_count, initial_count, 0) - ?),
               updated_at = NOW()
           WHERE id = ?`,
          [plantsHarvested, plantsHarvested, activeBatch.id]
        );
      }

      if (!isPartialHarvest) {
        // เก็บเกี่ยวหมดแปลง -> ปิดรอบ batch
        await pool.query(
          `UPDATE planting_batches SET status = 'harvested', actual_harvest_date = ? WHERE id = ?`,
          [hDate, activeBatch.id]
        );
      }
    }

    // บันทึกลง crop_activities (Timeline ตามมาตรฐาน GAP)
    await pool.query(
      `INSERT INTO crop_activities (user_id, plot_id, activity_date, stage, title, details, operator_name)
       VALUES (?, ?, ?, 'harvest', ?, ?, ?)`,
      [
        req.user.id,
        targetPlotId,
        hDate,
        `เก็บเกี่ยวผลผลิต ${plot.crop_name}${partialLabel} (${totalPacks} ถุง)`,
        logNotes,
        worker
      ]
    );

    // หากเป็นการเก็บเกี่ยวหมดแปลง ให้รีเซ็ตแปลงเป็น empty
    if (!isPartialHarvest) {
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
      ).catch(() => {});
    }

    const [hRow] = await pool.query('SELECT * FROM harvest_logs WHERE id = ?', [hResult.insertId]);

    const partialMsg = isPartialHarvest
      ? ` (ทยอยเก็บเกี่ยว แปลงยังคงสถานะปลูกต่อ)`
      : ` (เก็บเกี่ยวหมดแปลง รีเซ็ตแปลงพร้อมปลูกรอบใหม่)`;

    res.json({
      success: true,
      harvest: hRow[0],
      lot_code: lotCode,
      product: syncedProduct,
      phi_warning: phiWarning,
      is_partial: isPartialHarvest,
      destination: dest,
      summary: {
        cropName: plot.crop_name,
        lotNumber: lotCode,
        totalWeightKg: weightKg,
        totalPacks,
        unitPrice,
        totalValue: totalRevenue,
        packageType: bagType,
        destination: dest,
        isPartial: isPartialHarvest
      },
      message: `เก็บเกี่ยว ${plot.crop_name} น้ำหนัก ${weightKg} กก. (${totalPacks} ถุง มูลค่า ฿${totalRevenue.toLocaleString()}) เรียบร้อย!${partialMsg}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. นำผลผลิตที่เก็บเกี่ยวแล้วลงสต็อกสินค้าหน้าร้าน (Stock Allocation Engine)
harvestRouter.post('/:id/stock', async (req, res) => {
  try {
    const harvestId = req.params.id;
    const {
      quantity_to_stock,
      product_id,
      product_name,
      price,
      is_available = true,
      image_url,
    } = req.body;

    const [hRows] = await pool.query(
      `SELECT h.*, p.name AS plot_name, p.crop_name, c.name AS batch_crop_name 
       FROM harvest_logs h 
       LEFT JOIN plots p ON h.plot_id = p.id 
       LEFT JOIN planting_batches b ON h.batch_id = b.id
       LEFT JOIN crops c ON b.crop_id = c.id
       WHERE h.id = ? AND h.user_id = ?`,
      [harvestId, req.user.id]
    );

    if (!hRows[0]) {
      return res.status(404).json({ error: 'ไม่พบรายการเก็บเกี่ยวนี้' });
    }

    const harvest = hRows[0];
    const cropName = harvest.batch_crop_name || harvest.crop_name || 'ผักสด';
    const totalPacks = harvest.total_packs > 0 
      ? harvest.total_packs 
      : Math.max(1, Math.floor(Number(harvest.quantity || 0) / 0.4));
    const currentStocked = Number(harvest.stocked_quantity || 0);
    const remaining = Math.max(0, totalPacks - currentStocked);

    const qtyToStock = parseInt(quantity_to_stock, 10);
    if (isNaN(qtyToStock) || qtyToStock <= 0) {
      return res.status(400).json({ error: 'กรุณาระบุจำนวนที่ต้องการลงสต็อกให้ถูกต้อง (มากกว่า 0 ถุง)' });
    }

    if (qtyToStock > remaining) {
      return res.status(400).json({ 
        error: `จำนวนที่ต้องการลงสต็อก (${qtyToStock} ถุง) เกินกว่าจำนวนคงเหลือที่รอลงสต็อก (${remaining} ถุง)` 
      });
    }

    // ค้นหาสินค้าที่ตรงกับชนิดผักโดยตรง (ไม่ใช้ plot_id ที่อาจเป็นผักชนิดอื่นจากรอบก่อน)
    let targetProduct = null;
    if (product_id) {
      const [pRows] = await pool.query('SELECT * FROM products WHERE id = ?', [product_id]);
      if (pRows[0]) targetProduct = pRows[0];
    }

    if (!targetProduct && harvest.product_id) {
      const [pRows] = await pool.query('SELECT * FROM products WHERE id = ?', [harvest.product_id]);
      if (pRows[0]) targetProduct = pRows[0];
    }

    if (!targetProduct) {
      // ค้นหาตามชื่อผักตรงกัน
      const [pRows] = await pool.query(
        `SELECT * FROM products WHERE name LIKE ? OR ? LIKE CONCAT('%', name, '%') ORDER BY id DESC LIMIT 1`,
        [`%${cropName}%`, cropName]
      );
      if (pRows[0]) targetProduct = pRows[0];
    }

    const unitPrice = Number(price) > 0 ? Number(price) : (targetProduct ? Number(targetProduct.price) : 20);
    const prodStatus = is_available ? 'available' : 'out_of_stock';
    const prodImg = image_url || targetProduct?.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80';

    let finalProductId = null;
    if (targetProduct) {
      const newStock = Number(targetProduct.stock_quantity || 0) + qtyToStock;
      await pool.query(
        `UPDATE products 
         SET stock_quantity = ?, 
             price = ?, 
             unit = 'ถุง', 
             image_url = ?, 
             status = ?, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [newStock, unitPrice, prodImg, prodStatus, targetProduct.id]
      );
      finalProductId = targetProduct.id;
    } else {
      const pName = product_name || `${harvest.crop_name || 'ผักสด'} สด GAP (4 ขีด)`;
      const [pIns] = await pool.query(
        `INSERT INTO products (plot_id, name, category, price, unit, stock_quantity, image_url, status)
         VALUES (?, ?, 'ผักสด GAP', ?, 'ถุง', ?, ?, ?)`,
        [harvest.plot_id, pName, unitPrice, qtyToStock, prodImg, prodStatus]
      );
      finalProductId = pIns.insertId;
    }

    const [updatedProdRows] = await pool.query('SELECT * FROM products WHERE id = ?', [finalProductId]);
    const updatedProduct = updatedProdRows[0];

    // อัปเดต harvest_logs
    const newStockedTotal = currentStocked + qtyToStock;
    const newStatus = (newStockedTotal >= totalPacks) ? 'fully_stocked' : 'partial';

    await pool.query(
      `UPDATE harvest_logs 
       SET total_packs = ?, 
           stocked_quantity = ?, 
           stock_status = ?, 
           product_id = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [totalPacks, newStockedTotal, newStatus, finalProductId, harvestId]
    );

    // บันทึกกิจกรรม GAP Traceability ลง crop_activities
    const lotLabel = harvest.lot_code ? `ล็อต ${harvest.lot_code}` : `รอบวันที่ ${harvest.harvest_date}`;
    await pool.query(
      `INSERT INTO crop_activities (user_id, plot_id, activity_date, stage, title, details, operator_name)
       VALUES (?, ?, CURDATE(), 'harvest', ?, ?, ?)`,
      [
        req.user.id,
        harvest.plot_id,
        `นำผลผลิตลงสต็อกขาย (${qtyToStock} ถุง)`,
        `นำผลผลิต ${harvest.crop_name || 'ผัก'} ${lotLabel} จำนวน ${qtyToStock} ถุง (สะสม ${newStockedTotal}/${totalPacks} ถุง) ลงสต็อกสินค้าหน้าร้าน LINE Shop เรียบร้อย`,
        req.user.display_name || harvest.worker_name || 'เจ้าของฟาร์ม'
      ]
    ).catch(e => console.warn('Activity log insert error:', e.message));

    const [finalHarvestRows] = await pool.query('SELECT * FROM harvest_logs WHERE id = ?', [harvestId]);

    res.json({
      success: true,
      harvest: finalHarvestRows[0],
      product: updatedProduct,
      stocked_now: qtyToStock,
      total_packs: totalPacks,
      stocked_total: newStockedTotal,
      remaining: Math.max(0, totalPacks - newStockedTotal),
      stock_status: newStatus,
      message: `นำผักลงสต็อกสินค้า ${qtyToStock} ถุง เรียบร้อย! ${newStatus === 'fully_stocked' ? '(ลงสต็อกครบ 100% แล้ว)' : `(คงเหลือรอลงสต็อก ${totalPacks - newStockedTotal} ถุง)`}`
    });
  } catch (err) {
    console.error('Error stocking harvest:', err);
    res.status(500).json({ error: err.message });
  }
});

// Standard CRUD fallback
harvestRouter.use('/', crudRouter('harvest_logs', [
  'plot_id',
  'batch_id',
  'harvest_date',
  'quantity',
  'unit',
  'is_partial',
  'harvested_plants_count',
  'destination',
  'total_packs',
  'stocked_quantity',
  'stock_status',
  'product_id',
  'quality_grade',
  'lot_code',
  'revenue',
  'harvest_hygiene',
  'postharvest_handling',
  'worker_name',
  'notes',
]));
