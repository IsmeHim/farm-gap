import jwt from 'jsonwebtoken';

export function authRequired(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    req.user = payload; // { id, email, role }
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}
