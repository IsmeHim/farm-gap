import { Router } from 'express';
import { messagingApi } from '@line/bot-sdk';
import { pool } from '../db.js';

const { MessagingApiClient } = messagingApi;
const client = new MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy_token',
});

export const aiRouter = Router();


// 1. ดึงรายการสินค้าแนะนำสำหรับสินค้าชิ้นนั้นๆ
aiRouter.get('/recommendations/:productId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, p.name, p.price, p.unit, p.image_url, p.stock_quantity
       FROM product_recommendations r
       JOIN products p ON r.recommended_product_id = p.id
       WHERE r.product_id = ? AND p.status = 'available' AND p.stock_quantity > 0
       ORDER BY r.score DESC LIMIT 3`,
      [req.params.productId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. คำนวณความสัมพันธ์ของสินค้าคู่กัน (Recommendation Matrix)
aiRouter.post('/recommend', async (req, res) => {
  try {
    // ล้างข้อมูลเก่า
    await pool.query('DELETE FROM product_recommendations');

    // คำนวณและบันทึกข้อมูลการซื้อคู่กันแบบ Real-time ด้วย SQL
    await pool.query(`
      INSERT INTO product_recommendations (product_id, recommended_product_id, score, reason)
      SELECT 
        oi1.product_id AS product_id,
        oi2.product_id AS recommended_product_id,
        COUNT(*) / (SELECT COUNT(DISTINCT order_id) FROM order_items WHERE product_id = oi1.product_id) AS score,
        'มักถูกซื้อร่วมกันบ่อยๆ' AS reason
      FROM order_items oi1
      JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id != oi2.product_id
      GROUP BY oi1.product_id, oi2.product_id
      ORDER BY product_id, score DESC
    `);

    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM product_recommendations');
    res.json({ success: true, message: `คำนวณผักซื้อคู่กันใหม่เสร็จสิ้น (${rows[0].total} รายการบันทึก)` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. สถิติกลุ่มลูกค้า K-Means (สำหรับเกษตรกรดูแดชบอร์ด)
aiRouter.get('/clusters', async (req, res) => {
  try {
    const [clusters] = await pool.query('SELECT * FROM customer_clusters');
    const [customerStats] = await pool.query(`
      SELECT c.id, c.display_name, c.picture_url, c.cluster_id, cc.cluster_name,
             (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) AS order_count,
             (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = c.id) AS total_spend
      FROM customers c
      LEFT JOIN customer_clusters cc ON c.cluster_id = cc.id
      ORDER BY total_spend DESC
    `);
    res.json({ clusters, customers: customerStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. รันโมเดลจัดกลุ่มลูกค้า K-Means (Customer Behavior Clustering)
aiRouter.post('/cluster', async (req, res) => {
  try {
    // 4.1 ตรวจสอบและสร้างหมวดหมู่คลัสเตอร์เริ่มต้นถ้ายังไม่มี
    const [existingClusters] = await pool.query('SELECT * FROM customer_clusters');
    if (existingClusters.length === 0) {
      await pool.query(`
        INSERT INTO customer_clusters (id, cluster_name, description, preferred_crops) VALUES
        (1, 'สลัดเลิฟเวอร์ (Salad Lovers)', 'เน้นสั่งซื้อผักสลัดบ่อยครั้ง ปริมาณยอดเงินปานกลาง', '["กรีนโอ๊ค", "เรดโอ๊ค", "บัตเตอร์เฮด"]'),
        (2, 'ลูกค้าขาประจำ (Regular Customers)', 'สั่งซื้อครอบคลุม ผักรวมหลากหลาย และมีจำนวนออเดอร์สม่ำเสมอ', '["คอส", "ฟินเลย์", "คะน้า"]'),
        (3, 'ลูกค้าขายส่ง / B2B (Bulk Buyers)', 'สั่งจำนวนมาก ยอดชำระต่อบิลสูง สั่งซื้อผักหลากหลาย', '["กรีนโอ๊ค", "คอส", "ผักชี"]')
      `);
    }

    // 4.2 ดึงข้อมูลพฤติกรรมลูกค้ามาทำฟีเจอร์เวกเตอร์
    const [users] = await pool.query(`
      SELECT 
        c.id AS customer_id,
        COUNT(DISTINCT o.id) AS order_count,
        CAST(COALESCE(SUM(o.total_amount), 0) AS DOUBLE) AS total_spend,
        CAST(COALESCE(AVG(o.total_amount), 0) AS DOUBLE) AS avg_order_value,
        CAST(COALESCE(SUM(oi.quantity), 0) AS DOUBLE) AS total_items
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY c.id
    `);

    // หากไม่มีลูกค้าเลย หรือมีลูกค้าน้อยกว่า 3 คน ให้จับคู่กลุ่มเริ่มต้นโดยตรง
    if (users.length < 3) {
      for (const u of users) {
        // จับคลัสเตอร์ตามสัดส่วนยอดซื้อเบื้องต้น
        let clusterId = 1;
        if (u.total_spend > 5000) clusterId = 3;
        else if (u.order_count > 3) clusterId = 2;
        await pool.query('UPDATE customers SET cluster_id = ? WHERE id = ?', [clusterId, u.customer_id]);
      }
      return res.json({ success: true, message: 'ลูกค้าน้อยเกินไปสำหรับ K-Means, จัดกลุ่มแบบเบื้องต้นสำเร็จ' });
    }

    // 4.3 เตรียมข้อมูลสำหรับการทำ K-Means
    const K = 3;
    const data = users.map(u => ({
      id: u.customer_id,
      features: [u.order_count, u.total_spend, u.avg_order_value, u.total_items]
    }));

    // ฟังก์ชันช่วยทำ Normalization (Min-Max)
    const numFeatures = data[0].features.length;
    const mins = Array(numFeatures).fill(Infinity);
    const maxs = Array(numFeatures).fill(-Infinity);

    data.forEach(d => {
      d.features.forEach((val, i) => {
        if (val < mins[i]) mins[i] = val;
        if (val > maxs[i]) maxs[i] = val;
      });
    });

    const normalizedData = data.map(d => ({
      id: d.id,
      features: d.features.map((val, i) => {
        const den = maxs[i] - mins[i];
        return den === 0 ? 0 : (val - mins[i]) / den;
      })
    }));

    // เริ่มต้น Centroids 3 จุดจากข้อมูลสุ่ม
    let centroids = [];
    const chosenIndices = new Set();
    while (centroids.length < K) {
      const randIdx = Math.floor(Math.random() * normalizedData.length);
      if (!chosenIndices.has(randIdx)) {
        chosenIndices.add(randIdx);
        centroids.push([...normalizedData[randIdx].features]);
      }
    }

    // ฟังก์ชันคำนวณระยะห่าง Euclidean
    const euclideanDistance = (a, b) => {
      return Math.sqrt(a.reduce((sum, val, idx) => sum + Math.pow(val - b[idx], 2), 0));
    };

    let iterations = 100;
    let assignments = Array(normalizedData.length).fill(0);
    let centroidsChanged = true;

    while (iterations > 0 && centroidsChanged) {
      centroidsChanged = false;
      let newAssignments = [];

      // 1. มอบหมายกลุ่มที่ใกล้ Centroid ที่สุด
      normalizedData.forEach(d => {
        let minDistance = Infinity;
        let bestCluster = 0;
        centroids.forEach((centroid, cIdx) => {
          const dist = euclideanDistance(d.features, centroid);
          if (dist < minDistance) {
            minDistance = dist;
            bestCluster = cIdx;
          }
        });
        newAssignments.push(bestCluster);
      });

      // ตรวจสอบการอัปเดตกลุ่ม
      if (JSON.stringify(assignments) !== JSON.stringify(newAssignments)) {
        assignments = newAssignments;
        centroidsChanged = true;
      }

      // 2. คำนวณหา Centroids ใหม่
      const newCentroids = Array(K).fill(null).map(() => Array(numFeatures).fill(0));
      const counts = Array(K).fill(0);

      normalizedData.forEach((d, dIdx) => {
        const cIdx = assignments[dIdx];
        counts[cIdx]++;
        d.features.forEach((val, fIdx) => {
          newCentroids[cIdx][fIdx] += val;
        });
      });

      centroids = newCentroids.map((c, cIdx) => {
        const count = counts[cIdx];
        return count === 0 ? c : c.map(val => val / count);
      });

      iterations--;
    }

    // 4.4 บันทึกผลลัพธ์กลับลงไปในฐานข้อมูลลูกค้า
    for (let i = 0; i < normalizedData.length; i++) {
      const customerId = normalizedData[i].id;
      // แปลงจาก cluster index 0,1,2 เป็น cluster_id 1,2,3
      const clusterId = assignments[i] + 1;
      await pool.query('UPDATE customers SET cluster_id = ? WHERE id = ?', [clusterId, customerId]);
    }

    res.json({ success: true, message: 'โมเดล K-Means จัดกลุ่มลูกค้าตามพฤติกรรมการซื้อสำเร็จ' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. ยิง LINE Push Notification แบบเจาะจงกลุ่มเป้าหมาย (Personalized Push)
aiRouter.post('/notify-harvest', async (req, res) => {
  const { harvest_id, crop_name, quantity, unit, plot_name } = req.body;
  if (!crop_name) {
    return res.status(400).json({ error: 'crop_name is required' });
  }

  try {
    // ดึงข้อมูลลูกค้าที่ตรงเงื่อนไข (เคยสั่งผักชนิดนี้ หรือ อยู่ในกลุ่ม Cluster ที่ชอบผักชนิดนี้)
    const searchPattern = `%${crop_name}%`;
    let [customers] = await pool.query(
      `SELECT DISTINCT c.id, c.line_user_id, c.display_name, c.cluster_id, cc.cluster_name
       FROM customers c
       LEFT JOIN customer_clusters cc ON c.cluster_id = cc.id
       LEFT JOIN orders o ON o.customer_id = c.id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE (p.name LIKE ? OR cc.preferred_crops LIKE ?)`,
      [searchPattern, searchPattern]
    );

    // หากไม่พบลูกค้าตรงกลุ่มเฉพาะ ให้ดึงลูกค้า LINE ทั้งหมดเป็น Fallback
    if (customers.length === 0) {
      const [allCustomers] = await pool.query(
        `SELECT c.id, c.line_user_id, c.display_name, c.cluster_id, cc.cluster_name
         FROM customers c
         LEFT JOIN customer_clusters cc ON c.cluster_id = cc.id LIMIT 20`
      );
      customers = allCustomers;
    }

    if (customers.length === 0) {
      return res.json({ success: true, notified_count: 0, target_customers: [], message: 'ยังไม่มีลูกค้า LINE ในระบบ' });
    }

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const isMock = !token || token === 'dummy_token';

    // วนลูปยิง Push Notification หาแต่ละคน
    for (const c of customers) {
      const flexNotify = {
        type: 'flex',
        altText: `🥦 ${crop_name} สดๆ จากแปลง พร้อมส่งแล้ววันนี้!`,
        contents: {
          type: 'bubble',
          hero: {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop',
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
                text: `🥦 ${crop_name} สดๆ เพิ่งเก็บเกี่ยววันนี้!`,
                weight: 'bold',
                size: 'lg',
                color: '#2e7d32',
              },
              {
                type: 'text',
                text: `สวัสดีครับคุณ ${c.display_name || 'ลูกค้า LINE'} ทางฟาร์ม FarmGAP AI พึ่งเก็บเกี่ยว ${crop_name} ${quantity ? `จำนวน ${quantity} ${unit || 'กก.'}` : ''} จากแปลง ${plot_name || 'เพาะปลูก'} สดใหม่ ได้มาตรฐานความปลอดภัย GAP พร้อมจัดส่งถึงมือคุณแล้วครับ!`,
                wrap: true,
                size: 'sm',
                color: '#444444',
              },
            ],
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: '🛒 กดสั่งซื้อผักสดทันที',
                  uri: process.env.LIFF_ORDER_URL || 'https://liff.line.me/dummy-liff-order-id',
                },
                style: 'primary',
                color: '#2e7d32',
              },
            ],
          },
        },
      };

      if (!isMock) {
        try {
          await client.pushMessage({
            to: c.line_user_id,
            messages: [flexNotify],
          });
        } catch (err) {
          console.warn(`Failed LINE Push to ${c.display_name}:`, err.message);
        }
      }
    }

    res.json({
      success: true,
      isMock,
      notified_count: customers.length,
      target_customers: customers.map(c => ({
        id: c.id,
        name: c.display_name,
        cluster: c.cluster_name || 'ทั่วไป'
      })),
      message: `ยิง LINE Push Notification แจ้งเตือน ${crop_name} สำเร็จ (${customers.length} ท่าน)`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

