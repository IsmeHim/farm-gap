import { pool } from '../../../db.js';

// Helper: ดึงข้อมูลติดต่อเจ้าของฟาร์มและข้อมูลบัญชีจากฐานข้อมูลแบบ Dynamic
export async function getOwnerContactInfo() {
  try {
    const [rows] = await pool.query(
      "SELECT farm_name, display_name, phone, promptpay_number, bank_name, bank_account_no, bank_account_name, line_user_id FROM users WHERE (role = 'owner' OR role = 'admin') ORDER BY id ASC LIMIT 1"
    );
    if (rows.length > 0) {
      const u = rows[0];
      const raw = u.phone || u.promptpay_number || '0990684331';
      const cleanDigits = String(raw).replace(/[^0-9]/g, '');
      const formatted = cleanDigits.length === 10
        ? `${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`
        : raw;
      return {
        farmName: u.farm_name || 'FarmGAP',
        displayName: u.display_name || 'เจ้าของฟาร์ม',
        phone: formatted,
        rawPhone: cleanDigits,
        bankName: u.bank_name || '',
        bankAccountNo: u.bank_account_no || '',
        bankAccountName: u.bank_account_name || u.display_name || '',
        promptpayNumber: u.promptpay_number || cleanDigits,
      };
    }
  } catch (err) {
    console.error('Error fetching owner contact info:', err.message);
  }
  return {
    farmName: 'FarmGAP',
    displayName: 'เจ้าของฟาร์ม',
    phone: '099-068-4331',
    rawPhone: '0990684331',
    bankName: '',
    bankAccountNo: '',
    bankAccountName: '',
    promptpayNumber: '0990684331',
  };
}

