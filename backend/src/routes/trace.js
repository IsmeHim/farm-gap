import { Router } from 'express';
import { pool } from '../db.js';

// Public traceability — anyone can scan QR
const r = Router();

r.get('/:lot', async (req, res) => {
  try {
    const lotParam = req.params.lot;
    let [rows] = await pool.query(
      `SELECT h.*, p.name AS plot_name, p.crop_name, p.planting_date, u.farm_name
       FROM harvest_logs h
       JOIN plots p ON p.id = h.plot_id
       JOIN users u ON u.id = h.user_id
       WHERE h.lot_code = ? LIMIT 1`,
      [lotParam]
    );

    let harvest = rows[0];

    // Fallback: If not found by lot_code, check if lotParam is an order_code or order id
    if (!harvest) {
      const [orderHarvestRows] = await pool.query(
        `SELECT h.*, p.name AS plot_name, p.crop_name, p.planting_date, u.farm_name
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN harvest_logs h ON (oi.lot_code = h.lot_code OR (oi.lot_code IS NULL AND h.product_id = oi.product_id))
         JOIN plots p ON p.id = h.plot_id
         JOIN users u ON u.id = h.user_id
         WHERE o.order_code = ? OR o.id = ?
         ORDER BY h.id DESC LIMIT 1`,
        [lotParam, lotParam]
      );
      if (orderHarvestRows[0]) {
        harvest = orderHarvestRows[0];
      }
    }

    if (!harvest) return res.status(404).json({ error: 'lot not found' });

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
