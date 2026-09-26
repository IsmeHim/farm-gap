import { askGemini } from '../ai/gemini.js';

// Helper: ตรวจสอบว่าข้อความมีลักษณะเป็นที่อยู่จัดส่งจริงหรือไม่
export function isLikelyAddress(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  if (s.length < 3) return false;
  // ถ้าเป็นเบอร์โทรศัพท์ล้วน ไม่ใช่ที่อยู่
  if (/^0[0-9]{8,9}$/.test(s.replace(/[- ]/g, ''))) return false;

  // คำทักทาย หรือยกเลิก ไม่ใช่ที่อยู่
  const nonAddressWords = ['สวัสดี', 'ดีครับ', 'ดีค่ะ', 'ยกเลิก', 'ไม่เอา', 'สั่งซื้อ', 'ขอดูเมนู', 'เมนูผัก'];
  if (nonAddressWords.some(w => s === w || s.startsWith(w + ' '))) return false;

  const patterns = [
    /\b[1-9][0-9]{3,4}\b/, // รหัสไปรษณีย์ 4-5 หลัก
    /(?:ต\.|ตำบล|แขวง)/,
    /(?:อ\.|อำเภอ|เขต)/,
    /(?:จ\.|จังหวัด)/,
    /(?:ม\.|หมู่|หมู่ที่|มบ\.|หมู่บ้าน)/,
    /(?:ซ\.|ซอย)/,
    /(?:ถ\.|ถนน)/,
    /(?:บ้านเลขที่|ห้องเลขที่|ชั้น|ห้อง|ตึก|อาคาร|คอนโด|หอพัก|หอ|มหาลัย|มหาวิทยาลัย|โรงพยาบาล|รพ\.|เทศบาล|อบต\.)/,
    /\b[0-9]{1,4}\/[0-9]{1,4}\b/, // เช่น 122/16, 57/4
    /(?:ที่อยู่|ส่งที่|จัดส่งที่|ส่งมาที่|สถานที่ส่ง)/,
    /(?:กรุงเทพ|กทม|นนทบุรี|ปทุมธานี|สมุทรปราการ|สมุทรสาคร|นครปฐม|อยุธยา|สระบุรี|ชลบุรี|ระยอง|จันทบุรี|เชียงใหม่|เชียงราย|ลำปาง|ลำพูน|น่าน|พิษณุโลก|สุโขทัย|ขอนแก่น|โคราช|นครราชสีมา|อุดรธานี|อุบลราชธานี|บุรีรัมย์|สุรินทร์|ภูเก็ต|สงขลา|สุราษฎร์ธานี|กระบี่|พังงา|ตรัง|พัทลุง|สตูล|ยะลา|ปัตตานี|นราธิวาส|กาญจนบุรี|ราชบุรี|เพชรบุรี|ประจวบ|หัวหิน|หาดใหญ่|พัทยา|เบตง|หนองจิก|เกาะเปาะ|ตือเบาะ|รูสะมิแล|แม่โจ้)/i,
  ];

  if (patterns.some(p => p.test(s))) return true;

  if (s.length >= 8 && /[0-9]/.test(s) && /\s/.test(s)) {
    return true;
  }

  return false;
}

