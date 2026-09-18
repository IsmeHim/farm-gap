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
    let [existingClusters] = await pool.query('SELECT * FROM customer_clusters ORDER BY id ASC');
    if (existingClusters.length === 0) {
      await pool.query(`
        INSERT INTO customer_clusters (cluster_name, description, preferred_crops) VALUES
        ('สลัดเลิฟเวอร์ (Salad Lovers)', 'เน้นสั่งซื้อผักสลัดบ่อยครั้ง ปริมาณยอดเงินปานกลาง', '["กรีนโอ๊ค", "เรดโอ๊ค", "บัตเตอร์เฮด"]'),
        ('ลูกค้าประจำเพื่อสุขภาพ (Health Regulars)', 'ชอบผักเคล บัตเตอร์เฮด และสั่งน้ำสลัดคู่กันเป็นประจำ', '["คอส", "ฟินเลย์", "คะน้า"]'),
        ('กลุ่มร้านอาหารและค้าส่ง (Bulk & B2B)', 'สั่งซื้อปริมาณมาก ยอดชำระต่อบิลสูง สั่งซื้อผักหลากหลาย', '["กรีนโอ๊ค", "คอส", "ผักชี"]')
      `);
      [existingClusters] = await pool.query('SELECT * FROM customer_clusters ORDER BY id ASC');
    }

    const clusterIds = existingClusters.map(c => c.id);
    if (clusterIds.length === 0) {
      return res.status(500).json({ error: 'ไม่พบหมวดหมู่กลุ่มลูกค้าในระบบ' });
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

    if (users.length === 0) {
      return res.json({ success: true, message: 'ยังไม่มีข้อมูลลูกค้าในระบบ' });
    }

    // หากไม่มีลูกค้าเลย หรือมีลูกค้าน้อยกว่า 3 คน ให้จับคู่กลุ่มเริ่มต้นโดยตรง
    if (users.length < 3) {
      for (const u of users) {
        let clusterId = clusterIds[0];
        if (u.total_spend > 5000) clusterId = clusterIds[2] || clusterIds[0];
        else if (u.order_count > 3) clusterId = clusterIds[1] || clusterIds[0];
        await pool.query('UPDATE customers SET cluster_id = ? WHERE id = ?', [clusterId, u.customer_id]);
      }
      return res.json({ success: true, message: 'ลูกค้าน้อยเกินไปสำหรับ K-Means, จัดกลุ่มแบบเบื้องต้นสำเร็จ' });
    }

    // 4.3 เตรียมข้อมูลสำหรับการทำ K-Means
    const K = Math.min(clusterIds.length, 3);
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

    // เริ่มต้น Centroids K จุดแบบสุ่มปลอดภัย
    const shuffled = [...Array(normalizedData.length).keys()].sort(() => 0.5 - Math.random());
    let centroids = [];
    for (let k = 0; k < K; k++) {
      const idx = shuffled[k % shuffled.length];
      centroids.push([...normalizedData[idx].features]);
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
        return count === 0 ? centroids[cIdx] : c.map(val => val / count);
      });

      iterations--;
    }

    // 4.4 บันทึกผลลัพธ์กลับลงไปในฐานข้อมูลลูกค้า โดยอ้างอิง cluster_id จากตารางจริง
    for (let i = 0; i < normalizedData.length; i++) {
      const customerId = normalizedData[i].id;
      const clusterIdx = assignments[i];
      const clusterId = clusterIds[clusterIdx] || clusterIds[0];
      await pool.query('UPDATE customers SET cluster_id = ? WHERE id = ?', [clusterId, customerId]);
    }

    res.json({ success: true, message: 'โมเดล K-Means จัดกลุ่มลูกค้าตามพฤติกรรมการซื้อสำเร็จ' });
  } catch (error) {
    console.error('K-Means Cluster error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: ค้นหากลุ่มลูกค้าเป้าหมายสำหรับยิงแจ้งเตือน LINE
async function getTargetCustomers({ target_type = 'auto', cluster_id = null, crop_name = '' }) {
  let customers = [];

  if (target_type === 'cluster' && cluster_id) {
    // 1. เจาะจงตามกลุ่ม Cluster ID
    const [rows] = await pool.query(
      `SELECT c.id, c.line_user_id, c.display_name, c.picture_url, c.cluster_id, cc.cluster_name
       FROM customers c
       LEFT JOIN customer_clusters cc ON c.cluster_id = cc.id
       WHERE c.cluster_id = ? AND c.line_user_id IS NOT NULL AND TRIM(c.line_user_id) != ''`,
      [cluster_id]
    );
    customers = rows;
  } else if (target_type === 'all') {
    // 2. ลูกค้าทุกคนที่มี LINE
    const [rows] = await pool.query(
      `SELECT c.id, c.line_user_id, c.display_name, c.picture_url, c.cluster_id, cc.cluster_name
       FROM customers c
       LEFT JOIN customer_clusters cc ON c.cluster_id = cc.id
       WHERE c.line_user_id IS NOT NULL AND TRIM(c.line_user_id) != ''`
    );
    customers = rows;
  } else {
    // 3. AI Target Matching ตามความชอบผักและประวัติสั่งซื้อ
    const searchPattern = `%${(crop_name || '').trim()}%`;
    const [rows] = await pool.query(
      `SELECT DISTINCT c.id, c.line_user_id, c.display_name, c.picture_url, c.cluster_id, cc.cluster_name
       FROM customers c
       LEFT JOIN customer_clusters cc ON c.cluster_id = cc.id
       LEFT JOIN orders o ON o.customer_id = c.id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE c.line_user_id IS NOT NULL AND TRIM(c.line_user_id) != ''
         AND (
           (cc.preferred_crops IS NOT NULL AND (cc.preferred_crops LIKE ? OR ? LIKE CONCAT('%', cc.cluster_name, '%')))
           OR (p.name IS NOT NULL AND (p.name LIKE ? OR ? LIKE CONCAT('%', p.name, '%')))
         )`,
      [searchPattern, crop_name, searchPattern, crop_name]
    );
    customers = rows;
  }

  return customers;
}

// 5. ดึงข้อมูลกลุ่มผู้รับล่วงหน้าสำหรับ Live Preview ในหน้าต่าง Modal
aiRouter.get('/push-preview', async (req, res) => {
  try {
    const { target_type = 'auto', cluster_id, crop_name = '' } = req.query;
    const customers = await getTargetCustomers({ target_type, cluster_id, crop_name });
    res.json({
      success: true,
      count: customers.length,
      customers: customers.map(c => ({
        id: c.id,
        name: c.display_name,
        picture_url: c.picture_url,
        cluster_id: c.cluster_id,
        cluster_name: c.cluster_name || 'ทั่วไป',
        is_real_line: Boolean(c.line_user_id && c.line_user_id.startsWith('U') && c.line_user_id.length > 20)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. ยิง LINE Push Notification แบบเจาะจงกลุ่มเป้าหมายและกำหนดข้อความได้
aiRouter.post('/notify-harvest', async (req, res) => {
  const {
    harvest_id,
    crop_name,
    quantity,
    unit,
    plot_name,
    target_type = 'auto',
    cluster_id = null,
    custom_title = '',
    custom_message = '',
    custom_image_url = '',
    cta_label = '',
    cta_url = ''
  } = req.body;

  if (!crop_name) {
    return res.status(400).json({ error: 'crop_name is required' });
  }

  try {
    const customers = await getTargetCustomers({ target_type, cluster_id, crop_name });

    if (customers.length === 0) {
      return res.json({
        success: true,
        notified_count: 0,
        target_customers: [],
        message: 'ไม่พบลูกค้าในกลุ่มเป้าหมายที่เลือก'
      });
    }

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const isMock = !token || token === 'dummy_token';
    const client = isMock ? null : new MessagingApiClient({ channelAccessToken: token });

    const finalTitle = (custom_title || '').trim() || `🥦 ${crop_name} สดๆ เพิ่งเก็บเกี่ยววันนี้!`;
    const finalImage = (custom_image_url || '').trim() || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop';
    const finalCtaLabel = (cta_label || '').trim() || '🛒 กดสั่งซื้อผักสดทันที';
    const finalCtaUrl = (cta_url || '').trim() || process.env.LIFF_ORDER_URL || 'https://liff.line.me/2011230817-FlfQg9Yb';

    let sentCount = 0;

    for (const c of customers) {
      let bodyText = (custom_message || '').trim();
      if (!bodyText) {
        bodyText = `สวัสดีครับคุณ {name} ทางฟาร์ม FarmGAP พึ่งเก็บเกี่ยว ${crop_name} ${quantity ? `จำนวน ${quantity} ${unit || 'กก.'}` : ''} จากแปลง ${plot_name || 'เพาะปลูก'} สดใหม่ ได้มาตรฐานความปลอดภัย GAP พร้อมจัดส่งถึงมือคุณแล้วครับ!`;
      }
      bodyText = bodyText.replace(/{name}/g, c.display_name || 'ลูกค้าคนพิเศษ');

      const flexNotify = {
        type: 'flex',
        altText: finalTitle,
        contents: {
          type: 'bubble',
          hero: {
            type: 'image',
            url: finalImage,
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
                text: finalTitle,
                weight: 'bold',
                size: 'md',
                color: '#15803d',
                wrap: true,
              },
              {
                type: 'text',
                text: bodyText,
                wrap: true,
                size: 'sm',
                color: '#334155',
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
                  label: finalCtaLabel,
                  uri: finalCtaUrl,
                },
                style: 'primary',
                color: '#15803d',
                height: 'sm',
              },
            ],
          },
        },
      };

      if (!isMock && client) {
        if (c.line_user_id && c.line_user_id.startsWith('U') && c.line_user_id.length > 20) {
          try {
            await client.pushMessage({
              to: c.line_user_id,
              messages: [flexNotify],
            });
            sentCount++;
          } catch (err) {
            console.warn(`Failed LINE Push to ${c.display_name} (${c.line_user_id}):`, err.message);
          }
        }
      } else {
        sentCount++;
      }
    }

    res.json({
      success: true,
      isMock,
      notified_count: isMock ? customers.length : sentCount,
      target_customers: customers.map(c => ({
        id: c.id,
        name: c.display_name,
        cluster: c.cluster_name || 'ทั่วไป'
      })),
      message: `ยิง LINE Push Notification แจ้งเตือนสำเร็จ (${isMock ? customers.length : sentCount} ท่าน)`
    });
  } catch (error) {
    console.error('Notify harvest error:', error);
    res.status(500).json({ error: error.message });
  }
});

