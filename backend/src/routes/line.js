import { Router } from 'express';
import { messagingApi } from '@line/bot-sdk';
import crypto from 'crypto';
import { pool } from '../db.js';

const { MessagingApiClient } = messagingApi;
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy_token',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'dummy_secret',
};

// Create LINE Messaging API Client
const client = new MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});
export const lineRouter = Router();

// Middleware to verify signature using req.rawBody
function signatureVerifier(req, res, next) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const signature = req.headers['x-line-signature'];

  if (!channelSecret || channelSecret === 'dummy_secret') {
    console.warn('⚠️ LINE_CHANNEL_SECRET is dummy or missing. Skipping signature verification.');
    return next();
  }

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(rawBody)
    .digest('base64');

  if (hash !== signature) {
    console.warn('❌ Invalid LINE Webhook Signature.');
    return res.status(401).send('Invalid signature');
  }
  next();
}

// 1. ฟังก์ชันส่งข้อมูลสอบถามปัญญาประดิษฐ์ Gemini API
async function askGemini(prompt, systemInstruction) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === 'dummy_key') {
    console.warn('⚠️ GEMINI_API_KEY is not configured. Falling back to Mock AI responses.');
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('ปลูก') || lowerPrompt.includes('ทำสวน') || lowerPrompt.includes('ดูแล')) {
      return '🌱 ผักสลัดในฟาร์ม FarmGAP (เช่น กรีนโอ๊ค เรดโอ๊ค คอส) ปลูกโดยใช้ระบบเกษตรอินทรีย์ ปลอดภัย ได้รับใบรับรองมาตรฐาน GAP ในทุกล็อต มีการสุ่มตรวจวิเคราะห์คุณภาพน้ำรดดินสม่ำเสมอ ใช้เวลาประมาณ 40-45 วันในการเก็บเกี่ยวครับ';
    }
    if (lowerPrompt.includes('ราคา') || lowerPrompt.includes('เท่าไหร่') || lowerPrompt.includes('บาท')) {
      return '💵 ผักสลัดสดจากแปลงของเราจำหน่ายราคาเริ่มต้น 30-50 บาทต่อถุง/กิโลกรัมครับ ท่านสามารถตรวจสอบราคาและสต็อกล่าสุดแบบเรียลไทม์ได้ง่ายๆ โดยพิมพ์ส่งคำว่า "สั่งซื้อ" เพื่อเปิดระบบช้อปปิ้งได้เลยครับ';
    }
    if (lowerPrompt.includes('สต็อก') || lowerPrompt.includes('เหลือ') || lowerPrompt.includes('มีผัก')) {
      return '🥬 วันนี้ฟาร์มเรามีกรีนโอ๊ค คอส และเรดโอ๊ค สดจากแปลงพร้อมจัดส่งครับ! ท่านสามารถเปิดดูปริมาณสต็อกสดๆ และกดช้อปปิ้งได้โดยส่งคำว่า "สั่งซื้อ" หรือพิมพ์ "เมนูผัก" เพื่อให้บอทส่งลิงก์ช้อปปิ้งออนไลน์ให้ได้ครับ';
    }
    
    return 'สวัสดีครับ! ยินดีต้อนรับสู่ฟาร์มผักมาตรฐาน GAP ปลอดภัย (ขณะนี้ทำงานในโหมดจำลอง AI Mock) หากต้องการสั่งซื้อสามารถพิมพ์คำว่า "สั่งซื้อ" หรือสอบถามเกี่ยวกับการดูแลผัก สต็อก และราคาสินค้าได้ครับ!';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      throw new Error(`Gemini API error code: ${res.status}`);
    }
    
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'ขออภัยครับ ผมมีข้อขัดข้องในการเรียบเรียงคำตอบ';
  } catch (err) {
    console.error('Failed to query Gemini API:', err.message);
    return 'ขออภัยครับ ระบบปัญญาประดิษฐ์ประมวลผลคำตอบขัดข้องชั่วคราว คุณสามารถเลือกสั่งซื้อผักได้โดยส่งคำว่า "สั่งซื้อ" ครับ';
  }
}

