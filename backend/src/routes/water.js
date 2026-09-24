import { Router } from 'express';
import { crudRouter } from './crud.js';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const waterRouter = Router();
waterRouter.use(authRequired);

// Helper to get or init user settings
export async function getUserSettings(userId) {
  const [rows] = await pool.query('SELECT * FROM water_routine_settings WHERE user_id = ?', [userId]);
  if (rows[0]) return rows[0];

  await pool.query(`
    INSERT INTO water_routine_settings (user_id, auto_routine_enabled, auto_mode_type, auto_until_date, morning_time, evening_time, climate_condition, water_source)
    VALUES (?, TRUE, 'until_harvest', NULL, '07:00', '16:30', 'normal', 'น้ำสะอาดมาตรฐาน GAP')
    ON DUPLICATE KEY UPDATE user_id = user_id
  `, [userId]);

  const [created] = await pool.query('SELECT * FROM water_routine_settings WHERE user_id = ?', [userId]);
  return created[0] || {
    auto_routine_enabled: 1,
    auto_mode_type: 'until_harvest',
    auto_until_date: null,
    morning_time: '07:00',
    evening_time: '16:30',
    climate_condition: 'normal',
    water_source: 'น้ำสะอาดมาตรฐาน GAP'
  };
}

// Timezone helper for Thailand (Asia/Bangkok, UTC+7)
export function getBangkokDateTime(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(validDate);
  const get = (type) => parts.find(p => p.type === type)?.value || '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const second = parseInt(get('second'), 10);

  const dateStr = `${year}-${month}-${day}`;
  const timeVal = hour * 60 + minute;

  return { dateStr, hour, minute, second, timeVal };
}

