import { Router } from 'express';
import { pool } from '../db.js';

export const productsRouter = Router();

// ดึงรายการสินค้าผักทั้งหมด (สำหรับลูกค้า และ ฟาร์ม)
productsRouter.get('/', async (req, res) => {
  try {
    const { status, category } = req.query;
    let query = 'SELECT p.*, pl.name AS plot_name FROM products p LEFT JOIN plots pl ON p.plot_id = pl.id WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }
    if (category) {
      query += ' AND p.category = ?';
      params.push(category);
    }

    query += ' ORDER BY p.id DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ดึงรายละเอียดผักรายชิ้น
productsRouter.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT p.*, pl.name AS plot_name FROM products p LEFT JOIN plots pl ON p.plot_id = pl.id WHERE p.id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// เพิ่มสินค้าผักใหม่ (สำหรับเจ้าของฟาร์ม)
productsRouter.post('/', async (req, res) => {
  const { plot_id, name, category, price, unit, stock_quantity, image_url, status } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO products (plot_id, name, category, price, unit, stock_quantity, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        plot_id || null,
        name,
        category || 'ผักสลัด',
        price,
        unit || 'ถุง',
        stock_quantity || 0,
        image_url || null,
        status || 'available',
      ]
    );

    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// อัปเดตผัก (ราคา สต็อก สถานะ)
productsRouter.put('/:id', async (req, res) => {
  const { plot_id, name, category, price, unit, stock_quantity, image_url, status } = req.body;

  try {
    const [existing] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Product not found' });

    const current = existing[0];
    await pool.query(
      `UPDATE products 
       SET plot_id = ?, name = ?, category = ?, price = ?, unit = ?, stock_quantity = ?, image_url = ?, status = ?
       WHERE id = ?`,
      [
        plot_id !== undefined ? plot_id : current.plot_id,
        name || current.name,
        category || current.category,
        price !== undefined ? price : current.price,
        unit || current.unit,
        stock_quantity !== undefined ? stock_quantity : current.stock_quantity,
        image_url !== undefined ? image_url : current.image_url,
        status || current.status,
        req.params.id,
      ]
    );

    const [updated] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ลบสินค้าผัก
productsRouter.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
