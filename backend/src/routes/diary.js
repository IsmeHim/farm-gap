import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const diaryRouter = Router();
diaryRouter.use(authRequired);

// 1. ดึงรายการกิจกรรมทั้งหมด (Filter by plot_id, cycle_id, stage)
diaryRouter.get('/', async (req, res) => {
  try {
    const { plot_id, cycle_id, stage } = req.query;
    let query = `
      SELECT a.*, p.name AS plot_name, p.crop_name AS plot_crop_name,
             c.cycle_code, c.crop_name AS cycle_crop_name, c.status AS cycle_status
      FROM crop_activities a
      JOIN plots p ON p.id = a.plot_id
      LEFT JOIN crop_cycles c ON c.id = a.cycle_id
      WHERE a.user_id = ?
    `;
    const params = [req.user.id];

    if (plot_id) {
      query += ' AND a.plot_id = ?';
      params.push(plot_id);
    }
    if (cycle_id) {
      query += ' AND a.cycle_id = ?';
      params.push(cycle_id);
    }
    if (stage) {
      query += ' AND a.stage = ?';
      params.push(stage);
    }

    query += ' ORDER BY a.activity_date ASC, a.id ASC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Failed to get diary activities:', err);
    res.status(500).json({ error: err.message });
  }
});

// ดึงรายการรอบการปลูกของแปลง (Crop Cycles for Diary Filter)
diaryRouter.get('/cycles', async (req, res) => {
  try {
    const { plot_id } = req.query;
    if (!plot_id) return res.json([]);

    const [plots] = await pool.query('SELECT * FROM plots WHERE id = ? AND user_id = ?', [plot_id, req.user.id]);
    if (plots.length === 0) return res.json([]);
    const plot = plots[0];

    // Check crop_cycles
    let [cycles] = await pool.query(
      `SELECT c.*, p.name as plot_name 
       FROM crop_cycles c 
       JOIN plots p ON p.id = c.plot_id 
       WHERE c.plot_id = ? AND c.user_id = ? 
       ORDER BY c.cycle_number DESC, c.id DESC`,
      [plot_id, req.user.id]
    );

    // If no crop_cycles exist yet for this plot, auto-sync from planting_batches or plot info
    if (cycles.length === 0) {
      const [batches] = await pool.query(
        `SELECT b.*, c.name as crop_name
         FROM planting_batches b
         LEFT JOIN crops c ON c.id = b.crop_id
         WHERE b.plot_id = ? AND b.user_id = ?
         ORDER BY b.id ASC`,
        [plot_id, req.user.id]
      );

      if (batches.length > 0) {
        for (let i = 0; i < batches.length; i++) {
          const b = batches[i];
          const cycleNum = i + 1;
          const status = b.status === 'completed' || b.status === 'cancelled' ? 'harvested' : 'active';
          await pool.query(
            `INSERT INTO crop_cycles (user_id, plot_id, cycle_number, cycle_code, crop_name, planting_date, expected_harvest_date, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, plot_id, cycleNum, b.batch_code, b.crop_name || plot.crop_name || 'ผักสลัด', b.start_date, b.expected_harvest_date, status, b.notes]
          );
        }
      } else {
        const cycleNum = plot.cycle_number || 1;
        const cleanName = (plot.name || '').replace(/แปลง|\s|\(.*?\)/g, '').trim() || (`P${plot.id}`);
        const cycleCode = `BATCH-${cleanName}-R${cycleNum}`;
        const cropName = (plot.crop_name && plot.crop_name !== '-') ? plot.crop_name : 'ผักสลัด/ผักสวนครัว';
        const status = plot.status === 'empty' ? 'harvested' : 'active';

        await pool.query(
          `INSERT INTO crop_cycles (user_id, plot_id, cycle_number, cycle_code, crop_name, planting_date, expected_harvest_date, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.user.id, plot_id, cycleNum, cycleCode, cropName, plot.planting_date || null, plot.expected_harvest_date || null, status, 'รอบปลูกเริ่มต้นของแปลง']
        );
      }

      [cycles] = await pool.query(
        `SELECT c.*, p.name as plot_name 
         FROM crop_cycles c 
         JOIN plots p ON p.id = c.plot_id 
         WHERE c.plot_id = ? AND c.user_id = ? 
         ORDER BY c.cycle_number DESC, c.id DESC`,
        [plot_id, req.user.id]
      );
    }

    // Link any orphan crop_activities that have cycle_id IS NULL
    if (cycles.length > 0) {
      const targetCycle = cycles.find(c => c.status === 'active') || cycles[0];
      await pool.query(
        `UPDATE crop_activities 
         SET cycle_id = ? 
         WHERE plot_id = ? AND user_id = ? AND cycle_id IS NULL`,
        [targetCycle.id, plot_id, req.user.id]
      );
    }

    res.json(cycles);
  } catch (err) {
    console.error('Failed to get diary cycles:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. ดึงภาพรวมแปลงและรอบการปลูกปัจจุบันสำหรับหน้าไดอารี่
diaryRouter.get('/plots-summary', async (req, res) => {
  try {
    const [plots] = await pool.query(
      `SELECT p.id, p.name, p.crop_name, p.area_sqm, p.cycle_number, p.status,
              c.id AS active_cycle_id, c.cycle_code, c.planting_date, c.expected_harvest_date,
              (SELECT COUNT(*) FROM crop_activities WHERE plot_id = p.id) AS total_activities,
              (SELECT MAX(activity_date) FROM crop_activities WHERE plot_id = p.id) AS last_activity_date
       FROM plots p
       LEFT JOIN crop_cycles c ON c.plot_id = p.id AND c.status = 'active'
       WHERE p.user_id = ?
       ORDER BY p.id ASC`,
      [req.user.id]
    );
    res.json(plots);
  } catch (err) {
    console.error('Failed to get plots summary for diary:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. บันทึกกิจกรรมใหม่ลงไดอารี่
diaryRouter.post('/', async (req, res) => {
  try {
    const {
      plot_id,
      cycle_id,
      activity_date,
      stage,
      title,
      materials_used,
      details,
      water_frequency,
      operator_name,
      image_url,
      notes
    } = req.body;

    if (!plot_id || !activity_date || !stage || !title) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลสำคัญ (แปลง, วันที่, ขั้นตอน, หัวข้อกิจกรรม)' });
    }

    // หากไม่ได้ระบุ cycle_id ให้หารอบ active อัตโนมัติ
    let targetCycleId = cycle_id;
    if (!targetCycleId) {
      const [cycles] = await pool.query(
        'SELECT id FROM crop_cycles WHERE plot_id = ? AND status = "active" ORDER BY id DESC LIMIT 1',
        [plot_id]
      );
      if (cycles.length > 0) {
        targetCycleId = cycles[0].id;
      }
    }

    const [result] = await pool.query(
      `INSERT INTO crop_activities (
        user_id, plot_id, cycle_id, activity_date, stage, title,
        materials_used, details, water_frequency, operator_name, image_url, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        plot_id,
        targetCycleId || null,
        activity_date,
        stage,
        title,
        materials_used || null,
        details || null,
        water_frequency || null,
        operator_name || req.user.display_name || 'เจ้าของฟาร์ม',
        image_url || null,
        notes || null
      ]
    );

    const [inserted] = await pool.query(
      `SELECT a.*, p.name AS plot_name, c.cycle_code
       FROM crop_activities a
       JOIN plots p ON p.id = a.plot_id
       LEFT JOIN crop_cycles c ON c.id = a.cycle_id
       WHERE a.id = ?`,
      [result.insertId]
    );

    let syncedChemId = null;
    let syncedWaterId = null;
    let syncedHarvestId = null;

    // --- AUTO-SYNC TO GAP TABLES (Zero Duplicate Work for Farmer) ---
    // 1. Sync to chemical_logs if fertilizing or organic inputs
    if (stage === 'fertilizing' || (materials_used && (materials_used.includes('ปุ๋ย') || materials_used.includes('หมัก') || materials_used.includes('PSB')))) {
      try {
        const [chemRes] = await pool.query(
          `INSERT INTO chemical_logs (
            user_id, plot_id, log_date, chem_type, product_name, amount, unit,
            reason, application_method, safety_ppe, manufacturer, phi_days, worker_name, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            plot_id,
            activity_date,
            'ปุ๋ยอินทรีย์ / ชีวภาพ',
            materials_used ? materials_used.slice(0, 255) : title.slice(0, 255),
            1,
            'ชุด/ครั้ง',
            'บำรุงแปลงตามมาตรฐาน GAP ปลอดภัยไร้สารเคมี',
            'รดทางดิน / พ่นทางใบ',
            true,
            'ฟาร์มผลิตเอง / เกษตรอินทรีย์',
            0,
            operator_name || req.user.display_name || 'เจ้าของฟาร์ม',
            `[Auto-sync จากไดอารี่] ${title} ${details || ''}`
          ]
        );
        syncedChemId = chemRes.insertId;
      } catch (errSync) {
        console.error('Auto-sync to chemical_logs error:', errSync);
      }
    }

    // 2. Sync to harvest_logs if stage is harvest
    if (stage === 'harvest') {
      try {
        let qty = 20;
        const textToCheck = `${title} ${details || ''} ${materials_used || ''}`;
        const match = textToCheck.match(/(\d+(\.\d+)?)\s*(กก|กิโลกรัม|kg)/i);
        if (match) {
          qty = parseFloat(match[1]);
        }
        const [plotInfo] = await pool.query('SELECT name, crop_name FROM plots WHERE id = ?', [plot_id]);
        const plotShort = (plotInfo[0]?.name || 'P').replace(/แปลง|\s|\(.*?\)/g, '').slice(0, 4) || 'P';
        const dateCode = activity_date.replace(/-/g, '');
        const randomSuffix = Math.floor(100 + Math.random() * 900);
        const lotCode = `LOT-${plotShort}-${dateCode}-${randomSuffix}`;

        const [harvestRes] = await pool.query(
          `INSERT INTO harvest_logs (
            user_id, plot_id, harvest_date, quantity, unit, quality_grade,
            lot_code, revenue, harvest_hygiene, postharvest_handling, worker_name, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            plot_id,
            activity_date,
            qty,
            'kg',
            'A',
            lotCode,
            qty * 50,
            'สะอาดตามเกณฑ์ GAP',
            details || 'คัดเกรดและบรรจุถุงส่งจำหน่ายตามมาตรฐาน GAP',
            operator_name || req.user.display_name || 'เจ้าของฟาร์ม',
            `[Auto-sync จากไดอารี่] ${title}`
          ]
        );
        syncedHarvestId = harvestRes.insertId;
      } catch (errHarvest) {
        console.error('Auto-sync to harvest_logs error:', errHarvest);
      }
    }

    // Update crop_activities with synced IDs if any
    if (syncedChemId || syncedWaterId || syncedHarvestId) {
      await pool.query(
        `UPDATE crop_activities
         SET synced_chem_id = ?, synced_water_id = ?, synced_harvest_id = ?
         WHERE id = ?`,
        [syncedChemId, syncedWaterId, syncedHarvestId, result.insertId]
      );
    }

    res.status(201).json({
      success: true,
      message: 'บันทึกกิจกรรมลงไดอารี่ และซิงค์เข้าแบบบันทึก GAP อัตโนมัติเรียบร้อย',
      activity: inserted[0]
    });
  } catch (err) {
    console.error('Failed to create diary activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. แก้ไขบันทึกกิจกรรม
diaryRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      activity_date,
      stage,
      title,
      materials_used,
      details,
      water_frequency,
      operator_name,
      image_url,
      notes
    } = req.body;

    const [currentActs] = await pool.query(
      'SELECT * FROM crop_activities WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (!currentActs[0]) {
      return res.status(404).json({ error: 'ไม่พบบันทึกกิจกรรม' });
    }
    const act = currentActs[0];

    await pool.query(
      `UPDATE crop_activities
       SET activity_date = ?, stage = ?, title = ?, materials_used = ?,
           details = ?, water_frequency = ?, operator_name = ?, image_url = ?, notes = ?
       WHERE id = ? AND user_id = ?`,
      [
        activity_date,
        stage,
        title,
        materials_used || null,
        details || null,
        water_frequency || null,
        operator_name || 'เจ้าของฟาร์ม',
        image_url || null,
        notes || null,
        id,
        req.user.id
      ]
    );

    // Sync updates to linked GAP tables
    if (act.synced_chem_id) {
      await pool.query(
        `UPDATE chemical_logs
         SET log_date = ?, product_name = ?, worker_name = ?, notes = ?
         WHERE id = ? AND user_id = ?`,
        [
          activity_date,
          materials_used ? materials_used.slice(0, 255) : title.slice(0, 255),
          operator_name || 'เจ้าของฟาร์ม',
          `[Auto-sync จากไดอารี่] ${title} ${details || ''}`,
          act.synced_chem_id,
          req.user.id
        ]
      ).catch(e => console.error('Update synced chem log error:', e));
    }

    if (act.synced_harvest_id) {
      await pool.query(
        `UPDATE harvest_logs
         SET harvest_date = ?, worker_name = ?, postharvest_handling = ?, notes = ?
         WHERE id = ? AND user_id = ?`,
        [
          activity_date,
          operator_name || 'เจ้าของฟาร์ม',
          details || 'คัดเกรดและบรรจุถุงส่งจำหน่ายตามมาตรฐาน GAP',
          `[Auto-sync จากไดอารี่] ${title}`,
          act.synced_harvest_id,
          req.user.id
        ]
      ).catch(e => console.error('Update synced harvest log error:', e));
    }

    const [updated] = await pool.query('SELECT * FROM crop_activities WHERE id = ?', [id]);
    res.json({
      success: true,
      message: 'อัปเดตกิจกรรมและซิงค์ข้อมูลเรียบร้อยแล้ว',
      activity: updated[0]
    });
  } catch (err) {
    console.error('Failed to update diary activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. ลบบันทึกกิจกรรม (พร้อมลบข้อมูลที่เคยซิงค์ไปตาราง GAP ทั้งหมด)
diaryRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // หาบันทึกกิจกรรมก่อนเพื่อดู ID ที่เชื่อมโยง
    const [acts] = await pool.query(
      'SELECT * FROM crop_activities WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!acts[0]) {
      return res.status(404).json({ error: 'ไม่พบบันทึกกิจกรรมนี้' });
    }
    const act = acts[0];

    // 1. ลบจาก chemical_logs ที่ซิงค์ไว้
    if (act.synced_chem_id) {
      await pool.query('DELETE FROM chemical_logs WHERE id = ? AND user_id = ?', [act.synced_chem_id, req.user.id]);
    } else {
      // Fallback: ลบรายการที่มีข้อความ [Auto-sync] และชื่อเรื่องตรงกัน
      await pool.query(
        'DELETE FROM chemical_logs WHERE user_id = ? AND plot_id = ? AND log_date = ? AND notes LIKE ?',
        [req.user.id, act.plot_id, act.activity_date, `%${act.title}%`]
      );
    }

    // 2. ลบจาก harvest_logs ที่ซิงค์ไว้
    if (act.synced_harvest_id) {
      await pool.query('DELETE FROM harvest_logs WHERE id = ? AND user_id = ?', [act.synced_harvest_id, req.user.id]);
    } else {
      await pool.query(
        'DELETE FROM harvest_logs WHERE user_id = ? AND plot_id = ? AND harvest_date = ? AND notes LIKE ?',
        [req.user.id, act.plot_id, act.activity_date, `%${act.title}%`]
      );
    }

    // 4. ลบตัวกิจกรรมในไดอารี่
    await pool.query('DELETE FROM crop_activities WHERE id = ? AND user_id = ?', [id, req.user.id]);

    res.json({
      success: true,
      message: 'ลบบันทึกกิจกรรมและลบข้อมูลที่เชื่อมโยงในระบบ GAP ออกทั้งหมดเรียบร้อยแล้ว'
    });
  } catch (err) {
    console.error('Failed to delete diary activity:', err);
    res.status(500).json({ error: err.message });
  }
});
