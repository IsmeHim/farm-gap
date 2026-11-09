import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const r = Router();

r.post('/register', async (req, res) => {
  const { email, username, password, display_name, farm_name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const finalUsername = (username || '').trim() || null;
    const [result] = await pool.query(
      'INSERT INTO users (email, username, password_hash, display_name, farm_name, role) VALUES (?,?,?,?,?,?)',
      [email.trim(), finalUsername, hash, display_name || null, farm_name || null, 'user']
    );
    const token = jwt.sign(
      { id: result.insertId, email: email.trim(), username: finalUsername, role: 'user', display_name: display_name || null },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({
      token,
      user: {
        id: result.insertId,
        email: email.trim(),
        username: finalUsername,
        display_name,
        farm_name,
        role: 'user',
      },
    });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      if (e.message.includes('username') || e.message.includes('idx_users_username')) {
        return res.status(409).json({ error: 'ชื่อผู้ใช้ (Username) นี้มีผู้ใช้งานแล้ว' });
      }
      return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
    }
    res.status(500).json({ error: e.message });
  }
});

r.post('/login', async (req, res) => {
  try {
    const { email, username, identifier, password } = req.body;
    const loginKey = (identifier || email || username || '').trim();
    if (!loginKey || !password) {
      return res.status(400).json({ error: 'กรุณากรอกอีเมลหรือชื่อผู้ใช้ และรหัสผ่าน' });
    }

    // ค้นหาได้ทั้ง Email, Username และ Display Name
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR username = ? OR display_name = ? LIMIT 1',
      [loginKey, loginKey, loginKey]
    );
    if (!rows[0]) return res.status(401).json({ error: 'อีเมลหรือชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง' });
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'อีเมลหรือชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง' });
    const u = rows[0];
    const token = jwt.sign(
      { id: u.id, email: u.email, username: u.username, role: u.role, display_name: u.display_name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({
      token,
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        display_name: u.display_name,
        farm_name: u.farm_name,
        role: u.role,
      },
    });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจสอบว่าเปิด MySQL (Laragon) แล้ว' });
  }
});

// ข้อมูลการเงินและบัญชีธนาคารสำหรับลูกค้า/หน้าร้าน (Public)
r.get('/payment-info', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT farm_name, display_name, phone, bank_name, bank_account_no, bank_account_name, promptpay_number FROM users WHERE role = 'owner' LIMIT 1"
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
      'SELECT id, email, username, display_name, farm_name, phone, role, created_at, bank_name, bank_account_no, bank_account_name, promptpay_number, line_user_id, frontend_url, gemini_api_key, gemini_model, gemini_auto_fallback, gemini_enabled FROM users WHERE id = ?',
      [payload.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'user not found' });
    const u = rows[0];
    if (!u.gemini_api_key && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'dummy_key') {
      u.gemini_api_key = process.env.GEMINI_API_KEY;
    }
    res.json(u);
  } catch (err) {
    res.status(401).json({ error: 'invalid token' });
  }
});

