import { Router } from 'express';
import { messagingApi } from '@line/bot-sdk';
import crypto from 'crypto';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const { MessagingApiClient } = messagingApi;
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy_token',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'dummy_secret',
};

// Create LINE Messaging API Client with Auto-Retry on network/socket reset
const client = new MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

// Auto-retry wrapper against Undici idle keep-alive socket drops
const _originalReplyMessage = client.replyMessage.bind(client);
client.replyMessage = async function (params) {
  try {
    return await _originalReplyMessage(params);
  } catch (err) {
    if (err?.message?.includes('fetch failed')) {
      console.warn('⚠️ LINE fetch failed (socket reset). Retrying once in 250ms...');
      await new Promise(r => setTimeout(r, 250));
      return await _originalReplyMessage(params);
    }
    throw err;
  }
};
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
    // Ensure slip_image_url in orders is LONGTEXT so it never overflows
    await pool.query(`
      ALTER TABLE orders MODIFY COLUMN slip_image_url LONGTEXT
    `).catch(() => {});
    // Ensure tracking_number column exists in orders table
    await pool.query(`
      ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100) NULL
    `).catch(() => {});
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

  const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ].filter(Boolean);
  const models = [...new Set(candidateModels)];

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    }
  };

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      });
      
      if (!res.ok) {
        if (res.status === 429) {
          console.warn('⚠️ Gemini rate limit / quota exceeded (HTTP 429). Serving smart farm knowledge assistant.');
          break;
        }
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          console.warn(`⚠️ Gemini API auth/request rejected (HTTP ${res.status}). Aborting model fallbacks.`);
          break;
        }
        console.warn(`⚠️ Gemini model [${model}] returned HTTP ${res.status}, trying fallback model...`);
        continue;
      }
      
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return text;
      }
    } catch (err) {
      console.warn(`⚠️ Gemini model [${model}] error: ${err.message}, trying fallback model...`);
    }
  }

  console.warn('⚠️ Gemini API unavailable or quota reached. Serving smart farm knowledge assistant.');
  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes('ปลูก') || lowerPrompt.includes('ทำสวน') || lowerPrompt.includes('ดูแล')) {
    return '🌱 ผักสลัดในฟาร์ม FarmGAP (เช่น กรีนโอ๊ค เรดโอ๊ค คอส) ปลูกโดยใช้ระบบเกษตรอินทรีย์ ปลอดภัย ได้รับใบรับรองมาตรฐาน GAP ในทุกล็อต มีการสุ่มตรวจวิเคราะห์คุณภาพน้ำรดดินสม่ำเสมอ ใช้เวลาประมาณ 40-45 วันในการเก็บเกี่ยวครับ';
  }
  if (lowerPrompt.includes('ราคา') || lowerPrompt.includes('เท่าไหร่') || lowerPrompt.includes('บาท')) {
    return '💵 ผักสลัดสดจากแปลงของเราจำหน่ายราคาเริ่มต้น 20-50 บาทต่อถุง/กิโลกรัมครับ สามารถพิมพ์ระบุสั่งซื้อได้เลย เช่น "สั่งกรีนโอ๊ค 2 แพ็ค" หรือพิมพ์ "เมนูผัก" เพื่อดูรายการพร้อมราคาครับ';
  }
  if (lowerPrompt.includes('สต็อก') || lowerPrompt.includes('เหลือ') || lowerPrompt.includes('มีผัก') || lowerPrompt.includes('เมนู')) {
    return '🥬 วันนี้ฟาร์มเรามีผักสดพร้อมจัดส่งครับ! สามารถพิมพ์ "เมนูผัก" เพื่อเลือกชมและสั่งซื้อได้เลยครับ 🌱';
  }
  return '🌱 สวัสดีครับ ยินดีต้อนรับสู่ฟาร์มผักมาตรฐาน GAP ปลอดภัย คุณสามารถสั่งซื้อผักสดได้ง่ายๆ โดยพิมพ์รายการในแชทได้ทันที เช่น "สั่งกรีนโอ๊ค 2 แพ็ค" หรือพิมพ์ "เมนูผัก" เพื่อดูรายการผักสดทั้งหมดได้เลยครับ!';
}

// Helper: ดึงข้อมูลติดต่อเจ้าของฟาร์มและข้อมูลบัญชีจากฐานข้อมูลแบบ Dynamic
async function getOwnerContactInfo() {
  try {
    const [rows] = await pool.query(
      "SELECT farm_name, display_name, phone, promptpay_number, bank_name, bank_account_no, bank_account_name, line_user_id FROM users WHERE (role = 'owner' OR role = 'admin') ORDER BY id ASC LIMIT 1"
    );
    if (rows.length > 0) {
      const u = rows[0];
      const raw = u.phone || u.promptpay_number || '0990684331';
      const cleanDigits = String(raw).replace(/[^0-9]/g, '');
      const formatted = cleanDigits.length === 10
        ? `${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`
        : raw;
      return {
        farmName: u.farm_name || 'FarmGAP',
        displayName: u.display_name || 'เจ้าของฟาร์ม',
        phone: formatted,
        rawPhone: cleanDigits,
        bankName: u.bank_name || '',
        bankAccountNo: u.bank_account_no || '',
        bankAccountName: u.bank_account_name || u.display_name || '',
        promptpayNumber: u.promptpay_number || cleanDigits,
      };
    }
  } catch (err) {
    console.error('Error fetching owner contact info:', err.message);
  }
  return {
    farmName: 'FarmGAP',
    displayName: 'เจ้าของฟาร์ม',
    phone: '099-068-4331',
    rawPhone: '0990684331',
    bankName: '',
    bankAccountNo: '',
    bankAccountName: '',
    promptpayNumber: '0990684331',
  };
}

// 2. ดึงข้อมูลผักพร้อมขาย แปลงปลูก และข้อมูลติดต่อเจ้าของฟาร์ม เพื่อนำมาสร้างเป็น Context ใน AI Chatbot
async function getFarmContext() {
  try {
    const [products] = await pool.query(
      'SELECT name, price, unit, stock_quantity FROM products WHERE status = "available" AND stock_quantity > 0'
    );
    const [plots] = await pool.query(
      'SELECT name, crop_name, field_safety_status, status FROM plots WHERE status = "active"'
    );
    const owner = await getOwnerContactInfo();

    let context = 'คุณคือบอทผู้ช่วยตอบคำถามลูกค้าของฟาร์มผักสดอัจฉริยะ FarmGAP AI ที่เพาะปลูกตามมาตรฐาน GAP และผสานระบบ E-Commerce\n';
    context += `\n[ข้อมูลฟาร์ม]:\n`;
    context += `- ชื่อฟาร์ม: ${owner.farmName}\n`;
    context += `- ผู้ดูแล/เจ้าของฟาร์ม: คุณ${owner.displayName}\n`;

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
    
    context += '\n[คำสั่งพิเศษเรื่องการขอดูเมนู/รายการผัก]:\n';
    context += 'หากสิ่งที่ลูกค้าถามหรือต้องการคือการขอดูรายการผัก เมนูผัก หรือถามว่ามีเมนูอะไรบ้าง มีผักอะไรบ้าง หรือวันนี้มีอะไรขายบ้าง ให้ตอบเพียงคำว่า [SHOW_MENU_CARD] สั้นๆ เท่านั้น (ระบบจะส่งการ์ดเมนูผักสวยงามให้ลูกค้าโดยอัตโนมัติ)\n';

    context += '\n[กฎและนโยบายสำคัญในการตอบคำถามลูกค้า]:\n';
    context += '1. ตอบคำถามภาษาไทยอย่างสุภาพ มีหางเสียง "ครับ/ค่ะ" สั้นกระชับเข้าใจง่าย และให้ข้อมูลที่เป็นประโยชน์สูงสุด\n';
    context += `2. กฎเรื่องเบอร์ติดต่อเจ้าของฟาร์ม (สำคัญมาก): ให้ระบุเบอร์โทรศัพท์ ${owner.phone} (คุณ${owner.displayName} ฟาร์ม ${owner.farmName}) "เฉพาะ" ในกรณีที่ลูกค้าถามหาเบอร์ติดต่อ ขอเบอร์โทร ขอคุยกับเจ้าของฟาร์ม/แอดมิน หรือกรณีขอเงินคืนเท่านั้น! ห้ามใส่เบอร์ติดต่อหรือชวนโทรหาเจ้าของฟาร์มท้ายคำตอบทั่วไปโดยเด็ดขาด!\n`;
    context += `3. กฎเรื่องการขอเงินคืน (Refund): หากลูกค้าสอบถามว่า "ขอเงินคืนยังไง", "ขอเงินคืน", "โอนเงินแล้วขอยกเลิกออเดอร์" หรือทำนองเดียวกัน ให้ตอบอย่างสุภาพว่า ทางฟาร์มยินดีคืนเงินให้ตามยอดจริง โดยมีขั้นตอนง่ายๆ คือ:\n   - ส่งรูปภาพสลิปที่โอนเงินเข้ามาในแชทนี้\n   - พิมพ์แจ้งเลขบัญชีธนาคาร หรือเบอร์พร้อมเพย์ และชื่อบัญชีสำหรับรับเงินคืน\n   - ทางเจ้าของฟาร์มจะตรวจสอบและโอนเงินคืนให้โดยเร็ว หรือลูกค้าสามารถโทรแจ้งเจ้าของฟาร์มโดยตรงได้ที่เบอร์ ${owner.phone} (คุณ${owner.displayName})\n`;
    context += '4. อ้างอิงสต็อกผักสดและสถานะแปลงเพาะปลูกข้างต้นในการตอบให้สอดคล้องกันอย่างถูกต้อง\n';
    context += '5. แจ้งลูกค้าว่าสามารถสั่งซื้อผักสดได้โดยตรงในแชทนี้เลย (เช่น "สั่งกรีนโอ๊ค 2 แพ็ค") หรือพิมพ์ "เมนูผัก" เพื่อดูสินค้าทั้งหมด โดยฟาร์มรองรับทั้งการ "โอนเงิน/สแกน QR" และ "เก็บเงินปลายทาง (COD)"\n';
    context += '6. หากลูกค้าถามเรื่องสถานะพัสดุหรือออเดอร์ ให้แนะนำพิมพ์คำว่า "เช็คสถานะ" เพื่อตรวจสถานะออเดอร์ล่าสุด หรือพิมพ์ "ดูประวัติ" เพื่อดูประวัติการสั่งซื้อทั้งหมดในแชท\n';
    context += '7. ข้อห้ามเด็ดขาด: ห้ามแนบข้อความทำนองว่า "หากต้องการสอบถามข้อมูลเพิ่มเติม หรือติดต่อคุณ... โทรได้ที่เบอร์..." ท้ายคำตอบทั่วไปโดยเด็ดขาด!';
    
    return context;
  } catch (err) {
    console.error('Failed to build context:', err.message);
    return 'คุณคือผู้ช่วยแชทบอทของฟาร์มผัก FarmGAP AI มาตรฐาน GAP โปรดตอบกลับสั้นๆ อย่างมีไมตรีจิต';
  }
}

