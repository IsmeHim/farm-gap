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

// Helper: สกัดคีย์เวิร์ดชื่อผักทั้งไทย/อังกฤษ/คำย่อสำหรับสินค้าทุกตัวในระบบ
function getProductKeywords(productName) {
  const lower = productName.toLowerCase();
  const keywords = [];

  // 1. ดึงชื่อภาษาอังกฤษในวงเล็บ เช่น (Chinese Cabbage), (Green Oak)
  const enMatch = lower.match(/\(([^)]+)\)/);
  if (enMatch && enMatch[1]) {
    const en = enMatch[1].trim();
    keywords.push(en);
    en.split(/[\s-]+/).forEach(w => {
      if (w.length >= 3) keywords.push(w);
    });
  }

  // 2. ดึงชื่อภาษาไทยหลัก ตัดคำตกแต่ง (เช่น ปลอดสาร, สด, GAP, อินทรีย์, พรีเมียม ฯลฯ)
  const cleanThai = lower
    .replace(/\([^)]*\)/g, '')
    .replace(/ปลอดสาร|สด|gap|อินทรีย์|ซูเปอร์ฟู้ด|โฮมเมด|กรอบพรีเมียม|เนื้อนุ่ม|พรีเมียม/g, '')
    .trim();

  if (cleanThai) {
    keywords.push(cleanThai);
    if (cleanThai.startsWith('ผัก')) {
      const withoutPhak = cleanThai.replace(/^ผัก/, '').trim();
      if (withoutPhak.length >= 2) keywords.push(withoutPhak);
    }
  }

  // 3. คีย์เวิร์ดภาษาไทยที่ผู้ใช้งานมักพิมพ์บ่อย
  if (lower.includes('กาดขาว') || lower.includes('cabbage')) {
    keywords.push('ผักกาดขาว', 'กาดขาว', 'cabbage');
  }
  if (lower.includes('กาดหอม') || lower.includes('lettuce')) {
    keywords.push('ผักกาดหอม', 'กาดหอม');
  }
  if (lower.includes('ฟิล') || lower.includes('ฟิน') || lower.includes('frillice')) {
    keywords.push('ฟิลเล่ย์', 'ฟินเล่ย์', 'ฟิลเลย์', 'ฟินเลย์', 'ไอซ์เบิร์ก', 'frillice');
  }
  if (lower.includes('กรีน') || lower.includes('green')) {
    keywords.push('กรีนโอ๊ค', 'กรีนโอค', 'กรีน', 'green oak');
  }
  if (lower.includes('เรด') || lower.includes('red')) {
    keywords.push('เรดโอ๊ค', 'เรดโอค', 'เรด', 'red oak');
  }
  if (lower.includes('คอส') || lower.includes('cos')) {
    keywords.push('คอส', 'cos');
  }
  if (lower.includes('บัตเตอร์') || lower.includes('butter')) {
    keywords.push('บัตเตอร์เฮด', 'บัตเตอร์', 'butterhead');
  }
  if (lower.includes('เคล') || lower.includes('kale')) {
    keywords.push('ผักเคล', 'เคล', 'kale');
  }
  if (lower.includes('น้ำสลัด') || lower.includes('sesame')) {
    keywords.push('น้ำสลัด', 'งาคั่ว', 'dressing');
  }

  return [...new Set(keywords.filter(k => k.length >= 2))];
}

// Helper: ใช้ Gemini AI สกัดคำสั่งซื้อกรณีผู้ใช้พิมพ์ภาษาพูดซับซ้อน
async function extractOrderWithGemini(userText, availableProducts) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'dummy_key') return null;

  const productListDesc = availableProducts.map(p => `ID: ${p.id}, ชื่อ: ${p.name}, ราคา: ${p.price}`).join('\n');
  const prompt = `คุณคือระบบวิเคราะห์คำสั่งซื้อสินค้าเกษตร FarmGAP
ข้อความของลูกค้า:
"${userText}"

รายการสินค้าที่มีในระบบ:
${productListDesc}

หากข้อความนี้เป็นการสั่งซื้อหรือต้องการซื้อสินค้า ให้สกัดออกมาเป็น JSON โครงสร้างนี้เท่านั้น (ห้ามใส่คำอธิบายอื่น):
{
  "isOrder": true,
  "items": [
    { "product_id": <id ตัวเลข>, "quantity": <จำนวนตัวเลข> }
  ]
}
หากไม่ใช่การสั่งซื้อ ให้ตอบ:
{ "isOrder": false }`;

  try {
    const raw = await askGemini(prompt, "ตอบเฉพาะ JSON ตามโครงสร้างที่กำหนดเท่านั้น");
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('Gemini order extraction error:', err.message);
  }
  return null;
}

