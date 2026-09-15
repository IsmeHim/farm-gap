import { Router } from 'express';
import { pool } from '../db.js';

// Public traceability — anyone can scan QR
const r = Router();

r.get('/:lot', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT h.*, p.name AS plot_name, p.crop_name, p.cycle_number, u.farm_name
     FROM harvest_logs h
     JOIN plots p ON p.id = h.plot_id
     JOIN users u ON u.id = h.user_id
     WHERE h.lot_code = ? LIMIT 1`,
    [req.params.lot]
  );
  if (!rows[0]) return res.status(404).json({ error: 'lot not found' });
  res.json(rows[0]);
});

export default r;
