import { pool } from '../../../db.js';
import { client } from '../config.js';

// 5. Flex Message: ใบแจ้งหนี้และช่องทางโอนเงิน (Invoice & Payment)
export async function replyInvoiceAndPayment(replyToken, orderCode, totalAmount, items, addressText) {
  let bankInfoLines = [
    '• ธนาคาร: ธนาคารกสิกรไทย (KBANK)',
    '• เลขที่บัญชี: 098-2-34567-8',
    '• ชื่อบัญชี: ฟาร์มผัก FarmGAP AI',
    '• พร้อมเพย์: 081-234-5678',
  ];
  let qrImageElement = null;
  let finalQrUrl = null;

  try {
    const [owners] = await pool.query(
      "SELECT farm_name, display_name, bank_name, bank_account_no, bank_account_name, promptpay_number, promptpay_qr_url FROM users WHERE role = 'owner' LIMIT 1"
    );
    if (owners && owners[0]) {
      const o = owners[0];
      const customLines = [];
      if (o.bank_name) customLines.push(`• ธนาคาร: ${o.bank_name}`);
      if (o.bank_account_no) customLines.push(`• เลขบัญชี: ${o.bank_account_no}`);
      if (o.bank_account_name || o.display_name) customLines.push(`• ชื่อบัญชี: ${o.bank_account_name || o.display_name}`);
      if (o.promptpay_number) customLines.push(`• พร้อมเพย์: ${o.promptpay_number}`);

      if (customLines.length > 0) {
        bankInfoLines = customLines;
      }

      // Generate dynamic PromptPay QR code with locked amount
      const cleanPromptPay = (o.promptpay_number || '').replace(/[^0-9]/g, '');
      if (cleanPromptPay && totalAmount > 0) {
        finalQrUrl = `https://promptpay.io/${cleanPromptPay}/${totalAmount}.png`;
      } else if (cleanPromptPay) {
        finalQrUrl = `https://promptpay.io/${cleanPromptPay}.png`;
      } else if (o.promptpay_qr_url && o.promptpay_qr_url.startsWith('https://')) {
        finalQrUrl = o.promptpay_qr_url;
      }

      if (finalQrUrl) {
        qrImageElement = {
          type: 'image',
          url: finalQrUrl,
          size: 'md',
          aspectRatio: '1:1',
          aspectMode: 'cover',
          margin: 'sm',
          align: 'center',
          action: {
            type: 'uri',
            label: 'บันทึกรูป QR Code',
            uri: finalQrUrl,
          },
        };
      }
    }
  } catch (err) {
    console.warn('Could not load owner bank info for invoice:', err.message);
  }

  const itemsRows = items.map(it => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: `${it.name} x${it.quantity} ${it.unit}`,
        size: 'xs',
        color: '#333333',
        flex: 3,
      },
      {
        type: 'text',
        text: `฿${it.subtotal.toLocaleString()}`,
        size: 'xs',
        color: '#111111',
        weight: 'bold',
        align: 'end',
        flex: 2,
      },
    ],
  }));

  const flexInvoice = {
    type: 'flex',
    altText: `ใบแจ้งหนี้ออเดอร์ ${orderCode}`,
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
            text: '🧾 เปิดบิลออเดอร์สำเร็จ!',
            weight: 'bold',
            color: '#f4d27a',
            size: 'md',
          },
          {
            type: 'text',
            text: `เลขที่: ${orderCode}`,
            size: 'xs',
            color: '#c5e1a5',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: 'รายการผักสด:',
            weight: 'bold',
            size: 'xs',
            color: '#666666',
          },
          ...itemsRows,
          {
            type: 'separator',
            margin: 'sm',
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: 'ยอดโอนชำระรวม:',
                size: 'sm',
                weight: 'bold',
                color: '#173f2a',
              },
              {
                type: 'text',
                text: `฿${totalAmount.toLocaleString()} บาท`,
                size: 'lg',
                weight: 'bold',
                color: '#2e7d32',
                align: 'end',
              },
            ],
          },
          {
            type: 'separator',
            margin: 'sm',
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f8fdf9',
            cornerRadius: 'md',
            paddingAll: 'sm',
            contents: [
              {
                type: 'text',
                text: '📍 ที่อยู่จัดส่ง:',
                weight: 'bold',
                size: 'xs',
                color: '#2e7d32',
              },
              {
                type: 'text',
                text: addressText || 'ตามที่ลูกค้าระบุ',
                wrap: true,
                size: 'xs',
                color: '#444444',
                margin: 'xs',
              },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#fff9e6',
            borderColor: '#ffe082',
            borderWidth: '1px',
            cornerRadius: 'md',
            paddingAll: 'sm',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '💳 บัญชีสำหรับโอนเงิน:',
                weight: 'bold',
                size: 'xs',
                color: '#b5812d',
              },
              {
                type: 'text',
                text: bankInfoLines.join('\n'),
                wrap: true,
                size: 'xs',
                color: '#333333',
              },
              ...(qrImageElement ? [
                qrImageElement,
                {
                  type: 'text',
                  text: `🔒 QR พร้อมเพย์ ล็อกยอดเงิน ฿${totalAmount.toLocaleString()} พอดีเป๊ะ`,
                  weight: 'bold',
                  size: 'xxs',
                  color: '#2e7d32',
                  align: 'center',
                  margin: 'xs',
                },
                {
                  type: 'button',
                  action: {
                    type: 'uri',
                    label: `📥 บันทึกรูป QR Code (฿${totalAmount.toLocaleString()})`,
                    uri: finalQrUrl,
                  },
                  style: 'primary',
                  color: '#1b5e20',
                  height: 'sm',
                  margin: 'sm',
                },
                {
                  type: 'text',
                  text: '💡 แตะปุ่มด้านบนเพื่อบันทึกรูป แล้วเปิดสแกนจากแอปธนาคาร',
                  size: 'xxs',
                  color: '#888888',
                  wrap: true,
                  align: 'center',
                  margin: 'xs',
                },
              ] : []),
              {
                type: 'text',
                text: '📸 โอนแล้วส่งรูปสลิปเข้ามาในแชทนี้ได้เลยครับ!',
                weight: 'bold',
                size: 'xs',
                color: '#d32f2f',
                margin: 'sm',
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
          ...(finalQrUrl ? [
            {
              type: 'button',
              action: {
                type: 'uri',
                label: `📥 บันทึกรูป QR Code (฿${totalAmount.toLocaleString()})`,
                uri: finalQrUrl,
              },
              style: 'primary',
              color: '#173f2a',
              height: 'sm',
            },
          ] : []),
          {
            type: 'button',
            action: {
              type: 'message',
              label: '❌ ยกเลิกออเดอร์นี้',
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
      messages: [flexInvoice],
    });
  } catch (err) {
    console.error('Failed to reply invoice card:', err.message);
  }
}

