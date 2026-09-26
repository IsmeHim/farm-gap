import { client } from '../config.js';

// Flex Message: แจ้งยืนยันการสั่งซื้อแบบเก็บเงินปลายทาง (COD) สำเร็จ
export async function replyCodOrderConfirmation(replyToken, orderCode, totalAmount, items, addressText) {
  const itemsText = (items || [])
    .map(it => `• ${it.name} จำนวน ${it.quantity} ${it.unit || 'กก.'} (฿${(it.subtotal || 0).toLocaleString()})`)
    .join('\n');

  const flexCard = {
    type: 'flex',
    altText: `ยืนยันคำสั่งซื้อเก็บเงินปลายทาง ${orderCode}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#059669',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: '🎉 สั่งซื้อสำเร็จ (เก็บเงินปลายทาง)',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
          },
          {
            type: 'text',
            text: `รหัสคำสั่งซื้อ: ${orderCode}`,
            size: 'xs',
            color: '#d1fae5',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          // กล่องยอดเงินที่ต้องชำระเมื่อได้รับของ
          {
            type: 'box',
            layout: 'horizontal',
            backgroundColor: '#f0fdf4',
            borderColor: '#86efac',
            borderWidth: '1px',
            cornerRadius: 'md',
            paddingAll: 'md',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: 'ยอดชำระเมื่อได้รับสินค้า',
                size: 'xs',
                color: '#166534',
                weight: 'bold',
                flex: 6,
              },
              {
                type: 'text',
                text: `฿${Number(totalAmount).toLocaleString()} บาท`,
                size: 'lg',
                weight: 'bold',
                color: '#059669',
                align: 'end',
                flex: 6,
              },
            ],
          },
          // รายการผักที่สั่ง
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '🥬 รายการผักสดที่สั่ง:',
                weight: 'bold',
                size: 'xs',
                color: '#334155',
              },
              {
                type: 'text',
                text: itemsText,
                wrap: true,
                size: 'xs',
                color: '#475569',
              },
            ],
          },
          {
            type: 'separator',
          },
          // ข้อมูลจัดส่ง
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '📍 ข้อมูลจัดส่ง:',
                weight: 'bold',
                size: 'xs',
                color: '#334155',
              },
              {
                type: 'text',
                text: addressText,
                wrap: true,
                size: 'xs',
                color: '#64748b',
              },
            ],
          },
          // กล่องคำแนะนำ COD
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#fffbeb',
            borderColor: '#fde68a',
            borderWidth: '1px',
            cornerRadius: 'md',
            paddingAll: 'md',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '🚚 ขั้นตอนถัดไป:',
                weight: 'bold',
                size: 'xs',
                color: '#92400e',
              },
              {
                type: 'text',
                text: 'ฟาร์มได้รับคำสั่งซื้อเรียบร้อยแล้วครับ กำลังเตรียมเก็บเกี่ยวผักสดจากแปลง GAP และจัดส่งถึงหน้าบ้าน รบกวนเตรียมเงินสดชำระกับเจ้าหน้าที่ส่งพัสดุเมื่อได้รับสินค้านะครับ 🌱',
                wrap: true,
                size: 'xs',
                color: '#78350f',
              },
            ],
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
              label: '🔍 เช็คสถานะออเดอร์',
              text: 'เช็คสถานะ',
            },
            style: 'secondary',
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '🌱 สั่งซื้อผักสดเพิ่ม',
              text: 'สั่งซื้อ',
            },
            style: 'link',
            height: 'sm',
          },
        ],
      },
    },
  };

  try {
    await client.replyMessage({
      replyToken: replyToken,
      messages: [flexCard],
    });
  } catch (err) {
    console.error('Failed to reply COD order confirmation:', err.message);
  }
}
