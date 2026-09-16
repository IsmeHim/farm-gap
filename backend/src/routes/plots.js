import { Router } from 'express';
import { crudRouter } from './crud.js';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const plotsRouter = Router();
plotsRouter.use(authRequired);

// รายการรอบการปลูกทั้งหมด (All Crop Cycles History)
plotsRouter.get('/cycles', async (req, res) => {
  try {
    const { plot_id } = req.query;
    let query = `
      SELECT c.*, p.name as plot_name, p.water_source, p.area_sqm
      FROM crop_cycles c
      JOIN plots p ON p.id = c.plot_id
      WHERE c.user_id = ?
    `;
    const params = [req.user.id];
    if (plot_id) {
      query += ' AND c.plot_id = ?';
      params.push(plot_id);
    }
    query += ' ORDER BY c.id DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// เริ่มรอบการปลูกใหม่บนแปลงเดิม (Start New Crop Cycle on existing plot)
plotsRouter.post('/:id/new-crop', async (req, res) => {
  try {
    const {
      crop_name,
      planting_date,
      expected_harvest_date,
      area_sqm,
      default_water_liters,
      default_worker_name,
      water_source,
      water_source_type,
      soil_notes,
      notes,
    } = req.body;

    if (!crop_name) return res.status(400).json({ error: 'กรุณาระบุชื่อพืชที่จะปลูกรอบใหม่' });

    const [plots] = await pool.query('SELECT * FROM plots WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!plots[0]) return res.status(404).json({ error: 'ไม่พบแปลงปลูกนี้' });
    const current = plots[0];

    // Archive current/previous crop into previous_crop_history text
    const prevHistory = current.previous_crop_history || '';
    const oldPlantDate = current.planting_date ? new Date(current.planting_date).toISOString().split('T')[0] : '-';
    const archiveEntry = `[รอบที่ ${current.cycle_number || 1}] ${current.crop_name} (วันปลูก: ${oldPlantDate} | สถานะเดิม: ${current.status})`;
    const updatedHistory = prevHistory ? `${prevHistory}\n${archiveEntry}` : archiveEntry;

    const newCycle = (current.cycle_number || 1) + 1;
    const pDate = planting_date || new Date().toISOString().split('T')[0];

    // Close any previous active cycle for this plot in crop_cycles and sync harvest info if available
    const [lastHarvest] = await pool.query(
      'SELECT quantity, unit, quality_grade, lot_code, harvest_date FROM harvest_logs WHERE plot_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
      [req.params.id, req.user.id]
    );

    if (lastHarvest.length > 0) {
      const h = lastHarvest[0];
      await pool.query(
        `UPDATE crop_cycles 
         SET status = 'harvested',
             harvest_quantity = COALESCE(harvest_quantity, ?),
             harvest_unit = COALESCE(harvest_unit, ?),
             quality_grade = COALESCE(quality_grade, ?),
             lot_code = COALESCE(lot_code, ?),
             harvest_date = COALESCE(harvest_date, ?)
         WHERE plot_id = ? AND user_id = ? AND status = 'active'`,
        [h.quantity, h.unit, h.quality_grade, h.lot_code, h.harvest_date, req.params.id, req.user.id]
      );
    } else {
      await pool.query(
        `UPDATE crop_cycles SET status = 'harvested' WHERE plot_id = ? AND user_id = ? AND status = 'active'`,
        [req.params.id, req.user.id]
      );
    }

    // Insert new cycle into crop_cycles
    const cleanName = (current.name || '').replace(/แปลง|\s|\(.*?\)/g, '').trim() || (`P${current.id}`);
    const cycleCode = `BATCH-${cleanName}-R${newCycle}`;
    await pool.query(
      `INSERT INTO crop_cycles (user_id, plot_id, cycle_number, cycle_code, crop_name, planting_date, expected_harvest_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        req.user.id,
        req.params.id,
        newCycle,
        cycleCode,
        crop_name,
        pDate,
        expected_harvest_date || null,
        notes || null
      ]
    );

    await pool.query(
      `UPDATE plots SET 
        crop_name = ?,
        planting_date = ?,
        expected_harvest_date = ?,
        area_sqm = COALESCE(?, area_sqm),
        default_water_liters = COALESCE(?, default_water_liters),
        default_worker_name = COALESCE(?, default_worker_name),
        water_source = COALESCE(?, water_source),
        water_source_type = COALESCE(?, water_source_type),
        soil_notes = COALESCE(?, soil_notes),
        previous_crop_history = ?,
        status = 'active',
        cycle_number = ?,
        notes = COALESCE(?, notes),
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        crop_name,
        pDate,
        expected_harvest_date || null,
        area_sqm || null,
        default_water_liters || null,
        default_worker_name || null,
        water_source || null,
        water_source_type || null,
        soil_notes || null,
        updatedHistory,
        newCycle,
        notes || null,
        req.user.email,
        req.params.id,
        req.user.id,
      ]
    );

    const [updatedRows] = await pool.query('SELECT * FROM plots WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      plot: updatedRows[0],
      message: `เริ่มรอบการปลูกใหม่ (${crop_name} - รอบที่ ${newCycle}) บนแปลง ${current.name} สำเร็จ!`
    });
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
  'previous_crop_history',
  'field_safety_status',
  'soil_notes',
  'status',
  'notes',
  'default_water_liters',
  'default_worker_name',
  'cycle_number',
]));
