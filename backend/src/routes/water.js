import { Router } from 'express';
import { crudRouter } from './crud.js';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const waterRouter = Router();
waterRouter.use(authRequired);

// 1. ตรวจสอบสถานะการรดน้ำประจำวันนี้ (รองรับเช้าและเย็น)
waterRouter.get('/today-status', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { session } = req.query; // 'เช้า' | 'เย็น' | undefined (all today)
    
    let query = `
      SELECT w.id, w.plot_id, w.log_date, w.session, w.amount_liters, w.worker_name, w.created_at, p.name AS plot_name, p.crop_name
      FROM water_logs w
      JOIN plots p ON p.id = w.plot_id
      WHERE w.user_id = ? AND DATE(w.log_date) = ?
    `;
    const params = [req.user.id, today];

    if (session) {
      query += ' AND (w.session = ? OR (w.session IS NULL AND ? = "เช้า"))';
      params.push(session, session);
    }

    query += ' ORDER BY w.id DESC';
    const [rows] = await pool.query(query, params);

    // แยกกลุ่มตามรอบเช้าและรอบเย็น
    const morningPlotIds = [...new Set(rows.filter(r => r.session === 'เช้า' || !r.session).map(r => r.plot_id))];
    const eveningPlotIds = [...new Set(rows.filter(r => r.session === 'เย็น').map(r => r.plot_id))];
    const wateredPlotIds = [...new Set(rows.map(r => r.plot_id))];

    res.json({
      today,
      session: session || null,
      morningPlotIds,
      eveningPlotIds,
      wateredPlotIds,
      logs: rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. บันทึกรดน้ำด่วน 1 แปลง (1-Click Quick Watering)
waterRouter.post('/quick-log', async (req, res) => {
  try {
    const { plot_id, session = 'เช้า', amount_liters, notes, worker_name } = req.body;
    if (!plot_id) return res.status(400).json({ error: 'plot_id required' });

    const [plots] = await pool.query('SELECT * FROM plots WHERE id = ? AND user_id = ?', [plot_id, req.user.id]);
    if (!plots[0]) return res.status(404).json({ error: 'plot not found' });
    const p = plots[0];

    const today = new Date().toISOString().split('T')[0];
    const waterSource = p.water_source || 'น้ำบาดาลผ่านการกรอง';
    const waterSourceType = p.water_source_type || 'บาดาล';
    const amount = amount_liters !== undefined && Number(amount_liters) > 0 ? Number(amount_liters) : (p.default_water_liters || 50);
    const worker = worker_name || p.default_worker_name || req.user.display_name || 'ผู้ดูแลแปลง';

    const [result] = await pool.query(
      `INSERT INTO water_logs (user_id, plot_id, log_date, session, water_source, water_source_type, water_quality, contamination_check, amount_liters, worker_name, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, 'ผ่าน', 1, ?, ?, ?, ?, ?)`,
      [req.user.id, plot_id, today, session, waterSource, waterSourceType, amount, worker, notes || `⚡ 1-Click Quick Watering (${session})`, req.user.email, req.user.email]
    );

    const [newRow] = await pool.query('SELECT * FROM water_logs WHERE id = ?', [result.insertId]);
    res.json({
      success: true,
      log: newRow[0],
      message: `บันทึกรดน้ำรอบ${session} แปลง ${p.name} เรียบร้อยแล้ว (${amount} ลิตร)`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. บันทึกรดน้ำทุกแปลงที่กำลังปลูกวันนี้ในคลิกเดียว (1-Click All Active Plots)
waterRouter.post('/quick-all', async (req, res) => {
  try {
    const { session = 'เช้า' } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // ดึงเฉพาะแปลงที่กำลังปลูก (status = 'active')
    const [activePlots] = await pool.query(
      `SELECT * FROM plots WHERE user_id = ? AND status = 'active'`,
      [req.user.id]
    );

    if (activePlots.length === 0) {
      return res.json({ success: true, count: 0, message: 'ไม่มีแปลงที่กำลังปลูก (Active) ในขณะนี้' });
    }

    // ตรวจสอบว่าแปลงไหนรดน้ำรอบนี้แล้ววันนี้
    const [todayWatered] = await pool.query(
      `SELECT plot_id FROM water_logs WHERE user_id = ? AND DATE(log_date) = ? AND (session = ? OR (session IS NULL AND ? = 'เช้า'))`,
      [req.user.id, today, session, session]
    );
    const alreadyWateredIds = new Set(todayWatered.map(r => r.plot_id));

    const plotsToWater = activePlots.filter(p => !alreadyWateredIds.has(p.id));

    if (plotsToWater.length === 0) {
      return res.json({
        success: true,
        count: 0,
        already_watered: true,
        message: `ทุกแปลงที่กำลังปลูกได้รับการบันทึกรดน้ำรอบ${session} สำหรับวันนี้เรียบร้อยแล้ว`
      });
    }

    const inserted = [];
    for (const p of plotsToWater) {
      const waterSource = p.water_source || 'น้ำบาดาลผ่านการกรอง';
      const waterSourceType = p.water_source_type || 'บาดาล';
      const amount = p.default_water_liters || 50;
      const worker = p.default_worker_name || req.user.display_name || 'ผู้ดูแลแปลง';

      const [resIns] = await pool.query(
        `INSERT INTO water_logs (user_id, plot_id, log_date, session, water_source, water_source_type, water_quality, contamination_check, amount_liters, worker_name, notes, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, 'ผ่าน', 1, ?, ?, ?, ?, ?)`,
        [req.user.id, p.id, today, session, waterSource, waterSourceType, amount, worker, `⚡ 1-Click All Plots Routine (${session})`, req.user.email, req.user.email]
      );
      inserted.push({ id: resIns.insertId, plot_id: p.id, plot_name: p.name, session, amount });
    }

    res.json({
      success: true,
      count: inserted.length,
      plots: inserted,
      message: `บันทึกรดน้ำรอบ${session} ให้ ${inserted.length} แปลงเรียบร้อยแล้ว!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Standard CRUD fallback
waterRouter.use('/', crudRouter('water_logs', [
  'plot_id',
  'log_date',
  'session',
  'water_source',
  'water_source_type',
  'water_quality',
  'contamination_check',
  'amount_liters',
  'worker_name',
  'notes',
]));
