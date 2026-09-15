import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const uploadRouter = Router();

// POST /api/upload - Accepts base64 image data, saves to disk, returns relative URL
uploadRouter.post('/', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'ไม่พบข้อมูลรูปภาพ (Missing image data)' });

    // Parse base64 data URL: data:image/jpeg;base64,...
    const matches = data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'รูปแบบข้อมูลรูปภาพไม่ถูกต้อง (Invalid base64 format)' });
    }

    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'svg+xml') ext = 'svg';

    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `product-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.${ext}`;
    const targetPath = path.join(uploadsDir, filename);

    fs.writeFileSync(targetPath, buffer);

    const url = `/uploads/${filename}`;
    res.json({ success: true, url, filename });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการบันทึกรูปภาพ' });
  }
});
