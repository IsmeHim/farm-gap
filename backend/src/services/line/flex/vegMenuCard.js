import { pool } from '../../../db.js';
import { client, getChatSession } from '../config.js';

// Reply veg menu Flex Message
export async function replyVegMenu(replyToken, userId) {
  const [products] = await pool.query(
    'SELECT id, name, price, unit, stock_quantity FROM products WHERE status = "available" AND stock_quantity > 0 ORDER BY id ASC LIMIT 8'
  );

  // ตรวจสอบว่ามีสินค้าค้างอยู่ในตะกร้าแชทหรือไม่
  let cart = [];
  try {
    if (userId) {
      const session = await getChatSession(userId);
      if (Array.isArray(session?.draft_data?.cart) && session.draft_data.cart.length > 0) {
        cart = session.draft_data.cart;
      }
    }
  } catch (_) {}

  const cartTotalAmount = cart.reduce((sum, it) => sum + Number(it.subtotal || (it.quantity * it.price)), 0);
  const cartTotalPacks = cart.reduce((sum, it) => sum + Number(it.quantity), 0);

  const productRows = [];
  if (products.length === 0) {
    productRows.push({
      type: 'text',
      text: 'ขณะนี้สินค้าหมดชั่วคราว อยู่ระหว่างเตรียมแปลงเก็บเกี่ยวล็อตถัดไปครับ 🌱',
      wrap: true,
      size: 'sm',
      color: '#757575',
      align: 'center',
      margin: 'md',
    });
  } else {
    products.forEach((p, idx) => {
      if (idx > 0) {
        productRows.push({
          type: 'separator',
          margin: 'sm',
          color: '#f0f0f0',
        });
      }

      productRows.push({
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        alignItems: 'center',
        margin: 'sm',
        action: {
          type: 'postback',
          label: 'สั่ง',
          data: `action=select_product&product_id=${p.id}`,
          displayText: `สั่ง ${p.name}`,
        },
        contents: [
          // 1. Number Badge (1, 2, 3...)
          {
            type: 'box',
            layout: 'vertical',
            width: '24px',
            height: '24px',
            cornerRadius: '12px',
            backgroundColor: '#e8f5e9',
            justifyContent: 'center',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: String(idx + 1),
                size: 'xs',
                weight: 'bold',
                color: '#1b5e20',
                align: 'center',
              },
            ],
          },
          // 2. Vegetable Name & Remaining Stock
          {
            type: 'box',
            layout: 'vertical',
            flex: 5,
            spacing: 'none',
            contents: [
              {
                type: 'text',
                text: p.name,
                weight: 'bold',
                size: 'sm',
                color: '#1b3a24',
                wrap: true,
              },
              {
                type: 'text',
                text: `คงเหลือ ${Number(p.stock_quantity).toLocaleString()} ${p.unit}`,
                size: 'xxs',
                color: '#757575',
              },
            ],
          },
          // 3. Price per unit
          {
            type: 'box',
            layout: 'vertical',
            flex: 2,
            alignItems: 'flex-end',
            contents: [
              {
                type: 'text',
                text: `฿${Number(p.price).toLocaleString()}`,
                weight: 'bold',
                size: 'sm',
                color: '#2e7d32',
                align: 'end',
              },
              {
                type: 'text',
                text: `/${p.unit}`,
                size: 'xxs',
                color: '#9e9e9e',
                align: 'end',
              },
            ],
          },
          // 4. Quick Order Button (สั่ง 🛒)
          {
            type: 'box',
            layout: 'vertical',
            width: '52px',
            height: '28px',
            backgroundColor: '#1b5e20',
            cornerRadius: '14px',
            justifyContent: 'center',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: 'สั่ง 🛒',
                color: '#ffffff',
                size: 'xxs',
                weight: 'bold',
                align: 'center',
              },
            ],
          },
        ],
      });
    });
  }

  const flexMenu = {
    type: 'flex',
    altText: '🥗 เมนูผักสดพร้อมส่งวันนี้ FarmGAP',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#173f2a',
        paddingAll: 'lg',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '🥗 เมนูผักสดพร้อมส่งวันนี้',
                weight: 'bold',
                size: 'md',
                color: '#ffffff',
                flex: 8,
              },
              {
                type: 'text',
                text: 'GAP 100%',
                weight: 'bold',
                size: 'xxs',
                color: '#a5d6a7',
                align: 'end',
                flex: 4,
              },
            ],
          },
          {
            type: 'text',
            text: 'ผักสดตัดใหม่จากแปลง ได้รับมาตรฐานความปลอดภัย GAP',
            size: 'xxs',
            color: '#c8e6c9',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          ...productRows,
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f1f8e9',
            cornerRadius: 'md',
            paddingAll: 'sm',
            margin: 'lg',
            borderColor: '#c8e6c9',
            borderWidth: '1px',
            contents: [
              {
                type: 'text',
                text: '💡 วิธีสั่งซื้อง่ายๆ ในแชท:\n• แตะที่ผัก หรือปุ่ม [สั่ง 🛒] เพื่อเลือกจำนวนผักสะสมลงตะกร้า\n• แตะเลือกผักได้หลายชนิดตามต้องการ โดยไม่ต้องพิมพ์เอง\n• เมื่อเลือกครบแล้ว แตะ [✅ สรุปสั่งซื้อเลย] จบในแชทได้ทันที 🌱',
                wrap: true,
                size: 'xs',
                color: '#2e7d32',
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
        contents: cart.length > 0 ? [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: `🧺 ดูตะกร้า/สั่งซื้อ (${cartTotalPacks} ถุง • ฿${cartTotalAmount.toLocaleString()})`,
              data: 'action=view_cart',
              displayText: 'ดูตะกร้าสินค้า',
            },
            style: 'primary',
            color: '#16a34a',
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📦 เช็คสถานะออเดอร์ของฉัน',
              text: 'เช็คสถานะ',
            },
            style: 'secondary',
            height: 'sm',
          },
        ] : [
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📦 เช็คสถานะออเดอร์ของฉัน',
              text: 'เช็คสถานะ',
            },
            style: 'primary',
            color: '#173f2a',
            height: 'sm',
          },
        ],
      },
    },
  };

  try {
    await client.replyMessage({
      replyToken: replyToken,
      messages: [flexMenu],
    });
  } catch (err) {
    console.error('Failed to reply menu:', err.message);
  }
}
