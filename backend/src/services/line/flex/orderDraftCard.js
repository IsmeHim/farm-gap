import { pool } from '../../../db.js';
import { client, setChatSession } from '../config.js';

// 4. Flex Message: สรุปรายการสั่งซื้อและขอข้อมูลจัดส่ง (Order Draft Confirmation)
export async function replyOrderDraftConfirmation(replyToken, items, totalAmount) {
  const itemsText = items.map(it => {
    let line = `• ${it.name} จำนวน ${it.quantity} ${it.unit} (฿${it.subtotal.toLocaleString()})`;
    if (it.conversion_note) {
      line += `\n  ↳ 💡 ${it.conversion_note}`;
    }
    return line;
  }).join('\n');

  const flexCard = {
    type: 'flex',
    altText: 'สรุปรายการสั่งซื้อผักสด FarmGAP',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#173f2a',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: '🥗 ยืนยันรายการผักสดที่ต้องการสั่ง',
            weight: 'bold',
            color: '#f4d27a',
            size: 'md',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: itemsText,
            wrap: true,
            size: 'sm',
            color: '#2b3b2b',
            weight: 'bold',
          },
          {
            type: 'separator',
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'ยอดรวมทั้งสิ้น:',
                size: 'sm',
                color: '#666666',
              },
              {
                type: 'text',
                text: `฿${totalAmount.toLocaleString()} บาท`,
                size: 'md',
                weight: 'bold',
                color: '#2e7d32',
                align: 'end',
              },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#fffbeb',
            borderColor: '#f59e0b',
            borderWidth: '2px',
            cornerRadius: 'lg',
            paddingAll: 'md',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'xs',
                contents: [
                  {
                    type: 'text',
                    text: '📦',
                    size: 'sm',
                    flex: 1,
                  },
                  {
                    type: 'text',
                    text: 'กรุณาพิมพ์แจ้งข้อมูลจัดส่งในแชทนี้',
                    weight: 'bold',
                    size: 'sm',
                    color: '#92400e',
                    flex: 9,
                  },
                ],
              },
              {
                type: 'text',
                text: 'พิมพ์ส่ง 3 อย่างนี้ในข้อความเดียวได้เลยครับ:',
                size: 'xs',
                color: '#4b5563',
                weight: 'bold',
              },
              {
                type: 'box',
                layout: 'vertical',
                spacing: 'xs',
                contents: [
                  {
                    type: 'text',
                    text: '1️⃣ ชื่อ-นามสกุล ผู้รับ',
                    size: 'xs',
                    weight: 'bold',
                    color: '#1f2937',
                  },
                  {
                    type: 'text',
                    text: '2️⃣ เบอร์โทรศัพท์ติดต่อ (10 หลัก)',
                    size: 'xs',
                    weight: 'bold',
                    color: '#1f2937',
                  },
                  {
                    type: 'text',
                    text: '3️⃣ ที่อยู่จัดส่ง (พร้อมรหัสไปรษณีย์)',
                    size: 'xs',
                    weight: 'bold',
                    color: '#1f2937',
                  },
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#ffffff',
                borderColor: '#fde68a',
                borderWidth: '1px',
                cornerRadius: 'md',
                paddingAll: 'sm',
                spacing: 'xs',
                margin: 'xs',
                contents: [
                  {
                    type: 'text',
                    text: '💡 ตัวอย่างการพิมพ์:',
                    size: 'xxs',
                    color: '#b45309',
                    weight: 'bold',
                  },
                  {
                    type: 'text',
                    text: 'สมชาย ใจดี 0812345678 123/4 ม.5 ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200',
                    size: 'xs',
                    color: '#1e3a8a',
                    weight: 'bold',
                    wrap: true,
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        contents: [
          {
            type: 'button',
            action: {
              type: 'message',
              label: '❌ ยกเลิกการสั่งซื้อ',
              text: 'ยกเลิก',
            },
            style: 'secondary',
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
    console.error('Failed to reply order draft confirmation:', err.message);
  }
}

// 4.1 Flex Message: สรุปรายการสั่งซื้อสำหรับลูกค้าเดิม (ใช้ข้อมูลจัดส่งเดิมได้ทันที)
export async function replyReturningCustomerConfirmation(replyToken, items, totalAmount, existingContact) {
  const itemsText = items.map(it => {
    let line = `• ${it.name} จำนวน ${it.quantity} ${it.unit} (฿${it.subtotal.toLocaleString()})`;
    if (it.conversion_note) {
      line += `\n  ↳ 💡 ${it.conversion_note}`;
    }
    return line;
  }).join('\n');

  const flexCard = {
    type: 'flex',
    altText: 'ยืนยันรายการสั่งซื้อผักสด FarmGAP',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#173f2a',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: '🥗 ยืนยันรายการผักสดที่ต้องการสั่ง',
            weight: 'bold',
            color: '#f4d27a',
            size: 'md',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: itemsText,
            wrap: true,
            size: 'sm',
            color: '#2b3b2b',
            weight: 'bold',
          },
          {
            type: 'separator',
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'ยอดรวมทั้งสิ้น:',
                size: 'sm',
                color: '#666666',
              },
              {
                type: 'text',
                text: `฿${totalAmount.toLocaleString()} บาท`,
                size: 'md',
                weight: 'bold',
                color: '#2e7d32',
                align: 'end',
              },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f0fdf4',
            borderColor: '#22c55e',
            borderWidth: '2px',
            cornerRadius: 'lg',
            paddingAll: 'md',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '📍 ใช้ข้อมูลจัดส่งเดิมนี้เลยไหมครับ?',
                weight: 'bold',
                size: 'sm',
                color: '#166534',
                wrap: true,
              },
              {
                type: 'text',
                text: `👤 ผู้รับ: ${existingContact.name || 'คุณลูกค้า'}`,
                size: 'xs',
                weight: 'bold',
                color: '#1f2937',
              },
              {
                type: 'text',
                text: `📱 เบอร์โทร: ${existingContact.phone || '-'}`,
                size: 'xs',
                weight: 'bold',
                color: '#1f2937',
              },
              {
                type: 'text',
                text: `🏠 ที่อยู่: ${existingContact.address || '-'}`,
                size: 'xs',
                color: '#374151',
                wrap: true,
              },
              {
                type: 'separator',
                margin: 'sm',
              },
              {
                type: 'text',
                text: '👉 แตะปุ่ม [✅ ใช้ข้อมูลเดิมนี้เลย] ด้านล่างเพื่อดำเนินการต่อทันที',
                size: 'xxs',
                color: '#15803d',
                weight: 'bold',
                wrap: true,
              },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#fffbeb',
            borderColor: '#fde68a',
            borderWidth: '1px',
            cornerRadius: 'md',
            paddingAll: 'sm',
            spacing: 'xxs',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: '✏️ หรือต้องการส่งที่อยู่อื่น / เปลี่ยนข้อมูลใหม่:',
                size: 'xxs',
                weight: 'bold',
                color: '#92400e',
                wrap: true,
              },
              {
                type: 'text',
                text: 'พิมพ์ ชื่อ เบอร์โทร และที่อยู่ใหม่ ส่งในแชทนี้ได้เลยครับ',
                size: 'xxs',
                color: '#78350f',
                wrap: true,
              },
              {
                type: 'text',
                text: '💡 ตัวอย่าง: สมชาย ใจดี 0812345678 123/4 ม.5 ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200',
                size: 'xxs',
                color: '#1e3a8a',
                weight: 'bold',
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
        contents: [
          {
            type: 'button',
            action: {
              type: 'message',
              label: '✅ ใช้ข้อมูลเดิมนี้เลย',
              text: 'ใช้ข้อมูลเดิม',
            },
            style: 'primary',
            color: '#16a34a',
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '❌ ยกเลิกการสั่งซื้อ',
              text: 'ยกเลิก',
            },
            style: 'secondary',
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
    console.error('Failed to reply returning customer confirmation:', err.message);
  }
}

// Helper: ส่งการ์ดยืนยันออเดอร์ (ตรวจเช็คว่าเป็นลูกค้าเดิมที่มีที่อยู่แล้ว หรือลูกค้าใหม่)
export async function sendSmartOrderDraftConfirmation(replyToken, userId, items, totalAmount) {
  try {
    const [custRows] = await pool.query('SELECT display_name, phone, address FROM customers WHERE line_user_id = ?', [userId]);
    const cust = custRows[0] || {};
    const hasAddress = cust.address && cust.address !== '-' && cust.address.trim().length >= 5;
    const hasPhone = cust.phone && cust.phone !== '-' && cust.phone.trim().length >= 9;

    if (hasAddress && hasPhone) {
      const existingContact = {
        name: cust.display_name && cust.display_name !== 'ลูกค้า LINE' ? cust.display_name : 'คุณลูกค้า',
        phone: cust.phone,
        address: cust.address,
      };

      await setChatSession(userId, 'AWAITING_ADDRESS', null, {
        items,
        totalAmount,
        existing_contact: existingContact,
      });

      return replyReturningCustomerConfirmation(replyToken, items, totalAmount, existingContact);
    }
  } catch (err) {
    console.error('sendSmartOrderDraftConfirmation error:', err.message);
  }

  // Fallback สำหรับลูกค้าใหม่ที่ยังไม่มีข้อมูลจัดส่ง
  await setChatSession(userId, 'AWAITING_ADDRESS', null, {
    items,
    totalAmount,
  });
  return replyOrderDraftConfirmation(replyToken, items, totalAmount);
}
