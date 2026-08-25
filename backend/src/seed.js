import dotenv from 'dotenv';
dotenv.config();
import { pool } from './db.js';

async function seed() {
  console.log('🌱 Starting FarmGAP realistic database seeding...');

  try {
    const userId = 1;

    // 1. Clean existing data (Optional/Safe replace)
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    await pool.query('DELETE FROM product_recommendations');
    await pool.query('DELETE FROM order_items');
    await pool.query('DELETE FROM orders');
    await pool.query('DELETE FROM products');
    await pool.query('DELETE FROM customers');
    await pool.query('DELETE FROM customer_clusters');
    await pool.query('DELETE FROM gap_checklists WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM cost_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM workers WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM storage_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM harvest_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM pest_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM chemical_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM water_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM plots WHERE user_id = ?', [userId]);
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');

    // 2. Insert Plots (8 แปลงปลูกหลากหลายผัก)
    console.log('📦 Seeding Plots...');
    const plotsData = [
      [userId, 'แปลง A1 (Hydro NFT)', 'ผักกรีนโอ๊ค (Green Oak)', 200, '2026-07-10', '2026-08-25', 'น้ำบาดาลผ่านการกรอง RO/UV', 'บาดาล', '2026-06-01', 'ไม่พบโลหะหนักและเชื้อ E.coli', 'ผักกาดหอม', 'ปลอดภัย', 'แปลงปลูกยกระดับ สะอาด ไร้สิ่งปนเปื้อน', 'active', 'พร้อมเก็บเกี่ยวล็อตถัดไป'],
      [userId, 'แปลง A2 (Hydro NFT)', 'ผักเรดโอ๊ค (Red Oak)', 200, '2026-07-12', '2026-08-27', 'น้ำบาดาลผ่านการกรอง RO/UV', 'บาดาล', '2026-06-01', 'ไม่พบสารเคมีตกค้าง', 'กรีนโอ๊ค', 'ปลอดภัย', 'ควบคุมค่า EC 1.4-1.6 pH 6.0', 'active', 'สีแดงเข้มสวยงาม สมบูรณ์'],
      [userId, 'แปลง B1 (EVAP Greenhouse)', 'ผักฟิลเล่ย์ ไอซ์เบิร์ก (Frillice)', 300, '2026-07-05', '2026-08-20', 'น้ำประปาเกษตรกรองตะกอน', 'ประปา', '2026-05-15', 'ดินอินทรีย์ผสมขุยมะพร้าวสะอาด', 'ผักคอส', 'ปลอดภัย', 'ควบคุมอุณหภูมิไม่เกิน 28C', 'active', 'ใบหยิกหนากรอบมาก'],
      [userId, 'แปลง B2 (EVAP Greenhouse)', 'ผักคอส (Cos Lettuce)', 250, '2026-07-15', '2026-08-30', 'น้ำประปาเกษตรกรองตะกอน', 'ประปา', '2026-05-15', 'ดินอินทรีย์ pH 6.5', 'ฟิลเล่ย์', 'ปลอดภัย', 'มีตาข่ายกันแมลง 40 mesh', 'active', 'ก้านอวบ รสหวานกรอบ'],
      [userId, 'แปลง C1 (โรงเรือนกางมุ้ง)', 'ผักบัตเตอร์เฮด (Butterhead)', 180, '2026-07-18', '2026-09-02', 'น้ำบาดาลบำบัด', 'บาดาล', '2026-06-10', 'ดินร่วนปนทรายผสมปุ๋ยคอกหมัก', 'ผักสลัดรวม', 'ปลอดภัย', 'ใช้พลาสติกคลุมแปลงกันวัชพืช', 'active', 'ใบนุ่ม ห่อหัวแน่น'],
      [userId, 'แปลง C2 (แปลงยกร่องคลุมมุ้ง)', 'ผักกาดขาว (Chinese Cabbage)', 400, '2026-06-25', '2026-08-15', 'น้ำสระกักเก็บน้ำฝนผ่านกรอง', 'สระเก็บน้ำ', '2026-05-01', 'ดินร่วนอุดมสมบูรณ์', 'ข้าวโพดหวาน', 'ปลอดภัย', 'ใส่ปุ๋ยอินทรีย์อัดเม็ด', 'active', 'หัวใหญ่ น้ำหนักดี เฉลี่ย 800g/หัว'],
      [userId, 'แปลง D1 (โรงเรือนเปิดระบาย)', 'ผักกาดหอมอิตาลี (Italian Lettuce)', 150, '2026-07-20', '2026-09-05', 'น้ำประปาเกษตร', 'ประปา', '2026-06-01', 'ดินผสมปุ๋ยหมักใบก้ามปู', 'กวางตุ้ง', 'ปลอดภัย', 'รดน้ำระบบสปริงเกอร์ละอองฝอย', 'active', 'เจริญเติบโตสม่ำเสมอ'],
      [userId, 'แปลง D2 (โรงเรือนพ่นหมอก)', 'ผักเคลใบหยิก (Curly Kale)', 200, '2026-06-01', '2026-09-30', 'น้ำบาดาลกรอง UV', 'บาดาล', '2026-05-10', 'ดินผสมมูลไส้เดือน', 'รกร้างเดิม', 'ปลอดภัย', 'ราชินีผักใบเขียว คุณภาพพรีเมียม', 'active', 'เก็บใบได้ต่อเนื่องทุกสัปดาห์']
    ];

    const plotIds = [];
    for (const p of plotsData) {
      const [res] = await pool.query(
        `INSERT INTO plots (user_id, name, crop_name, area_sqm, planting_date, expected_harvest_date, water_source, water_source_type, soil_test_date, soil_test_result, previous_crop_history, field_safety_status, soil_notes, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p
      );
      plotIds.push(res.insertId);
    }

    // 3. Insert Water Logs (GAP #1)
    console.log('💧 Seeding Water Logs...');
    const waterData = [
      [userId, plotIds[0], '2026-08-20', 'น้ำบาดาลผ่าน UV', 'บาดาล', 'สะอาดมาก pH 6.4', 1, 1200, 'บุญมี รักเกษตร', 'เช็คระบบท่อส่งน้ำ NFT ไม่พบตะกอน'],
      [userId, plotIds[1], '2026-08-21', 'น้ำบาดาลผ่าน UV', 'บาดาล', 'สะอาดมาก pH 6.3', 1, 1150, 'บุญมี รักเกษตร', 'คุมค่า EC ที่ 1.5'],
      [userId, plotIds[2], '2026-08-22', 'น้ำประปาเกษตรกรอง', 'ประปา', 'สะอาดใส pH 6.7', 1, 1500, 'สมชาย ใจดี', 'รดน้ำเช้า-เย็นสม่ำเสมอ'],
      [userId, plotIds[3], '2026-08-23', 'น้ำประปาเกษตรกรอง', 'ประปา', 'สะอาดใส pH 6.6', 1, 1300, 'สมชาย ใจดี', 'วัดความชื้นในดินเหมาะสม'],
      [userId, plotIds[4], '2026-08-24', 'น้ำบาดาลบำบัด', 'บาดาล', 'คุณภาพดี pH 6.5', 1, 900, 'บุญมี รักเกษตร', 'ระบบพ่นหมอกเปิดตามรอบเวลา'],
      [userId, plotIds[5], '2026-08-24', 'น้ำสระกรองทราย', 'สระเก็บน้ำ', 'ผ่านเกณฑ์ GAP pH 6.8', 1, 2000, 'สุวิทย์ พืชผล', 'ตรวจสระน้ำไม่มีสิ่งปนเปื้อน'],
      [userId, plotIds[6], '2026-08-25', 'น้ำประปาเกษตร', 'ประปา', 'สะอาดใส pH 6.5', 1, 850, 'สมศรี มีสุข', 'รดน้ำช่วงเช้า 07:00'],
      [userId, plotIds[7], '2026-08-25', 'น้ำบาดาลผ่าน UV', 'บาดาล', 'สะอาดพิเศษ pH 6.2', 1, 1100, 'บุญมี รักเกษตร', 'พ่นหมอกลดความร้อนตอนเที่ยง']
    ];
    for (const w of waterData) {
      await pool.query(
        `INSERT INTO water_logs (user_id, plot_id, log_date, water_source, water_source_type, water_quality, contamination_check, amount_liters, worker_name, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        w
      );
    }

    // 4. Insert Chemical Logs (GAP #3 - ปุ๋ยชีวภาพและสารสกัดธรรมชาติ)
    console.log('🧪 Seeding Chemical & Bio-fertilizer Logs...');
    const chemData = [
      [userId, plotIds[0], '2026-08-10', 'ปุ๋ยน้ำ', 'สารละลายธาตุอาหาร AB ไฮโดรโปนิกส์', 15, 'ลิตร', 'บำรุงการเจริญเติบโตใบผักสลัด', 'ผสมลงถังจ่ายน้ำ', 1, 'กรีนแล็บ ฟาร์มมิ่ง', 'มาตรฐานปุ๋ยเคมีปลอดภัย', 0, 'บุญมี รักเกษตร', 'ธาตุอาหารครบถ้วน ใบเขียวสด'],
      [userId, plotIds[1], '2026-08-11', 'ปุ๋ยน้ำ', 'สารละลายธาตุอาหาร AB + ธาตุเหล็กคีเลต', 15, 'ลิตร', 'บำรุงสีแดงและก้านใบเรดโอ๊ค', 'ผสมลงถังจ่ายน้ำ', 1, 'กรีนแล็บ ฟาร์มมิ่ง', 'มาตรฐานปุ๋ยเคมีปลอดภัย', 0, 'บุญมี รักเกษตร', 'ใบสีแดงสดสวย'],
      [userId, plotIds[2], '2026-08-12', 'ชีวภัณฑ์', 'เชื้อราไตรโคเดอร์มา (Trichoderma)', 500, 'กรัม', 'ป้องกันโรครากเน่าโคนเน่า', 'พ่นลงโคนต้นช่วงแดดร่ม', 1, 'ศูนย์ชีวภัณฑ์อินทรีย์', 'สารชีวภัณฑ์ปลอดภัย 100%', 0, 'สมชาย ใจดี', 'ฉีดพ่นเวลา 17.00 น.'],
      [userId, plotIds[3], '2026-08-13', 'สารสกัดชีวภาพ', 'สารสกัดสะเดาและน้ำส้มควันไม้', 250, 'มล.', 'ป้องกันเพลี้ยไฟและไรแดง', 'ฉีดพ่นละอองฝอยใต้ใบ', 1, 'ฟาร์มสกัดชีวภาพไทย', 'สมุนไพรธรรมชาติ', 3, 'สมชาย ใจดี', 'หยุดฉีดก่อนเก็บเกี่ยว 7 วัน'],
      [userId, plotIds[4], '2026-08-14', 'ปุ๋ยอินทรีย์', 'น้ำหมักปลาทะเลอินทรีย์สูตรเร่งโต', 2, 'ลิตร', 'เสริมกรดอะมิโนและวิตามินใบ', 'ผสมน้ำรดแปลง', 1, 'ออร์แกนิกสยาม', 'ปุ๋ยอินทรีย์มาตรฐาน มกท.', 0, 'สมศรี มีสุข', 'กลิ่นจาง รดแล้วใบมันเงา'],
      [userId, plotIds[5], '2026-08-01', 'ปุ๋ยอินทรีย์', 'ปุ๋ยหมักมูลค้างคาวผสมขี้วัวอัดเม็ด', 50, 'กก.', 'บำรุงดินก่อนห่อหัวผักกาดขาว', 'โรยรอบโคนต้นและพรวนกลบ', 1, 'ไทยไบโอเฟิร์ท', 'ปุ๋ยอินทรีย์แท้', 0, 'สุวิทย์ พืชผล', 'ผักกาดขาวห่อหัวแน่น']
    ];
    for (const c of chemData) {
      await pool.query(
        `INSERT INTO chemical_logs (user_id, plot_id, log_date, chem_type, product_name, amount, unit, reason, application_method, safety_ppe, manufacturer, chemical_label, phi_days, worker_name, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c
      );
    }

    // 5. Insert Pest Logs (GAP #4 - สำรวจศัตรูพืช)
    console.log('🐛 Seeding Pest Logs...');
    const pestData = [
      [userId, plotIds[0], '2026-08-15', 'เพลี้ยไฟ (Thrips)', 'น้อยมาก (Level 1)', 'ติดกับดักกาวเหนียวสีเหลือง 10 จุด', 'สมชาย ใจดี', 'ดักจับแมลงได้ดี ไม่ระบาด'],
      [userId, plotIds[2], '2026-08-16', 'หนอนกระทู้ผัก', 'น้อย (Level 1)', 'เก็บทำลายตัวหนอนด้วยมือ + พ่นบิวเวอร์เรีย', 'สมศรี มีสุข', 'ตรวจสอบซ้ำทุก 2 วัน'],
      [userId, plotIds[5], '2026-08-05', 'ด้วงหมัดผักแถบลาย', 'ปานกลาง (Level 2)', 'ใช้กับดักแสงไฟล่อตอนกลางคืน + มุ้งตาข่าย', 'สุวิทย์ พืชผล', 'ควบคุมได้เรียบร้อย หัวผักกาดขาวสมบูรณ์'],
      [userId, plotIds[3], '2026-08-18', 'ไรขาว', 'น้อยมาก (Level 1)', 'พ่นน้ำส้มควันไม้เจือจาง', 'สมชาย ใจดี', 'ใบสะอาด ไร้รอยทำลาย']
    ];
    for (const p of pestData) {
      await pool.query(
        `INSERT INTO pest_logs (user_id, plot_id, log_date, pest_or_disease, severity, treatment_method, worker_name, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        p
      );
    }

    // 6. Insert Harvest Logs (GAP #5)
    console.log('🌾 Seeding Harvest Logs...');
    const harvestData = [
      [userId, plotIds[0], '2026-08-24', 45.00, 'kg', 'A', 'GAP-2026-GO01', 2025.00, 'สะอาดตามเกณฑ์ GAP', 'ตัดแต่งใบเสีย ล้างน้ำโอโซน บรรจุถุงระบายอากาศ', 'สมศรี มีสุข', 'ผักกรีนโอ๊คสดมาก น้ำหนักเฉลี่ย 150g/ต้น'],
      [userId, plotIds[1], '2026-08-24', 30.00, 'kg', 'A', 'GAP-2026-RO02', 1350.00, 'สะอาดตามเกณฑ์ GAP', 'ล้างน้ำไหล ตัดแต่งโคน บรรจุถุงเย็น', 'สมศรี มีสุข', 'สีแดงสวย ก้านไม่ช้ำ'],
      [userId, plotIds[2], '2026-08-23', 25.00, 'kg', 'A+', 'GAP-2026-FL03', 1625.00, 'สะอาดตามเกณฑ์ GAP', 'ตัดด้วยกรรไกรสแตนเลสฆ่าเชื้อ บรรจุกล่องโฟมเย็น', 'สมชาย ใจดี', 'ฟิลเล่ย์กรอบพิเศษ ส่งร้านสลัดพรีเมียม'],
      [userId, plotIds[3], '2026-08-22', 35.00, 'kg', 'A', 'GAP-2026-CS04', 1750.00, 'สะอาดตามเกณฑ์ GAP', 'ล้างทำความสะอาด คัดเกรด บรรจุกล่องละ 5kg', 'สมชาย ใจดี', 'ผักคอสใบยาวสวย'],
      [userId, plotIds[4], '2026-08-21', 20.00, 'kg', 'A', 'GAP-2026-BH05', 1100.00, 'สะอาดตามเกณฑ์ GAP', 'ห่อตาข่ายโฟมกันกระแทก บรรจุกล่องกระดาษ', 'บุญมี รักเกษตร', 'บัตเตอร์เฮดหัวกลมสวย'],
      [userId, plotIds[5], '2026-08-15', 120.00, 'kg', 'A', 'GAP-2026-CC06', 4200.00, 'สะอาดตามเกณฑ์ GAP', 'ตัดแต่งใบนอก ล้างและผึ่งลม บรรจุเข่งพลาสติกสะอาด', 'สุวิทย์ พืชผล', 'ส่งตลาดไทและซูเปอร์มาร์เก็ต'],
      [userId, plotIds[6], '2026-08-20', 40.00, 'kg', 'A', 'GAP-2026-IT07', 1600.00, 'สะอาดตามเกณฑ์ GAP', 'บรรจุถุงซิปล็อกสำหรับขายส่ง', 'สมศรี มีสุข', 'ผักกาดหอมสด'],
      [userId, plotIds[7], '2026-08-18', 15.00, 'kg', 'A+', 'GAP-2026-KL08', 1800.00, 'สะอาดตามเกณฑ์ GAP', 'มัดกำละ 250g ติดสติ๊กเกอร์ GAP QR Traceability', 'สมชาย ใจดี', 'เคลออร์แกนิกยอดนิยม']
    ];

    const harvestIds = [];
    for (const h of harvestData) {
      const [res] = await pool.query(
        `INSERT INTO harvest_logs (user_id, plot_id, harvest_date, quantity, unit, quality_grade, lot_code, revenue, harvest_hygiene, postharvest_handling, worker_name, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        h
      );
      harvestIds.push(res.insertId);
    }

    // 7. Insert Storage & Logistics Logs (GAP #6)
    console.log('🚚 Seeding Storage & Logistics Logs...');
    const storageData = [
      [userId, harvestIds[0], '2026-08-24', 'ห้องเย็นฟาร์ม Temp 4°C ความชื้น 95%', 'Tops Supermarket สาขาเซ็นทรัล', 'บจก. เซ็นทรัล ฟู้ด', 'รถกระบะห้องเย็นทะเบียน 2ฒข-4512', 1, 'คุมความเย็น 4°C ตลอดการเดินทาง', '08:30:00', 'สดสมบูรณ์ 100%', 'สุวิทย์ พืชผล', 'ส่งมอบตรงเวลา เอกสาร GAP ครบถ้วน'],
      [userId, harvestIds[2], '2026-08-23', 'ห้องเย็นฟาร์ม Temp 4°C', 'ร้านสลัดเพื่อสุขภาพ Salad Factory', 'ร้าน Salad Factory', 'รถขนส่งปรับอากาศ', 1, 'บรรจุกล่องโฟมใส่น้ำแข็งแห้ง', '09:00:00', 'กรอบสด ไม่ช้ำ', 'สุวิทย์ พืชผล', 'ลูกค้ารับสินค้าและเซ็นรับเรียบร้อย'],
      [userId, harvestIds[5], '2026-08-15', 'ลานพักผลผลิตชั่วคราว สะอาดมีหลังคา', 'ตลาดไท อาคารผักสด', 'เจ๊นก ค้าส่งผัก', 'รถกระบะคลุมผ้าใบสะอาด', 1, 'ถ่ายเทอากาศดี ไม่ตากแดด', '05:30:00', 'สด สะอาด ได้เกรดส่งออก', 'สุวิทย์ พืชผล', 'ชำระเงินสดเรียบร้อย']
    ];
    for (const s of storageData) {
      await pool.query(
        `INSERT INTO storage_logs (user_id, harvest_id, log_date, storage_location, shipped_to, buyer, vehicle, vehicle_clean_status, storage_conditions, transport_time, delivery_condition, worker_name, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s
      );
    }

    // 8. Insert Workers (GAP #7 - แรงงานและการอบรมสุขอนามัย)
    console.log('👥 Seeding Workers...');
    const workersData = [
      [userId, 'สมชาย ใจดี', 'หัวหน้าแปลงปลูกและควบคุม GAP', '081-234-5678', 1, '2026-01-15', 1, 'แข็งแรง สมบูรณ์'],
      [userId, 'สมศรี มีสุข', 'เจ้าหน้าที่ตัดแต่งและบรรจุภัณฑ์', '082-345-6789', 1, '2026-01-15', 1, 'แข็งแรง ไม่เป็นโรคติดต่อ'],
      [userId, 'บุญมี รักเกษตร', 'เจ้าหน้าที่ควบคุมระบบน้ำและปุ๋ย', '083-456-7890', 1, '2026-01-20', 1, 'แข็งแรง สมบูรณ์'],
      [userId, 'สุวิทย์ พืชผล', 'เจ้าหน้าที่คลังสินค้าและการขนส่ง', '084-567-8901', 1, '2026-02-01', 1, 'แข็งแรง มีใบขับขี่']
    ];
    for (const w of workersData) {
      await pool.query(
        `INSERT INTO workers (user_id, name, role, phone, hygiene_training, training_date, personal_hygiene_check, health_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        w
      );
    }

    // 9. Insert Cost Logs (บันทึกต้นทุนฟาร์ม)
    console.log('💰 Seeding Cost Logs...');
    const costData = [
      [userId, plotIds[0], '2026-07-08', 'เมล็ดพันธุ์', 'เมล็ดพันธุ์ผักสลัดกรีนโอ๊ค เคลือบสารกระตุ้นงอก (นำเข้าเนเธอร์แลนด์)', 650.00],
      [userId, plotIds[1], '2026-07-08', 'เมล็ดพันธุ์', 'เมล็ดพันธุ์ผักสลัดเรดโอ๊ค', 650.00],
      [userId, plotIds[2], '2026-07-02', 'เมล็ดพันธุ์', 'เมล็ดพันธุ์ฟิลเล่ย์ไอซ์เบิร์กเกรดพรีเมียม', 850.00],
      [userId, plotIds[0], '2026-07-15', 'ปุ๋ย/สารชีวภัณฑ์', 'ปุ๋ยน้ำธาตุอาหาร AB สำหรับผักไฮโดรโปนิกส์ 1 ชุด', 1200.00],
      [userId, plotIds[2], '2026-07-20', 'ปุ๋ย/สารชีวภัณฑ์', 'เชื้อราไตรโคเดอร์มาและบิวเวอร์เรียอินทรีย์', 450.00],
      [userId, null, '2026-07-31', 'บรรจุภัณฑ์', 'ถุงพลาสติกเจาะรูระบายอากาศพิมพ์ลาย FarmGAP 1,000 ใบ', 1500.00],
      [userId, null, '2026-08-01', 'สาธารณูปโภค', 'ค่าไฟฟ้าโรงเรือนและปั๊มน้ำประจำเดือน', 2450.00],
      [userId, null, '2026-06-01', 'ตรวจวิเคราะห์แล็บ', 'ค่าบริการตรวจวิเคราะห์ตัวอย่างน้ำและสารตกค้าง GAP', 1800.00]
    ];
    for (const c of costData) {
      await pool.query(
        `INSERT INTO cost_logs (user_id, plot_id, log_date, category, description, amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        c
      );
    }

    // 10. Insert GAP Checklists (การประเมินแปลงตามมาตรฐาน GAP)
    console.log('📋 Seeding GAP Checklists...');
    for (let i = 0; i < plotIds.length; i++) {
      await pool.query(
        `INSERT INTO gap_checklists (user_id, plot_id, check_date, inspector_name, field_inspection_pass, cleaning_check, pest_management_check, water_quality_check, chemical_usage_check, hygiene_check, notes)
         VALUES (?, ?, '2026-08-20', 'นายสมชาย ใจดี (QMR ประจำฟาร์ม)', 1, 1, 1, 1, 1, 1, 'ผ่านเกณฑ์มาตรฐานความปลอดภัย GAP ทุกหัวข้อ')`,
        [userId, plotIds[i]]
      );
    }

    // 11. Insert Products (สินค้าผักสดพร้อมขายบน LINE LIFF)
    console.log('🥦 Seeding Products...');
    const productsData = [
      [plotIds[0], 'ผักกรีนโอ๊คสด GAP (Green Oak)', 'ผักสลัด', 45.00, 'กก.', 45.00, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[1], 'ผักเรดโอ๊คสด GAP (Red Oak)', 'ผักสลัด', 45.00, 'กก.', 30.00, 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[2], 'ผักฟิลเล่ย์ ไอซ์เบิร์ก กรอบพรีเมียม (Frillice)', 'ผักสลัด', 65.00, 'กก.', 25.00, 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[3], 'ผักคอส สดกรอบ (Cos Lettuce)', 'ผักสลัด', 50.00, 'กก.', 35.00, 'https://images.unsplash.com/photo-1508747703725-719777637510?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[4], 'ผักบัตเตอร์เฮด เนื้อนุ่ม (Butterhead)', 'ผักสลัด', 55.00, 'กก.', 20.00, 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[5], 'ผักกาดขาว ปลอดสาร GAP (Chinese Cabbage)', 'ผักใบ', 35.00, 'กก.', 60.00, 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[6], 'ผักกาดหอมสดอินทรีย์ (Italian Lettuce)', 'ผักสลัด', 40.00, 'กก.', 40.00, 'https://images.unsplash.com/photo-1506806732259-39c2d0268443?q=80&w=600&auto=format&fit=crop', 'available'],
      [plotIds[7], 'ผักเคลใบหยิก ซูเปอร์ฟู้ด (Curly Kale)', 'ผักเพื่อสุขภาพ', 120.00, 'กก.', 15.00, 'https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?q=80&w=600&auto=format&fit=crop', 'available'],
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

    // 12. Insert Customer Clusters (AI K-Means Segments)
    console.log('🤖 Seeding Customer Clusters...');
    const [c1] = await pool.query(`INSERT INTO customer_clusters (cluster_name, description, preferred_crops) VALUES ('สลัดเลิฟเวอร์ (Salad Lovers)', 'เน้นสั่งซื้อผักสลัด (กรีนโอ๊ค, เรดโอ๊ค, คอส) ถี่สัปดาห์ละ 1-2 ครั้ง', '["ผักกรีนโอ๊ค", "ผักเรดโอ๊ค", "ผักฟิลเล่ย์", "น้ำสลัด"]')`);
    const [c2] = await pool.query(`INSERT INTO customer_clusters (cluster_name, description, preferred_crops) VALUES ('ลูกค้าประจำเพื่อสุขภาพ (Health Regulars)', 'ชอบผักเคล บัตเตอร์เฮด และสั่งน้ำสลัดคู่กันเป็นประจำ', '["ผักเคลใบหยิก", "ผักบัตเตอร์เฮด", "ผักกาดหอม"]')`);
    const [c3] = await pool.query(`INSERT INTO customer_clusters (cluster_name, description, preferred_crops) VALUES ('กลุ่มร้านอาหารและค้าส่ง (Bulk & B2B)', 'สั่งซื้อปริมาณมาก ยอดเฉลี่ยต่อบิลสูง เน้นผักกาดขาวและผักสลัดยกกิโล', '["ผักกาดขาว", "ผักกรีนโอ๊ค", "ผักคอส"]')`);

    // 13. Insert Customers (ลูกค้า LINE)
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

    // 14. Insert Orders & Order Items
    console.log('🛍️ Seeding Orders & Order Items...');
    const ordersData = [
      {
        order_code: 'ORD-20260824-1001',
        customer_id: custIds[0],
        total_amount: 149.00,
        status: 'pending',
        delivery_type: 'delivery',
        delivery_date: '2026-08-26',
        slip_image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600',
        notes: 'ขอผักกรีนโอ๊คต้นอวบๆ นะคะ',
        items: [
          { product_id: prodIds[0], quantity: 2, unit_price: 45.00, subtotal: 90.00 },
          { product_id: prodIds[8], quantity: 1, unit_price: 59.00, subtotal: 59.00 }
        ]
      },
      {
        order_code: 'ORD-20260824-1002',
        customer_id: custIds[1],
        total_amount: 520.00,
        status: 'paid',
        delivery_type: 'delivery',
        delivery_date: '2026-08-25',
        slip_image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600',
        notes: 'ส่งก่อนเที่ยง เพื่อเตรียมเปิดร้านสลัดครับ',
        items: [
          { product_id: prodIds[2], quantity: 4, unit_price: 65.00, subtotal: 260.00 },
          { product_id: prodIds[3], quantity: 4, unit_price: 50.00, subtotal: 200.00 },
          { product_id: prodIds[9], quantity: 1, unit_price: 59.00, subtotal: 59.00 }
        ]
      },
      {
        order_code: 'ORD-20260823-1003',
        customer_id: custIds[2],
        total_amount: 299.00,
        status: 'shipping',
        delivery_type: 'delivery',
        delivery_date: '2026-08-24',
        slip_image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600',
        notes: 'วางไว้หน้าประตูด้านล่างคอนโดได้เลยครับ',
        items: [
          { product_id: prodIds[7], quantity: 2, unit_price: 120.00, subtotal: 240.00 },
          { product_id: prodIds[8], quantity: 1, unit_price: 59.00, subtotal: 59.00 }
        ]
      },
      {
        order_code: 'ORD-20260822-1004',
        customer_id: custIds[3],
        total_amount: 145.00,
        status: 'completed',
        delivery_type: 'pickup',
        delivery_date: '2026-08-23',
        slip_image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600',
        notes: 'มารับเองที่หน้าแปลงช่วง 16.00 น.',
        items: [
          { product_id: prodIds[0], quantity: 1, unit_price: 45.00, subtotal: 45.00 },
          { product_id: prodIds[1], quantity: 1, unit_price: 45.00, subtotal: 45.00 },
          { product_id: prodIds[4], quantity: 1, unit_price: 55.00, subtotal: 55.00 }
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

    // 15. Insert AI Product Recommendations
    console.log('🤖 Seeding Product Recommendations Matrix...');
    const recs = [
      [prodIds[0], prodIds[1], 0.95, 'ลูกค้ามักสั่งซื้อ กรีนโอ๊ค คู่กับ เรดโอ๊ค เพื่อจัดจานสลัดทูโทน'],
      [prodIds[0], prodIds[8], 0.88, 'สั่งผักสลัดคู่กับน้ำสลัดงาคั่วญี่ปุ่น'],
      [prodIds[2], prodIds[8], 0.92, 'ฟิลเล่ย์ไอซ์เบิร์กทานคู่กับน้ำสลัดงาคั่วเพิ่มความกรอบอร่อย'],
      [prodIds[3], prodIds[9], 0.90, 'ผักคอสกับน้ำสลัดซีซาร์ เมนูคลาสสิกยอดนิยม'],
      [prodIds[4], prodIds[0], 0.85, 'บัตเตอร์เฮดนุ่มละมุนคู่กับกรีนโอ๊คสดกรอบ'],
      [prodIds[7], prodIds[8], 0.82, 'เคลปั่นกับน้ำสลัดเพื่อสุขภาพ']
    ];
    for (const r of recs) {
      await pool.query(
        `INSERT INTO product_recommendations (product_id, recommended_product_id, score, reason)
         VALUES (?, ?, ?, ?)`,
        r
      );
    }

    console.log('✅ Database seeded successfully with realistic GAP and Vegetable Farm data!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
