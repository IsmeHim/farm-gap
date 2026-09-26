import { pool } from '../../db.js';
import { generateOrderCode } from './config.js';

// ยกเลิกออเดอร์และคืนสต็อก
export async function cancelChatOrder(orderId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length > 0 && orders[0].status !== 'cancelled') {
      const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
      for (const item of items) {
        await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity + ?, status = "available" WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
      await connection.query('UPDATE orders SET status = "cancelled" WHERE id = ?', [orderId]);
    }
    await connection.commit();
    return orders[0]?.order_code || 'ORD';
  } catch (err) {
    await connection.rollback();
    console.error('Error cancelling order:', err.message);
    return null;
  } finally {
    connection.release();
  }
}

// สร้างออเดอร์ในฐานข้อมูล ตัดสต็อก และบันทึกข้อมูลลูกค้า
export async function createChatOrder(userId, draftData, paymentMethod = 'transfer') {
  const items = draftData.items || [];
  const totalAmount = draftData.totalAmount || draftData.total_amount || 0;
  const finalName = draftData.contact_name || draftData.customer_name || 'คุณลูกค้า';
  const finalPhone = draftData.contact_phone || draftData.phone || '-';
  const finalAddress = draftData.contact_address || draftData.address || '-';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get customer
    const [customers] = await connection.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
    const customer = customers[0] || {};

    // 2. Update customer phone, address, and display_name
    await connection.query(
      'UPDATE customers SET address = ?, phone = ?, display_name = COALESCE(?, display_name) WHERE id = ?',
      [finalAddress, finalPhone, draftData.contact_name || null, customer.id]
    );

    // 3. Check stock again and deduct
    for (const item of items) {
      const [prod] = await connection.query('SELECT stock_quantity, status FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      if (prod.length === 0 || prod[0].stock_quantity < item.quantity) {
        await connection.rollback();
        throw new Error(`ขออภัยครับ สินค้า "${item.name}" สต็อกไม่เพียงพอในขณะนี้`);
      }

      const newStock = prod[0].stock_quantity - item.quantity;
      const newStatus = newStock <= 0 ? 'out_of_stock' : prod[0].status;
      await connection.query('UPDATE products SET stock_quantity = ?, status = ? WHERE id = ?', [
        newStock,
        newStatus,
        item.product_id,
      ]);
    }

    // 4. Create Order with snapshot recipient info
    const orderCode = generateOrderCode();
    const noteDetail = `ผู้รับ: ${finalName} | โทร: ${finalPhone} | ที่อยู่: ${finalAddress}${paymentMethod === 'cod' ? ' | ชำระเงินปลายทาง (COD)' : ''}`;
    const [orderResult] = await connection.query(
      `INSERT INTO orders (order_code, customer_id, total_amount, status, delivery_type, payment_method, notes, recipient_name, recipient_phone, recipient_address)
       VALUES (?, ?, ?, 'pending', 'delivery', ?, ?, ?, ?, ?)`,
      [orderCode, customer.id, totalAmount, paymentMethod, noteDetail, finalName, finalPhone, finalAddress]
    );
    const orderId = orderResult.insertId;

    // 5. Insert order items
    for (const item of items) {
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price, item.subtotal]
      );
    }

    await connection.commit();

    const formattedAddressDisplay = `ชื่อผู้รับ: ${finalName}\nเบอร์โทร: ${finalPhone}\nที่อยู่: ${finalAddress}`;
    const fullOrder = {
      id: orderId,
      order_code: orderCode,
      customer_id: customer.id,
      total_amount: totalAmount,
      status: 'pending',
      payment_method: paymentMethod,
      customer_name: finalName,
      customer_phone: finalPhone,
      customer_address: finalAddress,
      items: items.map(i => ({
        ...i,
        product_name: i.name,
      })),
      notes: noteDetail,
    };

    return {
      orderId,
      orderCode,
      totalAmount,
      items,
      finalName,
      finalPhone,
      finalAddress,
      formattedAddressDisplay,
      fullOrder,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
