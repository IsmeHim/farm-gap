import { client } from '../config.js';

// Flex Message: ส่งลิงก์เปิดหน้าร้านเว็บ/LIFF ให้ลูกค้าที่สนใจสั่งทางเว็บ
export async function replyWebStoreLink(replyToken) {
  const liffUrl = process.env.LIFF_ORDER_URL || 'https://liff.line.me/2011230817-FlfQg9Yb';

  const flexCard = {
    type: 'flex',
    altText: '🛒 ลิงก์หน้าร้านสั่งซื้อผัก FarmGAP',
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#173f2a',
        paddingAll: 'md',
        contents: [
          {
            type: 'text',
            text: '🛒 หน้าร้านสั่งซื้อผักสด FarmGAP',
            weight: 'bold',
            color: '#f4d27a',
            size: 'sm',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'md',
        contents: [
          {
            type: 'text',
            text: 'คุณลูกค้าสามารถแตะปุ่มด้านล่างเพื่อเปิดหน้าร้าน เลือกดูผักสด และสั่งซื้อผ่านหน้าเว็บได้เลยครับ 🌱',
            wrap: true,
            size: 'xs',
            color: '#374151',
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
                text: '💡 หรือจะพิมพ์สั่งในแชทนี้ได้ง่ายๆ เลยครับ เช่น "สั่งกรีนโอ๊ค 2 ถุง"',
                size: 'xxs',
                color: '#15803d',
                wrap: true,
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        paddingAll: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '🛒 เปิดหน้าร้านสั่งซื้อผัก',
              uri: liffUrl,
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
      messages: [flexCard],
    });
  } catch (err) {
    console.error('Failed to reply web store link:', err.message);
  }
}
