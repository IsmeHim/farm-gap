import { pool } from '../../../db.js';
import { client } from '../config.js';

// Flex Message: แสดงสถานะออเดอร์ล่าสุดของลูกค้า (Order Status)
export async function replyOrderStatus(replyToken, userId) {
  try {
    const [customers] = await pool.query('SELECT id FROM customers WHERE line_user_id = ?', [userId]);

    if (customers.length === 0) {
      return client.replyMessage({
        replyToken: replyToken,
        messages: [{ type: 'text', text: 'ไม่พบประวัติการสั่งซื้อของคุณในระบบ สามารถเริ่มสั่งซื้อครั้งแรกผ่านแชทนี้ได้เลยครับ 🌱' }]
      });
    }

    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 1',
      [customers[0].id]
    );

    if (orders.length === 0) {
      return client.replyMessage({
        replyToken: replyToken,
        messages: [{ type: 'text', text: 'คุณยังไม่มีรายการสั่งซื้อใดๆ ในระบบขณะนี้ครับ พิมพ์สั่งซื้อได้เลยนะครับ 🌱' }]
      });
    }

    const order = orders[0];
    const isCod = order.payment_method?.toLowerCase() === 'cod';
    const statusLower = (order.status || '').toLowerCase();
    const statusMap = {
      pending: isCod ? { label: 'เตรียมจัดส่ง (เก็บเงินปลายทาง 💵)', color: '#059669' } : { label: 'รอตรวจสอบ/รอแนบสลิป ⏳', color: '#d97706' },
      paid: { label: 'ชำระแล้ว (เตรียมเก็บเกี่ยว/จัดส่ง) 💳', color: '#2563eb' },
      shipping: { label: 'กำลังจัดส่ง 🚚', color: '#7c3aed' },
      completed: { label: 'จัดส่งสำเร็จเรียบร้อย ✅', color: '#16a34a' },
      cancelled: { label: 'ยกเลิกออเดอร์ ❌', color: '#dc2626' },
    };
    const currentStatus = statusMap[statusLower] || { label: order.status, color: '#333333' };
    const localDate = new Date(order.created_at).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // ดึงรายการสินค้าของออเดอร์ล่าสุดนี้
    const [items] = await pool.query(
      `SELECT oi.quantity, oi.unit_price, oi.subtotal, p.name AS product_name, p.unit 
       FROM order_items oi 
       JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = ?`,
      [order.id]
    );

    const itemRows = items.map(item => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `🌱 ${item.product_name} x ${item.quantity} ${item.unit || 'กก.'}`,
          size: 'xs',
          color: '#374151',
          flex: 7,
          wrap: true,
        },
        {
          type: 'text',
          text: `฿${item.subtotal.toLocaleString()}`,
          size: 'xs',
          color: '#111827',
          align: 'end',
          flex: 3,
        },
      ],
    }));

    const bodyContents = [
      {
        type: 'text',
        text: '📋 สถานะออเดอร์ล่าสุดของคุณ',
        weight: 'bold',
        size: 'md',
        color: '#173f2a',
      },
      {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#f8fafc',
        cornerRadius: 'md',
        paddingAll: 'md',
        spacing: 'xs',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'เลขที่คำสั่งซื้อ',
                size: 'xs',
                color: '#6b7280',
                flex: 4,
              },
              {
                type: 'text',
                text: order.order_code,
                size: 'xs',
                weight: 'bold',
                color: '#111827',
                align: 'end',
                flex: 6,
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'วันที่สั่งซื้อ',
                size: 'xs',
                color: '#6b7280',
                flex: 4,
              },
              {
                type: 'text',
                text: localDate,
                size: 'xs',
                color: '#4b5563',
                align: 'end',
                flex: 6,
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'การชำระเงิน',
                size: 'xs',
                color: '#6b7280',
                flex: 4,
              },
              {
                type: 'text',
                text: isCod ? 'เก็บเงินปลายทาง (COD) 💵' : 'โอนเงิน / สแกน QR 💳',
                size: 'xs',
                weight: 'bold',
                color: isCod ? '#059669' : '#2563eb',
                align: 'end',
                flex: 6,
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'สถานะปัจจุบัน',
                size: 'xs',
                color: '#6b7280',
                flex: 4,
              },
              {
                type: 'text',
                text: currentStatus.label,
                size: 'xs',
                weight: 'bold',
                color: currentStatus.color,
                align: 'end',
                flex: 6,
                wrap: true,
              },
            ],
          },
        ],
      },
    ];

    if (itemRows.length > 0) {
      bodyContents.push({
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        margin: 'md',
        contents: [
          {
            type: 'text',
            text: 'รายการสินค้า:',
            size: 'xs',
            weight: 'bold',
            color: '#4b5563',
          },
          ...itemRows,
        ],
      });
    }

    bodyContents.push(
      {
        type: 'separator',
        margin: 'md',
      },
      {
        type: 'box',
        layout: 'horizontal',
        margin: 'md',
        contents: [
          {
            type: 'text',
            text: 'ยอดรวมทั้งสิ้น',
            weight: 'bold',
            size: 'sm',
            color: '#111827',
          },
          {
            type: 'text',
            text: `฿${order.total_amount.toLocaleString()} บาท`,
            weight: 'bold',
            size: 'sm',
            color: '#16a34a',
            align: 'end',
          },
        ],
      }
    );

    if (order.tracking_number) {
      bodyContents.push({
        type: 'text',
        text: `🚚 ข้อมูลจัดส่ง: ${order.tracking_number} (${order.delivery_type || 'จัดส่งพัสดุ'})`,
        size: 'xs',
        color: '#2563eb',
        margin: 'sm',
      });
    }

    const flexStatus = {
      type: 'flex',
      altText: `สถานะออเดอร์ ${order.order_code}: ${currentStatus.label}`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: bodyContents,
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: {
                type: 'message',
                label: '📜 ดูประวัติการสั่งซื้อ',
                text: 'ดูประวัติ',
              },
              style: 'secondary',
              height: 'sm',
            },
          ],
        },
      },
    };

    await client.replyMessage({
      replyToken: replyToken,
      messages: [flexStatus],
    });
  } catch (err) {
    console.error('Failed to reply order status:', err.message);
    try {
      await client.replyMessage({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: 'ขออภัยครับ เกิดข้อผิดพลาดชั่วคราวในการดึงข้อมูลสถานะออเดอร์ กรุณาลองกดใหม่อีกครั้ง หรือพิมพ์สอบถามเจ้าของฟาร์มได้เลยครับ 🌱',
          },
        ],
      });
    } catch (_) {}
  }
}