// Helper: สกัดชื่อผู้รับ เบอร์โทรศัพท์ และที่อยู่จัดส่ง จากข้อความที่ผู้ใช้พิมพ์ (Rule-based Regex & Structured Heuristics)
export function parseCustomerContact(text) {
  if (!text) return { name: null, phone: null, address: null };

  let name = null;
  let phone = null;
  let address = null;

  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. ตรวจสอบกรณีลูกค้าส่งเป็นลำดับบรรทัด (Multi-line Structured Text)
  if (rawLines.length >= 2) {
    const remainingLines = [];

    for (const line of rawLines) {
      // 1.1 สกัดเบอร์โทรจากบรรทัด
      const pMatch = line.match(/(?:^|[^\d])(0[689][0-9]{8}|0[2-57][0-9]{7})(?:[^\d]|$)/) ||
                     line.match(/(?:^|[^\d])(0[0-9]{1,2}[- ]?[0-9]{3,4}[- ]?[0-9]{3,4})(?:[^\d]|$)/);
      if (pMatch && pMatch[1]) {
        const cleaned = pMatch[1].replace(/[- ]/g, '');
        if (cleaned.length >= 9 && cleaned.length <= 10 && cleaned.startsWith('0')) {
          if (!phone) phone = cleaned;
          continue;
        }
      }

      // 1.2 สกัดชื่อผู้รับ
      const nameMatch = line.match(/^(?:[0-9]+[.)\]\-:]|\-|\*|•)?\s*(?:ชื่อ(?:ผู้รับ)?|คุณ|ผู้รับ)\s*[:\-]?\s*([ก-๙a-zA-Z\s]+)/i);
      if (nameMatch && nameMatch[1]) {
        const extracted = nameMatch[1].replace(/(?:เบอร์|โทร|tel|ที่อยู่|ส่งที่|บ้านเลขที่)[\s\S]*/i, '').trim();
        if (extracted && extracted.length >= 2 && !['ลูกค้า', 'ทั่วไป', 'ผู้รับ'].includes(extracted)) {
          if (!name) name = extracted;
          continue;
        }
      }

      // 1.3 สกัดที่อยู่
      const addrMatch = line.match(/^(?:[0-9]+[.)\]\-:]|\-|\*|•)?\s*(?:ที่อยู่(?:จัดส่ง)?|ส่งที่|จัดส่ง(?:ที่)?|บ้านเลขที่|สถานที่ส่ง)\s*[:\-]?\s*([\s\S]+)/i);
      if (addrMatch && addrMatch[1]) {
        const extracted = addrMatch[1].trim();
        if (extracted) {
          if (!address) address = extracted;
          continue;
        }
      }

      remainingLines.push(line);
    }

    // 1.4 ถ้ามีบรรทัดที่เหลือและยังขาดที่อยู่ หรือชื่อ ให้ตรวจสอบ
    for (const remLine of remainingLines) {
      const stripped = remLine.replace(/^(?:[0-9]+[.)\]\-:]|\-|\*|•)\s*/, '').trim();

      if (!address && isLikelyAddress(stripped)) {
        address = stripped;
      } else if (!name && /^[ก-๙a-zA-Z\s]{2,25}$/.test(stripped) && !isLikelyAddress(stripped)) {
        name = stripped;
      } else if (!address && phone && stripped.length >= 5) {
        address = stripped;
      }
    }
  }

  // 2. ถ้ายังสกัดไม่ครบ ให้ใช้ Inline Regex ทั้งข้อความ
  if (!phone) {
    const phoneMatch = text.match(/(?:^|[^\d])(0[689][0-9]{8}|0[2-57][0-9]{7})(?:[^\d]|$)/);
    if (phoneMatch && phoneMatch[1]) {
      phone = phoneMatch[1].replace(/[- ]/g, '');
    } else {
      const formattedMatch = text.match(/(?:^|[^\d])(0[0-9]{1,2}[- ]?[0-9]{3,4}[- ]?[0-9]{3,4})(?:[^\d]|$)/);
      if (formattedMatch && formattedMatch[1]) {
        const cleaned = formattedMatch[1].replace(/[- ]/g, '');
        if (cleaned.length >= 9 && cleaned.length <= 10 && cleaned.startsWith('0')) {
          phone = cleaned;
        }
      }
    }
  }

  // 2.1 สกัดชื่อผู้รับแบบระบุคำนำหน้า
  if (!name) {
    const explicitNameMatch = text.match(/(?:[0-9]+[.)\]\-:]|\-|\*|•)?\s*(?:ชื่อ(?:ผู้รับ)?|คุณ|ผู้รับ)\s*[:\-]?\s*([ก-๙a-zA-Z\s]+?)(?=(?:เบอร์|โทร|tel|ที่อยู่|ส่งที่|บ้านเลขที่|\d{9,10}|$|\n))/i);
    if (explicitNameMatch && explicitNameMatch[1]) {
      const candidate = explicitNameMatch[1].trim();
      if (candidate.length >= 2) name = candidate;
    }
  }

  // 2.2 สกัดชื่อกรณีขึ้นต้นข้อความ
  if (!name) {
    const beforeMatch = text.match(/^([ก-๙a-zA-Z]{2,20}(?:\s+[ก-๙a-zA-Z]{2,20})?)\s+(?:0[689]|\d+\/\d+|ที่อยู่|บ้านเลขที่)/);
    if (beforeMatch && beforeMatch[1]) {
      const candidate = beforeMatch[1].trim();
      const forbidden = ['ที่อยู่', 'ส่งที่', 'จัดส่ง', 'ขอสั่ง', 'สั่งซื้อ', 'โอนแล้ว', 'ยอดรวม', 'ลูกค้า'];
      if (!forbidden.includes(candidate)) {
        name = candidate;
      }
    }
  }

  // 2.3 สกัดที่อยู่จัดส่งแบบระบุคีย์เวิร์ดชัดเจน
  if (!address) {
    const explicitAddrMatch = text.match(/(?:ที่อยู่(?:จัดส่ง)?|ส่งที่|จัดส่ง(?:ที่)?|บ้านเลขที่|สถานที่ส่ง)\s*[:\-]?\s*([\s\S]+?)(?=(?:เบอร์|โทร|tel|ชื่อ|$))/i);
    if (explicitAddrMatch && explicitAddrMatch[1]) {
      const rawAddr = explicitAddrMatch[1].trim();
      if (isLikelyAddress(rawAddr)) {
        address = rawAddr;
      }
    }
  }

  // 2.4 หากยังไม่ได้ที่อยู่ ให้ลบเบอร์โทร และชื่อ ออกจากข้อความ แล้วเช็คว่าส่วนที่เหลือคือที่อยู่หรือไม่
  if (!address) {
    let remainder = text;
    if (phone) {
      remainder = remainder.replace(/(?:^|[^\d])(0[0-9]{1,2}[- ]?[0-9]{3,4}[- ]?[0-9]{3,4})(?:[^\d]|$)/, ' ');
    }
    if (name) {
      remainder = remainder.replace(name, ' ');
    }
    remainder = remainder.replace(/(?:[0-9]+[.)\]\-:]|\-|\*|•)?\s*(?:ชื่อผู้รับ|ชื่อ|เบอร์โทร|เบอร์|โทร|tel|ที่อยู่จัดส่ง|ที่อยู่|ส่งที่|สถานที่ส่ง)\s*[:\-]?/gi, ' ');
    remainder = remainder.replace(/\s+/g, ' ').trim();

    if (isLikelyAddress(remainder)) {
      address = remainder;
    } else if (phone && remainder.length >= 6 && !remainder.match(/^(?:สั่ง|ซื้อ|เอา|รับ|ขอ|ยกเลิก|สวัสดี|ดีครับ)/)) {
      address = remainder;
    }
  }

  return {
    name: name || null,
    phone: phone || null,
    address: address || null,
  };
}

