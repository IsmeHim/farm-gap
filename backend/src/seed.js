import dotenv from 'dotenv';
dotenv.config();
import { pool } from './db.js';

async function seed() {
  console.log('🌱 Starting FarmGAP realistic database seeding (Phase 1 Real Farm Workflow)...');

  try {
    const userId = 1;

    // 1. Clean existing data
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    await pool.query('DELETE FROM product_recommendations');
    await pool.query('DELETE FROM order_items');
    await pool.query('DELETE FROM orders');
    await pool.query('DELETE FROM products');
    await pool.query('DELETE FROM customers');
    await pool.query('DELETE FROM customer_clusters');
    await pool.query('DELETE FROM cost_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM storage_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM harvest_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM pest_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM chemical_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM water_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM crop_activities WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM planting_batches WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM plots WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM crops WHERE user_id = ? OR user_id IS NULL', [userId]);
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');

    const [uRows] = await pool.query('SELECT display_name FROM users WHERE id = ?', [userId]);
    const ownerName = uRows[0]?.display_name || 'เจ้าของฟาร์ม';

    // 2. Insert Crops (7 ชนิดผักจริง)
    console.log('🥬 Seeding Crops (คลังชนิดผัก)...');
    const cropsData = [
      ['ผักบุ้งจีน', 'Ipomoea aquatica', 'ผักกินใบ', 20, 0, 'กก.', 'ถุงใส 4 ขีด (7x24)', 20.00, 'leaf', 'แช่น้ำอุ่น 3 ชม. เทน้ำออก ผสมดิน 8 กระบะปูน = 1 แคร่ (2x6 ม.) หว่านเมล็ด 3 ขีด'],
      ['ผักกวางตุ้ง', 'Brassica chinensis', 'ผักกินใบ', 45, 15, 'กก.', 'ถุงใส 4 ขีด (9x18)', 20.00, 'leaf', 'เพาะเมล็ดทิชชูในกล่องปิด 7 วัน ย้ายลงถาดหลุม 200 หลุม 14 วัน แล้วลงแปลง'],
      ['กรีนโอ๊ค (Green Oak)', 'Lactuca sativa', 'ผักสลัด', 42, 14, 'กก.', 'ถุงใส 4 ขีด (9x18)', 35.00, 'leaf', 'ผักสลัดใบหยักสีเขียว รสหวานกรอบ ไม่ขม โตไว นิยมขายแพ็กถุง'],
      ['เรดโอ๊ค (Red Oak)', 'Lactuca sativa', 'ผักสลัด', 45, 14, 'กก.', 'ถุงใส 4 ขีด (9x18)', 35.00, 'leaf', 'ผักสลัดสีแดงอมม่วง สารต้านอนุมูลอิสระสูง ใบอ่อนนุ่ม'],
      ['ฟิลเล่ย์ ไอซ์เบิร์ก (Frillice Iceberg)', 'Lactuca sativa', 'ผักสลัด', 45, 15, 'กก.', 'ถุงใส 4 ขีด (9x18)', 40.00, 'leaf', 'ผักสลัดใบหนา กรอบมาก ทนสภาพอากาศ กลิ่นหอมสดชื่น'],
      ['คอส / โรเมน (Cos / Romaine)', 'Lactuca sativa var. longifolia', 'ผักสลัด', 48, 14, 'กก.', 'ถุงใส 4 ขีด (9x18)', 35.00, 'leaf', 'กรอบหวาน ใบตั้งสูง สำหรับทำซีซาร์สลัด'],
      ['บัตเตอร์เฮด (Butterhead)', 'Lactuca sativa var. capitata', 'ผักสลัด', 45, 14, 'กก.', 'ถุงใส 4 ขีด (9x18)', 40.00, 'leaf', 'ใบเรียบเนียน หวานนุ่ม ละมุนลิ้น']
    ];

    const cropIds = [];
    for (const c of cropsData) {
      const [res] = await pool.query(
        `INSERT INTO crops (user_id, name, scientific_name, category, growth_days, nursery_days, harvest_unit, default_bag_size, default_price, icon, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, ...c]
      );
      cropIds.push(res.insertId);
    }

    // 3. Insert Plots (6 แคร่ตามจริงขนาด 2 x 6 เมตร)
    console.log('📦 Seeding Plots (6 แคร่ตามจริง)...');
    const plotsData = [
      [userId, 1, 'แปลง/แคร่ที่ 1', 'แคร่ 2 x 6 เมตร', 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)', '-', 12, null, null, 'น้ำประปาเกษตรสะอาด', 'น้ำประปาเกษตรสะอาด', 'ปลอดภัย', 'empty', 'แปลงว่าง พร้อมเริ่มรอบปลูกใหม่'],
      [userId, 2, 'แปลง/แคร่ที่ 2', 'แคร่ 2 x 6 เมตร', 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)', '-', 12, null, null, 'น้ำประปาเกษตรสะอาด', 'น้ำประปาเกษตรสะอาด', 'ปลอดภัย', 'empty', 'แปลงว่าง พร้อมเริ่มรอบปลูกใหม่'],
      [userId, 3, 'แปลง/แคร่ที่ 3', 'แคร่ 2 x 6 เมตร', 'ดินปรุงพิเศษ + พีทมอส + มูลไส้เดือน สำหรับผักสลัด', 'ผักบุ้งจีน', 12, '2026-09-19', '2026-10-09', 'น้ำสะอาดมาตรฐาน GAP', 'น้ำสะอาดมาตรฐาน GAP', 'ปลอดภัย', 'growing', 'กำลังเจริญเติบโตสม่ำเสมอ'],
      [userId, 4, 'แปลง/แคร่ที่ 4', 'แคร่ 2 x 6 เมตร', 'ดินปรุงพิเศษ + พีทมอส + มูลไส้เดือน สำหรับผักสลัด', 'ฟิลเล่ย์ ไอซ์เบิร์ก (Frillice Iceberg)', 12, '2026-03-01', '2026-04-15', 'น้ำสะอาดมาตรฐาน GAP', 'น้ำสะอาดมาตรฐาน GAP', 'ปลอดภัย', 'harvest_ready', 'ใบหยิกหนากรอบมาก พร้อมเก็บเกี่ยว'],
      [userId, 5, 'แปลง/แคร่ที่ 5', 'แคร่ 2 x 6 เมตร', 'ดินผสมกากยาง + ปุ๋ยหมักชีวภาพ', 'ผักบุ้งจีน', 12, '2026-09-19', '2026-10-09', 'น้ำสะอาดมาตรฐาน GAP', 'น้ำสะอาดมาตรฐาน GAP', 'ปลอดภัย', 'growing', 'กำลังเจริญเติบโตสม่ำเสมอ'],
      [userId, 6, 'แปลง/แคร่ที่ 6', 'แคร่ 2 x 6 เมตร', 'ดินผสมกากยาง + ปุ๋ยหมักชีวภาพ (เตรียมพักแปลง)', 'ผักบุ้งจีน', 12, '2026-09-19', '2026-10-09', 'น้ำสะอาดมาตรฐาน GAP', 'น้ำสะอาดมาตรฐาน GAP', 'ปลอดภัย', 'growing', 'กำลังเจริญเติบโตสม่ำเสมอ']
    ];

    const plotIds = [];
    for (const p of plotsData) {
      const [res] = await pool.query(
        `INSERT INTO plots (user_id, plot_number, name, dimension, soil_recipe, crop_name, area_sqm, planting_date, expected_harvest_date, water_source, water_source_type, field_safety_status, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p
      );
      plotIds.push(res.insertId);
    }

    // 4. Insert Planting Batches (รอบการปลูก)
    console.log('🌱 Seeding Planting Batches...');
    const batchesData = [
      [userId, 'BATCH-260919-P3-641', plotIds[2], cropIds[0], '2026-09-19', '2026-10-09', 'growing', 1, 'หว่านเมล็ด 3 ขีดใน 1 แคร่'],
      [userId, 'BATCH-2026-FL01', plotIds[3], cropIds[4], '2026-03-01', '2026-04-15', 'harvest_ready', 1, 'ฟิลเล่ย์ ไอซ์เบิร์ก แปลงที่ 4 ใบหยักสวย กรอบมาก'],
      [userId, 'BATCH-260919-P5-188', plotIds[4], cropIds[0], '2026-09-19', '2026-10-09', 'growing', 1, 'รดน้ำเช้า-เย็นสม่ำเสมอ'],
      [userId, 'BATCH-260919-P6-118', plotIds[5], cropIds[0], '2026-09-19', '2026-10-09', 'growing', 1, 'รดน้ำเช้า-เย็นสม่ำเสมอ']
    ];

    for (let i = 0; i < batchesData.length; i++) {
      const b = batchesData[i];
      const [bRes] = await pool.query(
        `INSERT INTO planting_batches (user_id, batch_code, plot_id, crop_id, start_date, expected_harvest_date, status, auto_water, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        b
      );
      // Update plot with current_batch_id
      await pool.query('UPDATE plots SET current_batch_id = ? WHERE id = ?', [bRes.insertId, b[2]]);
    }

    // 5. Insert Crop Activities (Timeline ตามสมุดจดจริง)
    console.log('📖 Seeding Crop Activities (จากสมุดจดจริง)...');
    const activities = [
      [userId, plotIds[0], '2026-02-01', 'soil_prep', 'ผสมดินในกระบะปูน', 'กากยางที่พัฒนาที่ดินเอามาให้ 1 คันรถ 6 ล้อ ผสมกากยาง 2 กระสอบ ขี้ไก่ 1/2 กระสอบต่อ 1 กระบะปูน ผสม 8 กระบะปูนได้ 1 แคร่ (2x6 ม.)', 'กากยาง 16 กระสอบ, ขี้ไก่ 4 กระสอบ', ownerName],
      [userId, plotIds[0], '2026-02-05', 'seeding', 'แช่เมล็ดผักบุ้งน้ำอุ่น', 'แช่เมล็ดผักบุ้ง 3 ขีดในน้ำอุ่น 3 ชั่วโมง แล้วเทน้ำออก ให้พอหมาดๆ ตั้งไว้ค้างคืน', 'เมล็ดผักบุ้ง 3 ขีด', ownerName],
      [userId, plotIds[0], '2026-02-06', 'seeding', 'หว่านเมล็ดผักบุ้งในแคร่ 1', 'หว่านเมล็ดผักบุ้ง 3 ขีด ใน 1 แคร่ (2x6 ม.) รดน้ำเช้า-เย็น', 'เมล็ดผักบุ้ง', ownerName],
      [userId, plotIds[0], '2026-02-15', 'growing', 'ใส่ปุ๋ยขี้ไก่บำรุงต้น', 'ใส่ปุ๋ยขี้ไก่หมัก 3 ถังปูน โรยทั่วทั้งแคร่', 'ปุ๋ยขี้ไก่หมัก 3 ถังปูน', ownerName],
      [userId, plotIds[0], '2026-02-20', 'harvest', 'เก็บเกี่ยวผักบุ้งจีนส่งจำหน่าย', 'เก็บผักบุ้งได้ 30 กก. ต่อ 1 แคร่ ล้างน้ำสะอาด บรรจุถุงใส 7x24 ถุงละ 4 ขีด ขาย 20 บาท ได้ 75 ถุง', 'ถุงใส 7x24 นิ้ว', ownerName],

      [userId, plotIds[1], '2026-02-01', 'seeding', 'เพาะเมล็ดพันธุ์ผักกวางตุ้งในกล่องทิชชู', 'เพาะเมล็ดในกล่องพลาสติกมีฝาปิด วางทิชชู พ่นน้ำพอหมาด โรยเมล็ด ปิดฝา 7 วัน', 'เมล็ดพันธุ์กวางตุ้ง, กระดาษทิชชู', ownerName],
      [userId, plotIds[1], '2026-02-09', 'nursery', 'ย้ายต้นกล้าลงถาดหลุม 200 หลุม', 'ใช้ถาดหลุม 200 หลุม ใส่พีทมอส หยอดต้นกล้า ให้น้ำ เช้า-เที่ยง-เย็น', 'พีทมอส 1 กระสอบ, ถาดหลุม 200 หลุม', ownerName],
      [userId, plotIds[1], '2026-02-10', 'soil_prep', 'ผสมดินเตรียมแปลงกวางตุ้ง (แปลง 2)', 'ผสมดินเหมือนผักบุ้ง 8 กระบะปูนต่อ 1 แปลง', 'กากยาง 16 กระสอบ, ขี้ไก่ 4 กระสอบ', ownerName],
      [userId, plotIds[1], '2026-02-20', 'growing', 'ย้ายต้นกล้ากวางตุ้งลงแปลงจริง', 'นำต้นกล้าที่อยู่ในถาดหลุม 11 วัน ปลูกลงในแปลง รดน้ำเช้า-เย็น', 'ต้นกล้ากวางตุ้ง 200 ต้น', ownerName],
      [userId, plotIds[1], '2026-03-05', 'growing', 'ใส่ปุ๋ยขี้ไก่รอบโคนต้น', 'ใส่ปุ๋ยขี้ไก่ 3 อ่างป่น รอบๆ ต้น พร้อมพรวนดินตื้นๆ', 'ปุ๋ยขี้ไก่ 3 อ่างป่น', ownerName],
      [userId, plotIds[1], '2026-03-15', 'harvest', 'เก็บเกี่ยวผักกวางตุ้งส่งจำหน่าย', 'เก็บผักกวางตุ้งได้ 30 กก. บรรจุถุงใส 9x18 ถุงละ 4 ขีด ขาย 20 บาท ได้ 75 ถุง', 'ถุงใส 9x18 นิ้ว', ownerName]
    ];

    for (const a of activities) {
      await pool.query(
        `INSERT INTO crop_activities (user_id, plot_id, activity_date, stage, title, details, materials_used, operator_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        a
      );
    }

    // 6. Insert Water Logs (GAP #1) - คลีน ไม่มีปริมาณลิตร และแหล่งน้ำชัดเจน
    console.log('💧 Seeding Water Logs...');
    const waterData = [
      [userId, plotIds[2], '2026-09-19', 'เช้า', 'น้ำสะอาดมาตรฐาน GAP', 'น้ำสะอาดมาตรฐาน GAP', 'ผ่าน', 1, ownerName, 'รดน้ำรอบเช้าสม่ำเสมอ'],
      [userId, plotIds[3], '2026-09-19', 'เช้า', 'น้ำสะอาดมาตรฐาน GAP', 'น้ำสะอาดมาตรฐาน GAP', 'ผ่าน', 1, ownerName, 'รดน้ำรอบเช้าสม่ำเสมอ'],
      [userId, plotIds[4], '2026-09-19', 'เช้า', 'น้ำสะอาดมาตรฐาน GAP', 'น้ำสะอาดมาตรฐาน GAP', 'ผ่าน', 1, ownerName, 'รดน้ำรอบเช้าสม่ำเสมอ'],
      [userId, plotIds[5], '2026-09-19', 'เช้า', 'น้ำสะอาดมาตรฐาน GAP', 'น้ำสะอาดมาตรฐาน GAP', 'ผ่าน', 1, ownerName, 'รดน้ำรอบเช้าสม่ำเสมอ']
    ];
    for (const w of waterData) {
      await pool.query(
        `INSERT INTO water_logs (user_id, plot_id, log_date, session, water_source, water_source_type, water_quality, contamination_check, worker_name, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        w
      );
    }

    // 7. Insert Chemical Logs (GAP #3 - ปุ๋ยชีวภาพ/น้ำหมักชีวภาพ)
    console.log('🧪 Seeding Bio-fertilizer Logs...');
    const chemData = [
      [userId, plotIds[2], '2026-09-19', 'น้ำหมักชีวภาพ', 'น้ำหมักสับปะรด + จุลินทรีย์สังเคราะห์แสง', 200, 'ซีซี', 'บำรุงรากและเสริมการเจริญเติบโต', 'ผสมน้ำรดแปลง', 1, 'ฟาร์มหมักชีวภาพ', 'ชีวภาพปลอดภัย 100%', 0, ownerName, 'รดทุก 3 วันตามรอบ'],
      [userId, plotIds[3], '2026-04-01', 'ปุ๋ยอินทรีย์', 'ปุ๋ยขี้ไก่หมักธรรมชาติ', 3, 'ถังปูน', 'บำรุงก้านใบและขยายทรงพุ่ม', 'โรยรอบโคนต้น', 1, 'มูลไก่ฟาร์มปิด', 'อินทรีย์ปลอดภัย', 0, ownerName, 'พรวนกลบดินตื้นๆ']
    ];
    for (const c of chemData) {
      await pool.query(
        `INSERT INTO chemical_logs (user_id, plot_id, log_date, chem_type, product_name, amount, unit, reason, application_method, safety_ppe, manufacturer, chemical_label, phi_days, worker_name, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c
      );
    }

    // 8. Insert Pest Logs (GAP #4 - สำรวจศัตรูพืช)
    console.log('🐛 Seeding Pest Logs...');
    const pestData = [
      [userId, plotIds[2], '2026-09-19', 'เพลี้ยไฟ (Thrips)', 'น้อยมาก (Level 1)', 'ติดกับดักกาวเหนียวสีเหลือง', ownerName, 'ดักจับแมลงได้ดี ไม่ระบาด']
    ];
    for (const p of pestData) {
      await pool.query(
        `INSERT INTO pest_logs (user_id, plot_id, log_date, pest_or_disease, severity, treatment_method, worker_name, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        p
      );
    }

    // 9. Insert Harvest Logs (GAP #5)
    console.log('🌾 Seeding Harvest Logs...');
    const harvestData = [
      [userId, plotIds[0], '2026-02-20', 30.00, 'kg', 'เกรด A พรีเมียม', 'GAP-2026-PB01', 1500.00, 'ผ่านเกณฑ์สุขอนามัย GAP', 'ล้างน้ำสะอาด บรรจุถุงใส 7x24 ถุงละ 4 ขีด (ได้ 75 ถุง)', ownerName, 'ผักบุ้งจีนสด สะอาด น้ำหนัก 30 กก.'],
      [userId, plotIds[1], '2026-03-15', 30.00, 'kg', 'เกรด A พรีเมียม', 'GAP-2026-KT01', 1500.00, 'ผ่านเกณฑ์สุขอนามัย GAP', 'ล้างน้ำสะอาด บรรจุถุงใส 9x18 ถุงละ 4 ขีด (ได้ 75 ถุง)', ownerName, 'ผักกวางตุ้งสด สะอาด น้ำหนัก 30 กก.']
    ];
    for (const h of harvestData) {
      await pool.query(
        `INSERT INTO harvest_logs (user_id, plot_id, harvest_date, quantity, unit, quality_grade, lot_code, revenue, harvest_hygiene, postharvest_handling, worker_name, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        h
      );
    }

    // 10. Insert Storage Logs (GAP #6)
    console.log('📦 Seeding Storage Logs...');
    await pool.query(
      `INSERT INTO storage_logs (user_id, harvest_id, log_date, storage_location, shipped_to, buyer, vehicle, vehicle_clean_status, storage_conditions, delivery_condition, worker_name, notes)
       VALUES (?, 1, '2026-02-20', 'ห้องเย็นจัดเก็บผลผลิต GAP', 'ร้านกรีนสลัด & สั่งซื้อทาง LINE', 'ลูกค้าทั่วไป / LINE OA', 'รถกระบะห้องเย็น', 1, 'อุณหภูมิ 8-10C', 'สมบูรณ์สดใหม่', ownerName, 'ส่งมอบสดใหม่ทุกวัน')`,
      [userId]
    );

    // 11. Insert Cost Logs
    console.log('💰 Seeding Cost Logs...');
    const costData = [
      [userId, plotIds[0], '2026-02-01', 'วัสดุปลูก/ปรับปรุงดิน', 'กากยางพัฒนาที่ดิน 16 กระสอบ + ขี้ไก่ 4 กระสอบ สำหรับ 8 กระบะปูน', 600.00],
      [userId, plotIds[1], '2026-02-01', 'เมล็ดพันธุ์', 'เมล็ดพันธุ์กวางตุ้งและผักบุ้งจีนคุณภาพดี', 250.00],
      [userId, null, '2026-06-01', 'ตรวจวิเคราะห์แล็บ', 'ค่าบริการตรวจวิเคราะห์ตัวอย่างน้ำและสารตกค้าง GAP', 1800.00]
    ];
    for (const c of costData) {
      await pool.query(
        `INSERT INTO cost_logs (user_id, plot_id, log_date, category, description, amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        c
      );
    }

    // 13. Insert Products (สินค้าผักสดจริงพร้อมขายบน LINE LIFF ถุงละ 4 ขีด)
    console.log('🥦 Seeding Real Farm Products...');
    const productsData = [
      [plotIds[2], 'ผักบุ้งจีนสด GAP (ถุงใส 4 ขีด)', 'ผักกินใบ', 20.00, 'ถุง', 75.00, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[0], 'ผักกวางตุ้งสด GAP (ถุงใส 4 ขีด)', 'ผักกินใบ', 20.00, 'ถุง', 75.00, 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[2], 'ผักกรีนโอ๊คสด GAP (Green Oak 4 ขีด)', 'ผักสลัด', 35.00, 'ถุง', 45.00, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[2], 'ผักเรดโอ๊คสด GAP (Red Oak 4 ขีด)', 'ผักสลัด', 35.00, 'ถุง', 30.00, 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[3], 'ผักฟิลเล่ย์ ไอซ์เบิร์ก กรอบพรีเมียม (4 ขีด)', 'ผักสลัด', 40.00, 'ถุง', 50.00, 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[4], 'ผักคอส สดกรอบ (Cos Lettuce 4 ขีด)', 'ผักสลัด', 35.00, 'ถุง', 35.00, 'https://images.unsplash.com/photo-1508747703725-719777637510?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[5], 'ผักบัตเตอร์เฮด เนื้อนุ่ม (Butterhead 4 ขีด)', 'ผักสลัด', 40.00, 'ถุง', 25.00, 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?q=80&w=600&auto=format&fit=crop', 'available'],
      [null, 'น้ำสลัดงาคั่วญี่ปุ่น โฮมเมด (Roasted Sesame)', 'น้ำสลัด', 59.00, 'ขวด', 50.00, 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?q=80&w=600&auto=format&fit=crop', 'available'],
      [null, 'น้ำสลัดซีซาร์ ครีมเข้มข้น (Caesar Dressing)', 'น้ำสลัด', 59.00, 'ขวด', 40.00, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=600&auto=format&fit=crop', 'available']
    ];

    const prodIds = [];
    for (const prod of productsData) {
      const [res] = await pool.query(
        `INSERT INTO products (plot_id, name, category, price, unit, stock_quantity, image_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        prod
      );
      prodIds.push(res.insertId);
    }

    // 14. Insert Customer Clusters (AI K-Means Segments)
    console.log('🤖 Seeding Customer Clusters...');
    const [c1] = await pool.query(`INSERT INTO customer_clusters (cluster_name, description, preferred_crops) VALUES ('สลัดเลิฟเวอร์ (Salad Lovers)', 'เน้นสั่งซื้อผักสลัด (กรีนโอ๊ค, เรดโอ๊ค, คอส) ถี่สัปดาห์ละ 1-2 ครั้ง', '["ผักกรีนโอ๊ค", "ผักเรดโอ๊ค", "ผักฟิลเล่ย์", "น้ำสลัด"]')`);
    const [c2] = await pool.query(`INSERT INTO customer_clusters (cluster_name, description, preferred_crops) VALUES ('ลูกค้าประจำเพื่อสุขภาพ (Health Regulars)', 'ชอบผักบุ้ง กวางตุ้ง บัตเตอร์เฮด และสั่งน้ำสลัดคู่กันเป็นประจำ', '["ผักบุ้งจีน", "ผักกวางตุ้ง", "ผักบัตเตอร์เฮด"]')`);
    const [c3] = await pool.query(`INSERT INTO customer_clusters (cluster_name, description, preferred_crops) VALUES ('กลุ่มร้านอาหารและค้าส่ง (Bulk & B2B)', 'สั่งซื้อปริมาณมาก ยอดเฉลี่ยต่อบิลสูง เน้นผักสลัดและผักกินใบยกชุด', '["ผักบุ้งจีน", "ผักกวางตุ้ง", "ผักกรีนโอ๊ค"]')`);

    // 15. Insert Customers (ลูกค้า LINE)
    console.log('👤 Seeding Customers...');
    const customersData = [
      ['U1111111111111111111111111111111', 'คุณพลอยไพลิน (Healthy Girl)', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200', '089-111-2233', '99/12 หมู่บ้านสุขใจ ซอยอารีย์ 5 พญาไท กทม.', c1.insertId],
      ['U2222222222222222222222222222222', 'คุณเอกชัย (Salad Chef)', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200', '081-444-5566', '128 ร้านอาหารกรีนสลัด ถนนสุขุมวิท 71 วัฒนา กทม.', c3.insertId],
      ['U3333333333333333333333333333333', 'คุณธนากร (รักสุขภาพ)', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200', '086-777-8899', '55/4 คอนโดลุมพินี พระราม 9 ห้วยขวาง กทม.', c2.insertId],
      ['U4444444444444444444444444444444', 'คุณศิริพร (แม่บ้านสายคลีน)', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200', '085-333-4455', '210/8 ซอยลาดพร้าว 71 ลาดพร้าว กทม.', c1.insertId]
    ];

    const custIds = [];
    for (const cust of customersData) {
      const [res] = await pool.query(
        `INSERT INTO customers (line_user_id, display_name, picture_url, phone, address, cluster_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        cust
      );
      custIds.push(res.insertId);
    }

    // 16. Insert Orders & Order Items
    console.log('🛍️ Seeding Orders & Order Items...');
    const ordersData = [
      {
        order_code: 'ORD-20260919-1001',
        customer_id: custIds[0],
        total_amount: 99.00,
        status: 'pending',
        delivery_type: 'delivery',
        delivery_date: '2026-09-20',
        slip_image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600',
        notes: 'ขอผักบุ้งและผักกวางตุ้งสดๆ นะคะ',
        items: [
          { product_id: prodIds[0], quantity: 2, unit_price: 20.00, subtotal: 40.00 },
          { product_id: prodIds[7], quantity: 1, unit_price: 59.00, subtotal: 59.00 }
        ]
      },
      {
        order_code: 'ORD-20260919-1002',
        customer_id: custIds[1],
        total_amount: 320.00,
        status: 'paid',
        delivery_type: 'delivery',
        delivery_date: '2026-09-20',
        slip_image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600',
        notes: 'ส่งก่อน 11 โมงครับ',
        items: [
          { product_id: prodIds[4], quantity: 5, unit_price: 40.00, subtotal: 200.00 },
          { product_id: prodIds[8], quantity: 2, unit_price: 59.00, subtotal: 118.00 }
        ]
      }
    ];

    for (const ord of ordersData) {
      const [oRes] = await pool.query(
        `INSERT INTO orders (order_code, customer_id, total_amount, status, delivery_type, delivery_date, slip_image_url, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ord.order_code, ord.customer_id, ord.total_amount, ord.status, ord.delivery_type, ord.delivery_date, ord.slip_image_url, ord.notes]
      );
      for (const it of ord.items) {
        await pool.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?)`,
          [oRes.insertId, it.product_id, it.quantity, it.unit_price, it.subtotal]
        );
      }
    }

    // 17. Insert AI Product Recommendations
    console.log('🤖 Seeding Product Recommendations Matrix...');
    const recs = [
      [prodIds[0], prodIds[1], 0.95, 'ลูกค้ามักซื้อผักบุ้งจีนคู่กับผักกวางตุ้งสำหรับทำอาหารคู่กัน'],
      [prodIds[2], prodIds[3], 0.92, 'ลูกค้ามักสั่งซื้อ กรีนโอ๊ค คู่กับ เรดโอ๊ค เพื่อจัดจานสลัดทูโทน'],
      [prodIds[4], prodIds[7], 0.90, 'ฟิลเล่ย์ไอซ์เบิร์กทานคู่กับน้ำสลัดงาคั่วเพิ่มความกรอบอร่อย'],
      [prodIds[5], prodIds[8], 0.88, 'ผักคอสกับน้ำสลัดซีซาร์ เมนูคลาสสิกยอดนิยม']
    ];
    for (const r of recs) {
      await pool.query(
        `INSERT INTO product_recommendations (product_id, recommended_product_id, score, reason)
         VALUES (?, ?, ?, ?)`,
        r
      );
    }

    console.log('✅ Phase 1 Database Seeding Complete with 6 Plots, Crops, Batches, Real Products & Notebook Timeline!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
