import { client } from '../config.js';

// Flex Message: ถามลูกค้าเพื่อเลือกช่องทางการชำระเงิน (โอนเงิน หรือ เก็บเงินปลายทาง COD)
export async function replyPaymentMethodSelection(replyToken, draftData) {
  const itemsText = (draftData.items || [])
    .map(it => `• ${it.name} x${it.quantity} ${it.unit || 'กก.'} (฿${(it.subtotal || 0).toLocaleString()})`)
    .join('\n');
  const totalAmount = (draftData.totalAmount || draftData.total_amount || 0).toLocaleString();
  const customerName = draftData.contact_name || draftData.customer_name || 'คุณลูกค้า';
  const customerPhone = draftData.contact_phone || draftData.phone || '-';
  const customerAddress = draftData.contact_address || draftData.address || '-';

  const flexCard = {
    type: 'flex',
    altText: 'เลือกช่องทางการชำระเงิน FarmGAP',
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
            text: '💰 เลือกช่องทางการชำระเงิน',
            weight: 'bold',
            color: '#f4d27a',
            size: 'md',
          },
          {
            type: 'text',
            text: 'กรุณาเลือกรูปแบบที่สะดวกชำระเงินครับ',
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
          // กล่องสรุปรายการสินค้าและยอดเงิน
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f8fafc',
            borderColor: '#e2e8f0',
            borderWidth: '1px',
            cornerRadius: 'md',
            paddingAll: 'md',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '🥬 สรุปรายการสั่งซื้อ:',
                size: 'xs',
                weight: 'bold',
                color: '#334155',
              },
              {
                type: 'text',
                text: itemsText,
                size: 'xs',
                color: '#475569',
                wrap: true,
              },
              {
                type: 'separator',
                margin: 'sm',
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'ยอดรวมทั้งสิ้น:',
                    size: 'sm',
                    weight: 'bold',
                    color: '#1e293b',
                    flex: 5,
                  },
                  {
                    type: 'text',
                    text: `฿${totalAmount} บาท`,
                    size: 'md',
                    weight: 'bold',
                    color: '#16a34a',
                    align: 'end',
                    flex: 7,
                  },
                ],
              },
            ],
          },
          // กล่องข้อมูลจัดส่ง
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f1f8f3',
            cornerRadius: 'md',
            paddingAll: 'sm',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: `📦 ส่งถึง: ${customerName} (${customerPhone})`,
                size: 'xs',
                color: '#166534',
                weight: 'bold',
              },
              {
                type: 'text',
                text: `📍 ที่อยู่: ${customerAddress}`,
                size: 'xxs',
                color: '#4b5563',
                wrap: true,
              },
            ],
          },
          // ข้อความถาม
          {
            type: 'text',
            text: '👇 กรุณากดเลือกช่องทางการชำระเงินด้านล่าง:',
            size: 'xs',
            weight: 'bold',
            color: '#1f2937',
            margin: 'xs',
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
              label: '💳 โอนเงิน / สแกน QR Code',
              text: 'โอนเงิน',
            },
            style: 'primary',
            color: '#2563eb',
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '💵 เก็บเงินปลายทาง (COD)',
              text: 'เก็บเงินปลายทาง',
            },
            style: 'primary',
            color: '#059669',
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
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: '💳 โอนเงิน / QR',
            text: 'โอนเงิน',
          },
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '💵 เก็บเงินปลายทาง',
            text: 'เก็บเงินปลายทาง',
          },
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '❌ ยกเลิก',
            text: 'ยกเลิก',
          },
        },
      ],
    },
  };

  try {
    await client.replyMessage({
      replyToken: replyToken,
      messages: [flexCard],
    });
  } catch (err) {
    console.error('Failed to reply payment method selection:', err.message);
  }
}