// Helper: แปลงคำบอกจำนวนและเลขไทยเป็นตัวเลขอารบิก
function normalizeThaiQuantity(str) {
  if (!str) return '';
  let s = str;
  // แปลงเลขไทย ๑-๙
  const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  thaiDigits.forEach((td, i) => {
    s = s.replaceAll(td, String(i));
  });

  // แปลงคำบอกจำนวนพิเศษ เช่น ครึ่งกิโล, ครึ่งถุง
  s = s.replace(/ครึ่ง\s*(?:กิโล|กีโล|กก|โล|ถุง|แพ็ค|แพค)/g, ' 0.5 โล ');
  s = s.replace(/(?:^|\s)ครึ่ง(?:\s|$)/g, ' 0.5 ');

  // แปลงคำบอกจำนวนภาษาไทยเดี่ยวๆ
  const wordToNum = [
    { words: ['สิบ'], val: '10' },
    { words: ['เก้า'], val: '9' },
    { words: ['แปด'], val: '8' },
    { words: ['เจ็ด'], val: '7' },
    { words: ['หก'], val: '6' },
    { words: ['ห้า'], val: '5' },
    { words: ['สี่'], val: '4' },
    { words: ['สาม'], val: '3' },
    { words: ['สอง', 'คู่'], val: '2' },
    { words: ['หนึ่ง', 'นึง'], val: '1' },
  ];

  for (const item of wordToNum) {
    for (const w of item.words) {
      s = s.replace(
        new RegExp(`(^|[^ก-๙a-zA-Z0-9])${w}(?:\\s*(?:กิโล|กีโล|กก|โล|แพ็ค|แพค|ถุง|ชิ้น|หัว|ชุด))?(?=[^ก-๙a-zA-Z0-9]|$)`, 'gi'),
        `$1 ${item.val} `
      );
    }
  }

  return s.replace(/\s+/g, ' ').trim();
}