// 3. วิเคราะห์เจตนาและสกัดคำสั่งซื้อจากข้อความธรรมชาติ (Order Intent & Entity Extraction)
async function extractOrderIntent(text) {
  const buyKeywords = ['สั่ง', 'ซื้อ', 'เอา', 'รับ', 'จอง', 'order', 'ขอ', 'กิโล', 'กีโล', 'โล', 'แพ็ค', 'แพค', 'ถุง', 'กก'];
  const hasBuyKeyword = buyKeywords.some(k => text.includes(k));

  const [products] = await pool.query(
    'SELECT id, name, price, unit, stock_quantity FROM products WHERE status = "available"'
  );

  if (products.length === 0) {
    return { isOrder: false };
  }

  let matchedItems = [];
  const lowerText = text.toLowerCase();

  // 1. ถ้ามีเจตนาซื้อ ให้ใช้ Gemini AI สกัดเป็นอันดับแรก เพื่อความเข้าใจภาษามนุษย์สูงสุด (ดักจับคำพิมพ์ผิด เช่น 10 กีโล, สิบโล)
  if (hasBuyKeyword) {
    const geminiResult = await extractOrderWithGemini(text, products);
    if (geminiResult && geminiResult.isOrder && Array.isArray(geminiResult.items) && geminiResult.items.length > 0) {
      for (const gItem of geminiResult.items) {
        const prod = products.find(p => p.id === gItem.product_id);
        if (prod) {
          const qty = Number(gItem.quantity) || 1;
          matchedItems.push({
            product_id: prod.id,
            name: prod.name,
            price: Number(prod.price),
            unit: prod.unit || 'กก.',
            quantity: qty,
            stock_quantity: Number(prod.stock_quantity),
            subtotal: Number(prod.price) * qty,
          });
        }
      }
    }
  }

  // 2. ถ้า Gemini ไม่ได้ผล หรือไม่ได้ต่อเน็ต ให้ใช้ Regex Keyword Matching อัจฉริยะ (Local Fallback)
  if (matchedItems.length === 0) {
    for (const product of products) {
      const keywords = getProductKeywords(product.name);
      const matchedKw = keywords.find(kw => lowerText.includes(kw));

      if (matchedKw) {
        let qty = 1;
        // ขยายระยะห่างคำเป็น 30 ตัวอักษร เพื่อครอบคลุมคำขยาย (เช่น "ผักกาดขาว ปลอดสาร 10 กิโล")
        const regexPatterns = [
          new RegExp(`${matchedKw}[^0-9]{0,30}([0-9]+(?:\\.[0-9]+)?)`, 'i'),
          new RegExp(`([0-9]+(?:\\.[0-9]+)?)[^0-9]{0,30}${matchedKw}`, 'i'),
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
          // รองรับหน่วยต่างๆ รวมทั้งคำสะกดผิด เช่น กีโล, กก, โล
          const unitDigitMatch = text.match(new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s*(?:กิโล|กีโล|กก|ก\\.ก\\.|โล|แพ็ค|แพค|ถุง|ชิ้น|หัว|ชุด)[^0-9]*${matchedKw}`, 'i')) ||
                                 text.match(new RegExp(`${matchedKw}[^0-9]*([0-9]+(?:\\.[0-9]+)?)\\s*(?:กิโล|กีโล|กก|ก\\.ก\\.|โล|แพ็ค|แพค|ถุง|ชิ้น|หัว|ชุด)`, 'i'));
          if (unitDigitMatch && unitDigitMatch[1]) {
            qty = parseFloat(unitDigitMatch[1]);
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

    // กรณีสั่งผักรายการเดียว และในประโยคมีตัวเลขโดดๆ (เช่น "ขอสั่งผักกาดขาว 10")
    if (matchedItems.length === 1 && matchedItems[0].quantity === 1) {
      const singleDigitMatch = text.match(/\b([1-9][0-9]*)\b/);
      if (singleDigitMatch && singleDigitMatch[1]) {
        matchedItems[0].quantity = parseInt(singleDigitMatch[1], 10);
        matchedItems[0].subtotal = matchedItems[0].price * matchedItems[0].quantity;
      }
    }
  }

  if (matchedItems.length === 0) {
    return { isOrder: false };
  }

  if (!hasBuyKeyword && !text.match(/\d+/)) {
    return { isOrder: false };
  }

  // ตรวจสอบสต็อก
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
  let bankInfoLines = [
    '• ธนาคาร: ธนาคารกสิกรไทย (KBANK)',
    '• เลขที่บัญชี: 098-2-34567-8',
    '• ชื่อบัญชี: ฟาร์มผัก FarmGAP AI',
    '• พร้อมเพย์: 081-234-5678',
  ];
  let qrImageElement = null;

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

      // Check if farm owner provided a valid HTTPS QR code URL
      if (o.promptpay_qr_url && o.promptpay_qr_url.startsWith('https://')) {
        qrImageElement = {
          type: 'image',
          url: o.promptpay_qr_url,
          size: 'md',
          aspectRatio: '1:1',
          aspectMode: 'cover',
          margin: 'sm',
          align: 'center',
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
              ...(qrImageElement ? [qrImageElement] : []),
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

// Helper: ส่งการแจ้งเตือนเข้า LINE ของเจ้าของฟาร์ม (Admin Push Notification)
export async function notifyAdminNewOrder(orderData, eventType = 'NEW_ORDER') {
  try {
    // 1. ดึง LINE User ID และ frontend_url ของเจ้าของฟาร์มจากตาราง users
    const [owners] = await pool.query(
      "SELECT line_user_id, farm_name, display_name, frontend_url FROM users WHERE (role = 'owner' OR role = 'admin') AND line_user_id IS NOT NULL AND TRIM(line_user_id) != '' ORDER BY id ASC"
    );

    if (owners.length === 0 || !owners[0].line_user_id) {
      console.log('ℹ️ [Admin Notify] ไม่พบ LINE User ID ของเจ้าของฟาร์มในระบบ (สามารถตั้งค่าได้ที่หน้าโปรไฟล์บนเว็บ)');
      return;
    }

    const adminLineId = owners[0].line_user_id.trim();
    if (!adminLineId.startsWith('U')) {
      console.warn('⚠️ [Admin Notify] LINE User ID รูปแบบไม่ถูกต้อง (ควรขึ้นต้นด้วย U):', adminLineId);
      return;
    }

    if (!config.channelAccessToken || config.channelAccessToken === 'dummy_token') {
      console.warn('⚠️ [Admin Notify] LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่า');
      return;
    }

    const isSlip = eventType === 'SLIP_UPLOADED';
    const title = isSlip ? '💸 ลูกค้าแนบสลิปชำระเงินแล้ว!' : '🔔 มีคำสั่งซื้อใหม่เข้ามา!';
    const badgeText = isSlip ? 'สลิปรอตรวจ' : 'ออเดอร์ใหม่';
    const badgeBg = isSlip ? '#d97706' : '#15803d';
    const headerBg = isSlip ? '#78350f' : '#14532d';

    const orderCode = orderData.order_code || `ORD-${orderData.id || ''}`;
    const totalAmount = Number(orderData.total_amount || 0).toLocaleString();
    const customerName = orderData.customer_name || 'ลูกค้าทั่วไป';
    const customerPhone = orderData.customer_phone || '-';
    const customerAddress = orderData.customer_address || '-';

    // เตรียมรายการสินค้า (ถ้ามี)
    const items = orderData.items || [];
    const itemRows = items.slice(0, 5).map(item => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `• ${item.product_name || item.name || 'ผักสด'} x${item.quantity}`,
          size: 'xs',
          color: '#374151',
          flex: 8,
          wrap: true,
        },
        {
          type: 'text',
          text: `฿${Number(item.subtotal || (item.quantity * (item.unit_price || item.price || 0))).toLocaleString()}`,
          size: 'xs',
          color: '#111827',
          weight: 'bold',
          align: 'end',
          flex: 4,
        },
      ],
    }));

    // กำหนด URL หน้าเว็บ: ดึงจากที่ตั้งค่าในหน้า Profile ก่อน ➔ ถ้าไม่มีให้ใช้ .env ➔ ถ้าไม่มีให้ใช้ localhost
    const configuredUrl = owners[0]?.frontend_url ? owners[0].frontend_url.trim() : null;
    const rawFrontendBase = configuredUrl || process.env.FRONTEND_URL || process.env.DASHBOARD_URL || 'http://localhost:5173';
    const frontendBase = rawFrontendBase.replace(/\/+$/, '');
    const actionUri = process.env.DASHBOARD_ORDER_URL || `${frontendBase}/orders`;
    const printUri = orderData.id ? `${frontendBase}/orders/${orderData.id}/print` : actionUri;

    const flexContents = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBg,
        paddingAll: 'lg',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: title,
                weight: 'bold',
                size: 'md',
                color: '#ffffff',
                flex: 8,
              },
              {
                type: 'box',
                layout: 'horizontal',
                backgroundColor: badgeBg,
                cornerRadius: 'sm',
                paddingStart: 'sm',
                paddingEnd: 'sm',
                paddingTop: 'xs',
                paddingBottom: 'xs',
                contents: [
                  {
                    type: 'text',
                    text: badgeText,
                    weight: 'bold',
                    size: 'xxs',
                    color: '#ffffff',
                  },
                ],
              },
            ],
          },
          {
            type: 'text',
            text: `รหัสคำสั่งซื้อ: ${orderCode}`,
            size: 'xs',
            color: '#cbd5e1',
            margin: 'sm',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          // กล่องยอดรวมเงิน
          {
            type: 'box',
            layout: 'horizontal',
            backgroundColor: '#f8fafc',
            cornerRadius: 'md',
            paddingAll: 'md',
            borderColor: '#e2e8f0',
            borderWidth: '1px',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: 'ยอดรวมทั้งสิ้น',
                size: 'sm',
                color: '#64748b',
                flex: 6,
              },
              {
                type: 'text',
                text: `฿${totalAmount} บาท`,
                size: 'lg',
                weight: 'bold',
                color: '#059669',
                align: 'end',
                flex: 6,
              },
            ],
          },
          // ข้อมูลลูกค้า
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '👤 ข้อมูลลูกค้า:',
                size: 'xs',
                weight: 'bold',
                color: '#475569',
              },
              {
                type: 'text',
                text: `ชื่อ: ${customerName}`,
                size: 'xs',
                color: '#1e293b',
              },
              {
                type: 'text',
                text: `โทร: ${customerPhone}`,
                size: 'xs',
                color: '#1e293b',
              },
              {
                type: 'text',
                text: `ที่อยู่: ${customerAddress}`,
                size: 'xs',
                color: '#64748b',
                wrap: true,
              },
            ],
          },
          // รายการสินค้า
          ...(itemRows.length > 0
            ? [
                {
                  type: 'separator',
                  margin: 'md',
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'xs',
                  contents: [
                    {
                      type: 'text',
                      text: '🥬 รายการผักที่สั่ง:',
                      size: 'xs',
                      weight: 'bold',
                      color: '#475569',
                    },
                    ...itemRows,
                  ],
                },
              ]
            : []),
          ...(isSlip
            ? [
                {
                  type: 'separator',
                  margin: 'md',
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#fef3c7',
                  cornerRadius: 'md',
                  paddingAll: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: '📸 มีรูปสลิปแนบมาแล้ว กรุณาเข้าตรวจสอบความถูกต้องและอนุมัติสถานะบนระบบ FarmGAP ครับ',
                      size: 'xs',
                      color: '#92400e',
                      wrap: true,
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'md',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '🖨️ พิมพ์ใบปะหน้า & เช็คลิสต์',
              uri: printUri,
            },
            style: 'primary',
            color: '#15803d',
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '📦 เปิดดูรายการออเดอร์',
              uri: actionUri,
            },
            style: 'secondary',
            height: 'sm',
          },
        ],
      },
    };

    await client.pushMessage({
      to: adminLineId,
      messages: [
        {
          type: 'flex',
          altText: isSlip ? `💸 สลิปโอนเงินใหม่: ${orderCode} (฿${totalAmount})` : `🔔 คำสั่งซื้อใหม่: ${orderCode} (฿${totalAmount})`,
          contents: flexContents,
        },
      ],
    });

    console.log(`✅ [Admin Notify] ส่งการแจ้งเตือน ${eventType} ไปยัง LINE User ID: ${adminLineId} สำเร็จ`);
  } catch (err) {
    console.error('❌ [Admin Notify] ไม่สามารถส่งแจ้งเตือนเข้า LINE ได้:', err.message);
  }
}

// Helper: ส่งการแจ้งเตือนสถานะออเดอร์เข้า LINE ของลูกค้า (Customer Order Status Push Notification)
export async function notifyCustomerOrderStatus(orderId, newStatus, dispatchDetails = null) {
  try {
    // 1. ดึงข้อมูลออเดอร์และลูกค้า
    const [orderRows] = await pool.query(
      `SELECT o.*, c.line_user_id, c.display_name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (orderRows.length === 0) {
      console.warn(`⚠️ [Customer Notify] ไม่พบออเดอร์ id=${orderId}`);
      return;
    }

    const order = orderRows[0];
    const customerLineId = order.line_user_id ? order.line_user_id.trim() : null;

    if (!customerLineId || !customerLineId.startsWith('U')) {
      console.log(`ℹ️ [Customer Notify] ออเดอร์ #${order.order_code} ไม่มี LINE User ID ของลูกค้า (อาจไม่ได้สั่งผ่าน LINE)`);
      return;
    }

    if (!config.channelAccessToken || config.channelAccessToken === 'dummy_token') {
      console.warn('⚠️ [Customer Notify] LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่า');
      return;
    }

    // 2. ดึงรายการสินค้าในออเดอร์
    const [itemRows] = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.unit
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    // ดึง frontendBase สำหรับสร้างลิงก์เปิดเว็บ
    const [owners] = await pool.query(
      "SELECT frontend_url FROM users WHERE (role = 'owner' OR role = 'admin') AND frontend_url IS NOT NULL AND TRIM(frontend_url) != '' ORDER BY id ASC LIMIT 1"
    );
    const configuredUrl = owners[0]?.frontend_url ? owners[0].frontend_url.trim() : null;
    const rawFrontendBase = configuredUrl || process.env.FRONTEND_URL || process.env.DASHBOARD_URL || 'http://localhost:5173';
    const frontendBase = rawFrontendBase.replace(/\/+$/, '');

    const orderCode = order.order_code || `ORD-${order.id}`;
    const totalAmount = Number(order.total_amount || 0).toLocaleString();

    // รายการผัก (สูงสุด 4 รายการ)
    const itemsList = itemRows.slice(0, 4).map(item => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `• ${item.product_name} x${item.quantity} ${item.unit || ''}`,
          size: 'xs',
          color: '#334155',
          flex: 8,
          wrap: true,
        },
        {
          type: 'text',
          text: `฿${Number(item.subtotal || 0).toLocaleString()}`,
          size: 'xs',
          color: '#0f172a',
          weight: 'bold',
          align: 'end',
          flex: 4,
        },
      ],
    }));

    // URL ลิงก์
    const historyUri = process.env.LIFF_HISTORY_URL || `${frontendBase}/liff/history`;
    const orderStoreUri = process.env.LIFF_ORDER_URL || `${frontendBase}/liff/order`;

    let title = '';
    let badgeText = '';
    let badgeBg = '#15803d';
    let headerBg = '#14532d';
    let subMessage = '';
    let altText = '';
    let extraInfoBoxes = [];
    let buttons = [];

    if (newStatus === 'paid') {
      title = '✅ ตรวจสอบยอดเงินเรียบร้อยแล้ว';
      badgeText = 'ชำระแล้ว';
      badgeBg = '#16a34a';
      headerBg = '#14532d';
      altText = `✅ รับยอดชำระเงินออเดอร์ ${orderCode} เรียบร้อยแล้ว`;
      subMessage = 'ฟาร์มได้รับยอดเงินของท่านเรียบร้อยแล้ว ขณะนี้กำลังเตรียมตัดและแพ็คผักสดมาตรฐาน GAP ให้ท่านอย่างพิถีพิถันครับ';

      buttons = [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '📦 ดูประวัติคำสั่งซื้อ',
            uri: historyUri,
          },
          style: 'primary',
          color: '#15803d',
          height: 'sm',
        },
      ];
    } else if (newStatus === 'shipping') {
      title = '🚚 สินค้ากำลังอยู่ระหว่างจัดส่ง!';
      badgeText = 'กำลังจัดส่ง';
      badgeBg = '#0284c7';
      headerBg = '#0369a1';
      altText = `🚚 ออเดอร์ ${orderCode} กำลังออกเดินทางจัดส่ง`;
      subMessage = 'ผักสดปลอดภัยมาตรฐาน GAP ของท่านถูกบรรจุและเริ่มออกเดินทางจัดส่งแล้ว รอรับความสดใหม่ได้เลยครับ!';

      const vehicle = dispatchDetails?.vehicle || 'รถจักรยานยนต์ส่วนตัว (เจ้าของฟาร์มส่งเอง)';
      const storageCond = dispatchDetails?.storage_conditions || 'บรรจุในกล่อง/ถุงเก็บความสด ป้องกันแสงแดดและความร้อน';
      const shippedTo = dispatchDetails?.shipped_to || order.customer_address || (order.delivery_type === 'pickup' ? 'รับเองที่ฟาร์ม' : 'ที่อยู่ตามคำสั่งซื้อ');

      extraInfoBoxes = [
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#f0fdf4',
          cornerRadius: 'md',
          paddingAll: 'sm',
          borderColor: '#bbf7d0',
          borderWidth: '1px',
          spacing: 'xs',
          contents: [
            {
              type: 'text',
              text: '🛡️ ข้อมูลการจัดส่งมาตรฐาน GAP:',
              weight: 'bold',
              size: 'xxs',
              color: '#166534',
            },
            {
              type: 'text',
              text: `📍 ส่งไปที่: ${shippedTo}`,
              size: 'xxs',
              color: '#334155',
              wrap: true,
            },
            {
              type: 'text',
              text: `❄️ การคุมคุณภาพ: ${storageCond}`,
              size: 'xxs',
              color: '#334155',
              wrap: true,
            },
            {
              type: 'text',
              text: `🛵 ยานพาหนะ: ${vehicle}`,
              size: 'xxs',
              color: '#334155',
              wrap: true,
            },
          ],
        },
      ];

      buttons = [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '📦 ตรวจสอบสถานะการจัดส่ง',
            uri: historyUri,
          },
          style: 'primary',
          color: '#0284c7',
          height: 'sm',
        },
      ];
    } else if (newStatus === 'completed') {
      title = '🎉 สินค้าจัดส่งถึงท่านเรียบร้อยแล้ว!';
      badgeText = 'จัดส่งสำเร็จ';
      badgeBg = '#15803d';
      headerBg = '#14532d';
      altText = `🎉 ออเดอร์ ${orderCode} จัดส่งสำเร็จเรียบร้อยแล้ว ขอบคุณที่อุดหนุนครับ`;
      subMessage = 'ขอบคุณที่เลือกอุดหนุนผักสดปลอดภัยมาตรฐาน GAP จากฟาร์มของเรา ขอให้อร่อยและมีสุขภาพดีกับผักสดมื้อนี้นะครับ!';

      buttons = [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '🛒 สั่งซื้อผักสดใหม่อีกครั้ง',
            uri: orderStoreUri,
          },
          style: 'primary',
          color: '#15803d',
          height: 'sm',
        },
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '📦 ดูประวัติคำสั่งซื้อ',
            uri: historyUri,
          },
          style: 'secondary',
          height: 'sm',
        },
      ];
    } else if (newStatus === 'cancelled') {
      title = '❌ คำสั่งซื้อถูกยกเลิก';
      badgeText = 'ยกเลิกแล้ว';
      badgeBg = '#e11d48';
      headerBg = '#881337';
      altText = `❌ คำสั่งซื้อ ${orderCode} ถูกยกเลิกแล้ว`;
      subMessage = `คำสั่งซื้อ #${orderCode} ของท่านถูกยกเลิกแล้ว หากมีข้อสงสัยหรือต้องการสอบถามข้อมูลเพิ่มเติม สามารถพิมพ์ข้อความสอบถามในห้องแชทนี้ได้ตลอดเวลาครับ`;

      buttons = [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '🛒 หน้าร้านสั่งซื้อผักสด',
            uri: orderStoreUri,
          },
          style: 'secondary',
          height: 'sm',
        },
      ];
    } else {
      // Pending or unrecognized status
      return;
    }

    const flexContents = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBg,
        paddingAll: 'lg',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: title,
                weight: 'bold',
                size: 'md',
                color: '#ffffff',
                flex: 8,
              },
              {
                type: 'box',
                layout: 'horizontal',
                backgroundColor: badgeBg,
                cornerRadius: 'sm',
                paddingStart: 'sm',
                paddingEnd: 'sm',
                paddingTop: 'xs',
                paddingBottom: 'xs',
                contents: [
                  {
                    type: 'text',
                    text: badgeText,
                    weight: 'bold',
                    size: 'xxs',
                    color: '#ffffff',
                  },
                ],
              },
            ],
          },
          {
            type: 'text',
            text: `รหัสคำสั่งซื้อ: ${orderCode}`,
            size: 'xs',
            color: '#cbd5e1',
            margin: 'sm',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          // ข้อความแจ้งเตือนหลัก
          {
            type: 'text',
            text: subMessage,
            size: 'xs',
            color: '#475569',
            wrap: true,
          },
          // กล่องยอดรวมเงิน
          {
            type: 'box',
            layout: 'horizontal',
            backgroundColor: '#f8fafc',
            cornerRadius: 'md',
            paddingAll: 'md',
            borderColor: '#e2e8f0',
            borderWidth: '1px',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: 'ยอดรวมสุทธิ',
                size: 'sm',
                color: '#64748b',
                flex: 6,
              },
              {
                type: 'text',
                text: `฿${totalAmount} บาท`,
                size: 'md',
                color: '#0f172a',
                weight: 'bold',
                align: 'end',
                flex: 6,
              },
            ],
          },
          // ข้อมูลการจัดส่งเพิ่มเติม (GAP #6 ถ้ามี)
          ...extraInfoBoxes,
          // รายการสินค้า
          ...(itemsList.length > 0
            ? [
                {
                  type: 'separator',
                  margin: 'md',
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'xs',
                  contents: [
                    {
                      type: 'text',
                      text: '🥬 รายการสินค้า:',
                      size: 'xs',
                      weight: 'bold',
                      color: '#475569',
                    },
                    ...itemsList,
                  ],
                },
              ]
            : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'md',
        contents: buttons,
      },
    };

    await client.pushMessage({
      to: customerLineId,
      messages: [
        {
          type: 'flex',
          altText: altText,
          contents: flexContents,
        },
      ],
    });

    console.log(`✅ [Customer Notify] ส่งแจ้งเตือนสถานะ '${newStatus}' ให้ลูกค้า ${order.customer_name} (LINE ID: ${customerLineId}) สำเร็จ`);
  } catch (err) {
    console.error(`❌ [Customer Notify] ไม่สามารถส่งแจ้งเตือนสถานะให้ลูกค้าได้:`, err.message, err.response?.data || err.originalError?.response?.data || JSON.stringify(err.body || ''));
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
      const orderIdForNotify = session.order_id;
      await clearChatSession(userId);
      await replySlipConfirmed(event.replyToken, orderCode);

      // แจ้งเตือนเจ้าของฟาร์มเมื่อมีลูกค้าแนบสลิปผ่าน LINE Chat
      try {
        const [oRows] = await pool.query(
          `SELECT o.*, c.display_name AS customer_name, c.phone AS customer_phone, c.address AS customer_address 
           FROM orders o 
           LEFT JOIN customers c ON o.customer_id = c.id 
           WHERE o.id = ?`,
          [orderIdForNotify]
        );
        if (oRows.length > 0) {
          notifyAdminNewOrder(oRows[0], 'SLIP_UPLOADED').catch(e => console.error('notifyAdminNewOrder slip error:', e.message));
        }
      } catch (err) {
        console.error('Error in notifyAdminNewOrder for chat slip:', err.message);
      }
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

    // คำสั่งพิเศษ: แสดง LINE User ID สำหรับนำไปผูกในหน้าตั้งค่าโปรไฟล์บนเว็บ FarmGAP
    const lowerText = text.toLowerCase();
    if (['myid', 'my id', 'id', 'ไอดี', 'admin', 'แอดมิน'].includes(lowerText)) {
      return client.replyMessage({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: `🔑 LINE User ID ของคุณคือ:\n\n${userId}\n\n👉 แตะค้างที่ข้อความด้านล่างนี้เพื่อคัดลอกรหัส แล้วนำไปใส่ในหน้า "ตั้งค่าโปรไฟล์" บนเว็บไซต์ FarmGAP ได้เลยครับ 🌱`,
          },
          {
            type: 'text',
            text: userId,
          },
        ],
      });
    }

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

