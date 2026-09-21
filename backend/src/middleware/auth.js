import jwt from 'jsonwebtoken';

export function authRequired(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    req.user = payload; // { id, email, role, display_name }
    if (payload.role !== 'owner' && payload.role !== 'worker') {
      return res.status(403).json({ error: 'Forbidden: บัญชีผู้ใช้ทั่วไปไม่มีสิทธิ์เข้าถึงข้อมูลภายในฟาร์ม' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

export function anyAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}