// 6. Flex Message: ยืนยันการรับสลิปโอนเงินสำเร็จ
export async function replySlipConfirmed(replyToken, orderCode) {
  const flexSuccess = {
    type: 'flex',
    altText: `ได้รับสลิปออเดอร์ ${orderCode} เรียบร้อยแล้ว`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#2e7d32',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: '✅ ชำระเงินเรียบร้อยแล้ว!',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
          },
          {
            type: 'text',
            text: `ออเดอร์: ${orderCode}`,
            size: 'xs',
            color: '#e8f5e9',
            margin: 'xs',
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
            text: 'ทางฟาร์ม FarmGAP ได้รับหลักฐานการโอนเงินเรียบร้อยแล้วครับ 🥦',
            wrap: true,
            size: 'sm',
            color: '#2e7d32',
            weight: 'bold',
          },
          {
            type: 'text',
            text: 'ขณะนี้แปลงปลูกกำลังเตรียมเก็บเกี่ยวผลผลิตสดใหม่ตามมาตรฐาน GAP และแพ็คจัดส่งให้คุณอย่างพิถีพิถันครับ',
            wrap: true,
            size: 'xs',
            color: '#555555',
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
              label: '📦 เช็คสถานะออเดอร์',
              text: 'เช็คสถานะ',
            },
            style: 'primary',
            color: '#2e7d32',
            height: 'sm',
          },
        ],
      },
    },
  };

  try {
    await client.replyMessage({
      replyToken: replyToken,
      messages: [flexSuccess],
    });
  } catch (err) {
    console.error('Failed to reply slip confirmed:', err.message);
  }
}
