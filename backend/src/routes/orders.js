import { Router } from 'express';
import { pool } from '../db.js';

export const ordersRouter = Router();

// สร้างรหัสออเดอร์แบบสุ่มไม่ซ้ำ เช่น ORD-20260722-XXXX
function generateOrderCode() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${randomNum}`;
}

// สร้างรายการสั่งซื้อใหม่ (พร้อมตัดสต็อกผักอัตโนมัติ)
ordersRouter.post('/', async (req, res) => {
  const { customer_id, items, delivery_type, delivery_date, notes } = req.body;

  if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer ID and at least one item are required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. ตรวจสอบลูกค้า
    const [customerRows] = await connection.query('SELECT * FROM customers WHERE id = ?', [customer_id]);
    if (customerRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Customer not found' });
    }

    let totalAmount = 0;
    const orderItemsToInsert = [];

    // 2. ตรวจสอบสต็อกและคำนวณราคาสินค้าแต่ละรายการ
    for (const item of items) {
      const [productRows] = await connection.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      if (productRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: `Product ID ${item.product_id} not found` });
      }

      const product = productRows[0];
      const quantity = Number(item.quantity);

      if (product.stock_quantity < quantity) {
        await connection.rollback();
        return res.status(400).json({
          error: `สินค้า "${product.name}" สต็อกไม่พอ (เหลือเพียง ${product.stock_quantity} ${product.unit})`,
        });
      }

      const unitPrice = Number(product.price);
      const subtotal = unitPrice * quantity;
      totalAmount += subtotal;

      orderItemsToInsert.push({
        product_id: product.id,
        quantity,
        unit_price: unitPrice,
        subtotal,
      });

      // ตัดสต็อกผัก
      const newStock = product.stock_quantity - quantity;
      const newStatus = newStock <= 0 ? 'out_of_stock' : product.status;
      await connection.query('UPDATE products SET stock_quantity = ?, status = ? WHERE id = ?', [
        newStock,
        newStatus,
        product.id,
      ]);
    }

    // 3. บันทึกออเดอร์ลงในตาราง orders
    const orderCode = generateOrderCode();
    const [orderResult] = await connection.query(
      `INSERT INTO orders (order_code, customer_id, total_amount, status, delivery_type, delivery_date, notes)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
      [orderCode, customer_id, totalAmount, delivery_type || 'delivery', delivery_date || null, notes || null]
    );

    const orderId = orderResult.insertId;

    // 4. บันทึกรายการผักลงในตาราง order_items
    for (const orderItem of orderItemsToInsert) {
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
        [orderId, orderItem.product_id, orderItem.quantity, orderItem.unit_price, orderItem.subtotal]
      );
    }

    await connection.commit();

    // ดึงออเดอร์ที่สร้างสำเร็จพร้อมรายการสินค้า
    const [newOrderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const [newItemsRows] = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.unit, p.image_url 
       FROM order_items oi 
       JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = ?`,
      [orderId]
    );

    res.status(201).json({
      ...newOrderRows[0],
      items: newItemsRows,
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// ดึงรายการออเดอร์ทั้งหมด (สำหรับฟาร์ม)
ordersRouter.get('/', async (req, res) => {
  try {
    const { status, customer_id, line_user_id, phone } = req.query;
    let query = `
      SELECT o.*, c.display_name AS customer_name, c.phone AS customer_phone, c.line_user_id
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    if (customer_id) {
      query += ' AND o.customer_id = ?';
      params.push(customer_id);
    }
    if (line_user_id) {
      query += ' AND c.line_user_id = ?';
      params.push(line_user_id);
    }
    if (phone) {
      query += ' AND c.phone = ?';
      params.push(phone);
    }

    query += ' ORDER BY o.id DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ดึงรายละเอียดออเดอร์รายชิ้น
ordersRouter.get('/:id', async (req, res) => {
  try {
    const [orderRows] = await pool.query(
      `SELECT o.*, c.display_name AS customer_name, c.phone AS customer_phone, c.address AS customer_address, c.line_user_id
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (orderRows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const [itemRows] = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.unit, p.image_url 
       FROM order_items oi 
       JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = ?`,
      [req.params.id]
    );

    res.json({
      ...orderRows[0],
      items: itemRows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// อัปเดตสถานะออเดอร์ (pending -> paid -> shipping -> completed / cancelled)
ordersRouter.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowedStatuses = ['pending', 'paid', 'shipping', 'completed', 'cancelled'];
  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Order not found' });

    // คืนสต็อกผักหากยกเลิกออเดอร์
    if (status === 'cancelled' && existing[0].status !== 'cancelled') {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
      for (const item of items) {
        await pool.query('UPDATE products SET stock_quantity = stock_quantity + ?, status = "available" WHERE id = ?', [
          item.quantity,
          item.product_id,
        ]);
      }
    }

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    const [updated] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// แนบสลิปชำระเงิน
ordersRouter.post('/:id/slip', async (req, res) => {
  const { slip_image_url } = req.body;
  if (!slip_image_url) {
    return res.status(400).json({ error: 'slip_image_url is required' });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Order not found' });

    await pool.query('UPDATE orders SET slip_image_url = ?, status = "paid" WHERE id = ?', [slip_image_url, req.params.id]);
    const [updated] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