// Flex Message: แสดงประวัติการสั่งซื้อของลูกค้า (Order History)
export async function replyOrderHistory(replyToken, userId) {
  try {
    const [customers] = await pool.query('SELECT id FROM customers WHERE line_user_id = ?', [userId]);

    if (customers.length === 0) {
      return client.replyMessage({
        replyToken: replyToken,
        messages: [{ type: 'text', text: 'ไม่พบประวัติการสั่งซื้อของคุณในระบบ สามารถเริ่มสั่งซื้อครั้งแรกผ่านแชทนี้ได้เลยครับ 🌱' }]
      });
    }

    const [orders] = await pool.query(
      'SELECT id, order_code, total_amount, status, payment_method, created_at FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 10',
      [customers[0].id]
    );

    if (orders.length === 0) {
      return client.replyMessage({
        replyToken: replyToken,
        messages: [{ type: 'text', text: 'คุณยังไม่มีประวัติรายการสั่งซื้อในระบบขณะนี้ครับ พิมพ์ "สั่งซื้อ" ได้เลยนะครับ 🌱' }]
      });
    }

    // ดึง items ของทุก order เพื่อแสดงสรุปสินค้าสั้นๆ
    const orderIds = orders.map(o => o.id);
    const [items] = await pool.query(
      `SELECT oi.order_id, oi.quantity, p.name AS product_name, p.unit 
       FROM order_items oi 
       JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id IN (?)`,
      [orderIds]
    );

    const itemsByOrder = {};
    items.forEach(it => {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push(`${it.product_name} (${it.quantity}${it.unit || ''})`);
    });

    const statusMap = {
      pending: { label: 'รอตรวจสอบ/รอสลิป', color: '#d97706' },
      paid: { label: 'ชำระแล้ว', color: '#2563eb' },
      shipping: { label: 'กำลังจัดส่ง 🚚', color: '#7c3aed' },
      completed: { label: 'จัดส่งสำเร็จ ✅', color: '#16a34a' },
      cancelled: { label: 'ยกเลิก', color: '#dc2626' },
    };

    const orderBoxes = [];
    orders.forEach((o, index) => {
      const isCodOrder = o.payment_method === 'cod';
      const st = (isCodOrder && o.status === 'pending')
        ? { label: 'เตรียมส่ง (COD 💵)', color: '#059669' }
        : (statusMap[o.status] || { label: o.status, color: '#4b5563' });
      const localDate = new Date(o.created_at).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const itemSummary = (itemsByOrder[o.id] && itemsByOrder[o.id].length > 0)
        ? itemsByOrder[o.id].join(', ')
        : null;

      const orderBox = {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `📦 ${o.order_code}`,
                weight: 'bold',
                size: 'sm',
                color: '#1e293b',
                flex: 6,
              },
              {
                type: 'text',
                text: `฿${o.total_amount.toLocaleString()}`,
                weight: 'bold',
                size: 'sm',
                color: '#16a34a',
                align: 'end',
                flex: 4,
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `📅 ${localDate}`,
                size: 'xxs',
                color: '#64748b',
                flex: 5,
              },
              {
                type: 'text',
                text: st.label,
                size: 'xs',
                weight: 'bold',
                color: st.color,
                align: 'end',
                flex: 5,
              },
            ],
          },
        ],
      };

      if (itemSummary) {
        orderBox.contents.push({
          type: 'text',
          text: `🌱 ${itemSummary}`,
          size: 'xxs',
          color: '#475569',
          wrap: true,
        });
      }

      orderBoxes.push(orderBox);

      if (index < orders.length - 1) {
        orderBoxes.push({
          type: 'separator',
          margin: 'sm',
        });
      }
    });

    const flexHistory = {
      type: 'flex',
      altText: `ประวัติการสั่งซื้อของคุณ (${orders.length} รายการ)`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'none',
              contents: [
                {
                  type: 'text',
                  text: '📜 ประวัติการสั่งซื้อของคุณ',
                  weight: 'bold',
                  size: 'md',
                  color: '#173f2a',
                },
                {
                  type: 'text',
                  text: `แสดงรายการล่าสุด ${orders.length} รายการ`,
                  size: 'xxs',
                  color: '#94a3b8',
                },
              ],
            },
            {
              type: 'separator',
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: orderBoxes,
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: {
                type: 'message',
                label: '🌱 สั่งซื้อผักสดเพิ่ม',
                text: 'สั่งซื้อ',
              },
              style: 'primary',
              color: '#2e7d32',
              height: 'sm',
            },
            {
              type: 'button',
              action: {
                type: 'message',
                label: '🔍 เช็คสถานะออเดอร์ล่าสุด',
                text: 'เช็คสถานะ',
              },
              style: 'secondary',
              height: 'sm',
            },
          ],
        },
      },
    };

    await client.replyMessage({
      replyToken: replyToken,
      messages: [flexHistory],
    });
  } catch (err) {
    console.error('Failed to reply order history:', err.message);
  }
}
