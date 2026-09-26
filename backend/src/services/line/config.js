import { messagingApi } from '@line/bot-sdk';
import crypto from 'crypto';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const uploadsDir = path.join(__dirname, '../../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const { MessagingApiClient } = messagingApi;
export const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy_token',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'dummy_secret',
};

// Create LINE Messaging API Client with Auto-Retry on network/socket reset
export const client = new MessagingApiClient({
  channelAccessToken: lineConfig.channelAccessToken,
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

// Auto-initialize line_chat_sessions table
export async function initSessionTable() {
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
export async function getChatSession(lineUserId) {
  try {
    const [rows] = await pool.query('SELECT * FROM line_chat_sessions WHERE line_user_id = ?', [lineUserId]);
    if (rows.length > 0) {
      const row = rows[0];
      const updatedAt = new Date(row.updated_at).getTime();
      const now = Date.now();
      const diffMinutes = (now - updatedAt) / (1000 * 60);

      // ถ้าเซสชันค้างนานเกิน 30 นาที (หรือรอชำระเงินเกิน 120 นาที) ให้หมดอายุและรีเซ็ตเป็น IDLE อัตโนมัติ
      const isExpired = (row.state !== 'IDLE') && (
        (row.state !== 'AWAITING_PAYMENT' && diffMinutes > 30) ||
        (row.state === 'AWAITING_PAYMENT' && diffMinutes > 120)
      );

      if (isExpired) {
        await pool.query('UPDATE line_chat_sessions SET state = "IDLE", order_id = NULL, draft_data = NULL WHERE line_user_id = ?', [lineUserId]);
        return { state: 'IDLE', order_id: null, draft_data: null };
      }

      let draft = row.draft_data;
      if (typeof draft === 'string') {
        try { draft = JSON.parse(draft); } catch (_) {}
      }
      return { ...row, draft_data: draft };
    }
    return { state: 'IDLE', order_id: null, draft_data: null };
  } catch (err) {
    console.error('getChatSession error:', err.message);
    return { state: 'IDLE', order_id: null, draft_data: null };
  }
}

export async function setChatSession(lineUserId, state, orderId = null, draftData = null) {
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

export async function clearChatSession(lineUserId) {
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
export function generateOrderCode() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${randomNum}`;
}

// Middleware to verify signature using req.rawBody
export function signatureVerifier(req, res, next) {
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
