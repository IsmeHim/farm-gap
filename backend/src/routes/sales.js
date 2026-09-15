import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

export const salesRouter = Router();
salesRouter.use(authRequired);

// GET /api/sales/report
salesRouter.get('/report', async (req, res) => {
  try {
    const { start_date, end_date, status = 'valid' } = req.query;
    const uid = req.user.id;

    let dateCondition = '';
    const params = [];

    if (start_date && end_date) {
      dateCondition = 'AND DATE(o.created_at) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else if (start_date) {
      dateCondition = 'AND DATE(o.created_at) >= ?';
      params.push(start_date);
    } else if (end_date) {
      dateCondition = 'AND DATE(o.created_at) <= ?';
      params.push(end_date);
    }

    let statusCondition = '';
    if (status === 'valid') {
      statusCondition = "AND o.status IN ('paid', 'shipping', 'completed')";
    } else if (status !== 'all') {
      statusCondition = 'AND o.status = ?';
      params.push(status);
    }

    // 1. Fetch Orders with customer info
    const [orders] = await pool.query(
      `SELECT o.*, c.display_name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE 1=1 ${dateCondition} ${statusCondition}
       ORDER BY o.id DESC`,
      params
    );

    // 2. Fetch order items
    let orderItems = [];
    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      const [items] = await pool.query(
        `SELECT oi.*, p.name AS product_name, p.unit, p.price AS current_price
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id IN (${orderIds.map(() => '?').join(',')})`,
        orderIds
      );
      orderItems = items;
    }

    // Attach items to each order
    const ordersWithItems = orders.map(o => ({
      ...o,
      items: orderItems.filter(i => i.order_id === o.id)
    }));

    // 3. Product Sales Breakdown
    const productStats = {};
    for (const item of orderItems) {
      const pId = item.product_id;
      if (!productStats[pId]) {
        productStats[pId] = {
          product_id: pId,
          product_name: item.product_name,
          unit: item.unit,
          total_quantity: 0,
          total_revenue: 0,
          orders_count: 0
        };
      }
      productStats[pId].total_quantity += Number(item.quantity || 0);
      productStats[pId].total_revenue += Number(item.subtotal || 0);
      productStats[pId].orders_count += 1;
    }
    const topProducts = Object.values(productStats).sort((a, b) => b.total_revenue - a.total_revenue);

    // 4. Financial Summary
    const totalRevenue = orders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'paid' || o.status === 'shipping').length;
    const avgOrderValue = completedOrders > 0 ? (totalRevenue / completedOrders) : 0;
    const totalVeggiesKg = orderItems.reduce((sum, i) => sum + Number(i.quantity || 0), 0);

    // 5. Total Costs from cost_logs within the date range
    let costParams = [uid];
    let costDateCondition = '';
    if (start_date && end_date) {
      costDateCondition = 'AND log_date BETWEEN ? AND ?';
      costParams.push(start_date, end_date);
    }
    const [costs] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_costs FROM cost_logs WHERE user_id = ? ${costDateCondition}`,
      costParams
    );
    const totalCosts = Number(costs[0]?.total_costs || 0);
    const grossProfit = totalRevenue - totalCosts;

    res.json({
      summary: {
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        completed_orders: completedOrders,
        avg_order_value: Math.round(avgOrderValue),
        total_veggies_kg: totalVeggiesKg,
        total_costs: totalCosts,
        gross_profit: grossProfit,
      },
      top_products: topProducts,
      orders: ordersWithItems
    });
  } catch (err) {
    console.error('Sales report error:', err);
    res.status(500).json({ error: err.message });
  }
});