// Helper: สกัดคีย์เวิร์ดชื่อผักทั้งไทย/อังกฤษ/คำย่อ/คำสะกดผิดสำหรับสินค้าทุกตัวในระบบ
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
    .replace(/ปลอดสาร|สด|gap|อินทรีย์|ซูเปอร์ฟู้ด|โฮมเมด|กรอบพรีเมียม|เนื้อนุ่ม|พรีเมียม|ถุงใส|ขีด/g, '')
    .trim();

  if (cleanThai) {
    keywords.push(cleanThai);
    if (cleanThai.startsWith('ผัก')) {
      const withoutPhak = cleanThai.replace(/^ผัก/, '').trim();
      if (withoutPhak.length >= 2) keywords.push(withoutPhak);
    }
  }

  // 3. คีย์เวิร์ดภาษาไทยและคำพ้องที่ผู้ใช้งานมักพิมพ์บ่อย (รวมคำเว้นวรรค, คำย่อ, และคำพิมพ์ผิด)
  if (lower.includes('บุ้ง') || lower.includes('morning glory') || lower.includes('spinach')) {
    keywords.push('ผักบุ้งจีนสด', 'ผักบุ้งจีน', 'ผัก บุ้ง จีน', 'ผักบุ้ง', 'ผัก บุ้ง', 'บุ้งจีน', 'บุ้ง', 'morning glory', 'water spinach');
  }
  if (lower.includes('กวางตุ้ง') || lower.includes('choy') || lower.includes('กวางตุง')) {
    keywords.push('ผักกวางตุ้งสด', 'ผักกวางตุ้ง', 'ผัก กวางตุ้ง', 'กวางตุ้ง', 'กวาง ตุ้ง', 'กวางตุง', 'กวางตุ้งฮ่องเต้', 'choy sum', 'bok choy');
  }
  if (lower.includes('กาดขาว') || lower.includes('cabbage')) {
    keywords.push('ผักกาดขาวสด', 'ผักกาดขาว', 'ผัก กาดขาว', 'กาดขาว', 'cabbage', 'chinese cabbage');
  }
  if (lower.includes('กาดหอม') || lower.includes('lettuce')) {
    keywords.push('ผักกาดหอมสด', 'ผักกาดหอม', 'ผัก กาดหอม', 'กาดหอม', 'lettuce');
  }
  if (lower.includes('ฟิล') || lower.includes('ฟิน') || lower.includes('frillice') || lower.includes('ไอซ์เบิร์ก')) {
    keywords.push('ผักฟิลเล่ย์', 'ผัก ฟิลเล่ย์', 'ฟิลเล่ย์', 'ฟิล เล่ย์', 'ฟินเล่ย์', 'ฟิน เล่ย์', 'ฟิลเลย์', 'ฟินเลย์', 'ฟิลเล', 'ไอซ์เบิร์ก', 'ไอซ์ เบิร์ก', 'ไอสเบิร์ก', 'ไอซ์เบิก', 'frillice');
  }
  if (lower.includes('กรีน') || lower.includes('green')) {
    keywords.push('ผักกรีนโอ๊คสด', 'ผักกรีนโอ๊ค', 'ผัก กรีนโอ๊ค', 'กรีนโอ๊คสด', 'กรีนโอ๊ค', 'กรีน โอ๊ค', 'กรีนโอค', 'กรีน โอค', 'กรีนโอ้ค', 'กรีน', 'ผักกรีน', 'green oak', 'greenoak');
  }
  if (lower.includes('เรด') || lower.includes('red')) {
    keywords.push('ผักเรดโอ๊คสด', 'ผักเรดโอ๊ค', 'ผัก เรดโอ๊ค', 'เรดโอ๊คสด', 'เรดโอ๊ค', 'เรด โอ๊ค', 'เรดโอค', 'เรด โอค', 'เรดโอ้ค', 'เรด', 'ผักเรด', 'red oak', 'redoak');
  }
  if (lower.includes('คอส') || lower.includes('cos') || lower.includes('โรเมน')) {
    keywords.push('ผักคอสสด', 'ผักคอส', 'ผัก คอส', 'คอสสด', 'คอส', 'กรีนคอส', 'เรดคอส', 'cos', 'โรเมน', 'romaine', 'คอสสลัด');
  }
  if (lower.includes('บัตเตอร์') || lower.includes('butter')) {
    keywords.push('ผักบัตเตอร์เฮดสด', 'ผักบัตเตอร์เฮด', 'ผัก บัตเตอร์เฮด', 'บัตเตอร์เฮด', 'บัตเตอร์ เฮด', 'บัตเตอร์', 'บัตเตอร์เฮต', 'butterhead');
  }
  if (lower.includes('เคล') || lower.includes('kale')) {
    keywords.push('ผักเคลสด', 'ผักเคล', 'ผัก เคล', 'เคล', 'kale', 'คะน้าใบหยิก');
  }
  if (lower.includes('น้ำสลัด') || lower.includes('sesame') || lower.includes('งาคั่ว')) {
    keywords.push('น้ำสลัด', 'งาคั่ว', 'น้ำสลัดงาคั่ว', 'dressing');
  }

  // เรียงลำดับจากคำที่ยาวที่สุดไปสั้นที่สุดเสมอ เพื่อให้จับคำที่จำเพาะเจาะจงก่อน
  return [...new Set(keywords.filter(k => k.length >= 2))].sort((a, b) => b.length - a.length);
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
  const buyKeywords = [
    'สั่ง', 'ซื้อ', 'เอา', 'รับ', 'จอง', 'order', 'ขอ', 'อยากได้', 'อยากสั่ง', 'ต้องการ',
    'จัด', 'ส่ง', 'จัดส่ง', 'เพิ่ม', 'สัก', 'ซัก', 'กิโล', 'กีโล', 'โล', 'แพ็ค', 'แพค',
    'ถุง', 'กก', 'กล่อง', 'ชุด', 'ขีด', 'มัด', 'ต้น', 'หัว'
  ];
  const hasBuyKeyword = buyKeywords.some(k => text.includes(k));

  const [products] = await pool.query(
    'SELECT id, name, price, unit, stock_quantity FROM products WHERE status = "available"'
  );

  if (products.length === 0) {
    return { isOrder: false };
  }

  // 1. ทำความสะอาดข้อความ: ลบลำดับข้อ 1., 2., [1], (1), -, • ออกจากต้นบรรทัด เพื่อป้องกันสับสนกับจำนวนสินค้า
  let cleanedText = text
    .split('\n')
    .map(line => line.replace(/^\s*(?:[0-9]+[.)\]\-:]|\-|\*|•)\s*/, '').trim())
    .filter(Boolean)
    .join('\n');

  // 2. แปลงคำบอกจำนวนภาษาไทย (เช่น สองถุง -> 2 ถุง, ครึ่งโล -> 0.5 โล) และเลขไทยเป็นเลขอารบิก
  const normalizedText = normalizeThaiQuantity(cleanedText);
  const lowerText = normalizedText.toLowerCase();

  // ตรวจสอบแพทเทิร์น "อย่างละ [ตัวเลข]" (เช่น "เอากรีนโอ๊ค เรดโอ๊ค คอส อย่างละ 2 ถุง")
  const eachMatch = lowerText.match(/อย่างละ\s*([0-9]+(?:\.[0-9]+)?)/);
  const defaultEachQty = eachMatch && parseFloat(eachMatch[1]) > 0 ? parseFloat(eachMatch[1]) : null;

  let matchedItems = [];
  const addedProductIds = new Set();

  // ฟังก์ชันย่อยช่วยสกัดจำนวนสินค้าจากข้อความรอบๆ ชื่อผัก
  const escapeRx = s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const extractQuantityForKeyword = (segment, kw) => {
    let qty = null;
    const escapedKw = escapeRx(kw);
    const regexPatterns = [
      new RegExp(`${escapedKw}[^0-9]{0,25}([0-9]+(?:\\.[0-9]+)?)`, 'i'),
      new RegExp(`([0-9]+(?:\\.[0-9]+)?)[^0-9]{0,25}${escapedKw}`, 'i'),
    ];

    for (const rx of regexPatterns) {
      const match = segment.match(rx);
      if (match && match[1]) {
        const parsed = parseFloat(match[1]);
        if (!isNaN(parsed) && parsed > 0) {
          qty = parsed;
          break;
        }
      }
    }

    if (!qty) {
      const unitMatch = segment.match(new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s*(?:กิโล|กีโล|กก|ก\\.ก\\.|โล|แพ็ค|แพค|ถุง|ชิ้น|หัว|ชุด)[^0-9]*${escapedKw}`, 'i')) ||
                        segment.match(new RegExp(`${escapedKw}[^0-9]*([0-9]+(?:\\.[0-9]+)?)\\s*(?:กิโล|กีโล|กก|ก\\.ก\\.|โล|แพ็ค|แพค|ถุง|ชิ้น|หัว|ชุด)`, 'i'));
      if (unitMatch && unitMatch[1]) {
        qty = parseFloat(unitMatch[1]);
      }
    }

    return qty;
  };

  // 3. วิเคราะห์แบบแบ่ง Segment (แบ่งตามบรรทัด, จุลภาค, หรือคำเชื่อม "และ", "กับ", "แล้วก็", "+")
  const segments = lowerText.split(/[\n,+]|\s+และ\s+|\s+กับ\s+|\s+แล้วก็\s+/).map(s => s.trim()).filter(Boolean);

  for (const segment of segments) {
    for (const product of products) {
      if (addedProductIds.has(product.id)) continue;
      const keywords = getProductKeywords(product.name);
      const matchedKw = keywords.find(kw => segment.includes(kw));

      if (matchedKw) {
        let qty = extractQuantityForKeyword(segment, matchedKw);
        if (!qty && defaultEachQty) qty = defaultEachQty;
        if (!qty) qty = 1;

        matchedItems.push({
          product_id: product.id,
          name: product.name,
          price: Number(product.price),
          unit: product.unit || 'กก.',
          quantity: qty,
          stock_quantity: Number(product.stock_quantity),
          subtotal: Number(product.price) * qty,
        });
        addedProductIds.add(product.id);
      }
    }
  }

  // 4. ถ้ายังไม่พบจากการแบ่ง Segment ให้ลองค้นหาทั่วทั้งประโยค
  if (matchedItems.length === 0) {
    for (const product of products) {
      if (addedProductIds.has(product.id)) continue;
      const keywords = getProductKeywords(product.name);
      const matchedKw = keywords.find(kw => lowerText.includes(kw));

      if (matchedKw) {
        let qty = extractQuantityForKeyword(lowerText, matchedKw);
        if (!qty && defaultEachQty) qty = defaultEachQty;
        if (!qty) qty = 1;

        matchedItems.push({
          product_id: product.id,
          name: product.name,
          price: Number(product.price),
          unit: product.unit || 'กก.',
          quantity: qty,
          stock_quantity: Number(product.stock_quantity),
          subtotal: Number(product.price) * qty,
        });
        addedProductIds.add(product.id);
      }
    }
  }

  // กรณีสั่งผักรายการเดียว และในประโยคมีตัวเลขโดดๆ (เช่น "ขอสั่งผักกาดขาว 10")
  if (matchedItems.length === 1 && matchedItems[0].quantity === 1) {
    const singleDigitMatch = lowerText.match(/\b([1-9][0-9]*)\b/);
    if (singleDigitMatch && singleDigitMatch[1]) {
      const parsedNum = parseInt(singleDigitMatch[1], 10);
      if (parsedNum > 0 && parsedNum <= 100) {
        matchedItems[0].quantity = parsedNum;
        matchedItems[0].subtotal = matchedItems[0].price * matchedItems[0].quantity;
      }
    }
  }

  // 5. หาก Local Matching ของระบบยังสกัดไม่เจอ แต่ผู้ใช้มีเจตนาซื้อผัก จึงค่อยส่งต่อให้ Gemini AI ช่วยเป็น Fallback
  if (matchedItems.length === 0 && hasBuyKeyword) {
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

  if (matchedItems.length === 0) {
    return { isOrder: false };
  }

  if (!hasBuyKeyword && !lowerText.match(/\d+/)) {
    return { isOrder: false };
  }

  // ตรวจสอบสต็อกสินค้า
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

// 5. Flex Message: ใบแจ้งหนี้และช่องทางโอนเงิน (Invoice & Payment)
async function replyInvoiceAndPayment(replyToken, orderCode, totalAmount, items, addressText) {
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

// Reply single order status (Latest order only)
async function replyOrderStatus(replyToken, userId) {
  try {
    const [customers] = await pool.query('SELECT id FROM customers WHERE line_user_id = ?', [userId]);
    
    if (customers.length === 0) {
      return client.replyMessage({
        replyToken: replyToken,
        messages: [{ type: 'text', text: 'ไม่พบประวัติการสั่งซื้อของคุณในระบบ สามารถเริ่มสั่งซื้อครั้งแรกผ่านแชทนี้ได้เลยครับ 🌱' }]
      });
    }

    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 1',
      [customers[0].id]
    );

    if (orders.length === 0) {
      return client.replyMessage({
        replyToken: replyToken,
        messages: [{ type: 'text', text: 'คุณยังไม่มีรายการสั่งซื้อใดๆ ในระบบขณะนี้ครับ พิมพ์สั่งซื้อได้เลยนะครับ 🌱' }]
      });
    }

    const order = orders[0];
    const isCod = order.payment_method?.toLowerCase() === 'cod';
    const statusLower = (order.status || '').toLowerCase();
    const statusMap = {
      pending: isCod ? { label: 'เตรียมจัดส่ง (เก็บเงินปลายทาง 💵)', color: '#059669' } : { label: 'รอตรวจสอบ/รอแนบสลิป ⏳', color: '#d97706' },
      paid: { label: 'ชำระแล้ว (เตรียมเก็บเกี่ยว/จัดส่ง) 💳', color: '#2563eb' },
      shipping: { label: 'กำลังจัดส่ง 🚚', color: '#7c3aed' },
      completed: { label: 'จัดส่งสำเร็จเรียบร้อย ✅', color: '#16a34a' },
      cancelled: { label: 'ยกเลิกออเดอร์ ❌', color: '#dc2626' },
    };
    const currentStatus = statusMap[statusLower] || { label: order.status, color: '#333333' };
    const localDate = new Date(order.created_at).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // ดึงรายการสินค้าของออเดอร์ล่าสุดนี้
    const [items] = await pool.query(
      `SELECT oi.quantity, oi.unit_price, oi.subtotal, p.name AS product_name, p.unit 
       FROM order_items oi 
       JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = ?`,
      [order.id]
    );

    const itemRows = items.map(item => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `🌱 ${item.product_name} x ${item.quantity} ${item.unit || 'กก.'}`,
          size: 'xs',
          color: '#374151',
          flex: 7,
          wrap: true,
        },
        {
          type: 'text',
          text: `฿${item.subtotal.toLocaleString()}`,
          size: 'xs',
          color: '#111827',
          align: 'end',
          flex: 3,
        },
      ],
    }));

    const bodyContents = [
      {
        type: 'text',
        text: '📋 สถานะออเดอร์ล่าสุดของคุณ',
        weight: 'bold',
        size: 'md',
        color: '#173f2a',
      },
      {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#f8fafc',
        cornerRadius: 'md',
        paddingAll: 'md',
        spacing: 'xs',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'เลขที่คำสั่งซื้อ',
                size: 'xs',
                color: '#6b7280',
                flex: 4,
              },
              {
                type: 'text',
                text: order.order_code,
                size: 'xs',
                weight: 'bold',
                color: '#111827',
                align: 'end',
                flex: 6,
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'วันที่สั่งซื้อ',
                size: 'xs',
                color: '#6b7280',
                flex: 4,
              },
              {
                type: 'text',
                text: localDate,
                size: 'xs',
                color: '#4b5563',
                align: 'end',
                flex: 6,
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'การชำระเงิน',
                size: 'xs',
                color: '#6b7280',
                flex: 4,
              },
              {
                type: 'text',
                text: isCod ? 'เก็บเงินปลายทาง (COD) 💵' : 'โอนเงิน / สแกน QR 💳',
                size: 'xs',
                weight: 'bold',
                color: isCod ? '#059669' : '#2563eb',
                align: 'end',
                flex: 6,
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'สถานะปัจจุบัน',
                size: 'xs',
                color: '#6b7280',
                flex: 4,
              },
              {
                type: 'text',
                text: currentStatus.label,
                size: 'xs',
                weight: 'bold',
                color: currentStatus.color,
                align: 'end',
                flex: 6,
                wrap: true,
              },
            ],
          },
        ],
      },
    ];

    if (itemRows.length > 0) {
      bodyContents.push({
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        margin: 'md',
        contents: [
          {
            type: 'text',
            text: 'รายการสินค้า:',
            size: 'xs',
            weight: 'bold',
            color: '#4b5563',
          },
          ...itemRows,
        ],
      });
    }

    bodyContents.push(
      {
        type: 'separator',
        margin: 'md',
      },
      {
        type: 'box',
        layout: 'horizontal',
        margin: 'md',
        contents: [
          {
            type: 'text',
            text: 'ยอดรวมทั้งสิ้น',
            weight: 'bold',
            size: 'sm',
            color: '#111827',
          },
          {
            type: 'text',
            text: `฿${order.total_amount.toLocaleString()} บาท`,
            weight: 'bold',
            size: 'sm',
            color: '#16a34a',
            align: 'end',
          },
        ],
      }
    );

    if (order.tracking_number) {
      bodyContents.push({
        type: 'text',
        text: `🚚 ข้อมูลจัดส่ง: ${order.tracking_number} (${order.delivery_type || 'จัดส่งพัสดุ'})`,
        size: 'xs',
        color: '#2563eb',
        margin: 'sm',
      });
    }

    const flexStatus = {
      type: 'flex',
      altText: `สถานะออเดอร์ ${order.order_code}: ${currentStatus.label}`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: bodyContents,
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
                label: '📜 ดูประวัติการสั่งซื้อ',
                text: 'ดูประวัติ',
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
      messages: [flexStatus],
    });
  } catch (err) {
    console.error('Failed to reply order status:', err.message);
    try {
      await client.replyMessage({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: 'ขออภัยครับ เกิดข้อผิดพลาดชั่วคราวในการดึงข้อมูลสถานะออเดอร์ กรุณาลองกดใหม่อีกครั้ง หรือพิมพ์สอบถามเจ้าของฟาร์มได้เลยครับ 🌱',
          },
        ],
      });
    } catch (_) {}
  }
}

// Reply order history (Multi-orders directly in LINE chat)
async function replyOrderHistory(replyToken, userId) {
  try {
    const [customers] = await pool.query('SELECT id FROM customers WHERE line_user_id = ?', [userId]);
    
    if (customers.length === 0) {
      return client.replyMessage({
        replyToken: replyToken,
        messages: [{ type: 'text', text: 'ไม่พบประวัติการสั่งซื้อของคุณในระบบ สามารถเริ่มสั่งซื้อครั้งแรกผ่านแชทนี้ได้เลยครับ 🌱' }]
      });
    }

    const [orders] = await pool.query(
      'SELECT id, order_code, total_amount, status, payment_method, created_at FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 10',
      [customers[0].id]
    );

    if (orders.length === 0) {
      return client.replyMessage({
        replyToken: replyToken,
        messages: [{ type: 'text', text: 'คุณยังไม่มีประวัติรายการสั่งซื้อในระบบขณะนี้ครับ พิมพ์ "สั่งซื้อ" ได้เลยนะครับ 🌱' }]
      });
    }

    // ดึง items ของทุก order เพื่อแสดงสรุปสินค้าสั้นๆ
    const orderIds = orders.map(o => o.id);
    const [items] = await pool.query(
      `SELECT oi.order_id, oi.quantity, p.name AS product_name, p.unit 
       FROM order_items oi 
       JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id IN (?)`,
      [orderIds]
    );

    const itemsByOrder = {};
    items.forEach(it => {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push(`${it.product_name} (${it.quantity}${it.unit || ''})`);
    });

    const statusMap = {
      pending: { label: 'รอตรวจสอบ/รอสลิป', color: '#d97706' },
      paid: { label: 'ชำระแล้ว', color: '#2563eb' },
      shipping: { label: 'กำลังจัดส่ง 🚚', color: '#7c3aed' },
      completed: { label: 'จัดส่งสำเร็จ ✅', color: '#16a34a' },
      cancelled: { label: 'ยกเลิก', color: '#dc2626' },
    };

    const orderBoxes = [];
    orders.forEach((o, index) => {
      const isCodOrder = o.payment_method === 'cod';
      const st = (isCodOrder && o.status === 'pending')
        ? { label: 'เตรียมส่ง (COD 💵)', color: '#059669' }
        : (statusMap[o.status] || { label: o.status, color: '#4b5563' });
      const localDate = new Date(o.created_at).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const itemSummary = (itemsByOrder[o.id] && itemsByOrder[o.id].length > 0)
        ? itemsByOrder[o.id].join(', ')
        : null;

      const orderBox = {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `📦 ${o.order_code}`,
                weight: 'bold',
                size: 'sm',
                color: '#1e293b',
                flex: 6,
              },
              {
                type: 'text',
                text: `฿${o.total_amount.toLocaleString()}`,
                weight: 'bold',
                size: 'sm',
                color: '#16a34a',
                align: 'end',
                flex: 4,
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `📅 ${localDate}`,
                size: 'xxs',
                color: '#64748b',
                flex: 5,
              },
              {
                type: 'text',
                text: st.label,
                size: 'xs',
                weight: 'bold',
                color: st.color,
                align: 'end',
                flex: 5,
              },
            ],
          },
        ],
      };

      if (itemSummary) {
        orderBox.contents.push({
          type: 'text',
          text: `🌱 ${itemSummary}`,
          size: 'xxs',
          color: '#475569',
          wrap: true,
        });
      }

      orderBoxes.push(orderBox);

      if (index < orders.length - 1) {
        orderBoxes.push({
          type: 'separator',
          margin: 'sm',
        });
      }
    });

    const flexHistory = {
      type: 'flex',
      altText: `ประวัติการสั่งซื้อของคุณ (${orders.length} รายการ)`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'none',
              contents: [
                {
                  type: 'text',
                  text: '📜 ประวัติการสั่งซื้อของคุณ',
                  weight: 'bold',
                  size: 'md',
                  color: '#173f2a',
                },
                {
                  type: 'text',
                  text: `แสดงรายการล่าสุด ${orders.length} รายการ`,
                  size: 'xxs',
                  color: '#94a3b8',
                },
              ],
            },
            {
              type: 'separator',
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: orderBoxes,
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
                label: '🌱 สั่งซื้อผักสดเพิ่ม',
                text: 'สั่งซื้อ',
              },
              style: 'primary',
              color: '#2e7d32',
              height: 'sm',
            },
            {
              type: 'button',
              action: {
                type: 'message',
                label: '🔍 เช็คสถานะออเดอร์ล่าสุด',
                text: 'เช็คสถานะ',
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
      messages: [flexHistory],
    });
  } catch (err) {
    console.error('Failed to reply order history:', err.message);
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

    // 2. ดึงข้อมูลออเดอร์ ข้อมูลลูกค้า และรายการสินค้าล่าสุดจากฐานข้อมูลจริง (ถ้ามี orderData.id)
    let resolvedOrder = { ...orderData };
    if (orderData.id) {
      try {
        const [oRows] = await pool.query(`
          SELECT o.*, c.display_name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
          FROM orders o
          LEFT JOIN customers c ON o.customer_id = c.id
          WHERE o.id = ?
        `, [orderData.id]);
        if (oRows.length > 0) {
          const [itRows] = await pool.query(`
            SELECT oi.*, p.name AS product_name, p.unit
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
          `, [orderData.id]);
          resolvedOrder = {
            ...oRows[0],
            ...orderData,
            customer_name: orderData.customer_name || oRows[0].customer_name,
            customer_phone: orderData.customer_phone || oRows[0].customer_phone,
            customer_address: orderData.customer_address || oRows[0].customer_address,
            items: (itRows.length > 0 ? itRows : (orderData.items || [])),
          };
        }
      } catch (dbErr) {
        console.warn('⚠️ Could not refresh order details from DB for admin notify:', dbErr.message);
      }
    }

    const isCompleted = eventType === 'ORDER_COMPLETED' || eventType === 'SLIP_UPLOADED';
    const isSlip = eventType === 'SLIP_UPLOADED' || Boolean(resolvedOrder.slip_image_url);
    const title = isSlip ? '💸 ลูกค้าแจ้งชำระเงินแนบสลิปแล้ว!' : (isCompleted ? '🎉 ลูกค้าสั่งซื้อสำเร็จแล้ว!' : '🔔 มีคำสั่งซื้อใหม่เข้ามา!');
    const badgeText = isSlip ? 'แนบสลิปแล้ว' : (isCompleted ? 'สั่งซื้อสำเร็จ' : 'ออเดอร์ใหม่');
    const badgeBg = isSlip ? '#0284c7' : (isCompleted ? '#15803d' : '#0369a1');
    const headerBg = isSlip ? '#075985' : (isCompleted ? '#14532d' : '#0f172a');

    const orderCode = resolvedOrder.order_code || `ORD-${resolvedOrder.id || ''}`;
    const totalAmount = Number(resolvedOrder.total_amount || 0).toLocaleString();
    const customerName = resolvedOrder.customer_name || 'ลูกค้าทั่วไป';
    const customerPhone = resolvedOrder.customer_phone || '-';
    const customerAddress = resolvedOrder.customer_address || '-';

    // เตรียมรายการสินค้า (ถ้ามี)
    const items = resolvedOrder.items || [];
    const itemRows = items.slice(0, 5).map(item => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `• ${item.product_name || item.name || 'ผักสด'} x${Number(item.quantity) || 1} ${item.unit || 'ถุง'}`,
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
    const printUri = resolvedOrder.id ? `${frontendBase}/orders/${resolvedOrder.id}/print` : actionUri;

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
              {
                type: 'text',
                text: `การชำระเงิน: ${resolvedOrder.payment_method === 'cod' ? 'เก็บเงินปลายทาง (COD) 💵' : 'โอนเงินผ่านธนาคาร 💳'}`,
                size: 'xs',
                color: resolvedOrder.payment_method === 'cod' ? '#059669' : '#2563eb',
                weight: 'bold',
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
          ...(isCompleted
            ? [
                {
                  type: 'separator',
                  margin: 'md',
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
                      text: resolvedOrder.payment_method === 'cod'
                        ? '💵 ลูกค้าเลือกชำระเงินปลายทาง (COD) จัดเตรียมสินค้าและเก็บเงินสดเมื่อส่งมอบครับ'
                        : (resolvedOrder.slip_image_url
                          ? '✅ ลูกค้าแนบสลิปชำระเงินเรียบร้อยแล้ว สามารถตรวจสอบและจัดส่งผักสดได้ทันทีครับ'
                          : '✅ ลูกค้าสั่งซื้อสำเร็จเรียบร้อยแล้ว พร้อมให้ฟาร์มจัดเตรียมผักสดครับ'),
                      size: 'xs',
                      color: '#166534',
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

// Helper: ตรวจสอบว่าข้อความมีลักษณะเป็นที่อยู่จัดส่งจริงหรือไม่ (รองรับภาษาพูด ชื่อตำบล/อำเภอ/จังหวัด และรหัสไปรษณีย์)
function isLikelyAddress(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  if (s.length < 3) return false;
  // ถ้าเป็นเบอร์โทรศัพท์ล้วน ไม่ใช่ที่อยู่
  if (/^0[0-9]{8,9}$/.test(s.replace(/[- ]/g, ''))) return false;

  // คำทักทาย หรือยกเลิก ไม่ใช่ที่อยู่
  const nonAddressWords = ['สวัสดี', 'ดีครับ', 'ดีค่ะ', 'ยกเลิก', 'ไม่เอา', 'สั่งซื้อ', 'ขอดูเมนู', 'เมนูผัก'];
  if (nonAddressWords.some(w => s === w || s.startsWith(w + ' '))) return false;

  const patterns = [
    /\b[1-9][0-9]{3,4}\b/, // รหัสไปรษณีย์ 4-5 หลัก (รองรับพิมพ์ตก 4 หลัก เช่น 9700, 94000)
    /(?:ต\.|ตำบล|แขวง)/,
    /(?:อ\.|อำเภอ|เขต)/,
    /(?:จ\.|จังหวัด)/,
    /(?:ม\.|หมู่|หมู่ที่|มบ\.|หมู่บ้าน)/,
    /(?:ซ\.|ซอย)/,
    /(?:ถ\.|ถนน)/,
    /(?:บ้านเลขที่|ห้องเลขที่|ชั้น|ห้อง|ตึก|อาคาร|คอนโด|หอพัก|หอ|มหาลัย|มหาวิทยาลัย|โรงพยาบาล|รพ\.|เทศบาล|อบต\.)/,
    /\b[0-9]{1,4}\/[0-9]{1,4}\b/, // เช่น 122/16, 57/4
    /(?:ที่อยู่|ส่งที่|จัดส่งที่|ส่งมาที่|สถานที่ส่ง)/,
    // รายชื่อจังหวัดและสถานที่สำคัญในไทยที่พบบ่อย
    /(?:กรุงเทพ|กทม|นนทบุรี|ปทุมธานี|สมุทรปราการ|สมุทรสาคร|นครปฐม|อยุธยา|สระบุรี|ชลบุรี|ระยอง|จันทบุรี|เชียงใหม่|เชียงราย|ลำปาง|ลำพูน|น่าน|พิษณุโลก|สุโขทัย|ขอนแก่น|โคราช|นครราชสีมา|อุดรธานี|อุบลราชธานี|บุรีรัมย์|สุรินทร์|ภูเก็ต|สงขลา|สุราษฎร์ธานี|กระบี่|พังงา|ตรัง|พัทลุง|สตูล|ยะลา|ปัตตานี|นราธิวาส|กาญจนบุรี|ราชบุรี|เพชรบุรี|ประจวบ|หัวหิน|หาดใหญ่|พัทยา|เบตง|หนองจิก|เกาะเปาะ|ตือเบาะ|รูสะมิแล|แม่โจ้)/i,
  ];

  if (patterns.some(p => p.test(s))) return true;

  // หากข้อความมีความยาวพอสมควร (>= 8 ตัวอักษร) มีตัวเลข และมีเว้นวรรค ให้ถือเป็นที่อยู่
  if (s.length >= 8 && /[0-9]/.test(s) && /\s/.test(s)) {
    return true;
  }

  return false;
}

// Helper: สกัดชื่อผู้รับ เบอร์โทรศัพท์ และที่อยู่จัดส่ง จากข้อความที่ผู้ใช้พิมพ์ (Rule-based Regex & Structured Heuristics)
function parseCustomerContact(text) {
  if (!text) return { name: null, phone: null, address: null };

  let name = null;
  let phone = null;
  let address = null;

  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. ตรวจสอบกรณีลูกค้าส่งเป็นลำดับบรรทัด (Multi-line Structured Text เช่น 1.ชื่อ บอส \n 2.เบอร์ 095... \n 3.ตือเบาะ...)
  if (rawLines.length >= 2) {
    const remainingLines = [];

    for (const line of rawLines) {
      // 1.1 สกัดเบอร์โทรจากบรรทัด
      const pMatch = line.match(/(?:^|[^\d])(0[689][0-9]{8}|0[2-57][0-9]{7})(?:[^\d]|$)/) ||
                     line.match(/(?:^|[^\d])(0[0-9]{1,2}[- ]?[0-9]{3,4}[- ]?[0-9]{3,4})(?:[^\d]|$)/);
      if (pMatch && pMatch[1]) {
        const cleaned = pMatch[1].replace(/[- ]/g, '');
        if (cleaned.length >= 9 && cleaned.length <= 10 && cleaned.startsWith('0')) {
          if (!phone) phone = cleaned;
          continue; // บรรทัดนี้คือบรรทัดเบอร์โทร
        }
      }

      // 1.2 สกัดชื่อผู้รับจากบรรทัดที่มีคีย์เวิร์ดชื่อ เช่น "1.ชื่อ บอส", "ชื่อ: บอส", "คุณ บอส", "ผู้รับ บอส"
      const nameMatch = line.match(/^(?:[0-9]+[.)\]\-:]|\-|\*|•)?\s*(?:ชื่อ(?:ผู้รับ)?|คุณ|ผู้รับ)\s*[:\-]?\s*([ก-๙a-zA-Z\s]+)/i);
      if (nameMatch && nameMatch[1]) {
        const extracted = nameMatch[1].replace(/(?:เบอร์|โทร|tel|ที่อยู่|ส่งที่|บ้านเลขที่)[\s\S]*/i, '').trim();
        if (extracted && extracted.length >= 2 && !['ลูกค้า', 'ทั่วไป', 'ผู้รับ'].includes(extracted)) {
          if (!name) name = extracted;
          continue;
        }
      }

      // 1.3 สกัดที่อยู่จากบรรทัดที่มีคีย์เวิร์ดที่อยู่ เช่น "3.ที่อยู่ 57/4...", "ส่งที่: ..."
      const addrMatch = line.match(/^(?:[0-9]+[.)\]\-:]|\-|\*|•)?\s*(?:ที่อยู่(?:จัดส่ง)?|ส่งที่|จัดส่ง(?:ที่)?|บ้านเลขที่|สถานที่ส่ง)\s*[:\-]?\s*([\s\S]+)/i);
      if (addrMatch && addrMatch[1]) {
        const extracted = addrMatch[1].trim();
        if (extracted) {
          if (!address) address = extracted;
          continue;
        }
      }

      // บรรทัดอื่นๆ ที่ยังไม่ได้จำแนก
      remainingLines.push(line);
    }

    // 1.4 ถ้ามีบรรทัดที่เหลือและยังขาดที่อยู่ หรือชื่อ ให้ตรวจสอบ
    for (const remLine of remainingLines) {
      // ตัดเลขลำดับต้นบรรทัด เช่น "3.ตือเบาะ บอส 9700" -> "ตือเบาะ บอส 9700"
      const stripped = remLine.replace(/^(?:[0-9]+[.)\]\-:]|\-|\*|•)\s*/, '').trim();

      if (!address && isLikelyAddress(stripped)) {
        address = stripped;
      } else if (!name && /^[ก-๙a-zA-Z\s]{2,25}$/.test(stripped) && !isLikelyAddress(stripped)) {
        name = stripped;
      } else if (!address && phone && stripped.length >= 5) {
        // หากได้เบอร์โทรแล้ว บรรทัดที่เหลือที่ยาวพอให้ถือเป็นที่อยู่
        address = stripped;
      }
    }
  }

  // 2. ถ้ายังสกัดไม่ครบจากแบบบรรทัด ให้ใช้ Inline Regex ทั้งข้อความ
  if (!phone) {
    const phoneMatch = text.match(/(?:^|[^\d])(0[689][0-9]{8}|0[2-57][0-9]{7})(?:[^\d]|$)/);
    if (phoneMatch && phoneMatch[1]) {
      phone = phoneMatch[1].replace(/[- ]/g, '');
    } else {
      const formattedMatch = text.match(/(?:^|[^\d])(0[0-9]{1,2}[- ]?[0-9]{3,4}[- ]?[0-9]{3,4})(?:[^\d]|$)/);
      if (formattedMatch && formattedMatch[1]) {
        const cleaned = formattedMatch[1].replace(/[- ]/g, '');
        if (cleaned.length >= 9 && cleaned.length <= 10 && cleaned.startsWith('0')) {
          phone = cleaned;
        }
      }
    }
  }

  // 2.1 สกัดชื่อผู้รับแบบระบุคำนำหน้า (เช่น "1.ชื่อ บอส", "ชื่อ: สมชาย")
  if (!name) {
    const explicitNameMatch = text.match(/(?:[0-9]+[.)\]\-:]|\-|\*|•)?\s*(?:ชื่อ(?:ผู้รับ)?|คุณ|ผู้รับ)\s*[:\-]?\s*([ก-๙a-zA-Z\s]+?)(?=(?:เบอร์|โทร|tel|ที่อยู่|ส่งที่|บ้านเลขที่|\d{9,10}|$|\n))/i);
    if (explicitNameMatch && explicitNameMatch[1]) {
      const candidate = explicitNameMatch[1].trim();
      if (candidate.length >= 2) name = candidate;
    }
  }

  // 2.2 สกัดชื่อกรณีขึ้นต้นข้อความ เช่น "สมใจ มีสุข 0812345678 ที่อยู่ 122/16..."
  if (!name) {
    const beforeMatch = text.match(/^([ก-๙a-zA-Z]{2,20}(?:\s+[ก-๙a-zA-Z]{2,20})?)\s+(?:0[689]|\d+\/\d+|ที่อยู่|บ้านเลขที่)/);
    if (beforeMatch && beforeMatch[1]) {
      const candidate = beforeMatch[1].trim();
      const forbidden = ['ที่อยู่', 'ส่งที่', 'จัดส่ง', 'ขอสั่ง', 'สั่งซื้อ', 'โอนแล้ว', 'ยอดรวม', 'ลูกค้า'];
      if (!forbidden.includes(candidate)) {
        name = candidate;
      }
    }
  }

  // 2.3 สกัดที่อยู่จัดส่งแบบระบุคีย์เวิร์ดชัดเจน
  if (!address) {
    const explicitAddrMatch = text.match(/(?:ที่อยู่(?:จัดส่ง)?|ส่งที่|จัดส่ง(?:ที่)?|บ้านเลขที่|สถานที่ส่ง)\s*[:\-]?\s*([\s\S]+?)(?=(?:เบอร์|โทร|tel|ชื่อ|$))/i);
    if (explicitAddrMatch && explicitAddrMatch[1]) {
      const rawAddr = explicitAddrMatch[1].trim();
      if (isLikelyAddress(rawAddr)) {
        address = rawAddr;
      }
    }
  }

  // 2.4 หากยังไม่ได้ที่อยู่ ให้ลบเบอร์โทร และชื่อ ออกจากข้อความ แล้วเช็คว่าส่วนที่เหลือคือที่อยู่หรือไม่
  if (!address) {
    let remainder = text;
    if (phone) {
      remainder = remainder.replace(/(?:^|[^\d])(0[0-9]{1,2}[- ]?[0-9]{3,4}[- ]?[0-9]{3,4})(?:[^\d]|$)/, ' ');
    }
    if (name) {
      remainder = remainder.replace(name, ' ');
    }
    remainder = remainder.replace(/(?:[0-9]+[.)\]\-:]|\-|\*|•)?\s*(?:ชื่อผู้รับ|ชื่อ|เบอร์โทร|เบอร์|โทร|tel|ที่อยู่จัดส่ง|ที่อยู่|ส่งที่|สถานที่ส่ง)\s*[:\-]?/gi, ' ');
    remainder = remainder.replace(/\s+/g, ' ').trim();

    if (isLikelyAddress(remainder)) {
      address = remainder;
    } else if (phone && remainder.length >= 6 && !remainder.match(/^(?:สั่ง|ซื้อ|เอา|รับ|ขอ|ยกเลิก|สวัสดี|ดีครับ)/)) {
      // เมื่อมีเบอร์โทรแล้ว และข้อความที่เหลือมีความยาวพอสมควร ไม่ใช่คำทักทายหรือคำสั่งซื้อ ให้จัดเป็นที่อยู่
      address = remainder;
    }
  }

  return {
    name: name || null,
    phone: phone || null,
    address: address || null,
  };
}

// AI Helper: ใช้ Gemini ช่วยสกัด ชื่อ เบอร์โทร และที่อยู่จัดส่งจากข้อความลูกค้า
async function extractContactInfoWithGemini(userText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'dummy_key') return null;

  const prompt = `คุณคือผู้ช่วยสกัดข้อมูลติดต่อและที่อยู่จัดส่งสำหรับร้านค้าเกษตร FarmGAP
ข้อความที่ลูกค้าพิมพ์ส่งมา:
"${userText}"

หน้าที่ของคุณ:
สกัดข้อมูลติดต่อและที่อยู่ออกมา หากข้อมูลใดไม่มีในข้อความ ให้ใส่เป็น null
ตอบเฉพาะ JSON โครงสร้างนี้เท่านั้น ห้ามใส่ markdown code block หรือคำอธิบายอื่น:
{
  "name": "ชื่อ-นามสกุล หรือชื่อเล่นของผู้รับ หรือ null หากไม่มี",
  "phone": "เบอร์โทรศัพท์ 9-10 หลัก (เฉพาะตัวเลข เช่น 0812345678) หรือ null หากไม่มี",
  "address": "ที่อยู่จัดส่ง เลขที่ หมู่บ้าน ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์ หรือ null หากไม่มี"
}`;

  try {
    const raw = await askGemini(prompt, "ตอบเฉพาะ JSON ตามโครงสร้างที่กำหนดเท่านั้น");
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        name: parsed.name && parsed.name !== 'null' && !String(parsed.name).includes('null') ? String(parsed.name).trim() : null,
        phone: parsed.phone && parsed.phone !== 'null' ? String(parsed.phone).replace(/[^0-9]/g, '') : null,
        address: parsed.address && parsed.address !== 'null' && !String(parsed.address).includes('null') ? String(parsed.address).trim() : null,
      };
    }
  } catch (err) {
    console.warn('Gemini contact extraction error:', err.message);
  }
  return null;
}

// Smart extractor: ใช้ Regex + Gemini AI
async function parseSmartCustomerContact(text) {
  const regexResult = parseCustomerContact(text);

  // หากได้ทั้ง phone และ address ครบแล้ว ไม่ต้องเสียเวลาเรียก AI
  if (regexResult.phone && regexResult.address) {
    return regexResult;
  }

  // ป้องกันการเรียก Gemini โดยไม่จำเป็น: หากข้อความไม่มีลักษณะของเบอร์โทร หรือที่อยู่เลย ให้คืนค่าตาม Regex ทันที
  const hasPhone = /(?:^|[^\d])(0[689][0-9]{8}|0[2-57][0-9]{7})(?:[^\d]|$)/.test(text) ||
                   /(?:^|[^\d])(0[0-9]{1,2}[- ]?[0-9]{3,4}[- ]?[0-9]{3,4})(?:[^\d]|$)/.test(text);
  const hasAddr = isLikelyAddress(text);
  const hasContactKeyword = /(?:ชื่อ|คุณ|ผู้รับ|เบอร์|โทร|tel|ที่อยู่|ส่งที่|จัดส่ง|บ้านเลขที่)/i.test(text);

  if (!hasPhone && !hasAddr && !hasContactKeyword) {
    return regexResult;
  }

  // หากมีสัญญาณของข้อมูลจัดส่ง แต่ Regex สกัดได้ไม่ครบ ให้ Gemini AI ช่วยวิเคราะห์ข้อความธรรมชาติ
  try {
    const aiResult = await extractContactInfoWithGemini(text);
    if (aiResult) {
      return {
        name: regexResult.name || aiResult.name || null,
        phone: regexResult.phone || aiResult.phone || null,
        address: regexResult.address || (isLikelyAddress(aiResult.address) ? aiResult.address : null),
      };
    }
  } catch (err) {
    console.warn('Smart contact extraction error:', err.message);
  }

  return regexResult;
}

// AI Helper: ใช้ Gemini ช่วยวิเคราะห์เจตนาเลือกช่องทางชำระเงินจากภาษาพูด
async function detectPaymentMethodWithGemini(userText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'dummy_key') return null;

  const prompt = `ผู้ใช้กำลังอยู่ในขั้นตอนเลือกวิธีชำระเงินของร้านค้าฟาร์มผัก FarmGAP
ข้อความที่ผู้ใช้พิมพ์: "${userText}"

คำถาม: ผู้ใช้ต้องการเลือกวิธีชำระเงินแบบใด?
- หากเลือกเก็บเงินปลายทาง (จ่ายเงินสดเมื่อของถึง, จ่ายกับคนขับ, จ่ายตอนรับ): ตอบ COD
- หากเลือกโอนเงิน (สแกนจ่าย, คิวอาร์โค้ด, โอนผ่านบัญชี): ตอบ TRANSFER
- หากเป็นการสอบถามคำถาม หรือพูดเรื่องอื่นที่ไม่ได้เลือกวิธีชำระเงิน: ตอบ OTHER

ตอบเฉพาะคำว่า COD, TRANSFER หรือ OTHER เพียงคำเดียวเท่านั้น:`;

  try {
    const raw = await askGemini(prompt, "ตอบเฉพาะ COD, TRANSFER หรือ OTHER เท่านั้น");
    const clean = raw.trim().toUpperCase();
    if (clean.includes('COD')) return 'cod';
    if (clean.includes('TRANSFER')) return 'transfer';
    return null;
  } catch (err) {
    console.warn('Gemini payment method detection error:', err.message);
    return null;
  }
}

// Flex Message: แจ้งเตือนเมื่อข้อมูลจัดส่งยังไม่ครบถ้วน พร้อมระบุสิ่งที่ขาดอย่างชัดเจน
async function replyMissingContactInfo(replyToken, currentData, missingList) {
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

// Flex Message: ถามลูกค้าเพื่อเลือกช่องทางการชำระเงิน (โอนเงิน หรือ เก็บเงินปลายทาง COD)
async function replyPaymentMethodSelection(replyToken, draftData) {
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

// Flex Message: แจ้งยืนยันการสั่งซื้อแบบเก็บเงินปลายทาง (COD) สำเร็จ
async function replyCodOrderConfirmation(replyToken, orderCode, totalAmount, items, addressText) {
  const itemsText = (items || [])
    .map(it => `• ${it.name} จำนวน ${it.quantity} ${it.unit || 'กก.'} (฿${(it.subtotal || 0).toLocaleString()})`)
    .join('\n');

  const flexCard = {
    type: 'flex',
    altText: `ยืนยันคำสั่งซื้อเก็บเงินปลายทาง ${orderCode}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#059669',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: '🎉 สั่งซื้อสำเร็จ (เก็บเงินปลายทาง)',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
          },
          {
            type: 'text',
            text: `รหัสคำสั่งซื้อ: ${orderCode}`,
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
          // กล่องยอดเงินที่ต้องชำระเมื่อได้รับของ
          {
            type: 'box',
            layout: 'horizontal',
            backgroundColor: '#f0fdf4',
            borderColor: '#86efac',
            borderWidth: '1px',
            cornerRadius: 'md',
            paddingAll: 'md',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: 'ยอดชำระเมื่อได้รับสินค้า',
                size: 'xs',
                color: '#166534',
                weight: 'bold',
                flex: 6,
              },
              {
                type: 'text',
                text: `฿${Number(totalAmount).toLocaleString()} บาท`,
                size: 'lg',
                weight: 'bold',
                color: '#059669',
                align: 'end',
                flex: 6,
              },
            ],
          },
          // รายการผักที่สั่ง
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '🥬 รายการผักสดที่สั่ง:',
                weight: 'bold',
                size: 'xs',
                color: '#334155',
              },
              {
                type: 'text',
                text: itemsText,
                wrap: true,
                size: 'xs',
                color: '#475569',
              },
            ],
          },
          {
            type: 'separator',
          },
          // ข้อมูลจัดส่ง
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '📍 ข้อมูลจัดส่ง:',
                weight: 'bold',
                size: 'xs',
                color: '#334155',
              },
              {
                type: 'text',
                text: addressText,
                wrap: true,
                size: 'xs',
                color: '#64748b',
              },
            ],
          },
          // กล่องคำแนะนำ COD
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#fffbeb',
            borderColor: '#fde68a',
            borderWidth: '1px',
            cornerRadius: 'md',
            paddingAll: 'md',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '🚚 ขั้นตอนถัดไป:',
                weight: 'bold',
                size: 'xs',
                color: '#92400e',
              },
              {
                type: 'text',
                text: 'ฟาร์มได้รับคำสั่งซื้อเรียบร้อยแล้วครับ กำลังเตรียมเก็บเกี่ยวผักสดจากแปลง GAP และจัดส่งถึงหน้าบ้าน รบกวนเตรียมเงินสดชำระกับเจ้าหน้าที่ส่งพัสดุเมื่อได้รับสินค้านะครับ 🌱',
                wrap: true,
                size: 'xs',
                color: '#78350f',
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
              label: '🔍 เช็คสถานะออเดอร์',
              text: 'เช็คสถานะ',
            },
            style: 'secondary',
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '🌱 สั่งซื้อผักสดเพิ่ม',
              text: 'สั่งซื้อ',
            },
            style: 'link',
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
    console.error('Failed to reply COD order confirmation:', err.message);
  }
}

