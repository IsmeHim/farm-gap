import { pool } from '../../../db.js';
import { client, lineConfig } from '../config.js';

// Helper: ส่งการแจ้งเตือนสถานะออเดอร์เข้า LINE ของลูกค้า (Customer Order Status Push Notification)
export async function notifyCustomerOrderStatus(orderId, newStatus, dispatchDetails = null) {
  try {
    // 1. ดึงข้อมูลออเดอร์และลูกค้า
    const [orderRows] = await pool.query(
      `SELECT o.*, c.line_user_id, c.display_name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (orderRows.length === 0) {
      console.warn(`⚠️ [Customer Notify] ไม่พบออเดอร์ id=${orderId}`);
      return;
    }

    const order = orderRows[0];
    const customerLineId = order.line_user_id ? order.line_user_id.trim() : null;

    if (!customerLineId || !customerLineId.startsWith('U')) {
      console.log(`ℹ️ [Customer Notify] ออเดอร์ #${order.order_code} ไม่มี LINE User ID ของลูกค้า (อาจไม่ได้สั่งผ่าน LINE)`);
      return;
    }

    if (!lineConfig.channelAccessToken || lineConfig.channelAccessToken === 'dummy_token') {
      console.warn('⚠️ [Customer Notify] LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่า');
      return;
    }

    // 2. ดึงรายการสินค้าในออเดอร์
    const [itemRows] = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.unit
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    // ดึง frontendBase สำหรับสร้างลิงก์เปิดเว็บ
    const [owners] = await pool.query(
      "SELECT frontend_url FROM users WHERE (role = 'owner' OR role = 'admin') AND frontend_url IS NOT NULL AND TRIM(frontend_url) != '' ORDER BY id ASC LIMIT 1"
    );
    const configuredUrl = owners[0]?.frontend_url ? owners[0].frontend_url.trim() : null;
    const rawFrontendBase = configuredUrl || process.env.FRONTEND_URL || process.env.DASHBOARD_URL || 'http://localhost:5173';
    const frontendBase = rawFrontendBase.replace(/\/+$/, '');

    const orderCode = order.order_code || `ORD-${order.id}`;
    const totalAmount = Number(order.total_amount || 0).toLocaleString();

    // รายการผัก (สูงสุด 4 รายการ)
    const itemsList = itemRows.slice(0, 4).map(item => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `• ${item.product_name} x${item.quantity} ${item.unit || ''}`,
          size: 'xs',
          color: '#334155',
          flex: 8,
          wrap: true,
        },
        {
          type: 'text',
          text: `฿${Number(item.subtotal || 0).toLocaleString()}`,
          size: 'xs',
          color: '#0f172a',
          weight: 'bold',
          align: 'end',
          flex: 4,
        },
      ],
    }));

    // URL ลิงก์
    const historyUri = process.env.LIFF_HISTORY_URL || `${frontendBase}/liff/history`;
    const orderStoreUri = process.env.LIFF_ORDER_URL || `${frontendBase}/liff/order`;

    let title = '';
    let badgeText = '';
    let badgeBg = '#15803d';
    let headerBg = '#14532d';
    let subMessage = '';
    let altText = '';
    let extraInfoBoxes = [];
    let buttons = [];

    if (newStatus === 'paid') {
      title = '✅ ตรวจสอบยอดเงินเรียบร้อยแล้ว';
      badgeText = 'ชำระแล้ว';
      badgeBg = '#16a34a';
      headerBg = '#14532d';
      altText = `✅ รับยอดชำระเงินออเดอร์ ${orderCode} เรียบร้อยแล้ว`;
      subMessage = 'ฟาร์มได้รับยอดเงินของท่านเรียบร้อยแล้ว ขณะนี้กำลังเตรียมตัดและแพ็คผักสดมาตรฐาน GAP ให้ท่านอย่างพิถีพิถันครับ';

      buttons = [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '📦 ดูประวัติคำสั่งซื้อ',
            uri: historyUri,
          },
          style: 'primary',
          color: '#15803d',
          height: 'sm',
        },
      ];
    } else if (newStatus === 'shipping') {
      title = '🚚 สินค้ากำลังอยู่ระหว่างจัดส่ง!';
      badgeText = 'กำลังจัดส่ง';
      badgeBg = '#0284c7';
      headerBg = '#0369a1';
      altText = `🚚 ออเดอร์ ${orderCode} กำลังออกเดินทางจัดส่ง`;
      subMessage = 'ผักสดปลอดภัยมาตรฐาน GAP ของท่านถูกบรรจุและเริ่มออกเดินทางจัดส่งแล้ว รอรับความสดใหม่ได้เลยครับ!';

      const vehicle = dispatchDetails?.vehicle || 'รถจักรยานยนต์ส่วนตัว (เจ้าของฟาร์มส่งเอง)';
      const storageCond = dispatchDetails?.storage_conditions || 'บรรจุในกล่อง/ถุงเก็บความสด ป้องกันแสงแดดและความร้อน';
      const shippedTo = dispatchDetails?.shipped_to || order.customer_address || (order.delivery_type === 'pickup' ? 'รับเองที่ฟาร์ม' : 'ที่อยู่ตามคำสั่งซื้อ');

      extraInfoBoxes = [
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#f0fdf4',
          cornerRadius: 'md',
          paddingAll: 'sm',
          borderColor: '#bbf7d0',
          borderWidth: '1px',
          spacing: 'xs',
          contents: [
            {
              type: 'text',
              text: '🛡️ ข้อมูลการจัดส่งมาตรฐาน GAP:',
              weight: 'bold',
              size: 'xxs',
              color: '#166534',
            },
            {
              type: 'text',
              text: `📍 ส่งไปที่: ${shippedTo}`,
              size: 'xxs',
              color: '#334155',
              wrap: true,
            },
            {
              type: 'text',
              text: `❄️ การคุมคุณภาพ: ${storageCond}`,
              size: 'xxs',
              color: '#334155',
              wrap: true,
            },
            {
              type: 'text',
              text: `🛵 ยานพาหนะ: ${vehicle}`,
              size: 'xxs',
              color: '#334155',
              wrap: true,
            },
          ],
        },
      ];

      buttons = [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '📦 ตรวจสอบสถานะการจัดส่ง',
            uri: historyUri,
          },
          style: 'primary',
          color: '#0284c7',
          height: 'sm',
        },
      ];
    } else if (newStatus === 'completed') {
      title = '🎉 สินค้าจัดส่งถึงท่านเรียบร้อยแล้ว!';
      badgeText = 'จัดส่งสำเร็จ';
      badgeBg = '#15803d';
      headerBg = '#14532d';
      altText = `🎉 ออเดอร์ ${orderCode} จัดส่งสำเร็จเรียบร้อยแล้ว ขอบคุณที่อุดหนุนครับ`;
      subMessage = 'ขอบคุณที่เลือกอุดหนุนผักสดปลอดภัยมาตรฐาน GAP จากฟาร์มของเรา ขอให้อร่อยและมีสุขภาพดีกับผักสดมื้อนี้นะครับ!';

      buttons = [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '🛒 สั่งซื้อผักสดใหม่อีกครั้ง',
            uri: orderStoreUri,
          },
          style: 'primary',
          color: '#15803d',
          height: 'sm',
        },
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '📦 ดูประวัติคำสั่งซื้อ',
            uri: historyUri,
          },
          style: 'secondary',
          height: 'sm',
        },
      ];
    } else if (newStatus === 'cancelled') {
      title = '❌ คำสั่งซื้อถูกยกเลิก';
      badgeText = 'ยกเลิกแล้ว';
      badgeBg = '#e11d48';
      headerBg = '#881337';
      altText = `❌ คำสั่งซื้อ ${orderCode} ถูกยกเลิกแล้ว`;
      subMessage = `คำสั่งซื้อ #${orderCode} ของท่านถูกยกเลิกแล้ว หากมีข้อสงสัยหรือต้องการสอบถามข้อมูลเพิ่มเติม สามารถพิมพ์ข้อความสอบถามในห้องแชทนี้ได้ตลอดเวลาครับ`;

      buttons = [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '🛒 หน้าร้านสั่งซื้อผักสด',
            uri: orderStoreUri,
          },
          style: 'secondary',
          height: 'sm',
        },
      ];
    } else {
      // Pending or unrecognized status
      return;
    }

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
          // ข้อความแจ้งเตือนหลัก
          {
            type: 'text',
            text: subMessage,
            size: 'xs',
            color: '#475569',
            wrap: true,
          },
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
                text: 'ยอดรวมสุทธิ',
                size: 'sm',
                color: '#64748b',
                flex: 6,
              },
              {
                type: 'text',
                text: `฿${totalAmount} บาท`,
                size: 'md',
                color: '#0f172a',
                weight: 'bold',
                align: 'end',
                flex: 6,
              },
            ],
          },
          // ข้อมูลการจัดส่งเพิ่มเติม (GAP #6 ถ้ามี)
          ...extraInfoBoxes,
          // รายการสินค้า
          ...(itemsList.length > 0
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
                      text: '🥬 รายการสินค้า:',
                      size: 'xs',
                      weight: 'bold',
                      color: '#475569',
                    },
                    ...itemsList,
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
        contents: buttons,
      },
    };

    await client.pushMessage({
      to: customerLineId,
      messages: [
        {
          type: 'flex',
          altText: altText,
          contents: flexContents,
        },
      ],
    });

    console.log(`✅ [Customer Notify] ส่งแจ้งเตือนสถานะ '${newStatus}' ให้ลูกค้า ${order.customer_name} (LINE ID: ${customerLineId}) สำเร็จ`);
  } catch (err) {
    console.error(`❌ [Customer Notify] ไม่สามารถส่งแจ้งเตือนสถานะให้ลูกค้าได้:`, err.message, err.response?.data || err.originalError?.response?.data || JSON.stringify(err.body || ''));
  }
}
