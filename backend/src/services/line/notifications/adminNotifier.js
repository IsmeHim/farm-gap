import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../../db.js';
import { client, lineConfig } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../../../uploads');

// Helper: ดึง URL หน้าเว็บหลักของฟาร์ม (HTTPS สำหรับ LINE)
export async function getAdminFrontendBase() {
  const [owners] = await pool.query(
    "SELECT id, email, line_user_id, farm_name, display_name, frontend_url FROM users WHERE (role = 'owner' OR role = 'admin') ORDER BY id ASC"
  );
  const ownerWithLine = owners.find(o => o.line_user_id && o.line_user_id.trim().startsWith('U')) || owners[0];
  const configuredUrl = ownerWithLine?.frontend_url ? ownerWithLine.frontend_url.trim() : null;
  const rawFrontendBase = configuredUrl || process.env.FRONTEND_URL || process.env.DASHBOARD_URL || 'http://localhost:5173';
  const frontendBase = rawFrontendBase.replace(/\/+$/, '');
  return { frontendBase, owner: ownerWithLine, allOwners: owners };
}

// Helper: แปลง slip_image_url ให้เป็น HTTPS URL ที่ LINE สามารถดึงไปแสดงผลได้
function resolvePublicSlipHttpsUrl(rawSlipUrl, frontendBase) {
  if (!rawSlipUrl || typeof rawSlipUrl !== 'string') return null;
  let slipUrl = rawSlipUrl.trim();

  // หากเป็น Base64 Data URI ให้แปลงเป็นไฟล์ลง /uploads อัตโนมัติ
  if (slipUrl.startsWith('data:image/')) {
    try {
      const matches = slipUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        let ext = matches[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `slip-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.${ext}`;
        fs.writeFileSync(path.join(uploadsDir, filename), buffer);
        slipUrl = `/uploads/${filename}`;
      }
    } catch (e) {
      console.warn('⚠️ [Admin Notify] แปลง Base64 slip เป็นไฟล์ไม่สำเร็จ:', e.message);
      return null;
    }
  }

  if (slipUrl.startsWith('https://')) {
    return slipUrl;
  }

  if (slipUrl.startsWith('/')) {
    // ตรวจสอบว่า frontendBase เป็น https:// หรือไม่ (LINE บังคับ https สำหรับรูปภาพ)
    const httpsBase = frontendBase.startsWith('https://')
      ? frontendBase
      : (process.env.FRONTEND_URL && process.env.FRONTEND_URL.startsWith('https://')
          ? process.env.FRONTEND_URL.replace(/\/+$/, '')
          : null);
    if (httpsBase) {
      return `${httpsBase}${slipUrl}`;
    }
  }

  return null;
}