// อัปเดตข้อมูลโปรไฟล์และชื่อฟาร์ม รวมถึงบัญชีธนาคาร การชำระเงิน และการตั้งค่า Gemini AI
r.put('/profile', async (req, res) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const {
      display_name,
      username,
      farm_name,
      phone,
      password,
      bank_name,
      bank_account_no,
      bank_account_name,
      promptpay_number,
      line_user_id,
      frontend_url,
      gemini_api_key,
      gemini_model,
      gemini_auto_fallback,
      gemini_enabled,
    } = req.body;

    const finalUsername = username !== undefined ? (username?.trim() || null) : undefined;
    const finalGeminiKey = gemini_api_key !== undefined ? (gemini_api_key?.trim() || null) : undefined;
    const finalGeminiModel = gemini_model !== undefined ? (gemini_model?.trim() || 'gemini-3.5-flash-lite') : undefined;
    const finalGeminiFallback = gemini_auto_fallback !== undefined ? (gemini_auto_fallback ? 1 : 0) : undefined;
    const finalGeminiEnabled = gemini_enabled !== undefined ? (gemini_enabled ? 1 : 0) : undefined;

    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users SET 
          display_name = COALESCE(?, display_name), 
          username = COALESCE(?, username),
          farm_name = COALESCE(?, farm_name), 
          phone = COALESCE(?, phone),
          password_hash = ?,
          bank_name = ?,
          bank_account_no = ?,
          bank_account_name = ?,
          promptpay_number = ?,
          line_user_id = ?,
          frontend_url = ?,
          gemini_api_key = COALESCE(?, gemini_api_key),
          gemini_model = COALESCE(?, gemini_model),
          gemini_auto_fallback = COALESCE(?, gemini_auto_fallback),
          gemini_enabled = COALESCE(?, gemini_enabled)
        WHERE id = ?`,
        [
          display_name,
          finalUsername,
          farm_name,
          phone !== undefined ? phone : null,
          hash,
          bank_name !== undefined ? bank_name : null,
          bank_account_no !== undefined ? bank_account_no : null,
          bank_account_name !== undefined ? bank_account_name : null,
          promptpay_number !== undefined ? promptpay_number : null,
          line_user_id !== undefined ? line_user_id : null,
          frontend_url !== undefined ? frontend_url : null,
          finalGeminiKey,
          finalGeminiModel,
          finalGeminiFallback,
          finalGeminiEnabled,
          payload.id,
        ]
      );
    } else {
      await pool.query(
        `UPDATE users SET 
          display_name = COALESCE(?, display_name), 
          username = COALESCE(?, username),
          farm_name = COALESCE(?, farm_name),
          phone = COALESCE(?, phone),
          bank_name = ?,
          bank_account_no = ?,
          bank_account_name = ?,
          promptpay_number = ?,
          line_user_id = ?,
          frontend_url = ?,
          gemini_api_key = COALESCE(?, gemini_api_key),
          gemini_model = COALESCE(?, gemini_model),
          gemini_auto_fallback = COALESCE(?, gemini_auto_fallback),
          gemini_enabled = COALESCE(?, gemini_enabled)
        WHERE id = ?`,
        [
          display_name,
          finalUsername,
          farm_name,
          phone !== undefined ? phone : null,
          bank_name !== undefined ? bank_name : null,
          bank_account_no !== undefined ? bank_account_no : null,
          bank_account_name !== undefined ? bank_account_name : null,
          promptpay_number !== undefined ? promptpay_number : null,
          line_user_id !== undefined ? line_user_id : null,
          frontend_url !== undefined ? frontend_url : null,
          finalGeminiKey,
          finalGeminiModel,
          finalGeminiFallback,
          finalGeminiEnabled,
          payload.id,
        ]
      );
    }

    const [rows] = await pool.query(
      'SELECT id, email, username, display_name, farm_name, role, created_at, bank_name, bank_account_no, bank_account_name, promptpay_number, line_user_id, frontend_url, gemini_api_key, gemini_model, gemini_auto_fallback, gemini_enabled FROM users WHERE id = ?',
      [payload.id]
    );
    const u = rows[0];
    const token = jwt.sign(
      { id: u.id, email: u.email, username: u.username, role: u.role, display_name: u.display_name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, user: u, message: 'Profile updated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'ชื่อผู้ใช้ (Username) นี้มีผู้ใช้งานแล้ว' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ทดสอบการเชื่อมต่อ Google Gemini API จากหน้าตั้งค่าฟาร์ม (เหมือนในระบบ Money Manager)
r.post('/test-gemini', async (req, res) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try {
    jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const { gemini_api_key, gemini_model, gemini_auto_fallback } = req.body;

    const apiKey = (gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'กรุณากรอก Gemini API Key ก่อนทดสอบ' });
    }

    const { callGeminiWithDetails } = await import('../services/line/ai/gemini.js');
    const result = await callGeminiWithDetails({
      prompt: 'สวัสดี! ทดสอบการเชื่อมต่อจากระบบ FarmGAP ตอบสั้นๆ 1 ประโยคว่าพร้อมเป็นผู้ช่วย AI ของฟาร์มแล้ว',
      systemInstruction: 'คุณคือผู้ช่วย AI อัจฉริยะของระบบฟาร์มผักปลอดสารมาตรฐาน GAP (FarmGAP)',
      temperature: 0.3,
      configOverride: {
        apiKey,
        model: gemini_model || 'gemini-3.5-flash-lite',
        autoFallback: gemini_auto_fallback !== false,
        isEnabled: true,
      },
    });

    res.json(result);
  } catch (err) {
    console.error('test-gemini error:', err.message);
    res.status(500).json({ success: false, error: err.message });
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

