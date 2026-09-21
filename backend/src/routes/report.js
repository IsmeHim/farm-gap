import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const r = Router();
r.use(authRequired);

// Aggregate yearly data (frontend renders PDF with jsPDF or prints)
r.get('/:year', async (req, res) => {
  const year = Number(req.params.year);
  const start = `${year}-01-01`, end = `${year}-12-31`;
  const uid = req.user.id;
  const q = (sql, params) => pool.query(sql, params).then(([rows]) => rows);
  const [plots, batches, water, chems, pests, harvest, storage, costs, profile, activities, cycles] = await Promise.all([
    q(`SELECT p.*, 
              COALESCE(NULLIF(b.soil_recipe, ''), p.soil_recipe) AS effective_soil_recipe,
              COALESCE(NULLIF(b.soil_recipe, ''), p.soil_recipe) AS soil_recipe
       FROM plots p
       LEFT JOIN planting_batches b ON b.id = p.current_batch_id
       WHERE p.user_id=? 
       ORDER BY p.plot_number ASC, p.id ASC`, [uid]),
    q(`SELECT b.*, 
              COALESCE(NULLIF(b.soil_recipe, ''), p.soil_recipe) AS soil_recipe,
              p.name AS plot_name, c.name AS crop_name 
       FROM planting_batches b 
       JOIN plots p ON p.id = b.plot_id 
       LEFT JOIN crops c ON c.id = b.crop_id 
       WHERE b.user_id=? 
       ORDER BY b.id DESC`, [uid]).catch(() => []),
    q('SELECT * FROM water_logs WHERE user_id=? AND log_date BETWEEN ? AND ? ORDER BY log_date ASC', [uid, start, end]),
    q('SELECT * FROM chemical_logs WHERE user_id=? AND log_date BETWEEN ? AND ? ORDER BY log_date ASC', [uid, start, end]),
    q('SELECT * FROM pest_logs WHERE user_id=? AND log_date BETWEEN ? AND ? ORDER BY log_date ASC', [uid, start, end]),
    q('SELECT * FROM harvest_logs WHERE user_id=? AND harvest_date BETWEEN ? AND ? ORDER BY harvest_date ASC', [uid, start, end]),
    q('SELECT * FROM storage_logs WHERE user_id=? AND log_date BETWEEN ? AND ? ORDER BY log_date ASC', [uid, start, end]),
    q('SELECT * FROM cost_logs WHERE user_id=? AND log_date BETWEEN ? AND ? ORDER BY log_date ASC', [uid, start, end]),
    q('SELECT display_name, farm_name FROM users WHERE id=?', [uid]),
    q(`SELECT a.*, p.name AS plot_name, p.crop_name 
       FROM crop_activities a 
       JOIN plots p ON p.id = a.plot_id 
       WHERE a.user_id=? AND a.activity_date BETWEEN ? AND ? 
       ORDER BY a.activity_date ASC`, [uid, start, end]),
    q('SELECT * FROM crop_cycles WHERE user_id=? ORDER BY cycle_number ASC, id ASC', [uid]).catch(() => []),
  ]);
  res.json({ year, profile: profile[0], plots, batches, water, chems, pests, harvest, storage, workers: [], costs, activities, cycles });
});

export default r;