// ประมวลผล Smart Auto-Watering ให้ผู้ใช้คนเดียว (อิงเวลาไทย Asia/Bangkok)
export async function processAutoWaterRoutineForUser(userId) {
  const { dateStr: today, timeVal: currentTimeVal } = getBangkokDateTime();
  const settings = await getUserSettings(userId);

  if (!settings.auto_routine_enabled) {
    return { executed: false, reason: 'disabled', settings, isExpired: false };
  }

  // ตรวจสอบวันสิ้นสุดโหมดอัตโนมัติ
  let isExpired = false;
  if (settings.auto_mode_type === 'custom_date' && settings.auto_until_date) {
    const untilDateStr = typeof settings.auto_until_date === 'string'
      ? settings.auto_until_date.split('T')[0]
      : getBangkokDateTime(settings.auto_until_date).dateStr;
    if (today > untilDateStr) {
      isExpired = true;
      return { executed: false, reason: 'expired', settings, isExpired: true };
    }
  }

  // ดึงแปลงที่กำลังปลูก (active, growing, harvest_ready) และเปิดโหมดรดน้ำอัตโนมัติ
  const [activePlots] = await pool.query(
    `SELECT * FROM plots 
     WHERE user_id = ? 
       AND status IN ('active', 'growing', 'harvest_ready')
       AND (auto_water_enabled IS NULL OR auto_water_enabled = 1)`,
    [userId]
  );

  if (activePlots.length === 0) {
    return { executed: false, reason: 'no_active_plots', settings, isExpired };
  }

  const [mH, mM] = (settings.morning_time || '07:00').split(':').map(Number);
  const morningTimeVal = (mH || 7) * 60 + (mM || 0);

  const [eH, eM] = (settings.evening_time || '16:30').split(':').map(Number);
  const eveningTimeVal = (eH || 16) * 60 + (eM || 30);

  // ดึง log ที่มีอยู่แล้วของวันนี้
  const [existingLogs] = await pool.query(
    `SELECT plot_id, session FROM water_logs WHERE user_id = ? AND DATE(log_date) = ?`,
    [userId, today]
  );
  const existingMorning = new Set(existingLogs.filter(r => r.session === 'เช้า' || !r.session).map(r => r.plot_id));
  const existingEvening = new Set(existingLogs.filter(r => r.session === 'เย็น').map(r => r.plot_id));

  const [u] = await pool.query('SELECT display_name, email FROM users WHERE id = ?', [userId]);
  const worker = u[0]?.display_name || 'เจ้าของฟาร์ม';
  const userEmail = u[0]?.email || 'system';

  let addedMorning = 0;
  let addedEvening = 0;

  // ตรวจรอบเช้า: ถ้าเลยเวลาเช้าแล้วและยังไม่ได้บันทึก
  if (currentTimeVal >= morningTimeVal) {
    for (const p of activePlots) {
      if (!existingMorning.has(p.id)) {
        const isRainy = settings.climate_condition === 'rainy_humidity';
        const noteText = isRainy
          ? `🌧️ กิจวัตรอัตโนมัติรอบเช้า (${settings.morning_time} น.) - ฝนตก/ความชื้นสูง รดควบคุมความชื้น [โรงเรือนหลังคาใส GAP]`
          : `💧 กิจวัตรอัตโนมัติรอบเช้า (${settings.morning_time} น.) - น้ำสะอาดมาตรฐาน GAP [โรงเรือนหลังคาใส]`;

        await pool.query(
          `INSERT INTO water_logs (user_id, plot_id, log_date, session, water_source, water_source_type, water_quality, contamination_check, amount_liters, worker_name, notes, climate_condition, is_auto_routine, created_by, updated_by)
           VALUES (?, ?, ?, 'เช้า', ?, ?, 'ผ่าน', 1, NULL, ?, ?, ?, 1, ?, ?)`,
          [userId, p.id, today, p.water_source || settings.water_source, p.water_source || settings.water_source, p.default_worker_name || worker, noteText, settings.climate_condition || 'normal', userEmail, userEmail]
        );
        addedMorning++;
      }
    }
  }

  // ตรวจรอบเย็น: ถ้าเลยเวลาเย็นแล้วและยังไม่ได้บันทึก
  if (currentTimeVal >= eveningTimeVal) {
    for (const p of activePlots) {
      if (!existingEvening.has(p.id)) {
        const isRainy = settings.climate_condition === 'rainy_humidity';
        const noteText = isRainy
          ? `🌧️ กิจวัตรอัตโนมัติรอบเย็น (${settings.evening_time} น.) - สภาพอากาศความชื้นสูง รดเบาบางควบคุมความชื้น [โรงเรือนหลังคาใส GAP]`
          : `💧 กิจวัตรอัตโนมัติรอบเย็น (${settings.evening_time} น.) - น้ำสะอาดมาตรฐาน GAP [โรงเรือนหลังคาใส]`;

        await pool.query(
          `INSERT INTO water_logs (user_id, plot_id, log_date, session, water_source, water_source_type, water_quality, contamination_check, amount_liters, worker_name, notes, climate_condition, is_auto_routine, created_by, updated_by)
           VALUES (?, ?, ?, 'เย็น', ?, ?, 'ผ่าน', 1, NULL, ?, ?, ?, 1, ?, ?)`,
          [userId, p.id, today, p.water_source || settings.water_source, p.water_source || settings.water_source, p.default_worker_name || worker, noteText, settings.climate_condition || 'normal', userEmail, userEmail]
        );
        addedEvening++;
      }
    }
  }

  return { executed: true, addedMorning, addedEvening, settings, isExpired };
}

// Background Task: ประมวลผล Auto-Routine ให้ทุกผู้ใช้ที่เปิดโหมดนี้อยู่ (เรียกตามเวลาจริง)
export async function processAutoWaterRoutineForAllUsers() {
  try {
    const [rows] = await pool.query('SELECT DISTINCT user_id FROM water_routine_settings WHERE auto_routine_enabled = 1');
    for (const r of rows) {
      await processAutoWaterRoutineForUser(r.user_id);
    }
  } catch (err) {
    console.error('Auto-Routine background error:', err.message);
  }
}

