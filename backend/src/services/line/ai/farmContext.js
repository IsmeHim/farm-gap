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

// Helper: แปลงวันที่เป็น Midnight Local Date (ป้องกันปัญหา Timezone เลื่อนวัน)
function parseDateMidnight(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate());
  }
  const cleanStr = String(dateVal).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getDaysPlanted(dateVal) {
  const dZero = parseDateMidnight(dateVal);
  if (!dZero) return 0;
  const now = new Date();
  const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = nowZero.getTime() - dZero.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

// Helper: แปลงวันที่ ค.ศ. เป็น วันที่ภาษาไทย เช่น "30 ตุลาคม 2569"
export function formatThaiDate(dateStr) {
  if (!dateStr) return '';
  const d = parseDateMidnight(dateStr) || new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  
  const day = d.getDate();
  const month = thaiMonths[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

// Helper: คำนวณอายุพืช วันคาดเก็บเกี่ยว และจำนวนวันที่เหลือให้ตรงกับหน้าเว็บจัดการแปลงปลูก (Plots)
export function computeBatchStats(batch) {
  const growthDays = Number(batch?.growth_days || 30);
  const startDate = batch?.start_date || batch?.plot_planting_date;
  const seedDate = batch?.seed_prep_date || batch?.plot_seed_prep_date;

  const daysInBed = startDate ? getDaysPlanted(startDate) : 0;
  const plantAge = seedDate ? Math.max(daysInBed, getDaysPlanted(seedDate)) : daysInBed;

  let effectiveExpectedDate = batch?.expected_harvest_date;
  if (seedDate) {
    const seedMidnight = parseDateMidnight(seedDate);
    if (seedMidnight) {
      const calcExp = new Date(seedMidnight.getTime() + growthDays * 24 * 60 * 60 * 1000);
      const y = calcExp.getFullYear();
      const m = String(calcExp.getMonth() + 1).padStart(2, '0');
      const d = String(calcExp.getDate()).padStart(2, '0');
      effectiveExpectedDate = `${y}-${m}-${d}`;
    }
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expMidnight = parseDateMidnight(effectiveExpectedDate);
  let daysRemaining = Math.max(0, growthDays - plantAge);
  if (expMidnight) {
    const diffDays = Math.ceil((expMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = Math.max(0, diffDays);
  }

  return {
    plantAge,
    growthDays,
    daysRemaining,
    effectiveExpectedDate,
    harvestDateThai: formatThaiDate(effectiveExpectedDate),
  };
}

// Helper: สกัดคีย์เวิร์ดแบบ Dynamic รองรับผักทุกชนิดในฐานข้อมูล (รวมถึงผักที่เพิ่งเพิ่มใหม่ เช่น "test")
export function extractDynamicSearchTerms(rawName) {
  const lower = String(rawName || '').toLowerCase().trim();
  if (!lower) return [];

  const terms = [];
  const skipWords = ['ขีด', 'ถุง', 'ถุงใส', 'กรัม', 'กก', 'gap', 'kg', 'g', 'gm', 'กิโล', 'กิโลกรัม', 'แพ็ค', 'แพค', 'ผัก', 'สด', 'ปลอดสาร'];

  // 1. ดึงชื่อในวงเล็บ (ถ้าไม่ใช่หน่วยบรรจุภัณฑ์)
  const enMatch = lower.match(/\(([^)]+)\)/);
  if (enMatch && enMatch[1]) {
    const en = enMatch[1]
      .replace(/\d+(?:\.\d+)?\s*(?:ขีด|ถุง|กรัม|กก|kg|g|gm|กิโลกรัม|กิโล)/gi, '')
      .replace(/ถุงใส|ถุง|แพ็ค|แพค|gap/gi, '')
      .trim();
    if (en && !skipWords.includes(en) && !/^[0-9.\s]+$/.test(en)) {
      terms.push(en);
      en.split(/[\s-]+/).forEach(w => {
        const cleanW = w.replace(/^[0-9.]+|[0-9.]+$/g, '').trim();
        if (cleanW.length >= 2 && !skipWords.includes(cleanW) && !/^\d+$/.test(cleanW) && cleanW !== 'lettuce') {
          terms.push(cleanW);
        }
      });
    }
  }

  // 2. ดึงชื่อหลักแบบตัดคำขยายทั่วไปออก
  const cleanMain = lower
    .replace(/\([^)]*\)/g, '')
    .replace(/ปลอดสาร|สดกรอบ|สด|gap|อินทรีย์|ซูเปอร์ฟู้ด|โฮมเมด|กรอบพรีเมียม|เนื้อนุ่ม|พรีเมียม|ถุงใส|\d+\s*ขีด|\d+\s*กรัม|\d+\s*กิโล/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanMain && cleanMain.length >= 2 && !skipWords.includes(cleanMain)) {
    terms.push(cleanMain);
    if (cleanMain.startsWith('ผัก')) {
      const withoutPhak = cleanMain.replace(/^ผัก\s*/, '').trim();
      if (withoutPhak.length >= 2 && !skipWords.includes(withoutPhak)) {
        terms.push(withoutPhak);
      }
    } else {
      terms.push(`ผัก${cleanMain}`, `ผัก ${cleanMain}`);
    }
  }

  // 3. คำพ้องของผักยอดนิยม
  if (lower.includes('บุ้ง') || lower.includes('morning glory') || lower.includes('spinach')) {
    terms.push('ผักบุ้งจีน', 'ผักบุ้ง', 'บุ้งจีน', 'บุ้ง', 'morning glory', 'water spinach');
  }
  if (lower.includes('กวางตุ้ง') || lower.includes('choy') || lower.includes('กวางตุง')) {
    terms.push('ผักกวางตุ้ง', 'กวางตุ้ง', 'กวางตุง', 'choy sum', 'bok choy');
  }
  if (lower.includes('กรีน') || lower.includes('green')) {
    terms.push('ผักกรีนโอ๊ค', 'กรีนโอ๊ค', 'กรีนโอค', 'กรีนโอ้ค', 'กรีน', 'green oak', 'greenoak');
  }
  if (lower.includes('เรด') || lower.includes('red')) {
    terms.push('ผักเรดโอ๊ค', 'เรดโอ๊ค', 'เรดโอค', 'เรดโอ้ค', 'เรด', 'red oak', 'redoak');
  }
  if (lower.includes('คอส') || lower.includes('cos') || lower.includes('โรเมน')) {
    terms.push('ผักคอส', 'คอส', 'cos', 'โรเมน', 'romaine');
  }
  if (lower.includes('ฟิล') || lower.includes('ฟิน') || lower.includes('frillice') || lower.includes('ไอซ์เบิร์ก')) {
    terms.push('ผักฟิลเล่ย์', 'ฟิลเล่ย์', 'ฟินเล่ย์', 'ฟิลเลย์', 'ฟินเลย์', 'ไอซ์เบิร์ก', 'frillice');
  }
  if (lower.includes('บัตเตอร์') || lower.includes('butter')) {
    terms.push('ผักบัตเตอร์เฮด', 'บัตเตอร์เฮด', 'บัตเตอร์', 'butterhead');
  }
  if (lower.includes('กาดขาว') || (lower.includes('cabbage') && !lower.includes('salad'))) {
    terms.push('ผักกาดขาว', 'กาดขาว', 'chinese cabbage');
  }
  if (lower.includes('เคล') || lower.includes('kale')) {
    terms.push('ผักเคล', 'เคล', 'kale', 'คะน้าใบหยิก');
  }

  return [...new Set(terms.map(t => t.toLowerCase().trim()).filter(t => t.length >= 2))].sort((a, b) => b.length - a.length);
}

const escapeRx = s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

// Helper: ตรวจสอบว่าข้อความมีคีย์เวิร์ดผักนั้นหรือไม่ (รองรับทั้งชื่อไทยและอังกฤษ เช่น "test" โดยไม่ชนคำอังกฤษอื่น)
export function matchesKeywordInText(textLower, kw) {
  if (!textLower || !kw) return false;
  const cleanKw = kw.toLowerCase().trim();
  if (cleanKw.length < 2) return false;
  if (/^[a-z0-9]+$/i.test(cleanKw)) {
    const rx = new RegExp(`(^|[^a-z0-9])${escapeRx(cleanKw)}([^a-z0-9]|$)`, 'i');
    return rx.test(textLower);
  }
  return textLower.includes(cleanKw);
}

// Helper: ดึงรายการรอบการปลูกที่กำลังปลูกอยู่ในปัจจุบันทั้งหมด
export async function getActivePlantingBatches() {
  const [batches] = await pool.query(`
    SELECT b.id AS batch_id, b.start_date, b.seed_prep_date, b.expected_harvest_date, b.status,
           c.id AS crop_id, c.name AS crop_name, c.scientific_name, c.growth_days,
           p.id AS plot_id, p.name AS plot_name, p.seed_prep_date AS plot_seed_prep_date, p.planting_date AS plot_planting_date
    FROM planting_batches b
    LEFT JOIN crops c ON b.crop_id = c.id
    LEFT JOIN plots p ON b.plot_id = p.id
    WHERE b.status IN ('growing', 'active', 'harvest_ready')
      AND b.expected_harvest_date IS NOT NULL
    ORDER BY b.expected_harvest_date ASC
  `);
  return batches;
}

// Helper: ตรวจสอบรอบเก็บเกี่ยวถัดไปของผักชนิดที่ระบุ จาก planting_batches (รองรับชื่อผักทุกชนิดแบบ Dynamic)
export async function getUpcomingHarvestForProduct(productName) {
  try {
    const searchTerms = extractDynamicSearchTerms(productName);
    const allUpcoming = await getActivePlantingBatches();

    for (const item of allUpcoming) {
      const cropTerms = extractDynamicSearchTerms(item.crop_name || '');
      if (item.scientific_name) {
        cropTerms.push(String(item.scientific_name).toLowerCase().trim());
      }
      const cropLower = (item.crop_name || '').toLowerCase();
      const prodLower = (productName || '').toLowerCase();

      const isMatch =
        searchTerms.some(term => matchesKeywordInText(cropLower, term)) ||
        cropTerms.some(term => matchesKeywordInText(prodLower, term));

      if (isMatch) {
        const stats = computeBatchStats(item);
        return {
          hasUpcoming: true,
          harvestDate: stats.effectiveExpectedDate,
          harvestDateThai: stats.harvestDateThai,
          daysRemaining: stats.daysRemaining,
          plantAge: stats.plantAge,
          growthDays: stats.growthDays,
          plotName: item.plot_name || 'แปลงปลูกในฟาร์ม',
          cropName: item.crop_name,
          status: item.status,
        };
      }
    }
  } catch (err) {
    console.error('getUpcomingHarvestForProduct error:', err.message);
  }

  return { hasUpcoming: false };
}

// Helper: ตรวจจับกรณีลูกค้าถามหาผักรายชนิด (เช่น "ตอนนี้ผัก test มีไหม", "มี test ไหม", "ผัก test เก็บวันไหน", "สั่ง test")
// คืนค่าข้อความตอบกลับพร้อมข้อมูลแปลงปลูก อายุพืช กำหนดเก็บเกี่ยว และสถานะให้แสดงการ์ดเมนูควบคู่กัน
export async function detectCropInquiry(userText) {
  try {
    if (!userText || typeof userText !== 'string') return null;
    const lowerText = userText.trim().toLowerCase();

    // หากลูกค้าถามภาพรวมว่ามีเมนูอะไรบ้าง / มีผักอะไรบ้าง ให้ไปใช้การ์ดเมนูปกติ
    const generalMenuPhrases = ['อะไรบ้าง', 'มีอะไรขาย', 'ขายอะไร', 'เมนูอะไร', 'เมนุอะไร', 'รายการผัก', 'รายการสินค้า', 'ดูเมนู', 'ขอดูเมนู'];
    if (generalMenuPhrases.some(p => lowerText.includes(p)) || ['เมนู', 'เมนูผัก', 'menu', 'ผัก'].includes(lowerText)) {
      return null;
    }

    const [products] = await pool.query(
      'SELECT id, name, price, unit, stock_quantity, status FROM products'
    );
    const batches = await getActivePlantingBatches();
    const [crops] = await pool.query(
      'SELECT id, name, scientific_name, growth_days FROM crops'
    );

    // 1. ตรวจสอบว่าข้อความกล่าวถึงผักที่กำลังปลูกอยู่ในแปลง (planting_batches) หรือไม่
    let matchedBatch = null;
    for (const b of batches) {
      const terms = extractDynamicSearchTerms(b.crop_name || '');
      if (b.scientific_name) {
        const sci = String(b.scientific_name).toLowerCase().trim();
        if (sci.length >= 2) terms.push(sci);
      }
      if (terms.some(t => matchesKeywordInText(lowerText, t))) {
        matchedBatch = b;
        break;
      }
    }

    // 2. ตรวจสอบว่าข้อความกล่าวถึงสินค้าในตาราง products หรือไม่
    let matchedProduct = null;
    for (const p of products) {
      const terms = extractDynamicSearchTerms(p.name || '');
      if (terms.some(t => matchesKeywordInText(lowerText, t))) {
        matchedProduct = p;
        break;
      }
    }

    // 3. ตรวจสอบว่าข้อความกล่าวถึงชนิดพืชในตาราง crops (แม้ยังไม่ได้ลงแปลงหรือยังไม่อยู่ในร้านค้า) หรือไม่
    let matchedCrop = null;
    for (const c of crops) {
      const terms = extractDynamicSearchTerms(c.name || '');
      if (c.scientific_name) {
        const sci = String(c.scientific_name).toLowerCase().trim();
        if (sci.length >= 2) terms.push(sci);
      }
      if (terms.some(t => matchesKeywordInText(lowerText, t))) {
        matchedCrop = c;
        break;
      }
    }

    if (!matchedBatch && !matchedProduct && !matchedCrop) {
      return null;
    }

    // กรณีที่ 1: มีสินค้าชนิดนั้นวางขายในร้านค้าและมีสต็อกพร้อมส่ง (status = 'available' && stock_quantity > 0)
    if (matchedProduct && matchedProduct.status === 'available' && Number(matchedProduct.stock_quantity) > 0) {
      const shortName = matchedProduct.name.split('(')[0].trim();
      return {
        isCropInquiry: true,
        status: 'available',
        product: matchedProduct,
        showMenuCard: true,
        replyText: `✅ ตอนนี้ "${matchedProduct.name}" มีสินค้าพร้อมจัดส่งครับ! 🌱\n\n💰 ราคา: ${Number(matchedProduct.price).toLocaleString()} บาท/${matchedProduct.unit}\n📦 สต็อกคงเหลือ: ${Number(matchedProduct.stock_quantity).toLocaleString()} ${matchedProduct.unit}\n\n👇 คุณลูกค้าสามารถแตะปุ่ม [สั่ง 🛒] จากการ์ดเมนูด้านล่าง หรือพิมพ์สั่งซื้อในแชท เช่น "สั่ง${shortName} 2 ${matchedProduct.unit}" ได้เลยครับ 😊`,
      };
    }

    // กรณีที่ 2: ไม่มีในสต็อกพร้อมขาย (หรือยังไม่เคยเพิ่มเข้าหน้าร้านเลย เช่น ผัก "test") แต่กำลังปลูกอยู่ในแปลงเพาะปลูก!
    if (matchedBatch) {
      const stats = computeBatchStats(matchedBatch);
      const displayCropName = matchedProduct ? matchedProduct.name : matchedBatch.crop_name;
      const isNeverInStore = !matchedProduct;

      const introLine = isNeverInStore
        ? `🌱 ขณะนี้ผัก "${displayCropName}" ยังไม่มีวางจำหน่ายในหน้าร้านครับ เนื่องจากทางฟาร์มกำลังเพาะปลูกอยู่บนแปลงครับ`
        : `🌱 ขออภัยครับ ขณะนี้ผัก "${displayCropName}" ในสต็อกหมดชั่วคราวครับ แต่ทางฟาร์มกำลังเพาะปลูกรอเก็บเกี่ยวรอบถัดไปอยู่ครับ`;

      const harvestTimingText = stats.daysRemaining > 0
        ? `${stats.harvestDateThai} (อีกประมาณ ${stats.daysRemaining} วัน)`
        : `${stats.harvestDateThai} (ครบกำหนดพร้อมเก็บเกี่ยวเร็วๆ นี้ครับ)`;

      return {
        isCropInquiry: true,
        status: 'growing',
        batch: matchedBatch,
        showMenuCard: true,
        replyText: `${introLine}\n\n🚜 สถานะการเพาะปลูกปัจจุบัน:\n• แปลงเพาะปลูก: ${matchedBatch.plot_name || 'แปลงปลูกในฟาร์ม'}\n• อายุพืชปัจจุบัน: ${stats.plantAge}/${stats.growthDays} วัน\n• กำหนดเก็บเกี่ยว: ${harvestTimingText}\n\n👇 ระหว่างรอเก็บเกี่ยว คุณลูกค้าสามารถเลือกชมและสั่งซื้อผักสดปลอดสาร GAP ชนิดอื่นๆ ที่มีพร้อมส่งวันนี้ได้จากการ์ดเมนูด้านล่างนี้เลยครับ 😊`,
      };
    }

    // กรณีที่ 3: มีชื่อใน products (แต่สต็อก 0) หรือมีชื่อใน crops แต่ยังไม่มีรอบปลูกที่กำลังเติบโต
    const unavailableName = matchedProduct ? matchedProduct.name : matchedCrop?.name;
    return {
      isCropInquiry: true,
      status: 'out_of_stock',
      showMenuCard: true,
      replyText: `🌱 ขออภัยครับ ขณะนี้ผัก "${unavailableName}" ยังไม่มีสินค้าพร้อมจำหน่าย และอยู่ระหว่างเตรียมแปลงสำหรับรอบเพาะปลูกถัดไปครับ\n\n👇 คุณลูกค้าสามารถเลือกชมและสั่งซื้อผักสดปลอดสาร GAP ชนิดอื่นๆ ที่มีพร้อมส่งวันนี้ได้จากการ์ดเมนูด้านล่างนี้เลยครับ 😊`,
    };
  } catch (err) {
    console.error('detectCropInquiry error:', err.message);
    return null;
  }
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
      'SELECT name, crop_name, field_safety_status, status FROM plots WHERE status IN ("active", "growing", "harvest_ready", "preparing")'
    );
    const batches = await getActivePlantingBatches();
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

    context += '\n[ข้อมูลผักที่กำลังเพาะปลูกบนแปลงและกำหนดการเก็บเกี่ยวรอบถัดไป (รวมผักที่ยังไม่อยู่ในหน้าร้านและผักที่สต็อกหมด)]:\n';
    if (outOfStockProducts.length > 0 || batches.length > 0) {
      if (outOfStockProducts.length > 0) {
        outOfStockProducts.forEach(p => {
          context += `- ผักในหน้าร้านที่หมดชั่วคราว: ${p.name} (สต็อก 0)\n`;
        });
      }
      if (batches.length > 0) {
        context += `รายการแปลงเพาะปลูกที่กำลังปลูกอยู่ในฟาร์มขณะนี้:\n`;
        batches.forEach(b => {
          const stats = computeBatchStats(b);
          context += `- พืช: ${b.crop_name} (ยังไม่มีพร้อมขาย อยู่ระหว่างเพาะปลูก), ปลูกอยู่ที่: ${b.plot_name}, อายุพืชปัจจุบัน: ${stats.plantAge}/${stats.growthDays} วัน, กำหนดพร้อมเก็บเกี่ยว: ${stats.harvestDateThai} (อีกประมาณ ${stats.daysRemaining} วัน, สถานะ: ${b.status})\n`;
        });
      }
    } else {
      context += '- ไม่มีรายการแปลงเพาะปลูกที่รอเก็บเกี่ยว\n';
    }
    
    context += '\n[ข้อมูลแปลงเพาะปลูกและสถานะความปลอดภัย GAP ปัจจุบัน]:\n';
    if (plots.length > 0) {
      plots.forEach(pl => {
        context += `- แปลง: ${pl.name}, พืชในแปลง: ${pl.crop_name || 'กำลังเตรียมแปลง'}, สถานะแปลง: ${pl.status}, สถานะตรวจแปลง GAP: ${pl.field_safety_status}\n`;
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
