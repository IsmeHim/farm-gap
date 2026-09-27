import { client } from '../config.js';

// Flex Message: ต้อนรับผู้ใช้งานใหม่ (Welcome Card)
export async function replyWelcome(replyToken) {
  const flexWelcome = {
    type: 'flex',
    altText: 'ยินดีต้อนรับสู่ FarmGAP AI',
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '🌱 FarmGAP AI',
            wrap: true,
            weight: 'bold',
            size: 'xl',
            color: '#2e7d32',
          },
          {
            type: 'text',
            text: 'ยินดีต้อนรับสู่ฟาร์มผักสดปลอดสารพิษมาตรฐาน GAP สั่งผักสดจากแปลงส่งตรงถึงบ้าน สามารถพิมพ์สั่งซื้อในแชทนี้ได้เลยครับ!',
            wrap: true,
            size: 'sm',
            color: '#555555',
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
              label: '🥗 สั่งผักสดวันนี้',
              text: 'เมนูผัก',
            },
            style: 'primary',
            color: '#2e7d32',
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📦 เช็คสถานะออเดอร์',
              text: 'เช็คสถานะ',
            },
            style: 'secondary',
          },
        ],
      },
    },
  };

  try {
    await client.replyMessage({
      replyToken: replyToken,
      messages: [flexWelcome],
    });
  } catch (err) {
    console.error('Failed to reply welcome message:', err.message);
  }
}