// Helper: สกัดชื่อผู้รับ เบอร์โทรศัพท์ และที่อยู่จัดส่ง จากข้อความที่ผู้ใช้พิมพ์
function parseCustomerContact(text) {
  let name = null;
  let phone = null;
  let address = null;

  // 1. สกัดเบอร์โทรศัพท์ (รองรับทั้ง 08x, 09x, 06x มีหรือไม่มีขีด/วรรค)
  const phoneMatch = text.match(/0[0-9]{1,2}[- ]?[0-9]{3,4}[- ]?[0-9]{3,4}/);
  if (phoneMatch) {
    phone = phoneMatch[0].replace(/[- ]/g, '');
  }

  // 2. สกัดชื่อผู้รับ
  const nameMatch = text.match(/(?:ชื่อ|ผู้รับ|คุณ)\s*[:\-]?\s*([^\n,]+)/i);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim();
  }

  // 3. สกัดที่อยู่จัดส่ง
  const addrMatch = text.match(/(?:ที่อยู่|ส่งที่|จัดส่ง|บ้านเลขที่)\s*[:\-]?\s*([\s\S]+?)(?=(?:เบอร์|โทร|ชื่อ|$))/i);
  if (addrMatch && addrMatch[1]) {
    address = addrMatch[1].trim();
  } else {
    // กรณีพิมพ์แบบแยกบรรทัด ไม่มีคำว่าที่อยู่ ให้นำบรรทัดที่ไม่ใช่ชื่อและเบอร์มาเป็นที่อยู่
    address = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.match(/^(?:ชื่อ|เบอร์|โทร|tel)/i) && !l.match(/0[0-9]{8,9}/))
      .join(' ')
      .trim();
  }

  return {
    name: name || null,
    phone: phone || null,
    address: address || text.trim(),
  };
}

    // STATE: AWAITING_ADDRESS (Customer is providing shipping address & phone)
    if (session.state === 'AWAITING_ADDRESS' && session.draft_data?.items) {
      const items = session.draft_data.items;
      const totalAmount = session.draft_data.totalAmount || session.draft_data.total_amount;

      // Extract clean name, phone, address
      const contact = parseCustomerContact(text);
      const phone = contact.phone;
      const customerName = contact.name;
      const cleanAddress = contact.address;

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // 1. Get customer
        const [customers] = await connection.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
        const customer = customers[0];

        // 2. Update customer phone, address, and display_name
        await connection.query(
          'UPDATE customers SET address = ?, phone = COALESCE(?, phone), display_name = COALESCE(?, display_name) WHERE id = ?',
          [cleanAddress, phone, customerName, customer.id]
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
        const noteDetail = `ผู้รับ: ${customerName || customer.display_name} | โทร: ${phone || customer.phone || '-'} | ที่อยู่: ${cleanAddress}`;
        const [orderResult] = await connection.query(
          `INSERT INTO orders (order_code, customer_id, total_amount, status, delivery_type, notes)
           VALUES (?, ?, ?, 'pending', 'delivery', ?)`,
          [orderCode, customer.id, totalAmount, noteDetail]
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
          address: cleanAddress,
          customer_name: customerName,
          phone,
        });

        // 7. Send invoice & bank details
        const formattedAddressDisplay = `ชื่อผู้รับ: ${customerName || customer.display_name || 'คุณลูกค้า'}\nเบอร์โทร: ${phone || customer.phone || '-'}\nที่อยู่: ${cleanAddress}`;
        await replyInvoiceAndPayment(replyToken, orderCode, totalAmount, items, formattedAddressDisplay);

        // แจ้งเตือนเจ้าของฟาร์มเมื่อมีออเดอร์ใหม่ผ่าน LINE Chat
        try {
          const newOrderData = {
            id: orderId,
            order_code: orderCode,
            total_amount: totalAmount,
            customer_name: customerName || customer.display_name || 'คุณลูกค้า',
            customer_phone: phone || customer.phone || '-',
            customer_address: cleanAddress,
            items: items.map(it => ({
              product_name: it.product?.name || it.name || 'ผักสด',
              quantity: it.quantity,
              unit: it.product?.unit || it.unit || 'กก.',
              subtotal: it.subtotal || (it.quantity * (it.product?.price || it.price || 0)),
            })),
          };
          notifyAdminNewOrder(newOrderData, 'NEW_ORDER').catch(e => console.error('notifyAdminNewOrder chat order error:', e.message));
        } catch (err) {
          console.error('Error triggering admin notification for chat order:', err.message);
        }
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

    // Safety Net: หากผู้ใช้พิมพ์ข้อมูลติดต่อ/ที่อยู่ แต่ไม่ได้อยู่ในสถานะ AWAITING_ADDRESS
    const contactInfo = parseCustomerContact(text);
    if (contactInfo.phone || (contactInfo.name && contactInfo.address && (text.includes('ที่อยู่') || text.includes('เบอร์')))) {
      try {
        await pool.query(
          'UPDATE customers SET address = COALESCE(?, address), phone = COALESCE(?, phone), display_name = COALESCE(?, display_name) WHERE line_user_id = ?',
          [contactInfo.address, contactInfo.phone, contactInfo.name, userId]
        );
      } catch (_) {}

      return client.replyMessage({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: `ฟาร์มได้รับข้อมูลจัดส่งเรียบร้อยแล้วครับ ${contactInfo.name ? `(คุณ${contactInfo.name})` : ''} 📦🌱\n\nแต่ขณะนี้ยังไม่พบรายการผักสดที่ต้องการสั่งซื้อ รบกวนคุณลูกค้าพิมพ์บอกผักและจำนวนที่ต้องการสั่งได้เลยครับ เช่น:\n• "ขอสั่งผักกาดขาว 10 กิโล"\n• "สั่งกรีนโอ๊ค 2 แพ็ค"\n\nหรือพิมพ์ "เมนูผัก" เพื่อเลือกชมสินค้าทั้งหมดได้เลยครับ!`,
          },
        ],
      });
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
