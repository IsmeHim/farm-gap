import { pool } from '../../../db.js';
import { client } from '../config.js';

// Reply veg menu Flex Message
export async function replyVegMenu(replyToken, userId) {
  const [products] = await pool.query(
    'SELECT name, price, unit, stock_quantity FROM products WHERE status = "available" AND stock_quantity > 0 ORDER BY id ASC LIMIT 8'
  );

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
        spacing: 'md',
        alignItems: 'center',
        margin: 'sm',
        contents: [
          // 1. Number Badge (1, 2, 3...)
          {
            type: 'box',
            layout: 'vertical',
            width: '26px',
            height: '26px',
            cornerRadius: '13px',
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
            flex: 3,
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
                text: '💡 วิธีสั่งซื้อ: พิมพ์สั่งในแชทได้ทันทีครับ เช่น:\n• "สั่งกรีนโอ๊ค 2 ถุง"\n• "ขอสั่งฟิลเล่ย์ 3 ถุง"\n(สามารถสั่งเป็น "กิโล" ได้ ระบบจะคำนวณเป็นจำนวนถุงให้อัตโนมัติครับ เช่น 2 กิโล = 5 ถุง 🌱)',
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
        spacing: 'xs',
        paddingAll: 'md',
        contents: [
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