// Flex Message: แสดงข้อมูลและเบอร์โทรติดต่อเจ้าของฟาร์มโดยตรง
async function replyOwnerContact(replyToken) {
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
async function replyRefundInstructions(replyToken) {
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

// Helper: สร้างออเดอร์ในฐานข้อมูล ตัดสต็อก และบันทึกข้อมูลลูกค้า
async function createChatOrder(userId, draftData, paymentMethod = 'transfer') {
  const items = draftData.items || [];
  const totalAmount = draftData.totalAmount || draftData.total_amount || 0;
  const finalName = draftData.contact_name || draftData.customer_name || 'คุณลูกค้า';
  const finalPhone = draftData.contact_phone || draftData.phone || '-';
  const finalAddress = draftData.contact_address || draftData.address || '-';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get customer
    const [customers] = await connection.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
    const customer = customers[0] || {};

    // 2. Update customer phone, address, and display_name
    await connection.query(
      'UPDATE customers SET address = ?, phone = ?, display_name = COALESCE(?, display_name) WHERE id = ?',
      [finalAddress, finalPhone, draftData.contact_name || null, customer.id]
    );

    // 3. Check stock again and deduct
    for (const item of items) {
      const [prod] = await connection.query('SELECT stock_quantity, status FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      if (prod.length === 0 || prod[0].stock_quantity < item.quantity) {
        await connection.rollback();
        throw new Error(`ขออภัยครับ สินค้า "${item.name}" สต็อกไม่เพียงพอในขณะนี้`);
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
    const noteDetail = `ผู้รับ: ${finalName} | โทร: ${finalPhone} | ที่อยู่: ${finalAddress}${paymentMethod === 'cod' ? ' | ชำระเงินปลายทาง (COD)' : ''}`;
    const [orderResult] = await connection.query(
      `INSERT INTO orders (order_code, customer_id, total_amount, status, delivery_type, payment_method, notes)
       VALUES (?, ?, ?, 'pending', 'delivery', ?, ?)`,
      [orderCode, customer.id, totalAmount, paymentMethod, noteDetail]
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

    const formattedAddressDisplay = `ชื่อผู้รับ: ${finalName}\nเบอร์โทร: ${finalPhone}\nที่อยู่: ${finalAddress}`;
    const fullOrder = {
      id: orderId,
      order_code: orderCode,
      customer_id: customer.id,
      total_amount: totalAmount,
      status: 'pending',
      payment_method: paymentMethod,
      customer_name: finalName,
      customer_phone: finalPhone,
      customer_address: finalAddress,
      items: items.map(i => ({
        ...i,
        product_name: i.name,
      })),
      notes: noteDetail,
    };

    return {
      orderId,
      orderCode,
      totalAmount,
      items,
      finalName,
      finalPhone,
      finalAddress,
      formattedAddressDisplay,
      fullOrder,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
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
            const filename = `slip-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.jpg`;
            const targetPath = path.join(uploadsDir, filename);
            fs.writeFileSync(targetPath, buffer);
            slipDataUrl = `/uploads/${filename}`;
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

      // แจ้งเตือนเจ้าของฟาร์มเมื่อลูกค้าสั่งซื้อและแนบสลิปชำระเงินสำเร็จ
      try {
        const [oRows] = await pool.query(
          `SELECT o.*, c.display_name AS customer_name, c.phone AS customer_phone, c.address AS customer_address 
           FROM orders o 
           LEFT JOIN customers c ON o.customer_id = c.id 
           WHERE o.id = ?`,
          [orderIdForNotify]
        );
        if (oRows.length > 0) {
          const [itemsRows] = await pool.query(
            `SELECT oi.*, p.name AS product_name, p.unit 
             FROM order_items oi 
             JOIN products p ON oi.product_id = p.id 
             WHERE oi.order_id = ?`,
            [orderIdForNotify]
          );
          oRows[0].items = itemsRows;
          notifyAdminNewOrder(oRows[0], 'ORDER_COMPLETED').catch(e => console.error('notifyAdminNewOrder slip error:', e.message));
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
    const lowerTrimText = text.toLowerCase().trim();

    // 1. Global Greeting Handler: เมื่อลูกค้าทักทาย (สวัสดี, หวัดดี, hello, hi ฯลฯ)
    // ส่งการ์ดต้อนรับ replyWelcome ทันทีใน 0.02 วินาที ไม่ผ่าน Gemini และไม่อยู่ใต้สถานะใดๆ
    const isGreeting = (
      ['สวัสดี', 'หวัดดี', 'ดีครับ', 'ดีค่ะ', 'hello', 'hi', 'hey', 'start', 'เริ่มต้น', 'เริ่ม'].includes(lowerTrimText) ||
      lowerTrimText.startsWith('สวัสดี') ||
      lowerTrimText.startsWith('หวัดดี') ||
      lowerTrimText === 'ยินดีที่ได้รู้จัก'
    );
    if (isGreeting) {
      if (session && session.state === 'AWAITING_ADDRESS') {
        await clearChatSession(userId);
      }
      return replyWelcome(replyToken);
    }

    // Helper: ดักจับเจตนายกเลิกออเดอร์ในทุกรูปแบบภาษาคน (รวมถึงคำลงท้าย ครับ/ค่ะ, ข้อความยาว, หรือพิมพ์ผิด เช่น ยกเลิกช)
    function isCancelIntent(rawText) {
      if (!rawText || typeof rawText !== 'string') return false;
      const t = rawText.trim().toLowerCase();
      const cleaned = t.replace(/[\s.,!?~_\-]/g, '');

      if (cleaned.includes('ไม่ยกเลิก') || cleaned.includes('อย่ายกเลิก') || cleaned.includes('อย่าเพิ่งยกเลิก')) {
        return false;
      }

      const cancelRegex = /(?:ขอ|ช่วย)?ยกเลิก|ไม่เอา|ไม่ซื้อ|ไม่อยากได้|ลบออเดอร์|ลบรายการ|cancel|cancle/;
      return cancelRegex.test(cleaned);
    }

    // Helper: ใช้ Gemini AI ตรวจสอบเจตนายกเลิกในกรณีภาษาพูดซับซ้อน หรือพิมพ์นอกเหนือจากคำใน Regex
    async function isCancelWithGemini(rawText) {
      if (!rawText || typeof rawText !== 'string') return false;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'dummy_key') return false;

      const prompt = `ผู้ใช้กำลังอยู่ในขั้นตอนสั่งซื้อสินค้าในแชทของร้านฟาร์มผัก FarmGAP
ข้อความที่ผู้ใช้พิมพ์ส่งมา: "${rawText}"

คำถาม: ข้อความนี้มีเจตนาต้องการ "ยกเลิกคำสั่งซื้อ / ไม่ซื้อแล้ว / ไม่เอาแล้ว / เปลี่ยนใจไม่ซื้อ / ขอยุติรายการ / ปฏิเสธการรับสินค้า" หรือไม่?
(เช่น "เปลี่ยนใจแล้ว", "ไม่สะดวกรับแล้ว", "ขอบายก่อนนะ", "แคนเซิลนะ", "ยังไม่พร้อมจ่าย", "ขอผ่านก่อนครับ", "ยกเลิกช")
แต่ถ้าเป็นการถามคำถามทั่วไป, บอกที่อยู่, หรือพูดว่า "ไม่ยกเลิก", "สั่งเพิ่ม" ให้ตอบ NO

ตอบเฉพาะคำว่า YES หรือ NO สั้นๆ เพียงคำเดียวเท่านั้น:`;

      try {
        const reply = await askGemini(prompt, "ตอบเฉพาะ YES หรือ NO เท่านั้น");
        return reply.toUpperCase().includes('YES');
      } catch (_) {
        return false;
      }
    }

    // วิเคราะห์เจตนายกเลิก: ตรวจสอบทั้ง Regex แบบ Fast-path และใช้ Gemini AI เฉพาะกรณีที่มีคำบอกเหตุผลยกเลิก
    let shouldCancel = isCancelIntent(text);
    if (!shouldCancel && session.state !== 'IDLE' && !isGreeting) {
      const cancelKeywords = ['เปลี่ยน', 'สะดวก', 'บาย', 'เซิล', 'ผ่าน', 'พอ', 'หยุด', 'ไม่พร้อม', 'ไว้ก่อน'];
      if (cancelKeywords.some(k => lowerTrimText.includes(k))) {
        shouldCancel = await isCancelWithGemini(text);
      }
    }

    // Global cancellation handler (เข้าใจภาษาธรรมชาติ เช่น ยกเลิกช, ยกเลิก ครับ, ขอยกเลิก, ไม่เอาแล้ว, ภาษาพูดนอกบท)
    if (shouldCancel) {
      if (session.state === 'AWAITING_PAYMENT' && session.order_id) {
        const cancelledCode = await cancelChatOrder(session.order_id);
        const owner = await getOwnerContactInfo();
        await clearChatSession(userId);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: `ยกเลิกออเดอร์ ${cancelledCode} และคืนสต็อกผักสดเรียบร้อยแล้วครับ 🌱\n\n💸 หากคุณลูกค้าได้ทำการโอนเงินเข้ามาก่อนหน้านี้ สามารถส่งรูปสลิปพร้อมเลขบัญชีสำหรับรับเงินคืนในแชทนี้ หรือโทรแจ้งเจ้าของฟาร์มได้ที่เบอร์ ${owner.phone} (คุณ${owner.displayName}) ได้เลยครับ`,
            },
          ],
        });
      }

      if (session.state === 'AWAITING_ADDRESS' || session.state === 'AWAITING_PAYMENT_METHOD') {
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
      const draft = session.draft_data;

      // 1. ตรวจสอบว่าผู้ใช้สั่งซื้อใหม่ หรือต้องการเปลี่ยนรายการผักในออเดอร์หรือไม่
      const orderCheck = await extractOrderIntent(text);
      if (orderCheck.isOrder && orderCheck.items && orderCheck.items.length > 0) {
        await setChatSession(userId, 'AWAITING_ADDRESS', null, {
          ...draft,
          items: orderCheck.items,
          totalAmount: orderCheck.totalAmount,
        });
        return replyOrderDraftConfirmation(replyToken, orderCheck.items, orderCheck.totalAmount);
      }

      // 2. ตรวจสอบว่าผู้ใช้ขอดูเมนูผักหรือไม่
      if (isMenuInquiry(text)) {
        return replyVegMenu(replyToken, userId);
      }

      // Extract clean name, phone, address with hybrid AI & Regex
      const parsedContact = await parseSmartCustomerContact(text);

      // Merge with previously collected info in session draft
      const mergedName = parsedContact.name || draft.contact_name || null;
      const mergedPhone = parsedContact.phone || draft.contact_phone || null;
      const mergedAddress = parsedContact.address || draft.contact_address || null;

      // Fetch customer profile from DB
      const [customers] = await pool.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
      const customer = customers[0] || {};

      // Determine missing fields
      const missingList = [];
      if (!mergedAddress) {
        missingList.push('🏠 ที่อยู่จัดส่ง (เช่น บ้านเลขที่, ซอย/ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์)');
      }
      if (!mergedPhone) {
        missingList.push('📱 เบอร์โทรศัพท์ติดต่อ (10 หลัก สำหรับขนส่งโทรติดต่อ)');
      }
      if (!mergedName && (!customer.display_name || customer.display_name === 'ลูกค้า LINE')) {
        missingList.push('👤 ชื่อ-นามสกุล หรือชื่อเล่นของผู้รับ');
      }

      // ตรวจสอบว่าในข้อความนี้ มีข้อมูลติดต่อ (ชื่อ หรือ เบอร์ หรือ ที่อยู่) หรือไม่
      const providedContactInThisMsg = Boolean(
        parsedContact.name ||
        parsedContact.phone ||
        parsedContact.address
      );

      // ถ้าในข้อความนี้ไม่มีข้อมูลที่อยู่ เบอร์ หรือชื่อเลย และยังมีข้อมูลที่ขาดอยู่
      // แสดงว่าผู้ใช้กำลังพิมพ์สอบถามคำถาม หรือพูดคุยทั่วไป -> ให้ Gemini AI ตอบคำถามตามจริงทันที ไม่ตอบตัดบทซ้ำเดิม
      if (!providedContactInThisMsg && missingList.length > 0) {
        try {
          const farmContext = await getFarmContext();
          const itemsSummary = items.map(i => `${i.name} ${i.quantity} ${i.unit || 'แพ็ค'}`).join(', ');
          const addressInstruction = `${farmContext}
[สถานะปัจจุบันของลูกค้า]: ลูกค้ากำลังทำรายการสั่งซื้อผักสด (${itemsSummary} ยอดรวม ฿${Number(totalAmount).toLocaleString()} บาท) และอยู่ในขั้นตอนพิมพ์แจ้งข้อมูลจัดส่ง (ชื่อ, เบอร์โทร, ที่อยู่)
[คำสั่งสำหรับ AI]:
1. ตอบคำถามหรือข้อความของลูกค้าอย่างสุภาพ เป็นมิตร และชาญฉลาดตามคำถามจริง
2. ต่อท้ายคำตอบด้วยข้อความแนะนำสั้นๆ: "(สามารถพิมพ์แจ้งชื่อ เบอร์โทร และที่อยู่จัดส่งในแชทนี้ได้เลยครับ หรือพิมพ์ 'ยกเลิก' หากต้องการยกเลิกครับ 🌱)"`;

          const aiReply = await askGemini(text, addressInstruction);
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: aiReply }],
          });
        } catch (err) {
          console.error('Error answering AWAITING_ADDRESS with Gemini:', err.message);
        }
      }

      // If any required field is missing, save current draft progress and prompt the customer
      if (missingList.length > 0) {
        await setChatSession(userId, 'AWAITING_ADDRESS', null, {
          ...draft,
          contact_name: mergedName,
          contact_phone: mergedPhone,
          contact_address: mergedAddress,
        });

        return replyMissingContactInfo(
          replyToken,
          {
            name: mergedName || (customer.display_name !== 'ลูกค้า LINE' ? customer.display_name : null),
            phone: mergedPhone,
            address: mergedAddress,
          },
          missingList
        );
      }

      // All required contact info is complete!
      const contactDraft = {
        ...draft,
        items,
        totalAmount,
        contact_name: mergedName,
        contact_phone: mergedPhone,
        contact_address: mergedAddress,
      };

      // Check if user explicitly stated payment method in this message
      const lowerText = text.toLowerCase();
      const isCodExplicit = lowerText.includes('ปลายทาง') || lowerText.includes('cod') || lowerText.includes('เก็บปลายทาง') || lowerText.includes('เงินสด');
      const isTransferExplicit = lowerText.includes('โอนเงิน') || lowerText.includes('โอน') || lowerText.includes('พร้อมเพย์') || lowerText.includes('qr');

      if (isCodExplicit) {
        try {
          const created = await createChatOrder(userId, contactDraft, 'cod');
          await clearChatSession(userId);
          notifyAdminNewOrder(created.fullOrder, 'ORDER_COMPLETED').catch(e => console.error('notifyAdminNewOrder error:', e.message));
          return replyCodOrderConfirmation(replyToken, created.orderCode, created.totalAmount, created.items, created.formattedAddressDisplay);
        } catch (err) {
          console.error('Failed to create COD order:', err.message);
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: err.message || 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้งครับ' }],
          });
        }
      }

      if (isTransferExplicit) {
        try {
          const created = await createChatOrder(userId, contactDraft, 'transfer');
          await setChatSession(userId, 'AWAITING_PAYMENT', created.orderId, {
            order_code: created.orderCode,
            total_amount: created.totalAmount,
            items: created.items,
            address: created.finalAddress,
            customer_name: created.finalName,
            phone: created.finalPhone,
          });
          return replyInvoiceAndPayment(replyToken, created.orderCode, created.totalAmount, created.items, created.formattedAddressDisplay);
        } catch (err) {
          console.error('Failed to create transfer order:', err.message);
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: err.message || 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้งครับ' }],
          });
        }
      }

      // Transition to AWAITING_PAYMENT_METHOD and ask customer to choose
      await setChatSession(userId, 'AWAITING_PAYMENT_METHOD', null, contactDraft);
      return replyPaymentMethodSelection(replyToken, contactDraft);
    }

    // STATE: AWAITING_PAYMENT_METHOD (Customer is choosing between Bank Transfer and COD)
    if (session.state === 'AWAITING_PAYMENT_METHOD' && session.draft_data?.items) {
      const lowerText = text.toLowerCase().trim();
      let isCod = lowerText === 'เก็บเงินปลายทาง' || lowerText === 'ปลายทาง' || lowerText === 'cod' || lowerText.includes('ปลายทาง') || lowerText.includes('cod') || lowerText === '2' || lowerText.includes('เงินสด');
      let isTransfer = lowerText === 'โอนเงิน' || lowerText === 'โอน' || lowerText.includes('โอน') || lowerText.includes('พร้อมเพย์') || lowerText.includes('qr') || lowerText === '1' || lowerText === 'transfer';

      // ชั้นที่ 2: หาก Fast-path ยังไม่ตรง ให้ Gemini AI ช่วยวิเคราะห์เจตนาเลือกช่องทางชำระเงินจากภาษาพูด
      if (!isCod && !isTransfer) {
        const aiMethod = await detectPaymentMethodWithGemini(text);
        if (aiMethod === 'cod') isCod = true;
        if (aiMethod === 'transfer') isTransfer = true;
      }

      if (isCod) {
        try {
          const created = await createChatOrder(userId, session.draft_data, 'cod');
          await clearChatSession(userId);
          notifyAdminNewOrder(created.fullOrder, 'ORDER_COMPLETED').catch(e => console.error('notifyAdminNewOrder error:', e.message));
          return replyCodOrderConfirmation(replyToken, created.orderCode, created.totalAmount, created.items, created.formattedAddressDisplay);
        } catch (err) {
          console.error('Failed to create COD order:', err.message);
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: err.message || 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้งครับ' }],
          });
        }
      }

      if (isTransfer) {
        try {
          const created = await createChatOrder(userId, session.draft_data, 'transfer');
          await setChatSession(userId, 'AWAITING_PAYMENT', created.orderId, {
            order_code: created.orderCode,
            total_amount: created.totalAmount,
            items: created.items,
            address: created.finalAddress,
            customer_name: created.finalName,
            phone: created.finalPhone,
          });
          return replyInvoiceAndPayment(replyToken, created.orderCode, created.totalAmount, created.items, created.formattedAddressDisplay);
        } catch (err) {
          console.error('Failed to create transfer order:', err.message);
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: err.message || 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้งครับ' }],
          });
        }
      }

      // If user typed something else, respond with Gemini AI or payment selection
      try {
        const farmContext = await getFarmContext();
        const methodInstruction = `${farmContext}
[สถานะปัจจุบันของลูกค้า]: ลูกค้ากำลังอยู่ในขั้นตอนเลือกช่องทางชำระเงิน (มี 2 ตัวเลือก: 1. โอนเงินผ่าน QR Code หรือ 2. เก็บเงินปลายทาง COD)
[คำสั่งสำหรับ AI]: ตอบคำถามหรือข้อความของลูกค้าอย่างสุภาพและเป็นมิตร และต่อท้ายด้วยคำถามว่าลูกค้าสะดวกชำระแบบ "โอนเงิน" หรือ "เก็บเงินปลายทาง" เพื่อดำเนินรายการต่อ`;
        const aiReply = await askGemini(text, methodInstruction);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: 'text', text: aiReply }],
        });
      } catch (_) {
        return replyPaymentMethodSelection(replyToken, session.draft_data);
      }
    }

    // STATE: AWAITING_PAYMENT (Customer typed text instead of sending slip image)
    if (session.state === 'AWAITING_PAYMENT' && session.order_id) {
      const orderCode = session.draft_data?.order_code || 'ORD';
      const totalAmount = session.draft_data?.total_amount || 0;

      // ใช้ Gemini AI ช่วยตอบคำถามหรือข้อความของลูกค้า พร้อมแนบคำแนะนำการชำระเงิน/ยกเลิกท้ายข้อความอย่างเป็นมิตร
      try {
        const farmContext = await getFarmContext();
        const paymentInstruction = `${farmContext}
[สถานะปัจจุบันของลูกค้า]: ลูกค้าเพิ่งทำรายการสั่งซื้อออเดอร์หมายเลข ${orderCode} (ยอดชำระ ฿${Number(totalAmount).toLocaleString()} บาท) และอยู่ในขั้นตอนรอยืนยันการชำระเงิน (รอส่งรูปสลิปโอนเงิน)
[คำสั่งสำหรับ AI]:
1. ตอบคำถามหรือพูดคุยกับลูกค้าอย่างสุภาพ เป็นมิตร และชาญฉลาดตามสิ่งที่ลูกค้าพิมพ์มา
2. ต่อท้ายคำตอบด้วยข้อความสั้นๆ: "📌 (สำหรับออเดอร์ ${orderCode} ยอด ฿${Number(totalAmount).toLocaleString()} บาท สามารถแนบรูปสลิปเพื่อยืนยัน หรือพิมพ์ 'ยกเลิก' หากต้องการยกเลิกครับ)"`;

        const aiReply = await askGemini(text, paymentInstruction);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: aiReply,
            },
          ],
        });
      } catch (err) {
        console.error('Error answering AWAITING_PAYMENT with Gemini:', err.message);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: `ขณะนี้คุณมีออเดอร์ ${orderCode} (ยอดชำระ ฿${Number(totalAmount).toLocaleString()} บาท) รอยืนยันการชำระเงินครับ\n\n📸 เมื่อโอนแล้ว ส่งรูปสลิปเข้ามาในแชทนี้ได้เลยครับ\n❌ หรือพิมพ์ 'ยกเลิก' หากต้องการยกเลิกออเดอร์ครับ 🌱`,
            },
          ],
        });
      }
    }

