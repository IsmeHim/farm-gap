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

// Auto-initialize line_chat_sessions table
async function initSessionTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS line_chat_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        line_user_id VARCHAR(255) UNIQUE NOT NULL,
        state VARCHAR(50) NOT NULL DEFAULT 'IDLE',
        order_id INT NULL,
        draft_data JSON NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Failed to init line_chat_sessions table:', err.message);
  }
}
initSessionTable();

// Session Management Helpers
async function getChatSession(lineUserId) {
  try {
    const [rows] = await pool.query('SELECT * FROM line_chat_sessions WHERE line_user_id = ?', [lineUserId]);
    if (rows.length > 0) {
      let draft = rows[0].draft_data;
      if (typeof draft === 'string') {
        try { draft = JSON.parse(draft); } catch (_) {}
      }
      return { ...rows[0], draft_data: draft };
    }
    return { state: 'IDLE', order_id: null, draft_data: null };
  } catch (err) {
    console.error('getChatSession error:', err.message);
    return { state: 'IDLE', order_id: null, draft_data: null };
  }
}

async function setChatSession(lineUserId, state, orderId = null, draftData = null) {
  try {
    const draftJson = draftData ? JSON.stringify(draftData) : null;
    await pool.query(
      `INSERT INTO line_chat_sessions (line_user_id, state, order_id, draft_data)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE state = VALUES(state), order_id = VALUES(order_id), draft_data = VALUES(draft_data)`,
      [lineUserId, state, orderId, draftJson]
    );
  } catch (err) {
    console.error('setChatSession error:', err.message);
  }
}

async function clearChatSession(lineUserId) {
  try {
    await pool.query(
      'UPDATE line_chat_sessions SET state = "IDLE", order_id = NULL, draft_data = NULL WHERE line_user_id = ?',
      [lineUserId]
    );
  } catch (err) {
    console.error('clearChatSession error:', err.message);
  }
}