// AI Helper: ใช้ Gemini ช่วยสกัด ชื่อ เบอร์โทร และที่อยู่จัดส่งจากข้อความลูกค้า
export async function extractContactInfoWithGemini(userText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'dummy_key') return null;

  const prompt = `คุณคือผู้ช่วยสกัดข้อมูลติดต่อและที่อยู่จัดส่งสำหรับร้านค้าเกษตร FarmGAP
ข้อความที่ลูกค้าพิมพ์ส่งมา:
"${userText}"

หน้าที่ของคุณ:
สกัดข้อมูลติดต่อและที่อยู่ออกมา หากข้อมูลใดไม่มีในข้อความ ให้ใส่เป็น null
ตอบเฉพาะ JSON โครงสร้างนี้เท่านั้น ห้ามใส่ markdown code block หรือคำอธิบายอื่น:
{
  "name": "ชื่อ-นามสกุล หรือชื่อเล่นของผู้รับ หรือ null หากไม่มี",
  "phone": "เบอร์โทรศัพท์ 9-10 หลัก (เฉพาะตัวเลข เช่น 0812345678) หรือ null หากไม่มี",
  "address": "ที่อยู่จัดส่ง เลขที่ หมู่บ้าน ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์ หรือ null หากไม่มี"
}`;

  try {
    const raw = await askGemini(prompt, "ตอบเฉพาะ JSON ตามโครงสร้างที่กำหนดเท่านั้น");
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        name: parsed.name && parsed.name !== 'null' && !String(parsed.name).includes('null') ? String(parsed.name).trim() : null,
        phone: parsed.phone && parsed.phone !== 'null' ? String(parsed.phone).replace(/[^0-9]/g, '') : null,
        address: parsed.address && parsed.address !== 'null' && !String(parsed.address).includes('null') ? String(parsed.address).trim() : null,
      };
    }
  } catch (err) {
    console.warn('Gemini contact extraction error:', err.message);
  }
  return null;
}

