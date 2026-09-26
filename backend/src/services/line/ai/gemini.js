// 1. ฟังก์ชันส่งข้อมูลสอบถามปัญญาประดิษฐ์ Gemini API พร้อม Model Fallback
export async function askGemini(prompt, systemInstruction) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === 'dummy_key') {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('ปลูก') || lowerPrompt.includes('ทำสวน') || lowerPrompt.includes('ดูแล')) {
      return '🌱 ผักสลัดในฟาร์ม FarmGAP (เช่น กรีนโอ๊ค เรดโอ๊ค คอส) ปลูกโดยใช้ระบบเกษตรอินทรีย์ ปลอดภัย ได้รับใบรับรองมาตรฐาน GAP ในทุกล็อต มีการสุ่มตรวจวิเคราะห์คุณภาพน้ำรดดินสม่ำเสมอ ใช้เวลาประมาณ 40-45 วันในการเก็บเกี่ยวครับ';
    }
    if (lowerPrompt.includes('ราคา') || lowerPrompt.includes('เท่าไหร่') || lowerPrompt.includes('บาท')) {
      return '💵 ผักสลัดสดจากแปลงของเราจำหน่ายราคาเริ่มต้น 20-50 บาทต่อถุง/กิโลกรัมครับ สามารถพิมพ์ระบุสั่งซื้อได้เลย เช่น "สั่งกรีนโอ๊ค 2 ถุง" หรือพิมพ์ "เมนูผัก" เพื่อดูรายการพร้อมราคาครับ';
    }
    if (lowerPrompt.includes('สต็อก') || lowerPrompt.includes('เหลือ') || lowerPrompt.includes('มีผัก') || lowerPrompt.includes('เมนู')) {
      return '🥬 วันนี้ฟาร์มเรามีผักสดพร้อมส่งครับ! สามารถพิมพ์ "เมนูผัก" เพื่อเลือกชมและสั่งซื้อได้เลยครับ 🌱';
    }
    
    return 'สวัสดีครับ! ยินดีต้อนรับสู่ฟาร์มผักมาตรฐาน GAP ปลอดภัย คุณสามารถสั่งซื้อผักสดได้ง่ายๆ โดยพิมพ์แจ้งรายการในแชทได้ทันที เช่น "สั่งกรีนโอ๊ค 2 ถุง" หรือสอบถามเกี่ยวกับมาตรฐานความปลอดภัยและสต็อกได้เลยครับ!';
  }

  const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ].filter(Boolean);
  const models = [...new Set(candidateModels)];

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    }
  };

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      });
      
      if (!res.ok) {
        if (res.status === 429) {
          console.warn('⚠️ Gemini rate limit / quota exceeded (HTTP 429). Serving smart farm knowledge assistant.');
          break;
        }
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          console.warn(`⚠️ Gemini API auth/request rejected (HTTP ${res.status}). Aborting model fallbacks.`);
          break;
        }
        console.warn(`⚠️ Gemini model [${model}] returned HTTP ${res.status}, trying fallback model...`);
        continue;
      }
      
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return text;
      }
    } catch (err) {
      console.warn(`⚠️ Gemini model [${model}] error: ${err.message}, trying fallback model...`);
    }
  }

  console.warn('⚠️ Gemini API unavailable or quota reached. Serving smart farm knowledge assistant.');
  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes('ปลูก') || lowerPrompt.includes('ทำสวน') || lowerPrompt.includes('ดูแล')) {
    return '🌱 ผักสลัดในฟาร์ม FarmGAP (เช่น กรีนโอ๊ค เรดโอ๊ค คอส) ปลูกโดยใช้ระบบเกษตรอินทรีย์ ปลอดภัย ได้รับใบรับรองมาตรฐาน GAP ในทุกล็อต มีการสุ่มตรวจวิเคราะห์คุณภาพน้ำรดดินสม่ำเสมอ ใช้เวลาประมาณ 40-45 วันในการเก็บเกี่ยวครับ';
  }
  if (lowerPrompt.includes('ราคา') || lowerPrompt.includes('เท่าไหร่') || lowerPrompt.includes('บาท')) {
    return '💵 ผักสลัดสดจากแปลงของเราจำหน่ายราคาเริ่มต้น 20-50 บาทต่อถุง/กิโลกรัมครับ สามารถพิมพ์ระบุสั่งซื้อได้เลย เช่น "สั่งกรีนโอ๊ค 2 ถุง" หรือพิมพ์ "เมนูผัก" เพื่อดูรายการพร้อมราคาครับ';
  }
  if (lowerPrompt.includes('สต็อก') || lowerPrompt.includes('เหลือ') || lowerPrompt.includes('มีผัก') || lowerPrompt.includes('เมนู')) {
    return '🥬 วันนี้ฟาร์มเรามีผักสดพร้อมจัดส่งครับ! สามารถพิมพ์ "เมนูผัก" เพื่อเลือกชมและสั่งซื้อได้เลยครับ 🌱';
  }
  return '🌱 สวัสดีครับ ยินดีต้อนรับสู่ฟาร์มผักมาตรฐาน GAP ปลอดภัย คุณสามารถสั่งซื้อผักสดได้ง่ายๆ โดยพิมพ์รายการในแชทได้ทันที เช่น "สั่งกรีนโอ๊ค 2 ถุง" หรือพิมพ์ "เมนูผัก" เพื่อดูรายการผักสดทั้งหมดได้เลยครับ!';
}

