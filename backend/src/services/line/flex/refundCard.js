import { client } from '../config.js';
import { getOwnerContactInfo } from '../ai/farmContext.js';

// Flex Message: แสดงข้อมูลและเบอร์โทรติดต่อเจ้าของฟาร์มโดยตรง
export async function replyOwnerContact(replyToken) {
  const owner = await getOwnerContactInfo();
  const flexCard = {
    type: 'flex',
    altText: `📞 ติดต่อเจ้าของฟาร์ม: ${owner.phone}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#15803d',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: '📞 ช่องทางติดต่อเจ้าของฟาร์ม',
            weight: 'bold',
            size: 'md',
            color: '#ffffff',
          },
          {
            type: 'text',
            text: owner.farmName,
            size: 'xs',
            color: '#bbf7d0',
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
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f0fdf4',
            cornerRadius: 'md',
            paddingAll: 'md',
            borderWidth: '1px',
            borderColor: '#bbf7d0',
            contents: [
              {
                type: 'text',
                text: '👤 ผู้ดูแล / เจ้าของฟาร์ม:',
                size: 'xs',
                color: '#166534',
                weight: 'bold',
              },
              {
                type: 'text',
                text: `คุณ ${owner.displayName}`,
                size: 'sm',
                weight: 'bold',
                color: '#1f2937',
                margin: 'xs',
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'text',
                text: '📱 เบอร์โทรศัพท์ติดต่อโดยตรง:',
                size: 'xs',
                color: '#166534',
                weight: 'bold',
                margin: 'md',
              },
              {
                type: 'text',
                text: owner.phone,
                size: 'xl',
                weight: 'bold',
                color: '#15803d',
                margin: 'xs',
              },
            ],
          },
          {
            type: 'text',
            text: '💡 คุณลูกค้าสามารถแตะปุ่มโทรออกด้านล่างเพื่อคุยกับเจ้าของฟาร์มได้ทันที หรือพิมพ์ข้อความฝากเรื่องไว้ในแชทนี้ แอดมินจะรีบเข้ามาดูแลให้ครับ 🌱',
            size: 'xs',
            color: '#64748b',
            wrap: true,
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
            style: 'primary',
            color: '#15803d',
            height: 'sm',
            action: {
              type: 'uri',
              label: `📞 โทร ${owner.phone}`,
              uri: `tel:${owner.rawPhone}`,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: '🥬 ดูเมนูผักสด',
              text: 'เมนูผัก',
            },
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
    console.error('Failed to reply owner contact:', err.message);
  }
}

// Flex Message: แนะนำขั้นตอนการขอเงินคืนสำหรับลูกค้าที่โอนเงินแล้วต้องการยกเลิก
export async function replyRefundInstructions(replyToken) {
  const owner = await getOwnerContactInfo();
  const flexCard = {
    type: 'flex',
    altText: '💸 ขั้นตอนการขอรับเงินคืนจากฟาร์ม',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0284c7',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: '💸 ขั้นตอนการขอรับเงินคืน (Refund)',
            weight: 'bold',
            size: 'md',
            color: '#ffffff',
          },
          {
            type: 'text',
            text: `ฟาร์ม ${owner.farmName}`,
            size: 'xs',
            color: '#e0f2fe',
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
            text: 'สำหรับออเดอร์ที่โอนเงินเรียบร้อยแล้วและต้องการขอยกเลิก ทางฟาร์มยินดีโอนเงินคืนให้ตามยอดจริงครับ โดยมีขั้นตอนง่ายๆ ดังนี้:',
            size: 'xs',
            color: '#334155',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f8fafc',
            cornerRadius: 'md',
            paddingAll: 'md',
            spacing: 'sm',
            borderWidth: '1px',
            borderColor: '#e2e8f0',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '1️⃣', size: 'xs', flex: 1 },
                  { type: 'text', text: 'ส่งรูปภาพสลิปที่โอนเงินเข้ามาในแชทนี้', size: 'xs', color: '#1e293b', wrap: true, flex: 9 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '2️⃣', size: 'xs', flex: 1 },
                  { type: 'text', text: 'พิมพ์แจ้งเลขบัญชีธนาคาร หรือเบอร์พร้อมเพย์ และชื่อบัญชีสำหรับรับเงินคืน', size: 'xs', color: '#1e293b', wrap: true, flex: 9 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '3️⃣', size: 'xs', flex: 1 },
                  { type: 'text', text: 'เจ้าของฟาร์มจะตรวจสอบและทำการโอนเงินคืนให้โดยเร็วที่สุดครับ', size: 'xs', color: '#1e293b', wrap: true, flex: 9 },
                ],
              },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f0fdf4',
            cornerRadius: 'md',
            paddingAll: 'sm',
            contents: [
              {
                type: 'text',
                text: `📞 ติดต่อเจ้าของฟาร์มโดยตรง: ${owner.phone} (คุณ${owner.displayName})`,
                size: 'xs',
                color: '#166534',
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
            style: 'primary',
            color: '#0284c7',
            height: 'sm',
            action: {
              type: 'uri',
              label: `📞 โทรแจ้งเจ้าของฟาร์ม (${owner.phone})`,
              uri: `tel:${owner.rawPhone}`,
            },
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
    console.error('Failed to reply refund instructions:', err.message);
  }
}