// Smart extractor: ใช้ Regex + Gemini AI
export async function parseSmartCustomerContact(text) {
  const regexResult = parseCustomerContact(text);

  if (regexResult.phone && regexResult.address) {
    return regexResult;
  }

  const hasPhone = /(?:^|[^\d])(0[689][0-9]{8}|0[2-57][0-9]{7})(?:[^\d]|$)/.test(text) ||
                   /(?:^|[^\d])(0[0-9]{1,2}[- ]?[0-9]{3,4}[- ]?[0-9]{3,4})(?:[^\d]|$)/.test(text);
  const hasAddr = isLikelyAddress(text);
  const hasContactKeyword = /(?:ชื่อ|คุณ|ผู้รับ|เบอร์|โทร|tel|ที่อยู่|ส่งที่|จัดส่ง|บ้านเลขที่)/i.test(text);

  if (!hasPhone && !hasAddr && !hasContactKeyword) {
    return regexResult;
  }

  try {
    const aiResult = await extractContactInfoWithGemini(text);
    if (aiResult) {
      return {
        name: regexResult.name || aiResult.name || null,
        phone: regexResult.phone || aiResult.phone || null,
        address: regexResult.address || (isLikelyAddress(aiResult.address) ? aiResult.address : null),
      };
    }
  } catch (err) {
    console.warn('Smart contact extraction error:', err.message);
  }

  return regexResult;
}

// AI Helper: ใช้ Gemini ช่วยวิเคราะห์เจตนาเลือกช่องทางชำระเงินจากภาษาพูด
export async function detectPaymentMethodWithGemini(userText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'dummy_key') return null;

  const prompt = `ผู้ใช้กำลังอยู่ในขั้นตอนเลือกวิธีชำระเงินของร้านค้าฟาร์มผัก FarmGAP
ข้อความที่ผู้ใช้พิมพ์: "${userText}"

คำถาม: ผู้ใช้ต้องการเลือกวิธีชำระเงินแบบใด?
- หากเลือกเก็บเงินปลายทาง (จ่ายเงินสดเมื่อของถึง, จ่ายกับคนขับ, จ่ายตอนรับ): ตอบ COD
- หากเลือกโอนเงิน (สแกนจ่าย, คิวอาร์โค้ด, โอนผ่านบัญชี): ตอบ TRANSFER
- หากเป็นการสอบถามคำถาม หรือพูดเรื่องอื่นที่ไม่ได้เลือกวิธีชำระเงิน: ตอบ OTHER

ตอบเฉพาะคำว่า COD, TRANSFER หรือ OTHER เพียงคำเดียวเท่านั้น:`;

  try {
    const raw = await askGemini(prompt, "ตอบเฉพาะ COD, TRANSFER หรือ OTHER เท่านั้น");
    const clean = raw.trim().toUpperCase();
    if (clean.includes('COD')) return 'cod';
    if (clean.includes('TRANSFER')) return 'transfer';
    return null;
  } catch (err) {
    console.warn('Payment detection error:', err.message);
    return null;
  }
}
