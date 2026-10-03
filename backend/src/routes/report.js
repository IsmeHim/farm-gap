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
  const [plots, batches, water, chems, pests, harvest, storage, costs, profile, activities, crops] = await Promise.all([
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
    q(`SELECT a.*, p.name AS plot_name, p.plot_number,
              COALESCE(
                NULLIF(p.crop_name, '-'),
                (SELECT c.name FROM planting_batches pb JOIN crops c ON c.id = pb.crop_id WHERE pb.plot_id = a.plot_id ORDER BY pb.id DESC LIMIT 1),
                (SELECT c.name FROM crops c WHERE c.id = p.seed_crop_id),
                CASE 
                  WHEN a.title LIKE '%กวางตุ้ง%' OR a.details LIKE '%กวางตุ้ง%' THEN 'ผักกวางตุ้ง'
                  WHEN a.title LIKE '%ผักบุ้ง%' OR a.details LIKE '%ผักบุ้ง%' THEN 'ผักบุ้งจีน'
                  WHEN a.title LIKE '%ฟิลเล่ย์%' OR a.details LIKE '%ฟิลเล่ย์%' THEN 'ฟิลเล่ย์ ไอซ์เบิร์ก'
                  WHEN a.title LIKE '%กรีนโอ๊ค%' OR a.details LIKE '%กรีนโอ๊ค%' THEN 'กรีนโอ๊ค'
                  WHEN a.title LIKE '%เรดโอ๊ค%' OR a.details LIKE '%เรดโอ๊ค%' THEN 'เรดโอ๊ค'
                  ELSE 'ผักปลอดภัย GAP'
                END
              ) AS crop_name
       FROM crop_activities a 
       JOIN plots p ON p.id = a.plot_id 
       WHERE a.user_id=? AND a.activity_date BETWEEN ? AND ? 
       ORDER BY a.activity_date ASC, a.id ASC`, [uid, start, end]),
    q('SELECT * FROM crops WHERE user_id=? OR user_id IS NULL ORDER BY id ASC', [uid]),
  ]);

  // Derive cycles structure from batches so report maintains backward compatibility
  const cycles = (batches || []).map((b, idx) => ({
    id: b.id,
    plot_id: b.plot_id,
    cycle_number: idx + 1,
    cycle_code: b.batch_code,
    crop_name: b.crop_name,
    planting_date: b.start_date,
    expected_harvest_date: b.expected_harvest_date,
    status: b.status,
    notes: b.notes
  }));

  res.json({ year, profile: profile[0], plots, batches, water, chems, pests, harvest, storage, workers: [], costs, activities, cycles, crops });
});

export default r;
