import { pool } from '../../../db.js';
import { client, lineConfig } from '../config.js';

// Helper: ส่งการแจ้งเตือนเข้า LINE ของเจ้าของฟาร์ม (Admin Push Notification)
export async function notifyAdminNewOrder(orderData, eventType = 'NEW_ORDER') {
  try {
    // 1. ดึง LINE User ID และ frontend_url ของเจ้าของฟาร์มจากตาราง users
    const [owners] = await pool.query(
      "SELECT line_user_id, farm_name, display_name, frontend_url FROM users WHERE (role = 'owner' OR role = 'admin') AND line_user_id IS NOT NULL AND TRIM(line_user_id) != '' ORDER BY id ASC"
    );

    if (owners.length === 0 || !owners[0].line_user_id) {
      console.log('ℹ️ [Admin Notify] ไม่พบ LINE User ID ของเจ้าของฟาร์มในระบบ (สามารถตั้งค่าได้ที่หน้าโปรไฟล์บนเว็บ)');
      return;
    }

    const adminLineId = owners[0].line_user_id.trim();
    if (!adminLineId.startsWith('U')) {
      console.warn('⚠️ [Admin Notify] LINE User ID รูปแบบไม่ถูกต้อง (ควรขึ้นต้นด้วย U):', adminLineId);
      return;
    }

    if (!lineConfig.channelAccessToken || lineConfig.channelAccessToken === 'dummy_token') {
      console.warn('⚠️ [Admin Notify] LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่า');
      return;
    }

    // 2. ดึงข้อมูลออเดอร์ ข้อมูลลูกค้า และรายการสินค้าล่าสุดจากฐานข้อมูลจริง (ถ้ามี orderData.id)
    let resolvedOrder = { ...orderData };
    if (orderData.id) {
      try {
        const [oRows] = await pool.query(`
          SELECT o.*, c.display_name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
          FROM orders o
          LEFT JOIN customers c ON o.customer_id = c.id
          WHERE o.id = ?
        `, [orderData.id]);
        if (oRows.length > 0) {
          const [itRows] = await pool.query(`
            SELECT oi.*, p.name AS product_name, p.unit
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
          `, [orderData.id]);
          resolvedOrder = {
            ...oRows[0],
            ...orderData,
            customer_name: orderData.customer_name || oRows[0].customer_name,
            customer_phone: orderData.customer_phone || oRows[0].customer_phone,
            customer_address: orderData.customer_address || oRows[0].customer_address,
            items: (itRows.length > 0 ? itRows : (orderData.items || [])),
          };
        }
      } catch (dbErr) {
        console.warn('⚠️ Could not refresh order details from DB for admin notify:', dbErr.message);
      }
    }

    const isCompleted = eventType === 'ORDER_COMPLETED' || eventType === 'SLIP_UPLOADED';
    const isSlip = eventType === 'SLIP_UPLOADED' || Boolean(resolvedOrder.slip_image_url);
    const title = isSlip ? '💸 ลูกค้าแจ้งชำระเงินแนบสลิปแล้ว!' : (isCompleted ? '🎉 ลูกค้าสั่งซื้อสำเร็จแล้ว!' : '🔔 มีคำสั่งซื้อใหม่เข้ามา!');
    const badgeText = isSlip ? 'แนบสลิปแล้ว' : (isCompleted ? 'สั่งซื้อสำเร็จ' : 'ออเดอร์ใหม่');
    const badgeBg = isSlip ? '#0284c7' : (isCompleted ? '#15803d' : '#0369a1');
    const headerBg = isSlip ? '#075985' : (isCompleted ? '#14532d' : '#0f172a');

    const orderCode = resolvedOrder.order_code || `ORD-${resolvedOrder.id || ''}`;
    const totalAmount = Number(resolvedOrder.total_amount || 0).toLocaleString();
    const customerName = resolvedOrder.customer_name || 'ลูกค้าทั่วไป';
    const customerPhone = resolvedOrder.customer_phone || '-';
    const customerAddress = resolvedOrder.customer_address || '-';

    // เตรียมรายการสินค้า (ถ้ามี)
    const items = resolvedOrder.items || [];
    const itemRows = items.slice(0, 5).map(item => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `• ${item.product_name || item.name || 'ผักสด'} x${Number(item.quantity) || 1} ${item.unit || 'ถุง'}`,
          size: 'xs',
          color: '#374151',
          flex: 8,
          wrap: true,
        },
        {
          type: 'text',
          text: `฿${Number(item.subtotal || (item.quantity * (item.unit_price || item.price || 0))).toLocaleString()}`,
          size: 'xs',
          color: '#111827',
          weight: 'bold',
          align: 'end',
          flex: 4,
        },
      ],
    }));

    // กำหนด URL หน้าเว็บ: ดึงจากที่ตั้งค่าในหน้า Profile ก่อน ➔ ถ้าไม่มีให้ใช้ .env ➔ ถ้าไม่มีให้ใช้ localhost
    const configuredUrl = owners[0]?.frontend_url ? owners[0].frontend_url.trim() : null;
    const rawFrontendBase = configuredUrl || process.env.FRONTEND_URL || process.env.DASHBOARD_URL || 'http://localhost:5173';
    const frontendBase = rawFrontendBase.replace(/\/+$/, '');
    const actionUri = process.env.DASHBOARD_ORDER_URL || `${frontendBase}/orders`;
    const printUri = resolvedOrder.id ? `${frontendBase}/orders/${resolvedOrder.id}/print` : actionUri;

    const flexContents = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBg,
        paddingAll: 'lg',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: title,
                weight: 'bold',
                size: 'md',
                color: '#ffffff',
                flex: 8,
              },
              {
                type: 'box',
                layout: 'horizontal',
                backgroundColor: badgeBg,
                cornerRadius: 'sm',
                paddingStart: 'sm',
                paddingEnd: 'sm',
                paddingTop: 'xs',
                paddingBottom: 'xs',
                contents: [
                  {
                    type: 'text',
                    text: badgeText,
                    weight: 'bold',
                    size: 'xxs',
                    color: '#ffffff',
                  },
                ],
              },
            ],
          },
          {
            type: 'text',
            text: `รหัสคำสั่งซื้อ: ${orderCode}`,
            size: 'xs',
            color: '#cbd5e1',
            margin: 'sm',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          // กล่องยอดรวมเงิน
          {
            type: 'box',
            layout: 'horizontal',
            backgroundColor: '#f8fafc',
            cornerRadius: 'md',
            paddingAll: 'md',
            borderColor: '#e2e8f0',
            borderWidth: '1px',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: 'ยอดรวมทั้งสิ้น',
                size: 'sm',
                color: '#64748b',
                flex: 6,
              },
              {
                type: 'text',
                text: `฿${totalAmount} บาท`,
                size: 'lg',
                weight: 'bold',
                color: '#059669',
                align: 'end',
                flex: 6,
              },
            ],
          },
          // ข้อมูลลูกค้า
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '👤 ข้อมูลลูกค้า:',
                size: 'xs',
                weight: 'bold',
                color: '#475569',
              },
              {
                type: 'text',
                text: `ชื่อ: ${customerName}`,
                size: 'xs',
                color: '#1e293b',
              },
              {
                type: 'text',
                text: `โทร: ${customerPhone}`,
                size: 'xs',
                color: '#1e293b',
              },
              {
                type: 'text',
                text: `ที่อยู่: ${customerAddress}`,
                size: 'xs',
                color: '#64748b',
                wrap: true,
              },
              {
                type: 'text',
                text: `การชำระเงิน: ${resolvedOrder.payment_method === 'cod' ? 'เก็บเงินปลายทาง (COD) 💵' : 'โอนเงินผ่านธนาคาร 💳'}`,
                size: 'xs',
                color: resolvedOrder.payment_method === 'cod' ? '#059669' : '#2563eb',
                weight: 'bold',
              },
            ],
          },
          // รายการสินค้า
          ...(itemRows.length > 0
            ? [
                {
                  type: 'separator',
                  margin: 'md',
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'xs',
                  contents: [
                    {
                      type: 'text',
                      text: '🥬 รายการผักที่สั่ง:',
                      size: 'xs',
                      weight: 'bold',
                      color: '#475569',
                    },
                    ...itemRows,
                  ],
                },
              ]
            : []),
          ...(isCompleted
            ? [
                {
                  type: 'separator',
                  margin: 'md',
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#f0fdf4',
                  borderColor: '#bbf7d0',
                  borderWidth: '1px',
                  cornerRadius: 'md',
                  paddingAll: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: resolvedOrder.payment_method === 'cod'
                        ? '💵 ลูกค้าเลือกชำระเงินปลายทาง (COD) จัดเตรียมสินค้าและเก็บเงินสดเมื่อส่งมอบครับ'
                        : (resolvedOrder.slip_image_url
                          ? '✅ ลูกค้าแนบสลิปชำระเงินเรียบร้อยแล้ว สามารถตรวจสอบและจัดส่งผักสดได้ทันทีครับ'
                          : '✅ ลูกค้าสั่งซื้อสำเร็จเรียบร้อยแล้ว พร้อมให้ฟาร์มจัดเตรียมผักสดครับ'),
                      size: 'xs',
                      color: '#166534',
                      wrap: true,
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'md',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '🖨️ พิมพ์ใบปะหน้า & เช็คลิสต์',
              uri: printUri,
            },
            style: 'primary',
            color: '#15803d',
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '📦 เปิดดูรายการออเดอร์',
              uri: actionUri,
            },
            style: 'secondary',
            height: 'sm',
          },
        ],
      },
    };

    await client.pushMessage({
      to: adminLineId,
      messages: [
        {
          type: 'flex',
          altText: isSlip ? `💸 สลิปโอนเงินใหม่: ${orderCode} (฿${totalAmount})` : `🔔 คำสั่งซื้อใหม่: ${orderCode} (฿${totalAmount})`,
          contents: flexContents,
        },
      ],
    });

    console.log(`✅ [Admin Notify] ส่งการแจ้งเตือน ${eventType} ไปยัง LINE User ID: ${adminLineId} สำเร็จ`);
  } catch (err) {
    console.error('❌ [Admin Notify] ไม่สามารถส่งแจ้งเตือนเข้า LINE ได้:', err.message);
  }
}