// 2. ดึงข้อมูลผักพร้อมขายและแปลงปลูก เพื่อนำมาสร้างเป็น Context ใน AI Chatbot
async function getFarmContext() {
  try {
    const [products] = await pool.query(
      'SELECT name, price, unit, stock_quantity FROM products WHERE status = "available" AND stock_quantity > 0'
    );
    const [plots] = await pool.query(
      'SELECT name, crop_name, field_safety_status, status FROM plots WHERE status = "active"'
    );
    
    let context = 'คุณคือบอทผู้ช่วยตอบคำถามลูกค้าของฟาร์มผักสดอัจฉริยะ FarmGAP AI ที่เพาะปลูกตามมาตรฐาน GAP และผสานระบบ E-Commerce\n';
    context += '\n[ข้อมูลสต็อกสินค้าพร้อมขายวันนี้แบบเรียลไทม์]:\n';
    if (products.length > 0) {
      products.forEach(p => {
        context += `- ผัก: ${p.name}, ราคา: ${p.price} บาทต่อ ${p.unit}, สต็อกคงเหลือในห้องแช่แข็ง: ${p.stock_quantity} ${p.unit}\n`;
      });
    } else {
      context += '- ขณะนี้สินค้าหมดชั่วคราว อยู่ระหว่างเตรียมแปลงเก็บเกี่ยวล็อตถัดไป\n';
    }
    
    context += '\n[ข้อมูลแปลงเพาะปลูกและสถานะความปลอดภัย GAP ปัจจุบัน]:\n';
    if (plots.length > 0) {
      plots.forEach(pl => {
        context += `- แปลง: ${pl.name}, พืชในแปลง: ${pl.crop_name}, สถานะตรวจแปลง GAP: ${pl.field_safety_status}\n`;
      });
    } else {
      context += '- กำลังเตรียมดินและบำรุงแปลงปลูกใหม่\n';
    }
    
    context += '\n[กฎในการตอบคำถามลูกค้า]:\n';
    context += '1. ตอบคำถามภาษาไทยอย่างสุภาพ มีหางเสียง "ครับ/ค่ะ" และให้ข้อมูลสั้นกระชับเข้าใจง่าย ไม่เยิ่นเย้อ\n';
    context += '2. อ้างอิงสต็อกผักสดและสถานะแปลงเพาะปลูกข้างต้นในการตอบให้สอดคล้องกันอย่างถูกต้อง\n';
    context += '3. หากลูกค้าต้องการสั่งซื้อหรือดูสินค้าชิ้นอื่น ให้แนะนำลูกค้าให้ส่งข้อความคำว่า "สั่งซื้อ" หรือ "เมนูผัก" เพื่อเรียก Flex Message ช้อปปิ้งออนไลน์\n';
    context += '4. หากลูกค้าถามเรื่องสถานะพัสดุหรือออเดอร์ ให้แนะนำพิมพ์คำว่า "เช็คสถานะ" เพื่อตรวจประวัติล่าสุด';
    
    return context;
  } catch (err) {
    console.error('Failed to build context:', err.message);
    return 'คุณคือผู้ช่วยแชทบอทของฟาร์มผัก FarmGAP AI มาตรฐาน GAP โปรดตอบกลับสั้นๆ อย่างมีไมตรีจิต';
  }
}

// Reply welcome message with Flex design
async function replyWelcome(replyToken) {
  const flexWelcome = {
    type: 'flex',
    altText: 'ยินดีต้อนรับสู่ FarmGAP AI',
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?q=80&w=600&auto=format&fit=crop',
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
            text: 'ยินดีต้อนรับสู่ฟาร์มผักสดปลอดสารพิษมาตรฐาน GAP บริการสั่งผักสดจากแปลง ส่งตรงถึงมือคุณ พร้อม AI แนะนำและดูแลส่วนตัว',
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
              type: 'uri',
              label: '🛒 สั่งซื้อผักสดประจำวัน',
              uri: process.env.LIFF_ORDER_URL || 'https://liff.line.me/dummy-liff-order-id',
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

// Reply veg menu / order link
async function replyVegMenu(replyToken, userId) {
  const [products] = await pool.query(
    'SELECT name, price, unit, stock_quantity FROM products WHERE status = "available" AND stock_quantity > 0 LIMIT 5'
  );

  const productListText = products.length > 0
    ? products.map(p => `• ${p.name} - ${p.price} บาท/${p.unit} (คงเหลือ ${p.stock_quantity})`).join('\n')
    : 'ขณะนี้ไม่มีผักพร้อมเก็บเกี่ยว';

  const flexMenu = {
    type: 'flex',
    altText: 'รายการผักสดแนะนำ',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '🥗 เมนูผักสดวันนี้',
            weight: 'bold',
            size: 'lg',
            color: '#2e7d32',
          },
          {
            type: 'text',
            text: productListText,
            wrap: true,
            size: 'sm',
            color: '#333333',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '🛍️ เข้าหน้าสั่งซื้อผักทั้งหมด',
              uri: process.env.LIFF_ORDER_URL || 'https://liff.line.me/dummy-liff-order-id',
            },
            style: 'primary',
            color: '#2e7d32',
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

// Reply order status
async function replyOrderStatus(replyToken, userId) {
  const [customers] = await pool.query('SELECT id FROM customers WHERE line_user_id = ?', [userId]);
  
  if (customers.length === 0) {
    return client.replyMessage({
      replyToken: replyToken,
      messages: [{ type: 'text', text: 'ไม่พบประวัติการสั่งซื้อของคุณในระบบ สามารถเริ่มสั่งซื้อครั้งแรกผ่านเมนูด้านล่างได้เลยครับ' }]
    });
  }

  const [orders] = await pool.query(
    'SELECT order_code, total_amount, status, created_at FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 3',
    [customers[0].id]
  );

  if (orders.length === 0) {
    return client.replyMessage({
      replyToken: replyToken,
      messages: [{ type: 'text', text: 'คุณยังไม่มีรายการสั่งซื้อใดๆ ในระบบขณะนี้ครับ' }]
    });
  }

  const orderText = orders.map(o => {
    const statusMap = {
      pending: 'รอตรวจสอบ/รอแนบสลิป',
      paid: 'ชำระเงินแล้ว',
      shipping: 'กำลังจัดส่ง',
      completed: 'จัดส่งสำเร็จ',
      cancelled: 'ยกเลิกออเดอร์',
    };
    const localDate = new Date(o.created_at).toLocaleDateString('th-TH');
    return `📦 เลขที่: ${o.order_code}\nวันที่: ${localDate}\nยอดรวม: ${o.total_amount} บาท\nสถานะ: ${statusMap[o.status] || o.status}\n---`;
  }).join('\n');

  const flexStatus = {
    type: 'flex',
    altText: 'สถานะการสั่งซื้อล่าสุด',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '📋 Status ออเดอร์ของคุณ',
            weight: 'bold',
            size: 'lg',
            color: '#0d47a1',
          },
          {
            type: 'text',
            text: orderText,
            wrap: true,
            size: 'sm',
            color: '#333333',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '🔍 ดูประวัติทั้งหมด',
              uri: process.env.LIFF_HISTORY_URL || 'https://liff.line.me/dummy-liff-history-id',
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
      messages: [flexStatus],
    });
  } catch (err) {
    console.error('Failed to reply order status:', err.message);
  }
}

// Default static response template (Fallback)
async function replyDefault(replyToken) {
  const menuButtons = {
    type: 'flex',
    altText: 'คุยกับ FarmGAP AI',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: '🌾 เมนูช่วยเหลือ FarmGAP',
            weight: 'bold',
            size: 'md',
            color: '#2e7d32',
          },
          {
            type: 'text',
            text: 'ยินดีต้อนรับครับ คุณสามารถเลือกสั่งซื้อผักสดประจำวันหรือเช็คสถานะพัสดุผ่านปุ่มด้านล่างนี้ได้เลยครับ',
            wrap: true,
            size: 'xs',
            color: '#666666',
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
              label: '🥗 สั่งผักสดวันนี้',
              text: 'สั่งซื้อ',
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
      messages: [menuButtons],
    });
  } catch (err) {
    console.error('Failed to reply default menu:', err.message);
  }
}

