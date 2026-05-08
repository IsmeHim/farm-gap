import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const r = Router();
r.use(authRequired);

// Aggregate yearly data (frontend renders PDF with jsPDF)
r.get('/:year', async (req, res) => {
  const year = Number(req.params.year);
  const start = `${year}-01-01`, end = `${year}-12-31`;
  const uid = req.user.id;
  const q = (sql, params) => pool.query(sql, params).then(([rows]) => rows);
  const [plots, water, chems, pests, harvest, storage, workers, costs, profile] = await Promise.all([
    q('SELECT * FROM plots WHERE user_id=?', [uid]),
    q('SELECT * FROM water_logs WHERE user_id=? AND log_date BETWEEN ? AND ?', [uid, start, end]),
    q('SELECT * FROM chemical_logs WHERE user_id=? AND log_date BETWEEN ? AND ?', [uid, start, end]),
    q('SELECT * FROM pest_logs WHERE user_id=? AND log_date BETWEEN ? AND ?', [uid, start, end]),
    q('SELECT * FROM harvest_logs WHERE user_id=? AND harvest_date BETWEEN ? AND ?', [uid, start, end]),
    q('SELECT * FROM storage_logs WHERE user_id=? AND log_date BETWEEN ? AND ?', [uid, start, end]),
    q('SELECT * FROM workers WHERE user_id=?', [uid]),
    q('SELECT * FROM cost_logs WHERE user_id=? AND log_date BETWEEN ? AND ?', [uid, start, end]),
    q('SELECT display_name, farm_name FROM users WHERE id=?', [uid]),
  ]);
  res.json({ year, profile: profile[0], plots, water, chems, pests, harvest, storage, workers, costs });
});

export default r;
