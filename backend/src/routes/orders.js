import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { notifyAdminNewOrder, notifyCustomerOrderStatus } from './line.js';

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

    const fullOrder = {
      ...newOrderRows[0],
      customer_name: customerRows[0]?.display_name,
      customer_phone: customerRows[0]?.phone,
      customer_address: customerRows[0]?.address,
      items: newItemsRows,
    };

    // แจ้งเตือนเจ้าของฟาร์มเฉพาะเมื่อออเดอร์สำเร็จ (เช่น เก็บเงินปลายทาง COD หรือมีสลิปชำระเงินแนบมา)
    // สำหรับออเดอร์โอนเงิน จะแจ้งเตือนเมื่อลูกค้าแนบสลิปชำระเงินสำเร็จ
    if (payment_method === 'cod' || payment_method === 'cash' || newOrderRows[0]?.status === 'paid' || slip_image_url) {
      notifyAdminNewOrder(fullOrder, 'ORDER_COMPLETED').catch(e => console.error('notifyAdminNewOrder error:', e.message));
    }

    res.status(201).json(fullOrder);
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
      SELECT o.*, c.display_name AS customer_name, c.phone AS customer_phone, c.address AS customer_address, c.line_user_id
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

    // บันทึกลงสมุด ขนส่ง/เก็บรักษา (GAP #6) อัตโนมัติเมื่อสถานะเป็น 'shipping' (กำลังจัดส่ง)
    if (status === 'shipping') {
      await syncOrderToStorageLog(req.params.id);
    }

    // แจ้งเตือนสถานะสินค้าเข้า LINE ลูกค้าอัตโนมัติ
    notifyCustomerOrderStatus(req.params.id, status, {
      vehicle: 'รถจักรยานยนต์ส่วนตัว (เจ้าของฟาร์มส่งเอง)',
      storage_conditions: 'บรรจุในกล่อง/ถุงเก็บความสด ป้องกันแสงแดดและความร้อน',
    }).catch(e =>
      console.error('❌ [Notify Customer Error]:', e.message)
    );

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: บันทึกข้อมูลเข้าสมุด ขนส่ง/เก็บรักษา (GAP #6 storage_logs) อัตโนมัติจากออเดอร์
export async function syncOrderToStorageLog(orderId, customData = {}, userId = 1, userEmail = 'admin@farmgap.com') {
  try {
    // 1. ตรวจสอบว่าเคยบันทึก storage_log สำหรับ order นี้แล้วหรือยัง ป้องกันบันทึกซ้ำ
    const [existing] = await pool.query('SELECT id FROM storage_logs WHERE order_id = ?', [orderId]);
    if (existing.length > 0) {
      return existing[0].id;
    }

    // 2. ดึงข้อมูลออเดอร์และลูกค้า
    const [orderRows] = await pool.query(
      `SELECT o.*, c.display_name AS customer_name, c.address AS customer_address, c.phone AS customer_phone
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [orderId]
    );
    if (orderRows.length === 0) return null;
    const order = orderRows[0];

    // 3. ดึงรายการสินค้าเพื่อสรุปในหมายเหตุ
    const [itemRows] = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.unit
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );
    const itemsSummary = itemRows.map(i => `${i.product_name} x ${i.quantity} ${i.unit || ''}`).join(', ');
    const defaultNotes = itemsSummary ? `จัดส่งออเดอร์ #${order.order_code} [${itemsSummary}]` : `จัดส่งออเดอร์ #${order.order_code}`;

    const targetShippedTo = customData.shipped_to || order.customer_address || (order.delivery_type === 'pickup' ? 'รับเองที่ฟาร์ม' : 'ที่อยู่ตามคำสั่งซื้อ');
    const targetBuyer = customData.buyer || order.customer_name || 'ลูกค้าทั่วไป';
    const targetVehicle = customData.vehicle || 'รถจักรยานยนต์ส่วนตัว (เจ้าของฟาร์มส่งเอง)';
    const cleanBool = customData.vehicle_clean_status !== undefined ? (customData.vehicle_clean_status ? 1 : 0) : 1;
    const targetStorageLoc = customData.storage_location || 'คลังบรรจุและกระจายสินค้าฟาร์ม';
    const targetStorageCond = customData.storage_conditions || 'บรรจุในกล่อง/ถุงเก็บความสด ป้องกันแสงแดดและความร้อน';
    const targetDeliveryCond = customData.delivery_condition || 'ดี';
    const targetWorker = customData.worker_name || 'เจ้าของฟาร์ม';
    const targetNotes = customData.notes || defaultNotes;
    const targetDate = customData.log_date || new Date().toISOString().split('T')[0];
    const targetTime = customData.transport_time || new Date().toTimeString().split(' ')[0];

    const [sRes] = await pool.query(
      `INSERT INTO storage_logs (
        user_id, order_id, log_date, storage_location, shipped_to, buyer,
        vehicle, vehicle_clean_status, storage_conditions,
        transport_time, delivery_condition, worker_name, notes,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        orderId,
        targetDate,
        targetStorageLoc,
        targetShippedTo,
        targetBuyer,
        targetVehicle,
        cleanBool,
        targetStorageCond,
        targetTime,
        targetDeliveryCond,
        targetWorker,
        targetNotes,
        userEmail,
        userEmail
      ]
    );

    console.log(`✅ [Auto GAP #6] บันทึกลงสมุดขนส่ง/เก็บรักษาสำเร็จ (Log ID: ${sRes.insertId}) จากออเดอร์ #${order.order_code}`);
    return sRes.insertId;
  } catch (err) {
    console.error('❌ [Auto GAP #6 Error]:', err.message);
    return null;
  }
}

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
    const [updated] = await pool.query(
      `SELECT o.*, c.display_name AS customer_name, c.phone AS customer_phone, c.address AS customer_address 
       FROM orders o 
       LEFT JOIN customers c ON o.customer_id = c.id 
       WHERE o.id = ?`,
      [req.params.id]
    );

    if (updated[0]) {
      const [itemsRows] = await pool.query(
        `SELECT oi.*, p.name AS product_name, p.unit 
         FROM order_items oi 
         JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = ?`,
        [req.params.id]
      );
      updated[0].items = itemsRows;
      notifyAdminNewOrder(updated[0], 'ORDER_COMPLETED').catch(e => console.error('notifyAdmin slip error:', e.message));
    }

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// บันทึกการจัดส่งสินค้าอัจฉริยะ (Smart Dispatch & Auto-Sync to GAP #6 Storage Logs)
ordersRouter.post('/:id/dispatch', async (req, res) => {
  const {
    log_date,
    storage_location,
    shipped_to,
    buyer,
    vehicle,
    vehicle_clean_status,
    storage_conditions,
    transport_time,
    delivery_condition,
    worker_name,
    notes,
    sync_to_storage = true,
  } = req.body;

  try {
    // ดึงข้อมูลออเดอร์พร้อมลูกค้า
    const [orderRows] = await pool.query(
      `SELECT o.*, c.display_name AS customer_name, c.address AS customer_address, c.phone AS customer_phone
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (orderRows.length === 0) return res.status(404).json({ error: 'ไม่พบออเดอร์นี้' });
    const order = orderRows[0];

    // ตรวจสอบ JWT auth หากมี
    const authHeader = req.headers.authorization;
    let authUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        authUser = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'farmgap_secret_key_2026');
      } catch (e) {
        // ignore token decode errors for optional auth
      }
    }
    const userId = authUser?.id || 1;
    const userEmail = authUser?.email || 'admin@farmgap.com';

    // 1. อัปเดตสถานะออเดอร์เป็น 'shipping' (กำลังจัดส่ง)
    await pool.query("UPDATE orders SET status = 'shipping' WHERE id = ?", [req.params.id]);

    let storageLogId = null;

    // 2. บันทึกลงสมุด ขนส่ง/เก็บรักษา (GAP #6 storage_logs) หากเลือก sync_to_storage
    if (sync_to_storage) {
      storageLogId = await syncOrderToStorageLog(req.params.id, {
        log_date,
        storage_location,
        shipped_to,
        buyer,
        vehicle,
        vehicle_clean_status,
        storage_conditions,
        transport_time,
        delivery_condition,
        worker_name,
        notes,
      }, userId, userEmail);
    }

    const [updatedOrder] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);

    // แจ้งเตือนลูกค้าเข้า LINE พร้อมข้อมูลการขนส่งและการคุมคุณภาพ GAP #6
    notifyCustomerOrderStatus(req.params.id, 'shipping', {
      vehicle: vehicle || 'รถจักรยานยนต์ส่วนตัว (เจ้าของฟาร์มส่งเอง)',
      storage_conditions: storage_conditions || 'บรรจุในกล่อง/ถุงเก็บความสด ป้องกันแสงแดดและความร้อน',
      shipped_to,
      worker_name,
      delivery_condition,
    }).catch(e => console.error('❌ [Notify Customer Dispatch Error]:', e.message));

    res.json({
      success: true,
      order: updatedOrder[0],
      storage_log_id: storageLogId,
      message: `บันทึกการจัดส่งออเดอร์ #${order.order_code} ${storageLogId ? 'และลงบันทึก ขนส่ง/เก็บรักษา (GAP #6) สำเร็จ!' : 'เรียบร้อย'}`
    });
  } catch (error) {
    console.error('Dispatch error:', error);
    res.status(500).json({ error: error.message });
  }
});
