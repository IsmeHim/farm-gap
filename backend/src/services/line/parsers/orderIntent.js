import { pool } from '../../../db.js';
import { extractOrderWithGemini } from '../ai/gemini.js';
import { getUpcomingHarvestForProduct } from '../ai/farmContext.js';

// Helper: แปลงคำบอกจำนวนและเลขไทยเป็นตัวเลขอารบิก
export function normalizeThaiQuantity(str) {
  if (!str) return '';
  let s = str;
  // แปลงเลขไทย ๐-๙
  const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  thaiDigits.forEach((td, i) => {
    s = s.replaceAll(td, String(i));
  });

  // แปลงคำบอกจำนวนพิเศษ เช่น ครึ่งกิโล, ครึ่งถุง, ครึ่งขีด
  s = s.replace(/ครึ่ง\s*(?:กิโลกรัม|กิโล|กีโล|กก\.|ก\.ก\.|กก|โล|kg)/gi, ' 0.5 กิโล ');
  s = s.replace(/ครึ่ง\s*(?:ถุง|แพ็ค|แพค|ห่อ)/gi, ' 0.5 ถุง ');
  s = s.replace(/ครึ่ง\s*ขีด/gi, ' 0.5 ขีด ');
  s = s.replace(/(?:^|\s)ครึ่ง(?:\s|$)/g, ' 0.5 ');

  // แปลงคำบอกจำนวนภาษาไทยเดี่ยวๆ (ต้องเก็บหน่วยเดิมไว้ ไม่ลบหน่วยทิ้ง)
  const wordToNum = [
    { words: ['สิบ'], val: '10' },
    { words: ['เก้า'], val: '9' },
    { words: ['แปด'], val: '8' },
    { words: ['เจ็ด'], val: '7' },
    { words: ['หก'], val: '6' },
    { words: ['ห้า'], val: '5' },
    { words: ['สี่'], val: '4' },
    { words: ['สาม'], val: '3' },
    { words: ['สอง', 'คู่'], val: '2' },
    { words: ['หนึ่ง', 'นึง'], val: '1' },
  ];

  for (const item of wordToNum) {
    for (const w of item.words) {
      s = s.replace(
        new RegExp(`(^|[^ก-๙a-zA-Z0-9])${w}(?:\\s*(กิโลกรัม|กิโล|กีโล|กก\\.|ก\\.ก\\.|กก|โล|แพ็ค|แพค|ถุง|ชิ้น|หัว|ชุด|ขีด))?(?=[^ก-๙a-zA-Z0-9]|$)`, 'gi'),
        (match, prefix, unit) => `${prefix} ${item.val} ${unit ? unit + ' ' : ''}`
      );
    }
  }

  return s.replace(/\s+/g, ' ').trim();
}

// Helper: คำนวณน้ำหนักต่อถุง (กิโลกรัม) จากชื่อสินค้า
export function getProductWeightInKg(productName) {
  if (!productName) return 0.4;
  const kheedMatch = productName.match(/(\d+(?:\.\d+)?)\s*ขีด/);
  if (kheedMatch) return parseFloat(kheedMatch[1]) * 0.1;
  const gramMatch = productName.match(/(\d+(?:\.\d+)?)\s*(?:กรัม|g|gm)/i);
  if (gramMatch) return parseFloat(gramMatch[1]) / 1000;
  const kgMatch = productName.match(/(\d+(?:\.\d+)?)\s*(?:กิโล|กก|kg)/i);
  if (kgMatch) return parseFloat(kgMatch[1]);
  return 0.4; // ค่าเริ่มต้นมาตรฐานฟาร์ม FarmGAP: 4 ขีด (400 กรัม / 0.4 กิโลกรัม) ต่อถุง
}