// Helper: แปลงวันที่ ค.ศ. เป็น วันที่ภาษาไทย เช่น "9 ตุลาคม 2569"
export function formatThaiDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  
  const day = d.getDate();
  const month = thaiMonths[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

// Helper: ตรวจสอบรอบเก็บเกี่ยวถัดไปของผักชนิดที่ระบุ จาก planting_batches และ crop_cycles
export async function getUpcomingHarvestForProduct(productName) {
  try {
    const lower = (productName || '').toLowerCase();
    const searchTerms = [];
    if (lower.includes('บุ้ง')) searchTerms.push('บุ้ง');
    if (lower.includes('กวางตุ้ง') || lower.includes('กวางตุง')) searchTerms.push('กวางตุ้ง');
    if (lower.includes('กรีน') || lower.includes('green')) searchTerms.push('กรีนโอ๊ค', 'green');
    if (lower.includes('เรด') || lower.includes('red')) searchTerms.push('เรดโอ๊ค', 'red');
    if (lower.includes('คอส') || lower.includes('cos') || lower.includes('โรเมน')) searchTerms.push('คอส', 'cos', 'โรเมน');
    if (lower.includes('ฟิล') || lower.includes('ฟิน') || lower.includes('frillice') || lower.includes('ไอซ์เบิร์ก')) searchTerms.push('ฟิลเล่ย์', 'frillice', 'ไอซ์เบิร์ก');
    if (lower.includes('บัตเตอร์') || lower.includes('butter')) searchTerms.push('บัตเตอร์เฮด', 'butter');
    if (lower.includes('กาดขาว') || lower.includes('cabbage')) searchTerms.push('กาดขาว', 'cabbage');
    if (lower.includes('เคล') || lower.includes('kale')) searchTerms.push('เคล', 'kale');

    const [batches] = await pool.query(`
      SELECT b.expected_harvest_date, b.status, c.name AS crop_name, p.name AS plot_name
      FROM planting_batches b
      LEFT JOIN crops c ON b.crop_id = c.id
      LEFT JOIN plots p ON b.plot_id = p.id
      WHERE b.status IN ('growing', 'active', 'harvest_ready')
        AND b.expected_harvest_date IS NOT NULL
      ORDER BY b.expected_harvest_date ASC
    `);

    const [cycles] = await pool.query(`
      SELECT c.expected_harvest_date, c.status, c.crop_name, p.name AS plot_name
      FROM crop_cycles c
      LEFT JOIN plots p ON c.plot_id = p.id
      WHERE c.status IN ('active', 'growing', 'harvest_ready')
        AND c.expected_harvest_date IS NOT NULL
      ORDER BY c.expected_harvest_date ASC
    `);

    const allUpcoming = [...batches, ...cycles];

    for (const item of allUpcoming) {
      const cropLower = (item.crop_name || '').toLowerCase();
      const isMatch = searchTerms.some(term => cropLower.includes(term.toLowerCase()));
      if (isMatch) {
        const harvestDate = new Date(item.expected_harvest_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = harvestDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          hasUpcoming: true,
          harvestDate: item.expected_harvest_date,
          harvestDateThai: formatThaiDate(item.expected_harvest_date),
          daysRemaining: diffDays > 0 ? diffDays : 0,
          plotName: item.plot_name || 'แปลงปลูกในฟาร์ม',
          cropName: item.crop_name,
        };
      }
    }
  } catch (err) {
    console.error('getUpcomingHarvestForProduct error:', err.message);
  }

  return { hasUpcoming: false };
}

// 2. ดึงข้อมูลผักพร้อมขาย ผักที่หมด/กำลังปลูก รอบเก็บเกี่ยว และข้อมูลติดต่อเจ้าของฟาร์ม เพื่อนำมาสร้างเป็น Context ใน AI Chatbot
export async function getFarmContext() {
  try {
    const [availableProducts] = await pool.query(
      'SELECT name, price, unit, stock_quantity FROM products WHERE status = "available" AND stock_quantity > 0'
    );
    const [outOfStockProducts] = await pool.query(
      'SELECT name, price, unit, stock_quantity, status FROM products WHERE status = "out_of_stock" OR stock_quantity <= 0'
    );
    const [plots] = await pool.query(
      'SELECT name, crop_name, field_safety_status, status FROM plots WHERE status = "active"'
    );
    const [batches] = await pool.query(`
      SELECT b.expected_harvest_date, b.status, c.name AS crop_name, p.name AS plot_name
      FROM planting_batches b
      LEFT JOIN crops c ON b.crop_id = c.id
      LEFT JOIN plots p ON b.plot_id = p.id
      WHERE b.status IN ('growing', 'active', 'harvest_ready')
        AND b.expected_harvest_date IS NOT NULL
      ORDER BY b.expected_harvest_date ASC
    `);
    const owner = await getOwnerContactInfo();

    let context = 'คุณคือบอทผู้ช่วยตอบคำถามลูกค้าของฟาร์มผักสดอัจฉริยะ FarmGAP AI ที่เพาะปลูกตามมาตรฐาน GAP และผสานระบบ E-Commerce\n';
    context += `\n[ข้อมูลฟาร์ม]:\n`;
    context += `- ชื่อฟาร์ม: ${owner.farmName}\n`;
    context += `- ผู้ดูแล/เจ้าของฟาร์ม: คุณ${owner.displayName}\n`;

    context += '\n[ข้อมูลสต็อกสินค้าพร้อมขายวันนี้แบบเรียลไทม์]:\n';
    if (availableProducts.length > 0) {
      availableProducts.forEach(p => {
        context += `- ผัก: ${p.name}, ราคา: ${p.price} บาทต่อ ${p.unit}, สต็อกคงเหลือ: ${p.stock_quantity} ${p.unit} (มีสินค้าพร้อมส่งทันที)\n`;
      });
    } else {
      context += '- ขณะนี้สินค้าพร้อมส่งหมดชั่วคราว อยู่ระหว่างเตรียมแปลงเก็บเกี่ยวล็อตถัดไป\n';
    }

    context += '\n[ข้อมูลผักที่สินค้าหมดชั่วคราวและกำหนดการเก็บเกี่ยวรอบถัดไป]:\n';
    if (outOfStockProducts.length > 0 || batches.length > 0) {
      if (outOfStockProducts.length > 0) {
        outOfStockProducts.forEach(p => {
          context += `- ผักที่หมดชั่วคราว: ${p.name} (สต็อก 0)\n`;
        });
      }
      if (batches.length > 0) {
        context += `กำหนดการเก็บเกี่ยวแปลงเพาะปลูกในฟาร์ม:\n`;
        batches.forEach(b => {
          const dateThai = formatThaiDate(b.expected_harvest_date);
          context += `- พืช: ${b.crop_name}, ปลูกอยู่ที่: ${b.plot_name}, กำหนดพร้อมเก็บเกี่ยว: ${dateThai} (สถานะ: ${b.status})\n`;
        });
      }
    } else {
      context += '- ไม่มีรายการแปลงเพาะปลูกที่รอเก็บเกี่ยว\n';
    }
    
    context += '\n[ข้อมูลแปลงเพาะปลูกและสถานะความปลอดภัย GAP ปัจจุบัน]:\n';
    if (plots.length > 0) {
      plots.forEach(pl => {
        context += `- แปลง: ${pl.name}, พืชในแปลง: ${pl.crop_name}, สถานะตรวจแปลง GAP: ${pl.field_safety_status}\n`;
      });
    } else {
      context += '- กำลังเตรียมดินและบำรุงแปลงปลูกใหม่\n';
    }
    
    context += '\n[คำสั่งพิเศษเรื่องการขอดูเมนู/รายการผัก]:\n';
    context += 'หากสิ่งที่ลูกค้าถามหรือต้องการคือการขอดูรายการผัก เมนูผัก หรือถามว่ามีเมนูอะไรบ้าง มีผักอะไรบ้าง หรือวันนี้มีอะไรขายบ้าง ให้ตอบเพียงคำว่า [SHOW_MENU_CARD] สั้นๆ เท่านั้น (ระบบจะส่งการ์ดเมนูผักสวยงามให้ลูกค้าโดยอัตโนมัติ)\n';

    context += '\n[กฎและนโยบายสำคัญในการตอบคำถามลูกค้า]:\n';
    context += '1. ตอบคำถามภาษาไทยอย่างสุภาพ มีหางเสียง "ครับ/ค่ะ" สั้นกระชับเข้าใจง่าย และให้ข้อมูลที่เป็นประโยชน์สูงสุด\n';
    context += '2. กฎตอบเรื่องความพร้อมของผัก (สำคัญมาก):\n';
    context += '   - หากลูกค้าถามว่า "ผัก... มีไหม", "มี... ไหม": ถ้ามีในสต็อกพร้อมส่ง ให้ยืนยันว่ามีพร้อมส่ง แจ้งราคา และเชิญชวนสั่งซื้อได้ทันทีในแชท (เช่น "สั่งกรีนโอ๊ค 2 ถุง")\n';
    context += '   - หากผักชนิดนั้นหมดชั่วคราว หรือกำลังเพาะปลูกอยู่: ให้แจ้งอย่างสุภาพว่า ขณะนี้สินค้าหมดชั่วคราว แต่ทางฟาร์มกำลังปลูกอยู่ที่แปลงใด และมีกำหนดพร้อมเก็บเกี่ยวรอบถัดไปประมาณวันที่เท่าไหร่ (อ้างอิงจากข้อมูลด้านบนอย่างแม่นยำ) พร้อมชวนดูผักชนิดอื่นที่มีพร้อมส่งแทน\n';
    context += `3. กฎเรื่องเบอร์ติดต่อเจ้าของฟาร์ม (สำคัญมาก): ให้ระบุเบอร์โทรศัพท์ ${owner.phone} (คุณ${owner.displayName} ฟาร์ม ${owner.farmName}) "เฉพาะ" ในกรณีที่ลูกค้าถามหาเบอร์ติดต่อ ขอเบอร์โทร ขอคุยกับเจ้าของฟาร์ม/แอดมิน หรือกรณีขอเงินคืนเท่านั้น! ห้ามใส่เบอร์ติดต่อหรือชวนโทรหาเจ้าของฟาร์มท้ายคำตอบทั่วไปโดยเด็ดขาด!\n`;
    context += `4. กฎเรื่องการขอเงินคืน (Refund): หากลูกค้าสอบถามว่า "ขอเงินคืนยังไง", "ขอเงินคืน", "โอนเงินแล้วขอยกเลิกออเดอร์" หรือทำนองเดียวกัน ให้ตอบอย่างสุภาพว่า ทางฟาร์มยินดีคืนเงินให้ตามยอดจริง โดยมีขั้นตอนง่ายๆ คือ:\n   - ส่งรูปภาพสลิปที่โอนเงินเข้ามาในแชทนี้\n   - พิมพ์แจ้งเลขบัญชีธนาคาร หรือเบอร์พร้อมเพย์ และชื่อบัญชีสำหรับรับเงินคืน\n   - ทางเจ้าของฟาร์มจะตรวจสอบและโอนเงินคืนให้โดยเร็ว หรือลูกค้าสามารถโทรแจ้งเจ้าของฟาร์มโดยตรงได้ที่เบอร์ ${owner.phone} (คุณ${owner.displayName})\n`;
    context += '5. อ้างอิงสต็อกผักสดและสถานะแปลงเพาะปลูกข้างต้นในการตอบให้สอดคล้องกันอย่างถูกต้อง\n';
    context += '6. แจ้งลูกค้าว่าสามารถสั่งซื้อผักสดได้โดยตรงในแชทนี้เลย (เช่น "สั่งกรีนโอ๊ค 2 แพ็ค") หรือพิมพ์ "เมนูผัก" เพื่อดูสินค้าทั้งหมด โดยฟาร์มรองรับทั้งการ "โอนเงิน/สแกน QR" และ "เก็บเงินปลายทาง (COD)"\n';
    context += '7. หากลูกค้าถามเรื่องสถานะพัสดุหรือออเดอร์ ให้แนะนำพิมพ์คำว่า "เช็คสถานะ" เพื่อตรวจสถานะออเดอร์ล่าสุด หรือพิมพ์ "ดูประวัติ" เพื่อดูประวัติการสั่งซื้อทั้งหมดในแชท\n';
    context += '8. ข้อห้ามเด็ดขาด: ห้ามแนบข้อความทำนองว่า "หากต้องการสอบถามข้อมูลเพิ่มเติม หรือติดต่อคุณ... โทรได้ที่เบอร์..." ท้ายคำตอบทั่วไปโดยเด็ดขาด!';
    
    return context;
  } catch (err) {
    console.error('Failed to build context:', err.message);
    return 'คุณคือผู้ช่วยแชทบอทของฟาร์มผัก FarmGAP AI มาตรฐาน GAP โปรดตอบกลับสั้นๆ อย่างมีไมตรีจิต';
  }
}