// Event parser
async function handleEvent(event) {
  if (event.type === 'follow') {
    const userId = event.source.userId;
    let displayName = 'ลูกค้า LINE';
    let pictureUrl = null;

    try {
      if (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_ACCESS_TOKEN !== 'dummy_token') {
        const profile = await client.getProfile(userId);
        displayName = profile.displayName;
        pictureUrl = profile.pictureUrl;
      }
    } catch (e) {
      console.warn('Failed to fetch LINE profile, fallback to default:', e.message);
    }

    // Sync Customer
    const [existing] = await pool.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO customers (line_user_id, display_name, picture_url) VALUES (?, ?, ?)',
        [userId, displayName, pictureUrl]
      );
      console.log(`Synced new LINE customer: ${displayName} (${userId})`);
    } else {
      await pool.query(
        'UPDATE customers SET display_name = ?, picture_url = ? WHERE line_user_id = ?',
        [displayName, pictureUrl, userId]
      );
      console.log(`Updated LINE customer profile: ${displayName}`);
    }

    await replyWelcome(event.replyToken);
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    // ซิงก์โปรไฟล์ในตัวกรณีที่ยังไม่เคยมี
    try {
      const [existing] = await pool.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
      if (existing.length === 0) {
        let displayName = 'ลูกค้า LINE';
        let pictureUrl = null;
        try {
          if (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_ACCESS_TOKEN !== 'dummy_token') {
            const profile = await client.getProfile(userId);
            displayName = profile.displayName;
            pictureUrl = profile.pictureUrl;
          }
        } catch (_) {}
        await pool.query(
          'INSERT INTO customers (line_user_id, display_name, picture_url) VALUES (?, ?, ?)',
          [userId, displayName, pictureUrl]
        );
      }
    } catch (err) {
      console.error('Customer autosync failed:', err.message);
    }

    if (text === 'เมนูผัก' || text === 'สั่งซื้อ') {
      await replyVegMenu(replyToken, userId);
    } else if (text === 'เช็คสถานะ' || text === 'ออเดอร์') {
      await replyOrderStatus(replyToken, userId);
    } else {
      // 💬 คุยกับ Gemini AI Chatbot ภาษาธรรมชาติดึง Context แปลง/สต็อกผักสด
      try {
        const systemInstruction = await getFarmContext();
        const responseText = await askGemini(text, systemInstruction);
        await client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: 'text', text: responseText }]
        });
      } catch (err) {
        console.error('Error forwarding message to Gemini API:', err.message);
        await replyDefault(replyToken);
      }
    }
  }
}

// Router Webhook listener
lineRouter.post('/webhook', signatureVerifier, async (req, res) => {
  const events = req.body.events;
  if (!events || !Array.isArray(events)) {
    return res.status(200).send('OK');
  }

  try {
    await Promise.all(events.map(handleEvent));
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error in LINE webhook controller:', error);
    res.status(500).send('Webhook error');
  }
});
