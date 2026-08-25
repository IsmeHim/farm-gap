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

// ดึงข้อมูลโปรไฟล์ล่าสุด
r.get('/me', async (req, res) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const [rows] = await pool.query('SELECT id, email, display_name, farm_name, role, created_at FROM users WHERE id = ?', [payload.id]);
    if (!rows[0]) return res.status(404).json({ error: 'user not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(401).json({ error: 'invalid token' });
  }
});

// อัปเดตข้อมูลโปรไฟล์และชื่อฟาร์ม
r.put('/profile', async (req, res) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const { display_name, farm_name, password } = req.body;

    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE users SET display_name = COALESCE(?, display_name), farm_name = COALESCE(?, farm_name), password_hash = ? WHERE id = ?',
        [display_name, farm_name, hash, payload.id]
      );
    } else {
      await pool.query(
        'UPDATE users SET display_name = COALESCE(?, display_name), farm_name = COALESCE(?, farm_name) WHERE id = ?',
        [display_name, farm_name, payload.id]
      );
    }

    const [rows] = await pool.query('SELECT id, email, display_name, farm_name, role, created_at FROM users WHERE id = ?', [payload.id]);
    const u = rows[0];
    const token = jwt.sign({ id: u.id, email: u.email, role: u.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: u, message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default r;

