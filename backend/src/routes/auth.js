import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const r = Router();

r.post('/register', async (req, res) => {
  const { email, password, display_name, farm_name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email/password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, display_name, farm_name) VALUES (?,?,?,?)',
      [email, hash, display_name || null, farm_name || null]
    );
    const token = jwt.sign({ id: result.insertId, email, role: 'owner' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: result.insertId, email, display_name, farm_name, role: 'owner' } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'email already used' });
    res.status(500).json({ error: e.message });
  }
});

r.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
  if (!rows[0]) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const u = rows[0];
  const token = jwt.sign({ id: u.id, email: u.email, role: u.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: u.id, email: u.email, display_name: u.display_name, farm_name: u.farm_name, role: u.role } });
});

// ข้อมูลการเงินและบัญชีธนาคารสำหรับลูกค้า/หน้าร้าน (Public)
r.get('/payment-info', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT farm_name, display_name, bank_name, bank_account_no, bank_account_name, promptpay_number, promptpay_qr_url FROM users WHERE role = 'owner' LIMIT 1"
    );
    if (!rows[0]) return res.json({});
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ดึงข้อมูลโปรไฟล์ล่าสุด
r.get('/me', async (req, res) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const [rows] = await pool.query(
      'SELECT id, email, display_name, farm_name, role, created_at, bank_name, bank_account_no, bank_account_name, promptpay_number, promptpay_qr_url, line_user_id FROM users WHERE id = ?',
      [payload.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'user not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(401).json({ error: 'invalid token' });
  }
});

// อัปเดตข้อมูลโปรไฟล์และชื่อฟาร์ม รวมถึงบัญชีธนาคารและการชำระเงิน
r.put('/profile', async (req, res) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const {
      display_name,
      farm_name,
      password,
      bank_name,
      bank_account_no,
      bank_account_name,
      promptpay_number,
      promptpay_qr_url,
      line_user_id,
    } = req.body;

    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users SET 
          display_name = COALESCE(?, display_name), 
          farm_name = COALESCE(?, farm_name), 
          password_hash = ?,
          bank_name = ?,
          bank_account_no = ?,
          bank_account_name = ?,
          promptpay_number = ?,
          promptpay_qr_url = ?,
          line_user_id = ?
        WHERE id = ?`,
        [
          display_name,
          farm_name,
          hash,
          bank_name !== undefined ? bank_name : null,
          bank_account_no !== undefined ? bank_account_no : null,
          bank_account_name !== undefined ? bank_account_name : null,
          promptpay_number !== undefined ? promptpay_number : null,
          promptpay_qr_url !== undefined ? promptpay_qr_url : null,
          line_user_id !== undefined ? line_user_id : null,
          payload.id,
        ]
      );
    } else {
      await pool.query(
        `UPDATE users SET 
          display_name = COALESCE(?, display_name), 
          farm_name = COALESCE(?, farm_name),
          bank_name = ?,
          bank_account_no = ?,
          bank_account_name = ?,
          promptpay_number = ?,
          promptpay_qr_url = ?,
          line_user_id = ?
        WHERE id = ?`,
        [
          display_name,
          farm_name,
          bank_name !== undefined ? bank_name : null,
          bank_account_no !== undefined ? bank_account_no : null,
          bank_account_name !== undefined ? bank_account_name : null,
          promptpay_number !== undefined ? promptpay_number : null,
          promptpay_qr_url !== undefined ? promptpay_qr_url : null,
          line_user_id !== undefined ? line_user_id : null,
          payload.id,
        ]
      );
    }

    const [rows] = await pool.query(
      'SELECT id, email, display_name, farm_name, role, created_at, bank_name, bank_account_no, bank_account_name, promptpay_number, promptpay_qr_url, line_user_id FROM users WHERE id = ?',
      [payload.id]
    );
    const u = rows[0];
    const token = jwt.sign({ id: u.id, email: u.email, role: u.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: u, message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ทดสอบส่งข้อความแจ้งเตือนเข้า LINE ของเจ้าของฟาร์ม
r.post('/test-line-notification', async (req, res) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const { line_user_id } = req.body;

    let targetLineId = line_user_id;
    if (!targetLineId) {
      const [rows] = await pool.query('SELECT line_user_id FROM users WHERE id = ?', [payload.id]);
      targetLineId = rows[0]?.line_user_id;
    }

    if (!targetLineId || !targetLineId.trim()) {
      return res.status(400).json({ error: 'กรุณาระบุ LINE User ID ก่อนทดสอบส่งข้อความ' });
    }

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token || token === 'dummy_token') {
      return res.status(400).json({ error: 'LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่าในระบบ' });
    }

    const { messagingApi } = await import('@line/bot-sdk');
    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: token,
    });

    await client.pushMessage({
      to: targetLineId.trim(),
      messages: [
        {
          type: 'text',
          text: '🎉 ทดสอบการเชื่อมต่อแจ้งเตือนสำเร็จ!\n\nระบบ FarmGAP ผูกกับ LINE ของคุณเรียบร้อยแล้ว ต่อไปเมื่อมีคำสั่งซื้อผักสดเข้ามาใหม่ หรือมีลูกค้าแนบสลิปโอนเงิน ระบบจะแจ้งเตือนมาที่นี่ทันทีครับ 🌱✨',
        },
      ],
    });

    res.json({ success: true, message: 'ส่งข้อความแจ้งเตือนทดสอบเข้า LINE เรียบร้อยแล้ว!' });
  } catch (err) {
    console.error('Failed to send test LINE message:', err);
    res.status(500).json({ error: `ไม่สามารถส่งข้อความได้: ${err.message}` });
  }
});

export default r;