// Helper: ตรวจสอบว่าข้อความที่ลูกค้าพิมพ์มีเจตนาต้องการดูเมนูผักหรือรายการสินค้าหรือไม่
function isMenuInquiry(rawText) {
  const clean = String(rawText || '').trim().toLowerCase();
  if (['เมนูผัก', 'เมนุผัก', 'สั่งซื้อ', 'เมนู', 'เมนุ', 'menu', 'ดูเมนู', 'ดูเมนุ', 'ขอดูเมนู', 'ขอดูเมนุ', 'สั่งผัก', 'ซื้อผัก', 'รายการผัก', 'ผัก', 'รายการสินค้า', 'ผักพร้อมส่ง'].includes(clean)) {
    return true;
  }

  const menuKeywords = [
    'มีเมนูอะไร',
    'มีเมนุอะไร',
    'เมนูอะไรบ้าง',
    'เมนุอะไรบ้าง',
    'เมนูมีอะไร',
    'เมนุมีอะไร',
    'มีเมนู',
    'มีเมนุ',
    'มีผักอะไร',
    'ผักอะไรบ้าง',
    'ผักมีอะไร',
    'มีอะไรบ้างวันนี้',
    'วันนี้มีอะไรบ้าง',
    'มีอะไรบ้าง',
    'ขายอะไรบ้าง',
    'มีอะไรขาย',
    'ขายอะไร',
    'ขอดูเมนู',
    'ขอดูเมนุ',
    'ดูเมนู',
    'ดูเมนุ',
    'ขอเมนู',
    'ขอเมนุ',
    'เปิดเมนู',
    'เปิดเมนุ',
    'รายการผัก',
    'รายการสินค้า',
    'ผักพร้อมส่ง',
    'ผักสดมีอะไร',
    'ขอดูผัก',
    'ดูผัก',
    'อยากสั่งผัก',
    'สั่งผักอะไรได้บ้าง',
    'มีผักไหม',
    'มีผักมั้ย',
    'ผักมีไหม',
    'ผักมีมั้ย',
    'มีของไหม',
    'มีของมั้ย',
    'วันนี้มีผัก',
  ];

  if (menuKeywords.some(kw => clean.includes(kw))) {
    const isDirectQuantityOrder = /\d+\s*(กิโล|กก|แพ็ค|ถุง|ขีด|ต้น|กระปุก|กล่อง)/.test(clean);
    if (!isDirectQuantityOrder) {
      return true;
    }
  }

  return false;
}

    // STATE: IDLE (Standard conversation or new order intent)
    if (isMenuInquiry(text)) {
      return replyVegMenu(replyToken, userId);
    }
    if (
      ['เช็คสถานะ', 'ออเดอร์', 'สถานะ', 'สถานะออเดอร์', 'เช็คสถานะออเดอร์', 'ติดตามพัสดุ', 'เช็คพัสดุ', 'เช็คออเดอร์', 'ดูสถานะ', 'ตรวจสอบสถานะ'].includes(text) ||
      text.startsWith('เช็คสถานะ') ||
      text.startsWith('ดูสถานะ') ||
      text === 'status' ||
      lowerTrimText.includes('เช็คสถานะ') ||
      lowerTrimText.includes('ตามของ') ||
      lowerTrimText.includes('ส่งถึงไหน') ||
      lowerTrimText.includes('ของส่งยัง') ||
      lowerTrimText.includes('พัสดุถึงไหน')
    ) {
      return replyOrderStatus(replyToken, userId);
    }

    if (
      ['ดูประวัติ', 'ประวัติ', 'ประวัติการสั่งซื้อ', 'ประวัติออเดอร์', 'ดูประวัติการสั่งซื้อ', 'ประวัติการซื้อ'].includes(text) ||
      text.includes('ดูประวัติ') ||
      text.includes('ประวัติการสั่งซื้อ') ||
      text.includes('เคยสั่ง') ||
      text.includes('ออเดอร์เก่า') ||
      text === 'history'
    ) {
      return replyOrderHistory(replyToken, userId);
    }

    // ตรวจสอบคำถามขอเงินคืน (Refund)
    const isRefundInquiry = [
      'ขอเงินคืน', 'คืนเงิน', 'ขอเงินคืนยังไง', 'เงินคืน', 'ขอเงินคืนครับ',
      'ขอเงินคืนค่ะ', 'refund', 'ได้เงินคืนยังไง', 'ขอคืนเงิน', 'โอนแล้วขอยกเลิก', 'โอนเงินแล้วขอยกเลิก'
    ].some(k => lowerTrimText.includes(k));

    if (isRefundInquiry) {
      return replyRefundInstructions(replyToken);
    }

    // ตรวจสอบคำถามขอเบอร์โทร / ช่องทางติดต่อเจ้าของฟาร์มโดยตรง
    const isContactInquiry = (
      ['ขอเบอร์', 'เบอร์โทร', 'ขอเบอร์ติดต่อ', 'เบอร์ติดต่อ', 'ติดต่อเจ้าของ', 'ติดต่อคน', 'ติดต่อแอดมิน', 'เบอร์ฟาร์ม', 'ขอเบอร์โทร', 'โทรหาใคร', 'เบอร์โทรศัพท์'].some(k => lowerTrimText.includes(k)) ||
      (lowerTrimText.includes('เบอร์') && (lowerTrimText.includes('เจ้าของ') || lowerTrimText.includes('ฟาร์ม') || lowerTrimText.includes('แอดมิน') || lowerTrimText.includes('ติดต่อ')))
    );

    if (isContactInquiry) {
      return replyOwnerContact(replyToken);
    }

    // Check if customer is attempting to cancel an order from IDLE state
    const isIdleCancel = isCancelIntent(text) || (await isCancelWithGemini(text));
    if (isIdleCancel) {
      try {
        const [orders] = await pool.query(
          `SELECT o.id, o.order_code, o.payment_method, o.status 
           FROM orders o 
           JOIN customers c ON o.customer_id = c.id 
           WHERE c.line_user_id = ? 
           ORDER BY o.id DESC LIMIT 1`,
          [userId]
        );
        if (orders.length > 0) {
          const lastOrder = orders[0];
          const st = (lastOrder.status || '').toLowerCase();
          const pm = (lastOrder.payment_method || '').toLowerCase();
          if (st === 'pending') {
            if (pm === 'transfer') {
              return replyRefundInstructions(replyToken, lastOrder.order_code);
            } else if (pm === 'cod') {
              await pool.query('UPDATE orders SET status = "cancelled" WHERE id = ?', [lastOrder.id]);
              return client.replyMessage({
                replyToken: replyToken,
                messages: [
                  {
                    type: 'text',
                    text: `ยกเลิกออเดอร์เก็บเงินปลายทาง (${lastOrder.order_code}) เรียบร้อยแล้วครับ หากต้องการสั่งซื้อใหม่สามารถพิมพ์บอกผักที่ต้องการได้เลยครับ 🌱`,
                  },
                ],
              });
            }
          }
        }
      } catch (err) {
        console.error('Error handling IDLE cancel check:', err.message);
      }
    }

    // 1. ตรวจสอบการสั่งซื้อผักสดก่อนเป็นอันดับแรก (Local Order Intent Extraction - ตอบกลับได้ใน < 2ms ไม่ต้องรอ Gemini)
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

    // 2. Smart Address & Contact Parser (เฉพาะกรณีที่ไม่ได้สั่งซื้อ และผู้ใช้พิมพ์ข้อมูลจัดส่งเข้ามา)
    const contactInfo = await parseSmartCustomerContact(text);
    if (contactInfo.hasAddress || (contactInfo.phone && contactInfo.address)) {
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

      // หาก AI วิเคราะห์แล้วว่าลูกค้าอยากดูเมนูผัก ให้แสดง Flex Message เมนูผักสวยๆ ทันที
      if (responseText.includes('[SHOW_MENU_CARD]') || isMenuInquiry(responseText)) {
        return replyVegMenu(replyToken, userId);
      }

      try {
        await client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: 'text', text: responseText }],
        });
      } catch (replyErr) {
        console.error('Failed to reply message to LINE:', replyErr.message);
      }
    } catch (err) {
      console.error('Error in conversational AI processing:', err.message);
      try {
        await replyVegMenu(replyToken, userId);
      } catch (_) {}
    }
  }
}

// Router Webhook listener
lineRouter.post('/webhook', signatureVerifier, (req, res) => {
  const events = req.body.events;
  // Acknowledge LINE immediately with 200 OK to prevent LINE webhook timeout and retries
  res.status(200).send('OK');

  if (!events || !Array.isArray(events)) {
    return;
  }

  // Handle events asynchronously
  Promise.all(events.map(handleEvent)).catch(error => {
    console.error('Error in LINE webhook background processing:', error);
  });
});