// Generate Unique Order Code
function generateOrderCode() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${randomNum}`;
}

// Middleware to verify signature using req.rawBody
function signatureVerifier(req, res, next) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const signature = req.headers['x-line-signature'];

  if (!channelSecret || channelSecret === 'dummy_secret') {
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
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('ปลูก') || lowerPrompt.includes('ทำสวน') || lowerPrompt.includes('ดูแล')) {
      return '🌱 ผักสลัดในฟาร์ม FarmGAP (เช่น กรีนโอ๊ค เรดโอ๊ค คอส) ปลูกโดยใช้ระบบเกษตรอินทรีย์ ปลอดภัย ได้รับใบรับรองมาตรฐาน GAP ในทุกล็อต มีการสุ่มตรวจวิเคราะห์คุณภาพน้ำรดดินสม่ำเสมอ ใช้เวลาประมาณ 40-45 วันในการเก็บเกี่ยวครับ';
    }
    if (lowerPrompt.includes('ราคา') || lowerPrompt.includes('เท่าไหร่') || lowerPrompt.includes('บาท')) {
      return '💵 ผักสลัดสดจากแปลงของเราจำหน่ายราคาเริ่มต้น 30-50 บาทต่อถุง/กิโลกรัมครับ สามารถพิมพ์ระบุสั่งซื้อได้เลย เช่น "สั่งกรีนโอ๊ค 2 แพ็ค" หรือพิมพ์ "เมนูผัก" เพื่อดูรายการพร้อมราคาครับ';
    }
    if (lowerPrompt.includes('สต็อก') || lowerPrompt.includes('เหลือ') || lowerPrompt.includes('มีผัก') || lowerPrompt.includes('เมนู')) {
      return '🥬 วันนี้ฟาร์มเรามีกรีนโอ๊ค คอส และเรดโอ๊ค สดจากแปลงพร้อมจัดส่งครับ! สามารถพิมพ์สั่งซื้อได้ทันทีในแชทนี้ เช่น "ขอสั่งกรีนโอ๊ค 1 แพ็ค" หรือพิมพ์ "เมนูผัก" เพื่อดูรายการได้เลยครับ';
    }
    
    return 'สวัสดีครับ! ยินดีต้อนรับสู่ฟาร์มผักมาตรฐาน GAP ปลอดภัย คุณสามารถสั่งซื้อผักสดได้ง่ายๆ โดยพิมพ์แจ้งรายการในแชทได้ทันที เช่น "สั่งกรีนโอ๊ค 2 แพ็ค" หรือสอบถามเกี่ยวกับมาตรฐานความปลอดภัยและสต็อกได้เลยครับ!';
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
    return 'ขออภัยครับ ระบบปัญญาประดิษฐ์ประมวลผลคำตอบขัดข้องชั่วคราว คุณสามารถสั่งซื้อผักสดได้โดยพิมพ์เช่น "สั่งกรีนโอ๊ค 2 แพ็ค" หรือพิมพ์ "สั่งซื้อ" ครับ';
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
        context += `- ผัก: ${p.name}, ราคา: ${p.price} บาทต่อ ${p.unit}, สต็อกคงเหลือ: ${p.stock_quantity} ${p.unit}\n`;
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
    context += '1. ตอบคำถามภาษาไทยอย่างสุภาพ มีหางเสียง "ครับ/ค่ะ" สั้นกระชับเข้าใจง่าย\n';
    context += '2. อ้างอิงสต็อกผักสดและสถานะแปลงเพาะปลูกข้างต้นในการตอบให้สอดคล้องกันอย่างถูกต้อง\n';
    context += '3. แจ้งลูกค้าว่าสามารถสั่งซื้อผักสดได้โดยตรงในแชทนี้เลย (เช่น "สั่งกรีนโอ๊ค 2 แพ็ค") หรือพิมพ์ "เมนูผัก" เพื่อดูสินค้าทั้งหมด\n';
    context += '4. หากลูกค้าถามเรื่องสถานะพัสดุหรือออเดอร์ ให้แนะนำพิมพ์คำว่า "เช็คสถานะ" เพื่อตรวจประวัติล่าสุด';
    
    return context;
  } catch (err) {
    console.error('Failed to build context:', err.message);
    return 'คุณคือผู้ช่วยแชทบอทของฟาร์มผัก FarmGAP AI มาตรฐาน GAP โปรดตอบกลับสั้นๆ อย่างมีไมตรีจิต';
  }
}

// 3. วิเคราะห์เจตนาและสกัดคำสั่งซื้อจากข้อความธรรมชาติ (Order Intent & Entity Extraction)
async function extractOrderIntent(text) {
  const buyKeywords = ['สั่ง', 'ซื้อ', 'เอา', 'รับ', 'จอง', 'order', 'ขอ'];
  const hasBuyKeyword = buyKeywords.some(k => text.includes(k));

  const [products] = await pool.query(
    'SELECT id, name, price, unit, stock_quantity FROM products WHERE status = "available"'
  );

  if (products.length === 0) {
    return { isOrder: false };
  }

  const matchedItems = [];
  const lowerText = text.toLowerCase();

  for (const product of products) {
    const cleanProdName = product.name.trim();
    const lowerProd = cleanProdName.toLowerCase();

    const isFrillice = (lowerProd.includes('ฟิล') || lowerProd.includes('ฟิน') || lowerProd.includes('ไอซ์เบิร์ก') || lowerProd.includes('frillice')) &&
      (lowerText.includes('ฟิน') || lowerText.includes('ฟิล') || lowerText.includes('ไอซ์เบิร์ก') || lowerText.includes('frillice'));
    const isGreenOak = (lowerProd.includes('กรีน') || lowerProd.includes('green')) && (lowerText.includes('กรีน') || lowerText.includes('green'));
    const isRedOak = (lowerProd.includes('เรด') || lowerProd.includes('red')) && (lowerText.includes('เรด') || lowerText.includes('red'));
    const isCos = (lowerProd.includes('คอส') || lowerProd.includes('cos')) && (lowerText.includes('คอส') || lowerText.includes('cos'));
    const isButterhead = (lowerProd.includes('บัตเตอร์') || lowerProd.includes('butter')) && (lowerText.includes('บัตเตอร์') || lowerText.includes('butter'));
    const isDirectMatch = lowerText.includes(lowerProd);

    if (isDirectMatch || isFrillice || isGreenOak || isRedOak || isCos || isButterhead) {
      let qty = 1;
      const regexPatterns = [
        new RegExp(`${cleanProdName}[^0-9]{0,8}([0-9]+(?:\\.[0-9]+)?)`, 'i'),
        new RegExp(`([0-9]+(?:\\.[0-9]+)?)[^0-9]{0,8}${cleanProdName}`, 'i'),
        new RegExp(`(กรีน|เรด|คอส|ฟิน|ฟิล|บัตเตอร์)[^0-9]{0,8}([0-9]+(?:\\.[0-9]+)?)`, 'i'),
        new RegExp(`([0-9]+(?:\\.[0-9]+)?)[^0-9]{0,8}(กรีน|เรด|คอส|ฟิน|ฟิล|บัตเตอร์)`, 'i'),
      ];

      for (const rx of regexPatterns) {
        const match = text.match(rx);
        if (match && match[1]) {
          const parsed = parseFloat(match[1]);
          if (!isNaN(parsed) && parsed > 0) {
            qty = parsed;
            break;
          }
        }
      }

      if (qty === 1) {
        const generalDigit = text.match(/\b([1-9][0-9]*)\b/);
        if (generalDigit && generalDigit[1]) {
          qty = parseInt(generalDigit[1], 10);
        }
      }

      matchedItems.push({
        product_id: product.id,
        name: product.name,
        price: Number(product.price),
        unit: product.unit || 'กก.',
        quantity: qty,
        stock_quantity: Number(product.stock_quantity),
        subtotal: Number(product.price) * qty,
      });
    }
  }

  if (matchedItems.length === 0) {
    return { isOrder: false };
  }

  if (!hasBuyKeyword && !text.match(/\d+/)) {
    return { isOrder: false };
  }

  for (const item of matchedItems) {
    if (item.stock_quantity <= 0) {
      return {
        isOrder: true,
        error: `ขออภัยครับ ขณะนี้ผัก "${item.name}" สินค้าหมดชั่วคราวครับ ทางฟาร์มกำลังเตรียมเก็บเกี่ยวแปลงถัดไปครับ 🌱`,
      };
    }
    if (item.stock_quantity < item.quantity) {
      return {
        isOrder: true,
        error: `ขออภัยครับ ผัก "${item.name}" ปัจจุบันมีสต็อกพร้อมส่งเพียง ${item.stock_quantity} ${item.unit} (คุณสั่ง ${item.quantity} ${item.unit}) รบกวนระบุจำนวนใหม่ได้เลยครับ`,
      };
    }
  }

  const totalAmount = matchedItems.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    isOrder: true,
    items: matchedItems,
    totalAmount,
  };
}

// 4. Flex Message: สรุปรายการสั่งซื้อและขอที่อยู่จัดส่ง
async function replyOrderDraftConfirmation(replyToken, items, totalAmount) {
  const itemsText = items.map(it => `• ${it.name} จำนวน ${it.quantity} ${it.unit} (฿${it.subtotal.toLocaleString()})`).join('\n');

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
            backgroundColor: '#f1f8f3',
            cornerRadius: 'md',
            paddingAll: 'md',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '📦 กรุณาพิมพ์แจ้งข้อมูลจัดส่งในแชทนี้:',
                weight: 'bold',
                size: 'xs',
                color: '#1b5e20',
              },
              {
                type: 'text',
                text: '• ชื่อผู้รับ\n• เบอร์โทรศัพท์\n• ที่อยู่จัดส่ง',
                wrap: true,
                size: 'xs',
                color: '#444444',
              },
              {
                type: 'text',
                text: '(เช่น: สมชาย ใจดี 0812345678 123/4 ม.5 ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200)',
                wrap: true,
                size: 'xxs',
                color: '#777777',
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

// 5. Flex Message: ใบแจ้งหนี้และช่องทางโอนเงิน (Invoice & Payment)
async function replyInvoiceAndPayment(replyToken, orderCode, totalAmount, items, addressText) {
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
                text: '• ธนาคารกสิกรไทย (KBANK)\n• เลขที่บัญชี: 098-2-34567-8\n• ชื่อบัญชี: ฟาร์มผัก FarmGAP AI\n• พร้อมเพย์ (PromptPay): 081-234-5678',
                wrap: true,
                size: 'xs',
                color: '#333333',
              },
              {
                type: 'text',
                text: '📸 โอนแล้วส่งรูปสลิปเข้ามาในแชทนี้ได้เลยครับ!',
                weight: 'bold',
                size: 'xs',
                color: '#d32f2f',
                margin: 'xs',
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
async function replySlipConfirmed(replyToken, orderCode) {
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

// 7. ยกเลิกออเดอร์และคืนสต็อก
async function cancelChatOrder(orderId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length > 0 && orders[0].status !== 'cancelled') {
      const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
      for (const item of items) {
        await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity + ?, status = "available" WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
      await connection.query('UPDATE orders SET status = "cancelled" WHERE id = ?', [orderId]);
    }
    await connection.commit();
    return orders[0]?.order_code || 'ORD';
  } catch (err) {
    await connection.rollback();
    console.error('Error cancelling order:', err.message);
    return null;
  } finally {
    connection.release();
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

// Reply veg menu
async function replyVegMenu(replyToken, userId) {
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
                text: '💡 วิธีสั่งซื้อ: พิมพ์สั่งในแชทได้ทันที เช่น "สั่งกรีนโอ๊ค 2 กิโล" หรือคลิกปุ่มสั่งซื้อผ่านหน้าเว็บด้านล่างนี้ได้เลยครับ',
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
              type: 'uri',
              label: '🛒 เปิดหน้าร้านสั่งซื้อผัก (LIFF)',
              uri: process.env.LIFF_ORDER_URL || 'https://liff.line.me/dummy-liff-order-id',
            },
            style: 'primary',
            color: '#173f2a',
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📦 เช็คสถานะออเดอร์ของฉัน',
              text: 'เช็คสถานะ',
            },
            style: 'link',
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
      messages: [{ type: 'text', text: 'ไม่พบประวัติการสั่งซื้อของคุณในระบบ สามารถเริ่มสั่งซื้อครั้งแรกผ่านแชทนี้ได้เลยครับ 🌱' }]
    });
  }

  const [orders] = await pool.query(
    'SELECT order_code, total_amount, status, created_at FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 3',
    [customers[0].id]
  );

  if (orders.length === 0) {
    return client.replyMessage({
      replyToken: replyToken,
      messages: [{ type: 'text', text: 'คุณยังไม่มีรายการสั่งซื้อใดๆ ในระบบขณะนี้ครับ พิมพ์สั่งซื้อได้เลยนะครับ 🌱' }]
    });
  }

  const orderText = orders.map(o => {
    const statusMap = {
      pending: 'รอตรวจสอบ/รอแนบสลิป',
      paid: 'ชำระแล้ว (เตรียมเก็บเกี่ยว/จัดส่ง)',
      shipping: 'กำลังจัดส่ง 🚚',
      completed: 'จัดส่งสำเร็จ ✅',
      cancelled: 'ยกเลิกออเดอร์',
    };
    const localDate = new Date(o.created_at).toLocaleDateString('th-TH');
    return `📦 เลขที่: ${o.order_code}\nวันที่: ${localDate}\nยอดรวม: ฿${o.total_amount.toLocaleString()} บาท\nสถานะ: ${statusMap[o.status] || o.status}\n---`;
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
            text: '📋 สถานะออเดอร์ล่าสุดของคุณ',
            weight: 'bold',
            size: 'md',
            color: '#173f2a',
          },
          {
            type: 'text',
            text: orderText,
            wrap: true,
            size: 'xs',
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
              label: '🔍 ดูประวัติทั้งหมดในเว็บ',
              uri: process.env.LIFF_HISTORY_URL || 'https://liff.line.me/dummy-liff-history-id',
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
      messages: [flexStatus],
    });
  } catch (err) {
    console.error('Failed to reply order status:', err.message);
  }
}

// Event parser and router
async function handleEvent(event) {
  const userId = event.source?.userId;
  if (!userId) return;

  // 1. Follow Event: New user friends the official account
  if (event.type === 'follow') {
    let displayName = 'ลูกค้า LINE';
    let pictureUrl = null;

    try {
      if (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_ACCESS_TOKEN !== 'dummy_token') {
        const profile = await client.getProfile(userId);
        displayName = profile.displayName;
        pictureUrl = profile.pictureUrl;
      }
    } catch (e) {
      console.warn('Failed to fetch LINE profile:', e.message);
    }

    const [existing] = await pool.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO customers (line_user_id, display_name, picture_url) VALUES (?, ?, ?)',
        [userId, displayName, pictureUrl]
      );
    } else {
      await pool.query(
        'UPDATE customers SET display_name = ?, picture_url = ? WHERE line_user_id = ?',
        [displayName, pictureUrl, userId]
      );
    }

    await replyWelcome(event.replyToken);
    return;
  }

  // 2. Image Message Event: Check if user is uploading a payment slip
  if (event.type === 'message' && event.message.type === 'image') {
    const session = await getChatSession(userId);

    if (session.state === 'AWAITING_PAYMENT' && session.order_id) {
      let slipDataUrl = null;

      try {
        if (config.channelAccessToken && config.channelAccessToken !== 'dummy_token') {
          const contentRes = await fetch(
            `https://api-data.line.me/v2/bot/message/${event.message.id}/content`,
            {
              headers: { Authorization: `Bearer ${config.channelAccessToken}` },
            }
          );
          if (contentRes.ok) {
            const arrayBuffer = await contentRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            slipDataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
          }
        }
      } catch (imgErr) {
        console.warn('Failed to fetch image from LINE Content API:', imgErr.message);
      }

      // Fallback placeholder if token is dummy or download failed
      if (!slipDataUrl) {
        slipDataUrl = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600&auto=format&fit=crop';
      }

      await pool.query('UPDATE orders SET slip_image_url = ?, status = "paid" WHERE id = ?', [
        slipDataUrl,
        session.order_id,
      ]);

      const orderCode = session.draft_data?.order_code || 'ORD';
      await clearChatSession(userId);
      await replySlipConfirmed(event.replyToken, orderCode);
      return;
    }

    // Default image reply
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: 'text',
          text: 'ขอบคุณสำหรับรูปภาพครับ! หากต้องการสั่งซื้อผักสด สามารถพิมพ์รายการและจำนวนที่ต้องการได้เลยนะครับ เช่น "สั่งกรีนโอ๊ค 2 แพ็ค" 🌱',
        },
      ],
    });
  }

  // 3. Text Message Event
  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    const replyToken = event.replyToken;

    // Ensure customer profile exists
    try {
      const [existing] = await pool.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
      if (existing.length === 0) {
        let displayName = 'ลูกค้า LINE';
        let pictureUrl = null;
        try {
          if (config.channelAccessToken && config.channelAccessToken !== 'dummy_token') {
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

    // Fetch active session state
    const session = await getChatSession(userId);

    // Global cancellation handler
    if (text === 'ยกเลิก' || text === 'cancel' || text === 'ไม่เอาแล้ว') {
      if (session.state === 'AWAITING_PAYMENT' && session.order_id) {
        const cancelledCode = await cancelChatOrder(session.order_id);
        await clearChatSession(userId);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: `ยกเลิกออเดอร์ ${cancelledCode} และคืนสต็อกผักสดเรียบร้อยแล้วครับ หากต้องการสั่งซื้อใหม่สามารถพิมพ์บอกได้ตลอดเวลานะครับ 🌱`,
            },
          ],
        });
      }

      if (session.state === 'AWAITING_ADDRESS') {
        await clearChatSession(userId);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: 'ยกเลิกรายการสั่งซื้อเรียบร้อยแล้วครับ หากต้องการสั่งซื้อใหม่อีกครั้ง แจ้งได้ตลอดเวลาครับ 🌱',
            },
          ],
        });
      }

      return client.replyMessage({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: 'ขณะนี้ไม่มีรายการที่อยู่ระหว่างการสั่งซื้อครับ หากต้องการสั่งผักสด พิมพ์แจ้งรายการได้เลยครับ เช่น "สั่งกรีนโอ๊ค 2 แพ็ค" 🌱',
          },
        ],
      });
    }

    // STATE: AWAITING_ADDRESS (Customer is providing shipping address & phone)
    if (session.state === 'AWAITING_ADDRESS' && session.draft_data?.items) {
      const items = session.draft_data.items;
      const totalAmount = session.draft_data.totalAmount || session.draft_data.total_amount;

      // Extract phone number from text
      const phoneMatch = text.match(/0[0-9]{8,9}/);
      const phone = phoneMatch ? phoneMatch[0] : null;

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // 1. Get customer
        const [customers] = await connection.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
        const customer = customers[0];

        // 2. Update customer phone and address
        await connection.query(
          'UPDATE customers SET address = ?, phone = COALESCE(?, phone) WHERE id = ?',
          [text, phone, customer.id]
        );

        // 3. Check stock again and deduct
        for (const item of items) {
          const [prod] = await connection.query('SELECT stock_quantity, status FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
          if (prod.length === 0 || prod[0].stock_quantity < item.quantity) {
            await connection.rollback();
            await clearChatSession(userId);
            return client.replyMessage({
              replyToken: replyToken,
              messages: [
                {
                  type: 'text',
                  text: `ขออภัยครับ สินค้า "${item.name}" สต็อกไม่เพียงพอในขณะนี้ ระบบขออนุญาตยกเลิกรายการเดิม รบกวนพิมพ์สั่งซื้อใหม่อีกครั้งครับ`,
                },
              ],
            });
          }

          const newStock = prod[0].stock_quantity - item.quantity;
          const newStatus = newStock <= 0 ? 'out_of_stock' : prod[0].status;
          await connection.query('UPDATE products SET stock_quantity = ?, status = ? WHERE id = ?', [
            newStock,
            newStatus,
            item.product_id,
          ]);
        }

        // 4. Create Order
        const orderCode = generateOrderCode();
        const [orderResult] = await connection.query(
          `INSERT INTO orders (order_code, customer_id, total_amount, status, delivery_type, notes)
           VALUES (?, ?, ?, 'pending', 'delivery', ?)`,
          [orderCode, customer.id, totalAmount, text]
        );
        const orderId = orderResult.insertId;

        // 5. Insert order items
        for (const item of items) {
          await connection.query(
            'INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
            [orderId, item.product_id, item.quantity, item.price, item.subtotal]
          );
        }

        await connection.commit();

        // 6. Update session to AWAITING_PAYMENT
        await setChatSession(userId, 'AWAITING_PAYMENT', orderId, {
          order_code: orderCode,
          total_amount: totalAmount,
          items,
          address: text,
        });

        // 7. Send invoice & bank details
        await replyInvoiceAndPayment(replyToken, orderCode, totalAmount, items, text);
        return;
      } catch (orderErr) {
        await connection.rollback();
        console.error('Failed to create order from chat:', orderErr.message);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: 'ขออภัยครับ เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง หรือสั่งผ่านหน้าร้านเว็บได้ครับ',
            },
          ],
        });
      } finally {
        connection.release();
      }
    }

    // STATE: AWAITING_PAYMENT (Customer typed text instead of sending slip image)
    if (session.state === 'AWAITING_PAYMENT' && session.order_id) {
      const orderCode = session.draft_data?.order_code || 'ORD';
      const totalAmount = session.draft_data?.total_amount || 0;
      return client.replyMessage({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: `ขณะนี้คุณมีออเดอร์ ${orderCode} (ยอดชำระ ฿${totalAmount.toLocaleString()} บาท) รอยืนยันการชำระเงินครับ\n\n📸 เมื่อโอนแล้ว ส่งรูปสลิปเข้ามาในแชทนี้ได้เลยครับ\n❌ หรือพิมพ์ 'ยกเลิก' หากต้องการยกเลิกออเดอร์`,
          },
        ],
      });
    }

    // STATE: IDLE (Standard conversation or new order intent)
    if (text === 'เมนูผัก' || text === 'สั่งซื้อ') {
      return replyVegMenu(replyToken, userId);
    }
    if (text === 'เช็คสถานะ' || text === 'ออเดอร์') {
      return replyOrderStatus(replyToken, userId);
    }

    // Check if user is trying to order directly in chat
    const orderIntent = await extractOrderIntent(text);

    if (orderIntent.isOrder) {
      if (orderIntent.error) {
        return client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: 'text', text: orderIntent.error }],
        });
      }

      if (orderIntent.items && orderIntent.items.length > 0) {
        // Set session to AWAITING_ADDRESS
        await setChatSession(userId, 'AWAITING_ADDRESS', null, {
          items: orderIntent.items,
          totalAmount: orderIntent.totalAmount,
        });

        return replyOrderDraftConfirmation(replyToken, orderIntent.items, orderIntent.totalAmount);
      }
    }

    // Default conversational AI fallback (Gemini with farm context)
    try {
      const systemInstruction = await getFarmContext();
      const responseText = await askGemini(text, systemInstruction);
      await client.replyMessage({
        replyToken: replyToken,
        messages: [{ type: 'text', text: responseText }],
      });
    } catch (err) {
      console.error('Error forwarding message to Gemini API:', err.message);
      await replyVegMenu(replyToken, userId);
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
