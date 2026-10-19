import { Router } from 'express';
import { pool } from '../db.js';

// Public traceability — anyone can scan QR to trace specific crop batch
const r = Router();

r.get('/:lot', async (req, res) => {
  try {
    const lotParam = req.params.lot;

    // 1. Search harvest log by lot_code with exact crop and batch details
    let [rows] = await pool.query(
      `SELECT h.*, 
              p.name AS plot_name, 
              p.dimension AS plot_dimension,
              COALESCE(c.name, prod.name, NULLIF(p.crop_name, '-'), 'ผักสด GAP') AS crop_name,
              c.category AS crop_category,
              c.growth_days,
              b.batch_code,
              b.start_date AS batch_start_date,
              b.seed_prep_date AS batch_seed_prep_date,
              COALESCE(b.soil_recipe, p.soil_recipe) AS soil_recipe,
              COALESCE(b.soil_prep_date, p.soil_prep_date) AS soil_prep_date,
              u.farm_name, 
              u.display_name AS owner_name
       FROM harvest_logs h
       JOIN plots p ON p.id = h.plot_id
       JOIN users u ON u.id = h.user_id
       LEFT JOIN planting_batches b ON b.id = h.batch_id
       LEFT JOIN crops c ON c.id = b.crop_id
       LEFT JOIN products prod ON prod.id = h.product_id
       WHERE h.lot_code = ? 
       LIMIT 1`,
      [lotParam]
    );

    let harvest = rows[0];

    // 2. Fallback: If not found by lot_code, check if lotParam is an order_code or order id
    if (!harvest) {
      const [orderHarvestRows] = await pool.query(
        `SELECT h.*, 
                p.name AS plot_name, 
                p.dimension AS plot_dimension,
                COALESCE(c.name, prod.name, NULLIF(p.crop_name, '-'), 'ผักสด GAP') AS crop_name,
                c.category AS crop_category,
                c.growth_days,
                b.batch_code,
                b.start_date AS batch_start_date,
                b.seed_prep_date AS batch_seed_prep_date,
                COALESCE(b.soil_recipe, p.soil_recipe) AS soil_recipe,
                COALESCE(b.soil_prep_date, p.soil_prep_date) AS soil_prep_date,
                u.farm_name, 
                u.display_name AS owner_name
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN harvest_logs h ON (oi.lot_code = h.lot_code OR (oi.lot_code IS NULL AND h.product_id = oi.product_id))
         JOIN plots p ON p.id = h.plot_id
         JOIN users u ON u.id = h.user_id
         LEFT JOIN planting_batches b ON b.id = h.batch_id
         LEFT JOIN crops c ON c.id = b.crop_id
         LEFT JOIN products prod ON prod.id = h.product_id
         WHERE o.order_code = ? OR o.id = ?
         ORDER BY h.id DESC 
         LIMIT 1`,
        [lotParam, lotParam]
      );
      if (orderHarvestRows[0]) {
        harvest = orderHarvestRows[0];
      }
    }

    if (!harvest) return res.status(404).json({ error: 'ไม่พบข้อมูลรหัสสินค้าหรือล็อตนี้' });

    // 3. Fetch crop activities ONLY for this specific planting round/batch
    let activities = [];

    if (harvest.batch_id) {
      // Precise: Retrieve all activities tied directly to this batch_id
      const [actRows] = await pool.query(
        `SELECT * FROM crop_activities 
         WHERE batch_id = ? 
         ORDER BY activity_date ASC, id ASC`,
        [harvest.batch_id]
      );
      activities = actRows || [];
    }

    // Fallback: If harvest had no batch_id or batch had no activities, scope by plot and dates of this harvest only
    if (activities.length === 0 && harvest.plot_id) {
      const startDate = harvest.batch_start_date || harvest.batch_seed_prep_date || harvest.planting_date;
      if (startDate) {
        const [actRows] = await pool.query(
          `SELECT * FROM crop_activities 
           WHERE plot_id = ? 
             AND activity_date >= ? 
             AND activity_date <= ?
           ORDER BY activity_date ASC, id ASC`,
          [harvest.plot_id, startDate, harvest.harvest_date]
        );
        activities = actRows || [];
      } else {
        // Safe limit: only the activities directly preceding this harvest date, not the entire multi-year history
        const [actRows] = await pool.query(
          `SELECT * FROM crop_activities 
           WHERE plot_id = ? 
             AND activity_date <= ?
           ORDER BY activity_date DESC, id DESC 
           LIMIT 10`,
          [harvest.plot_id, harvest.harvest_date]
        );
        activities = (actRows || []).reverse();
      }
    }

    res.json({
      ...harvest,
      activities
    });
  } catch (err) {
    console.error('Trace error:', err);
    res.status(500).json({ error: 'Failed to fetch trace info' });
  }
});

export default r;