// Helper: สกัดคีย์เวิร์ดชื่อผักทั้งไทย/อังกฤษ/คำย่อ/คำสะกดผิดสำหรับสินค้าทุกตัวในระบบ
export function getProductKeywords(productName) {
  const lower = productName.toLowerCase();
  const keywords = [];

  // 1. ดึงชื่อภาษาอังกฤษในวงเล็บ เช่น (Chinese Cabbage), (Green Oak) (ข้ามคำที่เป็นหน่วย/ตัวเลข เช่น 4 ขีด, ถุงใส)
  const enMatch = lower.match(/\(([^)]+)\)/);
  const skipWords = ['ขีด', 'ถุง', 'ถุงใส', 'กรัม', 'กก', 'gap', 'kg', 'g', 'gm'];
  if (enMatch && enMatch[1]) {
    const en = enMatch[1].trim();
    if (!skipWords.includes(en.toLowerCase()) && !/^[0-9.\s]+$/.test(en)) {
      keywords.push(en);
    }
    en.split(/[\s-]+/).forEach(w => {
      const cleanW = w.replace(/^[0-9.]+|[0-9.]+$/g, '').trim().toLowerCase();
      if (cleanW.length >= 3 && !skipWords.includes(cleanW) && !/^\d+$/.test(cleanW)) {
        keywords.push(cleanW);
      }
    });
  }

  // 2. ดึงชื่อภาษาไทยหลัก ตัดคำตกแต่ง (เช่น ปลอดสาร, สด, GAP, อินทรีย์, พรีเมียม ฯลฯ)
  const cleanThai = lower
    .replace(/\([^)]*\)/g, '')
    .replace(/ปลอดสาร|สด|gap|อินทรีย์|ซูเปอร์ฟู้ด|โฮมเมด|กรอบพรีเมียม|เนื้อนุ่ม|พรีเมียม|ถุงใส|ขีด/g, '')
    .trim();

  if (cleanThai) {
    keywords.push(cleanThai);
    if (cleanThai.startsWith('ผัก')) {
      const withoutPhak = cleanThai.replace(/^ผัก/, '').trim();
      if (withoutPhak.length >= 2) keywords.push(withoutPhak);
    }
  }

  // 3. คีย์เวิร์ดภาษาไทยและคำพ้องที่ผู้ใช้งานมักพิมพ์บ่อย (รวมคำเว้นวรรค, คำย่อ, และคำพิมพ์ผิด)
  if (lower.includes('บุ้ง') || lower.includes('morning glory') || lower.includes('spinach')) {
    keywords.push('ผักบุ้งจีนสด', 'ผักบุ้งจีน', 'ผัก บุ้ง จีน', 'ผักบุ้ง', 'ผัก บุ้ง', 'บุ้งจีน', 'บุ้ง', 'morning glory', 'water spinach');
  }
  if (lower.includes('กวางตุ้ง') || lower.includes('choy') || lower.includes('กวางตุง')) {
    keywords.push('ผักกวางตุ้งสด', 'ผักกวางตุ้ง', 'ผัก กวางตุ้ง', 'กวางตุ้ง', 'กวาง ตุ้ง', 'กวางตุง', 'กวางตุ้งฮ่องเต้', 'choy sum', 'bok choy');
  }
  if (lower.includes('กาดขาว') || lower.includes('cabbage')) {
    keywords.push('ผักกาดขาวสด', 'ผักกาดขาว', 'ผัก กาดขาว', 'กาดขาว', 'cabbage', 'chinese cabbage');
  }
  if (lower.includes('กาดหอม') || lower.includes('lettuce')) {
    keywords.push('ผักกาดหอมสด', 'ผักกาดหอม', 'ผัก กาดหอม', 'กาดหอม', 'lettuce');
  }
  if (lower.includes('ฟิล') || lower.includes('ฟิน') || lower.includes('frillice') || lower.includes('ไอซ์เบิร์ก')) {
    keywords.push('ผักฟิลเล่ย์', 'ผัก ฟิลเล่ย์', 'ฟิลเล่ย์', 'ฟิล เล่ย์', 'ฟินเล่ย์', 'ฟิน เล่ย์', 'ฟิลเลย์', 'ฟินเลย์', 'ฟิลเล', 'ไอซ์เบิร์ก', 'ไอซ์ เบิร์ก', 'ไอสเบิร์ก', 'ไอซ์เบิก', 'frillice');
  }
  if (lower.includes('กรีน') || lower.includes('green')) {
    keywords.push('ผักกรีนโอ๊คสด', 'ผักกรีนโอ๊ค', 'ผัก กรีนโอ๊ค', 'กรีนโอ๊คสด', 'กรีนโอ๊ค', 'กรีน โอ๊ค', 'กรีนโอค', 'กรีน โอค', 'กรีนโอ้ค', 'กรีน', 'ผักกรีน', 'green oak', 'greenoak');
  }
  if (lower.includes('เรด') || lower.includes('red')) {
    keywords.push('ผักเรดโอ๊คสด', 'ผักเรดโอ๊ค', 'ผัก เรดโอ๊ค', 'เรดโอ๊คสด', 'เรดโอ๊ค', 'เรด โอ๊ค', 'เรดโอค', 'เรด โอค', 'เรดโอ้ค', 'เรด', 'ผักเรด', 'red oak', 'redoak');
  }
  if (lower.includes('คอส') || lower.includes('cos') || lower.includes('โรเมน')) {
    keywords.push('ผักคอสสด', 'ผักคอส', 'ผัก คอส', 'คอสสด', 'คอส', 'กรีนคอส', 'เรดคอส', 'cos', 'โรเมน', 'romaine', 'คอสสลัด');
  }
  if (lower.includes('บัตเตอร์') || lower.includes('butter')) {
    keywords.push('ผักบัตเตอร์เฮดสด', 'ผักบัตเตอร์เฮด', 'ผัก บัตเตอร์เฮด', 'บัตเตอร์เฮด', 'บัตเตอร์ เฮด', 'บัตเตอร์', 'บัตเตอร์เฮต', 'butterhead');
  }
  if (lower.includes('เคล') || lower.includes('kale')) {
    keywords.push('ผักเคลสด', 'ผักเคล', 'ผัก เคล', 'เคล', 'kale', 'คะน้าใบหยิก');
  }
  if (lower.includes('น้ำสลัด') || lower.includes('sesame') || lower.includes('งาคั่ว')) {
    keywords.push('น้ำสลัด', 'งาคั่ว', 'น้ำสลัดงาคั่ว', 'dressing');
  }

  // เรียงลำดับจากคำที่ยาวที่สุดไปสั้นที่สุดเสมอ เพื่อให้จับคำที่จำเพาะเจาะจงก่อน
  return [...new Set(keywords.filter(k => k.length >= 2))].sort((a, b) => b.length - a.length);
}