// Helper: ใช้ Gemini AI สกัดคำสั่งซื้อกรณีผู้ใช้พิมพ์ภาษาพูดซับซ้อน
export async function extractOrderWithGemini(userText, availableProducts) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'dummy_key') return null;

  const productListDesc = availableProducts.map(p => `ID: ${p.id}, ชื่อ: ${p.name}, ราคา: ${p.price}`).join('\n');
  const prompt = `คุณคือระบบวิเคราะห์คำสั่งซื้อสินค้าเกษตร FarmGAP
ข้อความของลูกค้า:
"${userText}"

รายการสินค้าที่มีในระบบ:
${productListDesc}

หากข้อความนี้เป็นการสั่งซื้อหรือต้องการซื้อสินค้า ให้สกัดออกมาเป็น JSON โครงสร้างนี้เท่านั้น (ห้ามใส่คำอธิบายอื่น):
{
  "isOrder": true,
  "items": [
    { "product_id": <id ตัวเลข>, "quantity": <จำนวนตัวเลข> }
  ]
}
หากไม่ใช่การสั่งซื้อ ให้ตอบ:
{ "isOrder": false }`;

  try {
    const raw = await askGemini(prompt, "ตอบเฉพาะ JSON ตามโครงสร้างที่กำหนดเท่านั้น");
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('Gemini order extraction error:', err.message);
  }
  return null;
}

// Helper: ใช้ Gemini AI ตรวจสอบเจตนายกเลิกในกรณีภาษาพูดซับซ้อน
export async function isCancelWithGemini(rawText) {
  if (!rawText || typeof rawText !== 'string') return false;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'dummy_key') return false;

  const prompt = `ผู้ใช้กำลังอยู่ในขั้นตอนสั่งซื้อสินค้าในแชทของร้านฟาร์มผัก FarmGAP
ข้อความที่ผู้ใช้พิมพ์ส่งมา: "${rawText}"

คำถาม: ข้อความนี้มีเจตนาต้องการ "ยกเลิกคำสั่งซื้อ / ไม่ซื้อแล้ว / ไม่เอาแล้ว / เปลี่ยนใจไม่ซื้อ / ขอยุติรายการ / ปฏิเสธการรับสินค้า" หรือไม่?
(เช่น "เปลี่ยนใจแล้ว", "ไม่สะดวกรับแล้ว", "ขอบายก่อนนะ", "แคนเซิลนะ", "ยังไม่พร้อมจ่าย", "ขอผ่านก่อนครับ", "ยกเลิกช")
แต่ถ้าเป็นการถามคำถามทั่วไป, บอกที่อยู่, หรือพูดว่า "ไม่ยกเลิก", "สั่งเพิ่ม" ให้ตอบ NO

ตอบเฉพาะคำว่า YES หรือ NO สั้นๆ เพียงคำเดียวเท่านั้น:`;

  try {
    const reply = await askGemini(prompt, "ตอบเฉพาะ YES หรือ NO เท่านั้น");
    return reply.toUpperCase().includes('YES');
  } catch (_) {
    return false;
  }
}