// 1. ดึงการตั้งค่ากิจวัตรการให้น้ำ (Water Routine Settings)
waterRouter.get('/settings', async (req, res) => {
  try {
    const settings = await getUserSettings(req.user.id);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. อัปเดตการตั้งค่ากิจวัตรการให้น้ำ
waterRouter.put('/settings', async (req, res) => {
  try {
    const {
      auto_routine_enabled,
      auto_mode_type,
      auto_until_date,
      morning_time,
      evening_time,
      climate_condition,
      water_source
    } = req.body;

    const formattedUntilDate = auto_until_date ? String(auto_until_date).split('T')[0] : null;

    await pool.query(`
      INSERT INTO water_routine_settings (user_id, auto_routine_enabled, auto_mode_type, auto_until_date, morning_time, evening_time, climate_condition, water_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        auto_routine_enabled = VALUES(auto_routine_enabled),
        auto_mode_type = VALUES(auto_mode_type),
        auto_until_date = VALUES(auto_until_date),
        morning_time = VALUES(morning_time),
        evening_time = VALUES(evening_time),
        climate_condition = VALUES(climate_condition),
        water_source = VALUES(water_source)
    `, [
      req.user.id,
      auto_routine_enabled ? 1 : 0,
      auto_mode_type || 'until_harvest',
      formattedUntilDate,
      morning_time || '07:00',
      evening_time || '16:30',
      climate_condition || 'normal',
      water_source || 'น้ำสะอาดมาตรฐาน GAP'
    ]);

    if (auto_routine_enabled) {
      await processAutoWaterRoutineForUser(req.user.id);
    }

    const updated = await getUserSettings(req.user.id);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.1 สลับเปิด/ปิดโหมดรดน้ำอัตโนมัติแบบ 1-Click (Toggle Auto-Routine)
waterRouter.post('/toggle-auto', async (req, res) => {
  try {
    const { enabled, auto_mode_type, auto_until_date } = req.body;
    const current = await getUserSettings(req.user.id);
    const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : (current.auto_routine_enabled ? 0 : 1);
    const newModeType = auto_mode_type !== undefined ? auto_mode_type : (current.auto_mode_type || 'until_harvest');
    const newUntilDate = auto_until_date !== undefined
      ? (auto_until_date ? String(auto_until_date).split('T')[0] : null)
      : current.auto_until_date;

    await pool.query(`
      UPDATE water_routine_settings
      SET auto_routine_enabled = ?, auto_mode_type = ?, auto_until_date = ?
      WHERE user_id = ?
    `, [newEnabled, newModeType, newUntilDate, req.user.id]);

    if (newEnabled) {
      await processAutoWaterRoutineForUser(req.user.id);
    }

    const updated = await getUserSettings(req.user.id);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.2 สลับเปิด/ปิดการรดน้ำอัตโนมัติเฉพาะแปลง (Per-Plot Auto Toggle)
waterRouter.post('/plot-auto-toggle', async (req, res) => {
  try {
    const { plot_id, enabled } = req.body;
    if (!plot_id) return res.status(400).json({ error: 'plot_id required' });

    const [plots] = await pool.query(
      'SELECT id, name, auto_water_enabled FROM plots WHERE id = ? AND user_id = ?',
      [plot_id, req.user.id]
    );
    if (!plots[0]) return res.status(404).json({ error: 'ไม่พบแปลงปลูกนี้' });

    const currentVal = plots[0].auto_water_enabled !== 0 ? 1 : 0;
    const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : (currentVal === 1 ? 0 : 1);

    await pool.query(
      'UPDATE plots SET auto_water_enabled = ? WHERE id = ? AND user_id = ?',
      [newEnabled, plot_id, req.user.id]
    );

    res.json({
      success: true,
      plot_id,
      plot_name: plots[0].name,
      auto_water_enabled: newEnabled,
      message: newEnabled === 1
        ? `🟢 เปิดโหมดรดน้ำอัตโนมัติให้ "${plots[0].name}" เรียบร้อยแล้ว`
        : `⏸️ งดรดน้ำอัตโนมัติสำหรับ "${plots[0].name}" (เว้นน้ำ/พักแปลง) เรียบร้อยแล้ว`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. สลับสภาพอากาศโรงเรือน (Climate Quick Toggle: 'normal' vs 'rainy_humidity')
waterRouter.post('/climate-toggle', async (req, res) => {
  try {
    const { climate_condition } = req.body;
    const condition = climate_condition === 'rainy_humidity' ? 'rainy_humidity' : 'normal';
    await pool.query(`
      INSERT INTO water_routine_settings (user_id, climate_condition)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE climate_condition = VALUES(climate_condition)
    `, [req.user.id, condition]);

    // อัปเดตบันทึกของวันนี้ด้วย (ถ้ามี)
    const today = getBangkokDateTime().dateStr;
    await pool.query(`
      UPDATE water_logs 
      SET climate_condition = ?
      WHERE user_id = ? AND DATE(log_date) = ?
    `, [condition, req.user.id, today]);

    res.json({ success: true, climate_condition: condition });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. ตรวจสอบสถานะการรดน้ำประจำวันนี้ และประมวลผล Auto-Routine ตามเวลา (อิงเวลาไทย Asia/Bangkok)
waterRouter.get('/today-status', async (req, res) => {
  try {
    const { dateStr: today } = getBangkokDateTime();
    const autoResult = await processAutoWaterRoutineForUser(req.user.id);
    const settings = autoResult.settings || await getUserSettings(req.user.id);

    // ดึง rows ปัจจุบันของวันนี้ทั้งหมด (ตามเวลาท้องถิ่นไทย)
    const [rows] = await pool.query(
      `SELECT w.*, p.name AS plot_name, p.crop_name
       FROM water_logs w
       JOIN plots p ON p.id = w.plot_id
       WHERE w.user_id = ? AND DATE(w.log_date) = ?
       ORDER BY w.id DESC`,
      [req.user.id, today]
    );

    const morningPlotIds = [...new Set(rows.filter(r => r.session === 'เช้า' || !r.session).map(r => r.plot_id))];
    const eveningPlotIds = [...new Set(rows.filter(r => r.session === 'เย็น').map(r => r.plot_id))];
    const wateredPlotIds = [...new Set(rows.map(r => r.plot_id))];

    // คำนวณวันหมดอายุและจำนวนวันที่เหลือ
    let isExpired = false;
    let daysRemaining = null;
    if (settings.auto_mode_type === 'custom_date' && settings.auto_until_date) {
      const untilDateStr = typeof settings.auto_until_date === 'string'
        ? settings.auto_until_date.split('T')[0]
        : getBangkokDateTime(settings.auto_until_date).dateStr;
      const todayDate = new Date(`${today}T00:00:00+07:00`);
      const untilDate = new Date(`${untilDateStr}T00:00:00+07:00`);
      const diffTime = untilDate.getTime() - todayDate.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (today > untilDateStr) {
        isExpired = true;
      }
    }

    res.json({
      today,
      settings,
      isExpired,
      daysRemaining,
      climate_condition: settings.climate_condition || 'normal',
      morningPlotIds,
      eveningPlotIds,
      wateredPlotIds,
      logs: rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. สรุปความสม่ำเสมอของการให้น้ำประจำรอบปลูก (Water Consistency per Crop Cycle)
waterRouter.get('/cycle-summary', async (req, res) => {
  try {
    const [plots] = await pool.query(
      `SELECT * FROM plots 
       WHERE user_id = ? AND status IN ('active', 'growing', 'harvest_ready')
       ORDER BY plot_number ASC, id ASC`,
      [req.user.id]
    );

    const [crops] = await pool.query(
      `SELECT name, growth_days FROM crops WHERE user_id = ? OR user_id IS NULL`,
      [req.user.id]
    ).catch(() => [[]]);
    const cropMap = Object.fromEntries((crops || []).map(c => [c.name, c.growth_days]));

    const summaries = [];
    const today = new Date();

    for (const p of plots) {
      const plantingDate = p.planting_date ? new Date(p.planting_date) : null;
      let daysPlanted = 0;
      if (plantingDate && !isNaN(plantingDate.getTime())) {
        const diffMs = today.getTime() - plantingDate.getTime();
        daysPlanted = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }

      // หาประวัติการให้น้ำของแปลงนี้นับตั้งแต่วันที่ปลูก
      let logQuery = `SELECT * FROM water_logs WHERE user_id = ? AND plot_id = ?`;
      const queryParams = [req.user.id, p.id];
      if (p.planting_date) {
        logQuery += ` AND DATE(log_date) >= ?`;
        queryParams.push(p.planting_date);
      }
      logQuery += ` ORDER BY log_date ASC`;

      const [logs] = await pool.query(logQuery, queryParams);

      const morningLogs = logs.filter(l => l.session === 'เช้า' || !l.session);
      const eveningLogs = logs.filter(l => l.session === 'เย็น');
      const rainyLogs = logs.filter(l => l.climate_condition === 'rainy_humidity');
      const normalLogs = logs.filter(l => l.climate_condition === 'normal' || !l.climate_condition);

      const expectedSessions = Math.max(1, daysPlanted * 2);
      const totalSessions = logs.length;
      const consistencyPct = Math.min(100, Math.round((totalSessions / expectedSessions) * 100));

      summaries.push({
        plot_id: p.id,
        plot_name: p.name,
        plot_number: p.plot_number,
        crop_name: p.crop_name,
        planting_date: p.planting_date,
        cycle_number: p.cycle_number || 1,
        days_planted: daysPlanted,
        estimated_days: cropMap[p.crop_name] || 35,
        water_source: p.water_source || 'น้ำสะอาดมาตรฐาน GAP',
        total_logs: logs.length,
        morning_count: morningLogs.length,
        evening_count: eveningLogs.length,
        rainy_count: rainyLogs.length,
        normal_count: normalLogs.length,
        consistency_pct: consistencyPct,
      });
    }

    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. ข้อมูลภาพรวมปฏิทินกิจวัตรรายเดือน (Monthly Routine Heatmap Data)
waterRouter.get('/calendar-logs', async (req, res) => {
  try {
    const { plot_id } = req.query;
    let query = `
      SELECT DATE(log_date) as date, 
             COUNT(DISTINCT plot_id) as plot_count,
             COUNT(*) as total_logs,
             SUM(CASE WHEN session = 'เช้า' OR session IS NULL THEN 1 ELSE 0 END) as morning_logs,
             SUM(CASE WHEN session = 'เย็น' THEN 1 ELSE 0 END) as evening_logs,
             MAX(climate_condition) as climate_condition
      FROM water_logs
      WHERE user_id = ?
    `;
    const params = [req.user.id];

    if (plot_id) {
      query += ` AND plot_id = ?`;
      params.push(plot_id);
    }

    // เอา 60 วันย้อนหลัง
    query += ` AND log_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) GROUP BY DATE(log_date) ORDER BY DATE(log_date) ASC`;
    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6.1 ข้อมูลตารางสรุปการให้น้ำรายวัน (1 วัน = 1 แถว รวมทุกแปลงมาตรฐาน GAP)
waterRouter.get('/daily-table', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT w.*, p.name AS plot_name, p.plot_number, p.crop_name
      FROM water_logs w
      JOIN plots p ON p.id = w.plot_id
      WHERE w.user_id = ?
    `;
    const params = [req.user.id];

    if (start_date && end_date) {
      query += ` AND DATE(w.log_date) BETWEEN ? AND ?`;
      params.push(start_date, end_date);
    }

    query += ` ORDER BY w.log_date DESC, w.id DESC`;
    const [rawLogs] = await pool.query(query, params);

    const [activePlots] = await pool.query(
      `SELECT id, name, plot_number, crop_name, auto_water_enabled FROM plots WHERE user_id = ? AND status IN ('active', 'growing', 'harvest_ready') ORDER BY plot_number ASC, id ASC`,
      [req.user.id]
    );
    const totalActiveCount = activePlots.length;
    const pausedPlots = activePlots.filter(p => p.auto_water_enabled === 0);
    const enabledActiveCount = activePlots.filter(p => p.auto_water_enabled !== 0).length;

    const map = new Map();
    for (const log of rawLogs) {
      const dStr = typeof log.log_date === 'string'
        ? log.log_date.split('T')[0]
        : new Date(log.log_date).toISOString().split('T')[0];

      if (!map.has(dStr)) {
        map.set(dStr, {
          date: dStr,
          total_logs: 0,
          morning_plots: [],
          evening_plots: [],
          climate_condition: log.climate_condition || 'normal',
          water_source: log.water_source || 'น้ำสะอาดมาตรฐาน GAP',
          water_quality: log.water_quality || 'ผ่าน',
          worker_names: new Set(),
          is_auto: false,
          logs: [],
        });
      }

      const dayGroup = map.get(dStr);
      dayGroup.total_logs++;
      dayGroup.logs.push(log);
      if (log.worker_name) dayGroup.worker_names.add(log.worker_name);
      if (log.is_auto_routine) dayGroup.is_auto = true;
      if (log.climate_condition === 'rainy_humidity') dayGroup.climate_condition = 'rainy_humidity';
      if (log.water_source) dayGroup.water_source = log.water_source;

      const isMorning = log.session === 'เช้า' || !log.session;
      const isEvening = log.session === 'เย็น';

      const plotInfo = {
        plot_id: log.plot_id,
        plot_name: log.plot_name,
        plot_number: log.plot_number,
        crop_name: log.crop_name,
        amount_liters: log.amount_liters,
        notes: log.notes,
        created_at: log.created_at,
      };

      if (isMorning) {
        if (!dayGroup.morning_plots.some(p => p.plot_id === log.plot_id)) {
          dayGroup.morning_plots.push(plotInfo);
        }
      } else if (isEvening) {
        if (!dayGroup.evening_plots.some(p => p.plot_id === log.plot_id)) {
          dayGroup.evening_plots.push(plotInfo);
        }
      }
    }

    const rows = Array.from(map.values()).map(g => {
      const distinctPlotIds = new Set([
        ...g.morning_plots.map(p => p.plot_id),
        ...g.evening_plots.map(p => p.plot_id)
      ]);

      const isMorningCompleted = (enabledActiveCount > 0 && g.morning_plots.length >= enabledActiveCount) || (totalActiveCount > 0 && g.morning_plots.length >= totalActiveCount);
      const isEveningCompleted = (enabledActiveCount > 0 && g.evening_plots.length >= enabledActiveCount) || (totalActiveCount > 0 && g.evening_plots.length >= totalActiveCount);

      return {
        date: g.date,
        total_logs: g.total_logs,
        plots_watered_count: distinctPlotIds.size,
        total_active_count: totalActiveCount,
        enabled_active_count: enabledActiveCount,
        paused_plots: pausedPlots.map(p => ({ id: p.id, name: p.name, crop_name: p.crop_name })),
        morning_count: g.morning_plots.length,
        evening_count: g.evening_plots.length,
        is_morning_completed: isMorningCompleted,
        is_evening_completed: isEveningCompleted,
        morning_plots: g.morning_plots,
        evening_plots: g.evening_plots,
        climate_condition: g.climate_condition,
        water_source: g.water_source,
        water_quality: g.water_quality,
        workers: Array.from(g.worker_names).join(', ') || 'เจ้าของฟาร์ม',
        is_auto: g.is_auto,
        logs: g.logs,
      };
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6.2 ลบบันทึกการให้น้ำทั้งหมดของวันที่ระบุ
waterRouter.delete('/by-date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) return res.status(400).json({ error: 'date required' });
    const [result] = await pool.query(
      `DELETE FROM water_logs WHERE user_id = ? AND DATE(log_date) = ?`,
      [req.user.id, date]
    );
    res.json({
      success: true,
      deleted: result.affectedRows,
      message: `ลบบันทึกการให้น้ำของวันที่ ${date} สำเร็จ (${result.affectedRows} รายการ)`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6.3 บันทึกการให้น้ำรายวันแบบ Manual (1 วัน บันทึกครบทุกแปลงหรือเลือกแปลง)
waterRouter.post('/daily-record', async (req, res) => {
  try {
    const { log_date, sessions = ['เช้า', 'เย็น'], plot_ids, water_source, climate_condition, notes, worker_name } = req.body;
    if (!log_date) return res.status(400).json({ error: 'log_date required' });

    let targetPlots = [];
    if (plot_ids && plot_ids.length > 0) {
      const [p] = await pool.query('SELECT * FROM plots WHERE user_id = ? AND id IN (?)', [req.user.id, plot_ids]);
      targetPlots = p;
    } else {
      const [p] = await pool.query(`SELECT * FROM plots WHERE user_id = ? AND status IN ('active', 'growing', 'harvest_ready')`, [req.user.id]);
      targetPlots = p;
    }

    if (targetPlots.length === 0) {
      return res.status(400).json({ error: 'ไม่มีแปลงปลูกที่เลือกหรือกำลังปลูก' });
    }

    const settings = await getUserSettings(req.user.id);
    const src = water_source || settings.water_source || 'น้ำสะอาดมาตรฐาน GAP';
    const climate = climate_condition || settings.climate_condition || 'normal';
    const worker = worker_name || req.user.display_name || 'เจ้าของฟาร์ม';

    let count = 0;
    for (const sess of sessions) {
      for (const plot of targetPlots) {
        const [existing] = await pool.query(
          `SELECT id FROM water_logs WHERE user_id = ? AND plot_id = ? AND DATE(log_date) = ? AND session = ?`,
          [req.user.id, plot.id, log_date, sess]
        );
        if (existing.length === 0) {
          const defaultNote = notes || (climate === 'rainy_humidity' 
            ? `🌧️ บันทึกการให้น้ำรอบ${sess} - สภาพอากาศฝนตก/ความชื้นสูง รดควบคุมความชื้น [โรงเรือนหลังคาใส GAP]`
            : `💧 บันทึกการให้น้ำรอบ${sess} - น้ำสะอาดมาตรฐาน GAP [โรงเรือนหลังคาใส]`);

          await pool.query(
            `INSERT INTO water_logs (user_id, plot_id, log_date, session, water_source, water_source_type, water_quality, contamination_check, amount_liters, worker_name, notes, climate_condition, is_auto_routine, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, 'ผ่าน', 1, NULL, ?, ?, ?, 0, ?, ?)`,
            [req.user.id, plot.id, log_date, sess, src, src, worker, defaultNote, climate, req.user.email, req.user.email]
          );
          count++;
        }
      }
    }

    res.json({ success: true, count, message: `บันทึกการให้น้ำวันที่ ${log_date} สำเร็จ (${count} รายการ)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. บันทึกรดน้ำด่วน 1 แปลง (1-Click Quick Watering)
waterRouter.post('/quick-log', async (req, res) => {
  try {
    const { plot_id, session = 'เช้า', amount_liters, notes, worker_name } = req.body;
    if (!plot_id) return res.status(400).json({ error: 'plot_id required' });

    const [plots] = await pool.query('SELECT * FROM plots WHERE id = ? AND user_id = ?', [plot_id, req.user.id]);
    if (!plots[0]) return res.status(404).json({ error: 'plot not found' });
    const p = plots[0];

    const today = getBangkokDateTime().dateStr;
    const settings = await getUserSettings(req.user.id);
    const waterSource = p.water_source || settings.water_source || 'น้ำสะอาดมาตรฐาน GAP';
    const waterSourceType = waterSource;
    const amount = amount_liters ? Number(amount_liters) : null;
    let worker = worker_name || p.default_worker_name || req.user.display_name;
    if (!worker) {
      const [u] = await pool.query('SELECT display_name FROM users WHERE id = ?', [req.user.id]);
      worker = u[0]?.display_name || 'เจ้าของฟาร์ม';
    }

    const isRainy = settings.climate_condition === 'rainy_humidity';
    const defaultNote = isRainy
      ? `🌧️ บันทึกรดน้ำรอบ${session} - สภาพอากาศฝนตก/ความชื้นสูง รดควบคุมความชื้น [โรงเรือนหลังคาใส GAP]`
      : `💧 1-Click รดน้ำรอบ${session} - น้ำสะอาดมาตรฐาน GAP [โรงเรือนหลังคาใส]`;

    const [result] = await pool.query(
      `INSERT INTO water_logs (user_id, plot_id, log_date, session, water_source, water_source_type, water_quality, contamination_check, amount_liters, worker_name, notes, climate_condition, is_auto_routine, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, 'ผ่าน', 1, ?, ?, ?, ?, 0, ?, ?)`,
      [req.user.id, plot_id, today, session, waterSource, waterSourceType, amount, worker, notes || defaultNote, settings.climate_condition || 'normal', req.user.email, req.user.email]
    );

    const [newRow] = await pool.query('SELECT * FROM water_logs WHERE id = ?', [result.insertId]);
    res.json({
      success: true,
      log: newRow[0],
      message: `บันทึกรดน้ำรอบ${session} แปลง ${p.name} เรียบร้อยแล้ว`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. บันทึกรดน้ำทุกแปลงที่กำลังปลูกวันนี้ในคลิกเดียว (1-Click All Active Plots)
waterRouter.post('/quick-all', async (req, res) => {
  try {
    const { session = 'เช้า' } = req.body;
    const today = getBangkokDateTime().dateStr;
    const settings = await getUserSettings(req.user.id);

    const [activePlots] = await pool.query(
      `SELECT * FROM plots 
       WHERE user_id = ? 
         AND status IN ('active', 'growing', 'harvest_ready')
         AND (auto_water_enabled IS NULL OR auto_water_enabled = 1)`,
      [req.user.id]
    );

    if (activePlots.length === 0) {
      return res.json({ success: true, count: 0, message: 'ไม่มีแปลงที่กำลังปลูกในขณะนี้' });
    }

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

    let defaultWorker = req.user.display_name;
    if (!defaultWorker) {
      const [u] = await pool.query('SELECT display_name FROM users WHERE id = ?', [req.user.id]);
      defaultWorker = u[0]?.display_name || 'เจ้าของฟาร์ม';
    }

    const isRainy = settings.climate_condition === 'rainy_humidity';
    const defaultNote = isRainy
      ? `🌧️ รดน้ำรอบ${session} ทุกแปลง - สภาพอากาศฝนตก/ความชื้นสูง รดควบคุมความชื้น [โรงเรือนหลังคาใส GAP]`
      : `⚡ 1-Click รดน้ำรอบ${session} ทุกแปลง - น้ำสะอาดมาตรฐาน GAP [โรงเรือนหลังคาใส]`;

    const inserted = [];
    for (const p of plotsToWater) {
      const waterSource = p.water_source || settings.water_source || 'น้ำสะอาดมาตรฐาน GAP';
      const waterSourceType = waterSource;
      const worker = p.default_worker_name || defaultWorker;

      const [resIns] = await pool.query(
        `INSERT INTO water_logs (user_id, plot_id, log_date, session, water_source, water_source_type, water_quality, contamination_check, amount_liters, worker_name, notes, climate_condition, is_auto_routine, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, 'ผ่าน', 1, NULL, ?, ?, ?, 0, ?, ?)`,
        [req.user.id, p.id, today, session, waterSource, waterSourceType, worker, defaultNote, settings.climate_condition || 'normal', req.user.email, req.user.email]
      );
      inserted.push({ id: resIns.insertId, plot_id: p.id, plot_name: p.name, session });
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
  'climate_condition',
  'is_auto_routine',
]));