// Helper: สร้าง Flex Bubble สำหรับการ์ด Step 2 (กำลังจัดส่ง -> รอกดยืนยันจัดส่งสำเร็จ)
export function buildAdminShippingStepBubble(order, items = [], frontendBase = 'http://localhost:5173', storageLogId = null) {
  const orderCode = order.order_code || `ORD-${order.id}`;
  const totalAmount = Number(order.total_amount || 0).toLocaleString();
  const isCod = order.payment_method === 'cod';
  const customerName = order.customer_name || order.recipient_name || 'ลูกค้าทั่วไป';
  const customerPhone = order.customer_phone || order.recipient_phone || '-';
  const customerAddress = order.customer_address || order.recipient_address || '-';
  const printUri = order.id ? `${frontendBase}/orders/${order.id}/print` : `${frontendBase}/orders`;

  const itemRows = items.slice(0, 5).map(item => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: `• ${item.product_name || item.name || 'ผักสด'} x${Number(item.quantity) || 1} ${item.unit || 'ถุง'}`,
        size: 'xs',
        color: '#334155',
        flex: 8,
        wrap: true,
      },
      {
        type: 'text',
        text: `฿${Number(item.subtotal || (item.quantity * (item.unit_price || item.price || 0))).toLocaleString()}`,
        size: 'xs',
        color: '#0f172a',
        weight: 'bold',
        align: 'end',
        flex: 4,
      },
    ],
  }));

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0369a1',
      paddingAll: 'lg',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          alignItems: 'center',
          contents: [
            {
              type: 'text',
              text: '🚚 เริ่มจัดส่งสินค้าแล้ว!',
              weight: 'bold',
              size: 'md',
              color: '#ffffff',
              flex: 7,
            },
            {
              type: 'box',
              layout: 'horizontal',
              backgroundColor: '#0284c7',
              cornerRadius: 'sm',
              paddingStart: 'sm',
              paddingEnd: 'sm',
              paddingTop: 'xs',
              paddingBottom: 'xs',
              contents: [
                {
                  type: 'text',
                  text: 'Step 2/2: กำลังส่ง',
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
          color: '#e0f2fe',
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
        // แถบยืนยันการบันทึกสมุด GAP #6 และแจ้งเตือนลูกค้า
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#f0fdf4',
          borderColor: '#bbf7d0',
          borderWidth: '1px',
          cornerRadius: 'md',
          paddingAll: 'sm',
          spacing: 'xs',
          contents: [
            {
              type: 'text',
              text: `✅ บันทึกสมุดขนส่ง GAP #6 อัตโนมัติสำเร็จ${storageLogId ? ` (#${storageLogId})` : ''}`,
              size: 'xs',
              weight: 'bold',
              color: '#166534',
              wrap: true,
            },
            {
              type: 'text',
              text: '📲 แจ้งเตือนสถานะ "กำลังจัดส่ง" ไปยัง LINE ลูกค้าเรียบร้อยแล้ว',
              size: 'xxs',
              color: '#15803d',
              wrap: true,
            },
          ],
        },
        // แถบแจ้งเตือนการเก็บเงินสำหรับคนขับ/เจ้าของฟาร์ม
        {
          type: 'box',
          layout: 'horizontal',
          backgroundColor: isCod ? '#fffbeb' : '#f8fafc',
          borderColor: isCod ? '#fde68a' : '#e2e8f0',
          borderWidth: '1px',
          cornerRadius: 'md',
          paddingAll: 'md',
          alignItems: 'center',
          contents: [
            {
              type: 'text',
              text: isCod ? '💵 เก็บเงินสดปลายทาง (COD)' : '💳 โอนชำระแล้ว (ไม่ต้องเก็บเพิ่ม)',
              size: 'xs',
              weight: 'bold',
              color: isCod ? '#b45309' : '#475569',
              flex: 7,
              wrap: true,
            },
            {
              type: 'text',
              text: `฿${totalAmount}`,
              size: 'lg',
              weight: 'bold',
              color: isCod ? '#d97706' : '#059669',
              align: 'end',
              flex: 5,
            },
          ],
        },
        // ข้อมูลผู้รับสำหรับจัดส่ง
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          contents: [
            {
              type: 'text',
              text: '📍 ข้อมูลผู้รับปลายทาง:',
              size: 'xs',
              weight: 'bold',
              color: '#475569',
            },
            {
              type: 'text',
              text: `ชื่อ: ${customerName} (${customerPhone})`,
              size: 'xs',
              weight: 'bold',
              color: '#0f172a',
              wrap: true,
            },
            {
              type: 'text',
              text: `ที่อยู่: ${customerAddress}`,
              size: 'xs',
              color: '#334155',
              wrap: true,
            },
          ],
        },
        ...(itemRows.length > 0
          ? [
              {
                type: 'separator',
                margin: 'sm',
              },
              {
                type: 'box',
                layout: 'vertical',
                spacing: 'xs',
                contents: itemRows,
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
            type: 'postback',
            label: '✅ ยืนยันจัดส่งถึงมือลูกค้าสำเร็จ',
            data: `action=admin_complete&order_id=${order.id}`,
            displayText: `✅ ยืนยันจัดส่งออเดอร์ ${orderCode} สำเร็จ`,
          },
          style: 'primary',
          color: '#16a34a',
          height: 'sm',
        },
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '🖨️ ดู/พิมพ์ใบปะหน้าพัสดุ',
            uri: printUri,
          },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  };
}

// Helper: สร้าง Flex Bubble สำหรับการ์ดปิดออเดอร์สำเร็จ (Completed)
export function buildAdminCompletedStepBubble(order, frontendBase = 'http://localhost:5173') {
  const orderCode = order.order_code || `ORD-${order.id}`;
  const totalAmount = Number(order.total_amount || 0).toLocaleString();
  const isCod = order.payment_method === 'cod';
  const customerName = order.customer_name || order.recipient_name || 'ลูกค้าทั่วไป';

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#14532d',
      paddingAll: 'lg',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          alignItems: 'center',
          contents: [
            {
              type: 'text',
              text: '🎉 ปิดออเดอร์สำเร็จครบวงจร!',
              weight: 'bold',
              size: 'md',
              color: '#ffffff',
              flex: 8,
            },
            {
              type: 'box',
              layout: 'horizontal',
              backgroundColor: '#16a34a',
              cornerRadius: 'sm',
              paddingStart: 'sm',
              paddingEnd: 'sm',
              paddingTop: 'xs',
              paddingBottom: 'xs',
              contents: [
                {
                  type: 'text',
                  text: 'สำเร็จ 100%',
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
          color: '#bbf7d0',
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
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#f0fdf4',
          borderColor: '#bbf7d0',
          borderWidth: '1px',
          cornerRadius: 'md',
          paddingAll: 'md',
          spacing: 'xs',
          contents: [
            {
              type: 'text',
              text: `✅ ส่งมอบผักสดให้ "${customerName}" เรียบร้อยแล้ว`,
              size: 'xs',
              weight: 'bold',
              color: '#166534',
              wrap: true,
            },
            {
              type: 'text',
              text: `💰 ยอดขายสุทธิ: ฿${totalAmount} บาท (${isCod ? 'เก็บเงินสดปลายทาง COD' : 'โอนชำระแล้ว'})`,
              size: 'xs',
              color: '#15803d',
              wrap: true,
            },
            {
              type: 'text',
              text: '📲 ส่งข้อความขอบคุณพร้อมลิงก์สั่งซื้อรอบถัดไปให้ลูกค้าแล้วครับ',
              size: 'xxs',
              color: '#475569',
              wrap: true,
            },
          ],
        },
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
            label: '📊 เปิดดูหน้าจัดการออเดอร์บนเว็บ',
            uri: `${frontendBase}/orders`,
          },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  };
}

// Helper: ส่งการแจ้งเตือนเข้า LINE ของเจ้าของฟาร์ม (Admin Push Notification)
export async function notifyAdminNewOrder(orderData, eventType = 'NEW_ORDER') {
  try {
    // 1. ดึง LINE User ID และ frontend_url ของเจ้าของฟาร์มจากตาราง users
    const { frontendBase, owner } = await getAdminFrontendBase();

    if (!owner || !owner.line_user_id) {
      console.log('ℹ️ [Admin Notify] ไม่พบ LINE User ID ของเจ้าของฟาร์มในระบบ (สามารถตั้งค่าได้ที่หน้าโปรไฟล์บนเว็บ)');
      return;
    }

    const adminLineId = owner.line_user_id.trim();
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
          SELECT o.*, 
                 COALESCE(o.recipient_name, c.display_name) AS customer_name, 
                 COALESCE(o.recipient_phone, c.phone) AS customer_phone, 
                 COALESCE(o.recipient_address, c.address) AS customer_address
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
            slip_image_url: oRows[0].slip_image_url || orderData.slip_image_url,
            payment_method: oRows[0].payment_method || orderData.payment_method,
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

    const isCod = resolvedOrder.payment_method === 'cod';
    const publicSlipUrl = !isCod ? resolvePublicSlipHttpsUrl(resolvedOrder.slip_image_url, frontendBase) : null;
    const isSlip = !isCod && (eventType === 'SLIP_UPLOADED' || Boolean(resolvedOrder.slip_image_url));

    const title = isCod
      ? '🚚 ออเดอร์ใหม่ (เก็บเงินปลายทาง)'
      : (isSlip ? '💸 ออเดอร์ใหม่ (โอนเงินแนบสลิปแล้ว)' : '🔔 มีคำสั่งซื้อใหม่เข้ามา!');
    const badgeText = isCod ? 'เก็บปลายทาง COD' : (isSlip ? 'แนบสลิปแล้ว' : 'ออเดอร์ใหม่');
    const badgeBg = isCod ? '#d97706' : (isSlip ? '#16a34a' : '#0284c7');
    const headerBg = isCod ? '#78350f' : (isSlip ? '#14532d' : '#0f172a');

    const orderCode = resolvedOrder.order_code || `ORD-${resolvedOrder.id || ''}`;
    const totalAmount = Number(resolvedOrder.total_amount || 0).toLocaleString();
    const customerName = resolvedOrder.customer_name || 'ลูกค้าทั่วไป';
    const customerPhone = resolvedOrder.customer_phone || '-';
    const customerAddress = resolvedOrder.customer_address || '-';

    // เตรียมรายการสินค้า (ถ้ามี)
    const items = resolvedOrder.items || [];
    const itemRows = items.slice(0, 6).map(item => ({
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
                flex: 7,
                wrap: true,
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
                color: isCod ? '#d97706' : '#059669',
                align: 'end',
                flex: 6,
              },
            ],
          },
          // แถบแสดงสถานะการชำระเงิน (แยก COD กับ โอนเงินแนบสลิป ชัดเจน)
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: isCod ? '#fffbeb' : '#f0fdf4',
            borderColor: isCod ? '#fde68a' : '#bbf7d0',
            borderWidth: '1px',
            cornerRadius: 'md',
            paddingAll: 'sm',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: isCod
                  ? `🚚 เก็บเงินปลายทาง (COD) — ไม่มีสลิปโอนเงิน`
                  : (publicSlipUrl
                      ? `💳 โอนเงินผ่านธนาคาร — ส่งรูปสลิปให้ด้านบนแล้ว`
                      : `💳 โอนเงินผ่านธนาคาร — แจ้งชำระเงินแล้ว`),
                size: 'xs',
                weight: 'bold',
                color: isCod ? '#b45309' : '#166534',
                wrap: true,
              },
              {
                type: 'text',
                text: isCod
                  ? `โปรดเตรียมจัดส่งผักสด และเก็บเงินสด ฿${totalAmount} บาท เมื่อส่งถึงมือลูกค้าครับ`
                  : (publicSlipUrl
                      ? `กรุณาตรวจสอบรูปสลิปโอนเงินด้านบน แล้วกดปุ่ม "จัดส่งสินค้า" ด้านล่างเพื่อดำเนินการต่อได้ทันทีครับ`
                      : `สามารถกดปุ่ม "จัดส่งสินค้า" ด้านล่างเพื่อดำเนินการต่อได้ทันทีครับ`),
                size: 'xxs',
                color: isCod ? '#92400e' : '#15803d',
                wrap: true,
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
                text: '👤 ข้อมูลลูกค้าและที่อยู่จัดส่ง:',
                size: 'xs',
                weight: 'bold',
                color: '#475569',
              },
              {
                type: 'text',
                text: `ชื่อ: ${customerName}`,
                size: 'xs',
                color: '#1e293b',
                weight: 'bold',
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
                color: '#334155',
                wrap: true,
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
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'md',
        contents: [
          ...(resolvedOrder.id
            ? [
                {
                  type: 'button',
                  action: {
                    type: 'postback',
                    label: '🚚 กดจัดส่งสินค้า (ลงสมุด GAP #6)',
                    data: `action=admin_dispatch&order_id=${resolvedOrder.id}`,
                    displayText: `🚚 เริ่มจัดส่งออเดอร์ ${orderCode}`,
                  },
                  style: 'primary',
                  color: '#16a34a',
                  height: 'sm',
                },
              ]
            : []),
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '🖨️ พิมพ์ใบปะหน้า & เช็คลิสต์',
              uri: printUri,
            },
            style: 'secondary',
            height: 'sm',
          },
          ...(resolvedOrder.id
            ? [
                {
                  type: 'button',
                  action: {
                    type: 'postback',
                    label: '❌ ยกเลิกออเดอร์ (คืนสต็อกผัก)',
                    data: `action=admin_cancel&order_id=${resolvedOrder.id}`,
                    displayText: `❌ ยกเลิกออเดอร์ ${orderCode}`,
                  },
                  style: 'secondary',
                  color: '#fee2e2',
                  height: 'sm',
                },
              ]
            : []),
        ],
      },
    };

    // สร้างชุดข้อความที่จะส่งให้เจ้าของฟาร์ม:
    // - หากเป็นโอนเงินและมีรูปสลิป (publicSlipUrl) ➔ ส่งรูปสลิปใบใหญ่คู่กับการ์ดออเดอร์ทันที
    // - หากเป็นเก็บเงินปลายทาง (COD) ➔ ส่งเฉพาะการ์ดออเดอร์ (ไม่มีรูปสลิป)
    const messagesToSend = [];
    if (!isCod && publicSlipUrl) {
      messagesToSend.push({
        type: 'image',
        originalContentUrl: publicSlipUrl,
        previewImageUrl: publicSlipUrl,
      });
    }

    messagesToSend.push({
      type: 'flex',
      altText: isCod
        ? `🚚 ออเดอร์ใหม่ (COD เก็บปลายทาง): ${orderCode} (฿${totalAmount})`
        : `💸 ออเดอร์ใหม่พร้อมสลิปโอนเงิน: ${orderCode} (฿${totalAmount})`,
      contents: flexContents,
    });

    try {
      await client.pushMessage({
        to: adminLineId,
        messages: messagesToSend,
      });
    } catch (pushErr) {
      // Fallback: หากส่งรูปสลิปไม่ผ่าน (เช่น URL รูปมีปัญหา) ให้ส่งเฉพาะการ์ด Flex เพื่อไม่ให้แจ้งเตือนตกหล่น
      if (messagesToSend.length > 1) {
        console.warn('⚠️ [Admin Notify] ส่งรูปสลิปไม่สำเร็จ กำลังส่งเฉพาะการ์ดแจ้งเตือนแทน:', pushErr.message);
        await client.pushMessage({
          to: adminLineId,
          messages: [messagesToSend[messagesToSend.length - 1]],
        });
      } else {
        throw pushErr;
      }
    }

    console.log(`✅ [Admin Notify] ส่งการแจ้งเตือน ${eventType} ${!isCod && publicSlipUrl ? '(พร้อมรูปสลิป)' : '(COD/ไม่มีสลิป)'} ไปยัง LINE เจ้าของฟาร์มสำเร็จ`);
  } catch (err) {
    console.error('❌ [Admin Notify] ไม่สามารถส่งแจ้งเตือนเข้า LINE ได้:', err.message);
  }
}
