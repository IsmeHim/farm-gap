import { Router } from 'express';
import { pool } from '../db.js';

export const customersRouter = Router();

// ซิงก์โปรไฟล์ลูกค้าจาก LINE OA (สร้างใหม่ หรือ อัปเดตข้อมูลเดิม)
customersRouter.post('/sync', async (req, res) => {
  const { line_user_id, display_name, picture_url, phone, address } = req.body;
  if (!line_user_id) {
    return res.status(400).json({ error: 'line_user_id is required' });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM customers WHERE line_user_id = ?', [line_user_id]);

    if (existing.length > 0) {
      // อัปเดตข้อมูลที่มีอยู่แล้ว
      await pool.query(
        `UPDATE customers 
         SET display_name = COALESCE(?, display_name),
             picture_url = COALESCE(?, picture_url),
             phone = COALESCE(?, phone),
             address = COALESCE(?, address)
         WHERE line_user_id = ?`,
        [display_name, picture_url, phone, address, line_user_id]
      );
      const [updated] = await pool.query('SELECT * FROM customers WHERE line_user_id = ?', [line_user_id]);
      return res.json({ message: 'Customer updated', customer: updated[0] });
    } else {
      // สร้างลูกค้าใหม่
      const [result] = await pool.query(
        'INSERT INTO customers (line_user_id, display_name, picture_url, phone, address) VALUES (?, ?, ?, ?, ?)',
        [line_user_id, display_name || 'LINE User', picture_url || null, phone || null, address || null]
      );
      const [newCustomer] = await pool.query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
      return res.status(201).json({ message: 'Customer created', customer: newCustomer[0] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ดึงโปรไฟล์ลูกค้าด้วย LINE User ID
customersRouter.get('/line/:line_user_id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, cc.cluster_name, cc.preferred_crops 
       FROM customers c 
       LEFT JOIN customer_clusters cc ON c.cluster_id = cc.id 
       WHERE c.line_user_id = ?`,
      [req.params.line_user_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ดึงรายละเอียดลูกค้าและประวัติการสั่งซื้อ
customersRouter.get('/:id', async (req, res) => {
  try {
    const [customerRows] = await pool.query(
      `SELECT c.*, cc.cluster_name 
       FROM customers c 
       LEFT JOIN customer_clusters cc ON c.cluster_id = cc.id 
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (customerRows.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const [orders] = await pool.query('SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC', [req.params.id]);

    res.json({
      ...customerRows[0],
      orders,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// อัปเดตข้อมูลลูกค้า (เช่น ที่อยู่ เบอร์โทร)
customersRouter.put('/:id', async (req, res) => {
  const { display_name, phone, address } = req.body;
  try {
    await pool.query(
      'UPDATE customers SET display_name = COALESCE(?, display_name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ?',
      [display_name, phone, address, req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