// 3. วิเคราะห์เจตนาและสกัดคำสั่งซื้อจากข้อความธรรมชาติ (Order Intent & Entity Extraction)
export async function extractOrderIntent(text) {
  const buyKeywords = [
    'สั่ง', 'ซื้อ', 'เอา', 'รับ', 'จอง', 'order', 'ขอ', 'อยากได้', 'อยากสั่ง', 'ต้องการ',
    'จัด', 'ส่ง', 'จัดส่ง', 'เพิ่ม', 'สัก', 'ซัก', 'กิโล', 'กีโล', 'โล', 'แพ็ค', 'แพค',
    'ถุง', 'กก', 'กล่อง', 'ชุด', 'ขีด', 'มัด', 'ต้น', 'หัว'
  ];
  const hasBuyKeyword = buyKeywords.some(k => text.includes(k));

  const [products] = await pool.query(
    'SELECT id, name, price, unit, stock_quantity, status FROM products'
  );

  if (products.length === 0) {
    return { isOrder: false };
  }

  // 1. ทำความสะอาดข้อความ: ลบลำดับข้อ 1., 2., [1], (1), -, • ออกจากต้นบรรทัด
  let cleanedText = text
    .split('\n')
    .map(line => line.replace(/^\s*(?:[0-9]+[.)\]\-:]|\-|\*|•)\s*/, '').trim())
    .filter(Boolean)
    .join('\n');

  // 2. แปลงคำบอกจำนวนภาษาไทย และเลขไทยเป็นเลขอารบิก
  const normalizedText = normalizeThaiQuantity(cleanedText);
  const lowerText = normalizedText.toLowerCase();

  // ตรวจสอบแพทเทิร์น "อย่างละ [ตัวเลข] [หน่วย?]" (เช่น "เอากรีนโอ๊ค เรดโอ๊ค อย่างละ 2 ถุง" หรือ "อย่างละ 2 กิโล")
  const eachMatch = lowerText.match(/อย่างละ\s*([0-9]+(?:\.[0-9]+)?)\s*(กิโลกรัม|กิโล|กีโล|กก\.|ก\.ก\.|กก|โล|kg|ขีด|ถุง|แพ็ค|แพค|ห่อ|ชุด|อัน|ชิ้น)?/i);
  const defaultEachRawQty = eachMatch && parseFloat(eachMatch[1]) > 0 ? parseFloat(eachMatch[1]) : null;
  const defaultEachUnit = eachMatch && eachMatch[2] ? eachMatch[2].trim().toLowerCase() : null;

  let matchedItems = [];
  const addedProductIds = new Set();

  // ฟังก์ชันย่อยช่วยสกัดจำนวนสินค้าและหน่วย พร้อมคำนวณแปลงหน่วยเป็นจำนวนถุงอัตโนมัติ (เช่น กิโล/ขีด -> ถุง)
  const escapeRx = s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const extractQuantityAndUnitForKeyword = (segment, kw, product) => {
    const unitsRegexStr = '(?:กิโลกรัม|กิโล|กีโล|กก\\.|ก\\.ก\\.|กก|โล|kg|ขีด|ถุง|แพ็ค|แพค|ห่อ|ชุด|อัน|ชิ้น)';
    const escapedKw = escapeRx(kw);
    const weightPerBag = getProductWeightInKg(product?.name);

    // 1. kw ... num unit
    let rx = new RegExp(escapedKw + '[^0-9]{0,25}?([0-9]+(?:\\.[0-9]+)?)\\s*(' + unitsRegexStr + ')?', 'i');
    let match = segment.match(rx);

    // 2. num unit ... kw
    if (!match) {
      rx = new RegExp('([0-9]+(?:\\.[0-9]+)?)\\s*(' + unitsRegexStr + ')?[^0-9]{0,25}?' + escapedKw, 'i');
      match = segment.match(rx);
    }

    let rawQty = null;
    let rawUnit = null;

    if (match) {
      rawQty = parseFloat(match[1]);
      rawUnit = match[2] ? match[2].trim().toLowerCase() : null;
    }

    if (!rawQty || isNaN(rawQty) || rawQty <= 0) {
      return { qty: null, note: null };
    }

    const isKg = rawUnit && /^(กิโลกรัม|กิโล|กีโล|กก\.|ก\.ก\.|กก|โล|kg)$/i.test(rawUnit);
    const isKheed = rawUnit && /^ขีด$/i.test(rawUnit);

    let finalQty = rawQty;
    let note = null;

    if (isKg) {
      const calculated = rawQty / weightPerBag;
      finalQty = Math.round(calculated);
      if (finalQty < 1) finalQty = 1;
      const kheedPerBag = Math.round(weightPerBag * 10);
      if (calculated % 1 === 0) {
        note = `คำนวณจาก ${rawQty} กิโลกรัม = ${finalQty} ถุงพอดี (ถุงละ ${kheedPerBag} ขีด)`;
      } else {
        note = `คำนวณจาก ${rawQty} กิโลกรัม ≈ ${finalQty} ถุง (ถุงละ ${kheedPerBag} ขีด)`;
      }
    } else if (isKheed) {
      const kheedPerBag = Math.round(weightPerBag * 10);
      const calculated = rawQty / (weightPerBag * 10);
      finalQty = Math.round(calculated);
      if (finalQty < 1) finalQty = 1;
      note = `คำนวณจาก ${rawQty} ขีด = ${finalQty} ถุง (ถุงละ ${kheedPerBag} ขีด)`;
    } else {
      finalQty = Math.round(rawQty);
    }

    return { qty: finalQty, rawQty, rawUnit, note };
  };

  // Helper สำหรับคำนวณจำนวนกรณีมี "อย่างละ ..."
  const calculateDefaultEachQty = (product) => {
    if (!defaultEachRawQty) return { qty: 1, note: null };
    const weightPerBag = getProductWeightInKg(product?.name);
    const isKg = defaultEachUnit && /^(กิโลกรัม|กิโล|กีโล|กก\.|ก\.ก\.|กก|โล|kg)$/i.test(defaultEachUnit);
    const isKheed = defaultEachUnit && /^ขีด$/i.test(defaultEachUnit);
    if (isKg) {
      const calculated = defaultEachRawQty / weightPerBag;
      const finalQty = Math.max(1, Math.round(calculated));
      const kheedPerBag = Math.round(weightPerBag * 10);
      return {
        qty: finalQty,
        note: `คำนวณจาก ${defaultEachRawQty} กิโลกรัม = ${finalQty} ถุง (ถุงละ ${kheedPerBag} ขีด)`,
      };
    } else if (isKheed) {
      const kheedPerBag = Math.round(weightPerBag * 10);
      const finalQty = Math.max(1, Math.round(defaultEachRawQty / (weightPerBag * 10)));
      return {
        qty: finalQty,
        note: `คำนวณจาก ${defaultEachRawQty} ขีด = ${finalQty} ถุง (ถุงละ ${kheedPerBag} ขีด)`,
      };
    }
    return { qty: Math.round(defaultEachRawQty), note: null };
  };

  // 3. วิเคราะห์แบบแบ่ง Segment
  const segments = lowerText.split(/[\n,+]|\s+และ\s+|\s+กับ\s+|\s+แล้วก็\s+/).map(s => s.trim()).filter(Boolean);

  for (const segment of segments) {
    for (const product of products) {
      if (addedProductIds.has(product.id)) continue;
      const keywords = getProductKeywords(product.name);
      const matchedKw = keywords.find(kw => segment.includes(kw));

      if (matchedKw) {
        const parsed = extractQuantityAndUnitForKeyword(segment, matchedKw, product);
        let qty = parsed.qty;
        let note = parsed.note;

        if (!qty && defaultEachRawQty) {
          const def = calculateDefaultEachQty(product);
          qty = def.qty;
          note = def.note;
        }
        if (!qty) qty = 1;

        matchedItems.push({
          product_id: product.id,
          name: product.name,
          price: Number(product.price),
          unit: product.unit || 'ถุง',
          quantity: qty,
          stock_quantity: Number(product.stock_quantity),
          subtotal: Number(product.price) * qty,
          conversion_note: note,
        });
        addedProductIds.add(product.id);
      }
    }
  }

  // 4. ถ้ายังไม่พบจากการแบ่ง Segment ให้ลองค้นหาทั่วทั้งประโยค
  if (matchedItems.length === 0) {
    for (const product of products) {
      if (addedProductIds.has(product.id)) continue;
      const keywords = getProductKeywords(product.name);
      const matchedKw = keywords.find(kw => lowerText.includes(kw));

      if (matchedKw) {
        const parsed = extractQuantityAndUnitForKeyword(lowerText, matchedKw, product);
        let qty = parsed.qty;
        let note = parsed.note;

        if (!qty && defaultEachRawQty) {
          const def = calculateDefaultEachQty(product);
          qty = def.qty;
          note = def.note;
        }
        if (!qty) qty = 1;

        matchedItems.push({
          product_id: product.id,
          name: product.name,
          price: Number(product.price),
          unit: product.unit || 'ถุง',
          quantity: qty,
          stock_quantity: Number(product.stock_quantity),
          subtotal: Number(product.price) * qty,
          conversion_note: note,
        });
        addedProductIds.add(product.id);
      }
    }
  }

  // กรณีสั่งผักรายการเดียว และในประโยคมีตัวเลขโดดๆ (เช่น "ขอสั่งผักกาดขาว 10")
  if (matchedItems.length === 1 && matchedItems[0].quantity === 1 && !matchedItems[0].conversion_note) {
    const singleDigitMatch = lowerText.match(/\b([1-9][0-9]*)\b/);
    if (singleDigitMatch && singleDigitMatch[1]) {
      const parsedNum = parseInt(singleDigitMatch[1], 10);
      if (parsedNum > 0 && parsedNum <= 100) {
        matchedItems[0].quantity = parsedNum;
        matchedItems[0].subtotal = matchedItems[0].price * matchedItems[0].quantity;
      }
    }
  }

  // 5. หาก Local Matching ของระบบยังสกัดไม่เจอ แต่ผู้ใช้มีเจตนาซื้อผัก จึงค่อยส่งต่อให้ Gemini AI ช่วยเป็น Fallback
  if (matchedItems.length === 0 && hasBuyKeyword) {
    const geminiResult = await extractOrderWithGemini(text, products);
    if (geminiResult && geminiResult.isOrder && Array.isArray(geminiResult.items) && geminiResult.items.length > 0) {
      for (const gItem of geminiResult.items) {
        const prod = products.find(p => p.id === gItem.product_id);
        if (prod) {
          const qty = Number(gItem.quantity) || 1;
          matchedItems.push({
            product_id: prod.id,
            name: prod.name,
            price: Number(prod.price),
            unit: prod.unit || 'กก.',
            quantity: qty,
            stock_quantity: Number(prod.stock_quantity),
            subtotal: Number(prod.price) * qty,
          });
        }
      }
    }
  }

  if (matchedItems.length === 0) {
    return { isOrder: false };
  }

  if (!hasBuyKeyword && !lowerText.match(/\d+/)) {
    return { isOrder: false };
  }

  // ตรวจสอบสต็อกสินค้าและรอบเก็บเกี่ยวถัดไป
  for (const item of matchedItems) {
    const isOutOfStock = item.status === 'out_of_stock' || item.stock_quantity <= 0;
    if (isOutOfStock) {
      const harvest = await getUpcomingHarvestForProduct(item.name);
      if (harvest.hasUpcoming) {
        return {
          isOrder: true,
          error: `ขออภัยครับ ขณะนี้ผัก "${item.name}" ในสต็อกหมดชั่วคราวครับ 🌱\n\n🚜 ทางฟาร์มกำลังเพาะปลูกอยู่ที่ "${harvest.plotName}" คาดว่าจะพร้อมเก็บเกี่ยวรอบถัดไปประมาณวันที่ ${harvest.harvestDateThai} (อีกประมาณ ${harvest.daysRemaining} วัน) ครับ\n\nคุณลูกค้าสามารถพิมพ์ "เมนูผัก" เพื่อเลือกชมผักสดชนิดอื่นๆ ที่มีพร้อมส่งวันนี้ได้เลยครับ! 😊`,
        };
      } else {
        return {
          isOrder: true,
          error: `ขออภัยครับ ขณะนี้ผัก "${item.name}" ในสต็อกหมดชั่วคราวครับ 🌱 ทางฟาร์มกำลังเตรียมแปลงสำหรับรอบปลูกถัดไปครับ\n\nคุณลูกค้าสามารถพิมพ์ "เมนูผัก" เพื่อเลือกดูผักสดชนิดอื่นๆ ที่มีพร้อมส่งวันนี้ได้เลยครับ! 😊`,
        };
      }
    }
    if (item.stock_quantity < item.quantity) {
      const harvest = await getUpcomingHarvestForProduct(item.name);
      let harvestNote = '';
      if (harvest.hasUpcoming) {
        harvestNote = `\n\n🚜 ทั้งนี้ทางฟาร์มมีรอบเก็บเกี่ยวเพิ่มเติมประมาณวันที่ ${harvest.harvestDateThai} ครับ`;
      }
      return {
        isOrder: true,
        error: `ขออภัยครับ ผัก "${item.name}" ปัจจุบันมีสต็อกพร้อมส่งเพียง ${item.stock_quantity} ${item.unit} (คุณลูกค้าสั่ง ${item.quantity} ${item.unit}) ครับ 🌱${harvestNote}\n\nคุณลูกค้ารับ ${item.stock_quantity} ${item.unit} เท่าที่มีพร้อมส่งก่อน หรือต้องการระบุจำนวนใหม่ สามารถพิมพ์บอกได้เลยครับ 😊`,
      };
    }
  }

  const totalAmount = matchedItems.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    isOrder: true,
    items: matchedItems,
    totalAmount,
  };
}
