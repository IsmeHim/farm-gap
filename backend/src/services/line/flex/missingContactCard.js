import { client } from '../config.js';

// Flex Message: แจ้งเตือนเมื่อข้อมูลจัดส่งยังไม่ครบถ้วน (Missing Contact Info)
export async function replyMissingContactInfo(replyToken, currentData, missingList) {
  const receivedBoxes = [];

  if (currentData.address) {
    receivedBoxes.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: [
        { type: 'text', text: '🏠 ที่อยู่:', size: 'xs', color: '#166534', weight: 'bold', flex: 3 },
        { type: 'text', text: currentData.address, size: 'xs', color: '#1f2937', wrap: true, flex: 7 },
      ],
    });
  }

  if (currentData.phone) {
    receivedBoxes.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: [
        { type: 'text', text: '📱 เบอร์โทร:', size: 'xs', color: '#166534', weight: 'bold', flex: 3 },
        { type: 'text', text: currentData.phone, size: 'xs', color: '#1f2937', flex: 7 },
      ],
    });
  }

  if (currentData.name) {
    receivedBoxes.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: [
        { type: 'text', text: '👤 ชื่อผู้รับ:', size: 'xs', color: '#166534', weight: 'bold', flex: 3 },
        { type: 'text', text: currentData.name, size: 'xs', color: '#1f2937', flex: 7 },
      ],
    });
  }

  const missingBoxes = missingList.map(item => ({
    type: 'text',
    text: `• ${item}`,
    size: 'xs',
    weight: 'bold',
    color: '#b91c1c',
    wrap: true,
  }));

  const bodyContents = [];

  // หัวข้อแจ้งเตือน
  bodyContents.push({
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    contents: [
      {
        type: 'text',
        text: '⚠️ ข้อมูลจัดส่งยังไม่ครบถ้วนครับ',
        weight: 'bold',
        size: 'md',
        color: '#b45309',
      },
      {
        type: 'text',
        text: 'ระบบบันทึกข้อมูลเบื้องต้นไว้แล้ว รบกวนพิมพ์ข้อมูลที่ยังขาดเพื่อเปิดออเดอร์ครับ',
        size: 'xs',
        color: '#6b7280',
        wrap: true,
      },
    ],
  });

  // แสดงกล่องสิ่งที่ได้รับแล้ว (ถ้ามี)
  if (receivedBoxes.length > 0) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#f0fdf4',
      borderWidth: '1px',
      borderColor: '#bbf7d0',
      cornerRadius: 'md',
      paddingAll: 'md',
      spacing: 'xs',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: '✅ ข้อมูลที่ได้รับแล้ว:',
          weight: 'bold',
          size: 'xs',
          color: '#15803d',
        },
        ...receivedBoxes,
      ],
    });
  }

  // แสดงกล่องสิ่งที่ยังขาด
  bodyContents.push({
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#fef2f2',
    borderWidth: '1px',
    borderColor: '#fecaca',
    cornerRadius: 'md',
    paddingAll: 'md',
    spacing: 'xs',
    margin: 'md',
    contents: [
      {
        type: 'text',
        text: '❗ ข้อมูลที่ต้องการเพิ่มเติม:',
        weight: 'bold',
        size: 'xs',
        color: '#b91c1c',
      },
      ...missingBoxes,
    ],
  });

  // คำแนะนำวิธีพิมพ์
  bodyContents.push({
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: '1px',
    cornerRadius: 'md',
    paddingAll: 'md',
    margin: 'md',
    contents: [
      {
        type: 'text',
        text: '👉 พิมพ์ส่งเข้ามาในแชทนี้ได้เลยครับ เช่น:',
        size: 'xs',
        color: '#92400e',
        weight: 'bold',
      },
      {
        type: 'text',
        text: '0812345678 คุณสมชาย',
        size: 'xs',
        color: '#1e3a8a',
        weight: 'bold',
        margin: 'xs',
      },
    ],
  });

  const flexCard = {
    type: 'flex',
    altText: 'กรุณาแจ้งข้อมูลจัดส่งเพิ่มเติม',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: bodyContents,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'message',
              label: '❌ ยกเลิกการสั่งซื้อนี้',
              text: 'ยกเลิก',
            },
            style: 'secondary',
            height: 'sm',
          },
        ],
      },
    },
  };

  await client.replyMessage({
    replyToken: replyToken,
    messages: [flexCard],
  });
}
