import { Router } from 'express';
import { pool } from '../db.js';

// Public traceability — anyone can scan QR
const r = Router();

r.get('/:lot', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT h.*, p.name AS plot_name, p.crop_name, p.planting_date, u.farm_name
       FROM harvest_logs h
       JOIN plots p ON p.id = h.plot_id
       JOIN users u ON u.id = h.user_id
       WHERE h.lot_code = ? LIMIT 1`,
      [req.params.lot]
    );
    if (!rows[0]) return res.status(404).json({ error: 'lot not found' });
    const harvest = rows[0];

    // Fetch crop activities for this plot up to harvest date
    const [activities] = await pool.query(
      `SELECT * FROM crop_activities 
       WHERE plot_id = ? AND activity_date <= ?
       ORDER BY activity_date ASC`,
      [harvest.plot_id, harvest.harvest_date]
    );

    res.json({
      ...harvest,
      activities: activities || []
    });
  } catch (err) {
    console.error('Trace error:', err);
    res.status(500).json({ error: 'Failed to fetch trace info' });
  }
});

export default r;
