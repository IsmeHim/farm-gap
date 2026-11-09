import { pool } from '../../../db.js';

// Priority list of Gemini models as requested by Super Admin
export const GEMINI_FALLBACK_ORDER = [
  "gemini-3.5-flash-lite", // ตัวหลัก: ฟรีวันละ 500 ครั้ง เร็ว ฉลาดพอดีกับงานร้านค้า/ฟาร์ม
  "gemini-3.1-flash-lite", // สำรอง 1: ฟรีอีก 500 ครั้ง/วัน (รวมเป็น 1,000 ครั้ง/วัน)
  "gemini-3.6-flash",      // สำรอง 2: ตัวท็อป (กรณี Lite ใช้งานไม่ได้)
  "gemini-2.5-flash",      // สำรอง 3: รวดเร็ว แม่นยำ รองรับงานร้านค้าและฟาร์ม
  "gemini-2.5-flash-lite", // สำรอง 4: ประหยัดโควต้า ตอบไวมาก
  "gemini-2.0-flash",      // สำรอง 5: เสถียรสูง
];

export const GEMINI_MODEL_OPTIONS = [
  {
    id: "gemini-3.5-flash-lite",
    name: "gemini-3.5-flash-lite",
    desc: "ตัวหลัก: ฟรีวันละ 500 ครั้ง เร็ว ฉลาดพอดีกับงานร้านค้า/ฟาร์ม",
    badge: "ตัวหลัก (แนะนำ)",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "gemini-3.1-flash-lite",
    desc: "สำรอง 1: ฟรีอีก 500 ครั้ง/วัน (รวมเป็น 1,000 ครั้ง/วัน)",
    badge: "สำรอง 1",
  },
  {
    id: "gemini-3.6-flash",
    name: "gemini-3.6-flash",
    desc: "สำรอง 2: ตัวท็อป (กรณี Lite ใช้งานไม่ได้)",
    badge: "สำรอง 2",
  },
  {
    id: "gemini-2.5-flash",
    name: "gemini-2.5-flash",
    desc: "สำรอง 3: รวดเร็ว แม่นยำ รองรับงานร้านค้าและฟาร์ม",
    badge: "สำรอง 3",
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "gemini-2.5-flash-lite",
    desc: "สำรอง 4: ประหยัดโควต้า ตอบไวมาก",
    badge: "สำรอง 4",
  },
  {
    id: "gemini-2.0-flash",
    name: "gemini-2.0-flash",
    desc: "สำรอง 5: เสถียรสูง",
    badge: "สำรอง 5",
  },
];

// Helper: สร้างลำดับโมเดลที่จะลองเรียกตามโมเดลหลักและการตั้งค่า Auto Fallback (เหมือนระบบ Money Manager)
export function buildModelTryList(primaryModel, autoFallback = true) {
  const startModel = primaryModel || GEMINI_FALLBACK_ORDER[0];
  if (!autoFallback) {
    return [startModel];
  }
  const remaining = GEMINI_FALLBACK_ORDER.filter((m) => m !== startModel);
  return [startModel, ...remaining];
}

// Helper: ดึงการตั้งค่า Gemini AI จากฐานข้อมูลของเจ้าของฟาร์ม (หากไม่มีให้ใช้ค่าเริ่มต้นจาก .env)
export async function getActiveGeminiConfig() {
  const fallbackKey = (process.env.GEMINI_API_KEY || "").trim();
  const fallbackModel = (process.env.GEMINI_MODEL || GEMINI_FALLBACK_ORDER[0]).trim();

  try {
    const [rows] = await pool.query(
      "SELECT gemini_api_key, gemini_model, gemini_auto_fallback, gemini_enabled FROM users WHERE (role = 'owner' OR role = 'admin') ORDER BY id ASC LIMIT 1"
    );
    if (rows.length > 0) {
      const r = rows[0];
      const dbKey = (r.gemini_api_key || "").trim();
      return {
        apiKey: dbKey || fallbackKey,
        model: (r.gemini_model || fallbackModel).trim(),
        autoFallback: r.gemini_auto_fallback !== undefined && r.gemini_auto_fallback !== null ? Boolean(r.gemini_auto_fallback) : true,
        isEnabled: r.gemini_enabled !== undefined && r.gemini_enabled !== null ? Boolean(r.gemini_enabled) : true,
      };
    }
  } catch (_) {}

  return {
    apiKey: fallbackKey,
    model: fallbackModel,
    autoFallback: true,
    isEnabled: true,
  };
}

// Helper: เรียกโมเดล Gemini รายตัวแบบเดียวกับ geminiService.js ใน Money Manager
// (ไม่มี AbortSignal.timeout สั้นๆ มาตัดสาย, รองรับ maxOutputTokens: 8192 และกรอง p.thought)
async function callSingleGeminiModel({ apiKey, model, systemInstruction, userPrompt, temperature = 0.3 }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: typeof temperature === "number" ? temperature : 0.3,
      maxOutputTokens: 8192,
    },
  };

  if (systemInstruction && systemInstruction.trim()) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction.trim() }],
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errDetail = errJson?.error?.message || errDetail;
    } catch {
      // ignore parse error
    }
    const err = new Error(`[${model}] ${errDetail}`);
    err.status = response.status;
    err.model = model;
    throw err;
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const rawParts = candidate?.content?.parts || [];

  // Filter out internal thinking parts (thought: true) in Gemini 2.5/3.x models
  const visibleParts = rawParts.filter((p) => !p.thought);
  const partsToUse = visibleParts.length > 0 ? visibleParts : rawParts;

  const text = partsToUse
    .map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error(`[${model}] ไม่ได้รับข้อความตอบกลับจากโมเดล`);
  }

  return text;
}

// ฟังก์ชันเรียก Gemini พร้อมคืนรายละเอียดโมเดลที่ตอบสำเร็จ (สำหรับทั้งปุ่มทดสอบในหน้าตั้งค่าและระบบ AI หลัก)
export async function callGeminiWithDetails({
  prompt,
  systemInstruction,
  temperature = 0.3,
  configOverride = null,
}) {
  const cfg = configOverride || (await getActiveGeminiConfig());
  const apiKey = (cfg.apiKey || "").trim();

  if (!cfg.isEnabled) {
    return {
      success: false,
      error: "ปิดการใช้งาน Gemini AI อยู่ (สามารถเปิดได้ที่หน้าตั้งค่าฟาร์ม)",
    };
  }

  if (!apiKey || apiKey === "dummy_key") {
    return {
      success: false,
      error: "ยังไม่ได้ตั้งค่า Gemini API Key",
    };
  }

  const modelsToTry = buildModelTryList(cfg.model || GEMINI_FALLBACK_ORDER[0], cfg.autoFallback !== false);
  const errors = [];

  for (let i = 0; i < modelsToTry.length; i++) {
    const modelName = modelsToTry[i];
    try {
      const answer = await callSingleGeminiModel({
        apiKey,
        model: modelName,
        systemInstruction,
        userPrompt: prompt,
        temperature,
      });

      return {
        success: true,
        response: answer,
        usedModel: modelName,
        fallbackUsed: i > 0,
        triedCount: i + 1,
      };
    } catch (err) {
      errors.push(`${modelName}: ${err.message}`);
      console.warn(`⚠️ Gemini model [${modelName}] failed: ${err.message}`);
      if (err.message && /API_KEY_INVALID|API key not valid/i.test(err.message)) {
        break;
      }
    }
  }

  return {
    success: false,
    error: errors.join(" | "),
    errors,
  };
}

// 1. ฟังก์ชันส่งข้อมูลสอบถามปัญญาประดิษฐ์ Gemini API พร้อม Model Fallback
export async function askGemini(prompt, systemInstruction, temperature = 0.4) {
  const res = await callGeminiWithDetails({
    prompt,
    systemInstruction,
    temperature,
  });

  if (res.success && res.response) {
    return res.response;
  }

  console.warn("⚠️ Gemini API unavailable or quota reached. Serving smart farm knowledge assistant.");
  const lowerPrompt = String(prompt || "").toLowerCase();
  if (lowerPrompt.includes("ปลูก") || lowerPrompt.includes("ทำสวน") || lowerPrompt.includes("ดูแล")) {
    return "🌱 ผักสลัดในฟาร์ม FarmGAP (เช่น กรีนโอ๊ค เรดโอ๊ค คอส) ปลูกโดยใช้ระบบเกษตรอินทรีย์ ปลอดภัย ได้รับใบรับรองมาตรฐาน GAP ในทุกล็อต มีการสุ่มตรวจวิเคราะห์คุณภาพน้ำรดดินสม่ำเสมอ ใช้เวลาประมาณ 30-45 วันในการเก็บเกี่ยวครับ";
  }
  if (lowerPrompt.includes("ราคา") || lowerPrompt.includes("เท่าไหร่") || lowerPrompt.includes("บาท")) {
    return "💵 ผักสดจากแปลงของเราจำหน่ายราคาเริ่มต้น 20-50 บาทต่อถุง/กิโลกรัมครับ สามารถพิมพ์ระบุสั่งซื้อได้เลย เช่น \"สั่งกรีนโอ๊ค 2 ถุง\" หรือพิมพ์ \"เมนูผัก\" เพื่อดูรายการพร้อมราคาครับ";
  }
  if (lowerPrompt.includes("สต็อก") || lowerPrompt.includes("เหลือ") || lowerPrompt.includes("มีผัก") || lowerPrompt.includes("เมนู")) {
    return "🥬 วันนี้ฟาร์มเรามีผักสดพร้อมจัดส่งครับ! สามารถพิมพ์ \"เมนูผัก\" เพื่อเลือกชมและสั่งซื้อได้เลยครับ 🌱";
  }
  return "🌱 สวัสดีครับ ยินดีต้อนรับสู่ฟาร์มผักมาตรฐาน GAP ปลอดภัย คุณสามารถสั่งซื้อผักสดได้ง่ายๆ โดยพิมพ์รายการในแชทได้ทันที เช่น \"สั่งกรีนโอ๊ค 2 ถุง\" หรือพิมพ์ \"เมนูผัก\" เพื่อดูรายการผักสดทั้งหมดได้เลยครับ!";
}

// Helper: ใช้ Gemini AI สกัดคำสั่งซื้อกรณีผู้ใช้พิมพ์ภาษาพูดซับซ้อน
export async function extractOrderWithGemini(userText, availableProducts) {
  const productListDesc = availableProducts.map((p) => `ID: ${p.id}, ชื่อ: ${p.name}, ราคา: ${p.price}`).join("\n");
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
    const res = await callGeminiWithDetails({
      prompt,
      systemInstruction: "ตอบเฉพาะ JSON ตามโครงสร้างที่กำหนดเท่านั้น",
      temperature: 0.1,
    });
    if (res.success && res.response) {
      const jsonMatch = res.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.warn("Gemini order extraction error:", err.message);
  }
  return null;
}

// Helper: ใช้ Gemini AI ตรวจสอบเจตนายกเลิกในกรณีภาษาพูดซับซ้อน
export async function isCancelWithGemini(rawText) {
  if (!rawText || typeof rawText !== "string") return false;

  const prompt = `ผู้ใช้กำลังอยู่ในขั้นตอนสั่งซื้อสินค้าในแชทของร้านฟาร์มผัก FarmGAP
ข้อความที่ผู้ใช้พิมพ์ส่งมา: "${rawText}"

คำถาม: ข้อความนี้มีเจตนาต้องการ "ยกเลิกคำสั่งซื้อ / ไม่ซื้อแล้ว / ไม่เอาแล้ว / เปลี่ยนใจไม่ซื้อ / ขอยุติรายการ / ปฏิเสธการรับสินค้า" หรือไม่?
(เช่น "เปลี่ยนใจแล้ว", "ไม่สะดวกรับแล้ว", "ขอบายก่อนนะ", "แคนเซิลนะ", "ยังไม่พร้อมจ่าย", "ขอผ่านก่อนครับ", "ยกเลิกช")
แต่ถ้าเป็นการถามคำถามทั่วไป, บอกที่อยู่, หรือพูดว่า "ไม่ยกเลิก", "สั่งเพิ่ม" ให้ตอบ NO

ตอบเฉพาะคำว่า YES หรือ NO สั้นๆ เพียงคำเดียวเท่านั้น:`;

  try {
    const res = await callGeminiWithDetails({
      prompt,
      systemInstruction: "ตอบเฉพาะ YES หรือ NO เท่านั้น",
      temperature: 0.1,
    });
    if (res.success && res.response) {
      return res.response.toUpperCase().includes("YES");
    }
  } catch (_) {}
  return false;
}

// 4. ฟังก์ชันวิเคราะห์และตอบคำถามเชิงลึกของ "เจ้าของฟาร์ม" ด้วย Gemini AI เป็นหลัก (Owner AI Assistant)
export async function analyzeOwnerMessageWithGemini(ownerText, deepData) {
  const unmanagedIds = (deepData?.unmanagedOrders || []).map((o) => o.id);

  const systemInstruction = `คุณคือ "ผู้ช่วย AI อัจฉริยะประจำตัวเจ้าของฟาร์ม (Owner Executive AI Assistant)" ของระบบ FarmGAP บน LINE Official Account
ผู้ที่กำลังพิมพ์คุยกับคุณตอนนี้คือ "เจ้าของฟาร์ม" (คุณ${deepData?.owner?.displayName || "เจ้าของฟาร์ม"})

[ข้อมูลจริงในฐานข้อมูลฟาร์ม ณ ปัจจุบัน]:
${deepData?.contextText || ""}

[หน้าที่สำคัญของคุณ]:
วิเคราะห์ข้อความหรือคำถามที่เจ้าของฟาร์มพิมพ์มาด้วยความเข้าใจภาษาคนอย่างลึกซึ้ง แล้วตัดสินใจดังนี้:
1. กรณีที่ 1 (เจ้าของฟาร์มถามงานหลังบ้าน / ถามเรื่องออเดอร์ / ออเดอร์ไหนยังไม่จัดการ / ออเดอร์ค้าง / ออเดอร์วันนี้ / ออเดอร์ของลูกค้าชื่อ... / ยอดขาย / สต็อกผัก / สถานะแปลงปลูก / หรือคุยทั่วไปกับ AI):
   - ให้ตั้งค่า "isOwnerAction": true
   - เขียนคำตอบใน "replyText" ให้ชัดเจน ตรงประเด็น อ้างอิงตัวเลข รหัสออเดอร์ ชื่อลูกค้า และรายการผักจากข้อมูลจริงด้านบนอย่างแม่นยำ สุภาพและเป็นมืออาชีพ
   - หากคำถามของเจ้าของฟาร์มเกี่ยวข้องกับการขอดูออเดอร์, ถามว่ามีออเดอร์ไหนยังไม่ได้จัดการบ้าง, มีออเดอร์ใครค้างบ้าง, วันนี้มีออเดอร์ไหม, หรือถามหาออเดอร์ของลูกค้าคนใดคนหนึ่ง:
     * ถ้ามีออเดอร์ที่ตรงกับคำถาม: ให้ตั้งค่า "showOrderListCard": true และใส่รหัส "order_id" (ตัวเลข id จากข้อมูลด้านบน) ของออเดอร์ที่เกี่ยวข้องทั้งหมดลงในอาร์เรย์ "matchedOrderIds" (เช่น [35, 34, 32]) เพื่อที่ระบบจะได้สร้างการ์ดลิสต์รายการออเดอร์พร้อมปุ่มกด "⚙️ จัดการออเดอร์นี้" ส่งแนบไปให้เจ้าของฟาร์มกดจัดการได้ทันที!
     * พิเศษ: หากเจ้าของถามว่า "วันนี้มีออเดอร์ไหนที่ยังไม่จัดการบ้าง" หากวันนี้ไม่มีออเดอร์ใหม่ค้าง แต่มีออเดอร์ค้างจากวันก่อนที่ยังไม่ได้จัดการ (สถานะ paid, pending, shipping) ให้แจ้งให้เจ้าของทราบด้วย และใส่ order_id ของออเดอร์ที่ยังไม่ได้จัดการเหล่านั้นลงใน "matchedOrderIds" พร้อมตั้ง "showOrderListCard": true เพื่อให้เจ้าของกดจัดการได้ทันที
     * ถ้าไม่มีออเดอร์ค้างเลย (จัดการครบหมดแล้ว): ให้ตอบชมเชยว่าจัดการครบทุกออเดอร์แล้ว และตั้งค่า "showOrderListCard": false, "matchedOrderIds": []

2. กรณีที่ 2 (เจ้าของฟาร์มกำลังพิมพ์ทดสอบระบบสั่งซื้อผักเหมือนลูกค้าชัดเจน เช่น พิมพ์ว่า "สั่งผักบุ้ง 2 ถุง", "เมนูผัก", "เช็คตะกร้า"):
   - ให้ตั้งค่า "isOwnerAction": false เพื่อให้ระบบส่งต่อไปเข้า Flow จำลองการสั่งซื้อของหน้าร้านตามปกติ

ตอบกลับมาเป็น JSON โครงสร้างนี้เท่านั้น (ห้ามมีข้อความอื่นนอก JSON):
{
  "isOwnerAction": true,
  "replyText": "ข้อความตอบกลับเจ้าของฟาร์มอย่างละเอียดชัดเจน",
  "showOrderListCard": true,
  "matchedOrderIds": [35, 34]
}`;

  try {
    const res = await callGeminiWithDetails({
      prompt: ownerText,
      systemInstruction,
      temperature: 0.2,
    });
    if (res.success && res.response) {
      const jsonMatch = res.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isOwnerAction: parsed.isOwnerAction !== false,
          replyText: parsed.replyText || "สรุปข้อมูลจากระบบฟาร์มครับ 🌱",
          showOrderListCard: Boolean(parsed.showOrderListCard),
          matchedOrderIds: Array.isArray(parsed.matchedOrderIds)
            ? parsed.matchedOrderIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0)
            : [],
          usedModel: res.usedModel,
        };
      }
    }
  } catch (err) {
    console.warn("⚠️ analyzeOwnerMessageWithGemini error:", err.message);
  }

  return null;
}

// 5. ฟังก์ชันสมองหลัก AI-First สำหรับวิเคราะห์ข้อความของ "ลูกค้า" ก่อนคำดัก (Primary Customer Brain)
// เข้าใจทุกคำถาม คุยตอบโต้ ถามผักที่กำลังปลูก สั่งซื้อผัก ดูเมนู เช็คสถานะ ขอเงินคืน ขอเบอร์โทร ได้ในจุดเดียว!
export async function analyzeCustomerMessageWithGemini(userText, farmContextText, availableProducts = [], activeCart = []) {
  const productSummary = availableProducts
    .map((p) => `- product_id: ${p.id} | ชื่อ: "${p.name}" | ราคา: ฿${p.price}/${p.unit} | คงเหลือ: ${p.stock_quantity} ${p.unit}`)
    .join("\n");

  const cartSummary = activeCart.length > 0
    ? activeCart.map((c) => `${c.name} x${c.quantity} ${c.unit || "ถุง"}`).join(", ")
    : "ยังไม่มีสินค้าในตะกร้า";

  const systemInstruction = `${farmContextText}

[รายการสินค้าที่มีสต็อกพร้อมขายในระบบขณะนี้ (ใช้สำหรับจับคู่ product_id เมื่อลูกค้าสั่งซื้อ)]:
${productSummary || "- ไม่มีสินค้าพร้อมขาย"}

[ตะกร้าสินค้าปัจจุบันของลูกค้า]: ${cartSummary}

[หน้าที่ของคุณในฐานะ Primary Brain ของระบบแชทบอท FarmGAP]:
วิเคราะห์ข้อความของลูกค้าด้วยความฉลาดของ Gemini AI โดยตรง (ไม่ต้องพึ่งคำดัก) แล้วเลือก "intent" ที่ตรงกับเจตนาของลูกค้ามากที่สุดเพียง 1 อย่าง พร้อมตอบกลับเป็น JSON:

1. "ORDER_ITEMS": ลูกค้าพิมพ์สั่งซื้อผักที่มีในสต็อกพร้อมขาย และระบุจำนวนชัดเจน (เช่น "สั่งผักบุ้ง 2 ถุง", "เอากวางตุ้ง 1 กิโลกับคอส 2 ถุง", "ขอสั่งกรีนโอ๊ค 3 แพ็ค")
   - ใส่รายการที่สั่งใน "items": [{ "product_id": <ตัวเลข>, "quantity": <จำนวนถุงตัวเลข>, "unit_note": "<หมายเหตุถ้าสั่งเป็นกิโล เช่น 1 กก. = 2 ถุง>" }] (หมายเหตุ: ผัก 1 ถุงหนักประมาณ 0.4 กก. หรือ 4 ขีด ถ้าลูกค้าสั่ง 1 กิโล ให้แปลงเป็น quantity: 3 หรือตามน้ำหนักถุง)
2. "SELECT_PRODUCT_QTY": ลูกค้าพิมพ์ว่าจะสั่งผักชนิดที่มีพร้อมขาย แต่ "ไม่ได้ระบุจำนวน" (เช่น "สั่งผักบุ้ง", "เอาผักคอส", "ซื้อกรีนโอ๊ค")
   - ใส่ "selectingProductId": <product_id ตัวเลขของผักนั้น>
3. "CROP_OR_FARM_QA": ลูกค้าถามเกี่ยวกับผักรายชนิด (เช่น "ตอนนี้มีผัก test ไหม", "ผักบุ้งมีไหม", "กวางตุ้งเก็บวันไหน", "ปลูกยังไง", "ปลอดสารไหม") หรือพูดคุยสอบถามทั่วไป
   - เขียนคำตอบใน "replyText" ให้ครบถ้วนตามข้อมูลจริงด้านบน (ถ้าเป็นผักที่กำลังปลูกอยู่บนแปลงแต่ยังไม่มีขายในร้าน เช่น ผัก test ให้บอกชื่อแปลง อายุพืชปัจจุบัน และวันที่คาดว่าจะเก็บเกี่ยวเป็นภาษาไทยให้ชัดเจน!)
   - หากเป็นคำถามถามหาผัก หรือถามว่ามีผัก...ไหม ให้ตั้ง "attachMenuCard": true เพื่อแนบการ์ดเมนูผักที่พร้อมขายให้ลูกค้าเลือกชมด้านล่างด้วย
4. "SHOW_MENU": ลูกค้าขอดูเมนูผักทั้งหมด / ถามว่าวันนี้มีอะไรขายบ้าง / มีเมนูอะไรบ้าง
5. "CHECK_ORDER_STATUS": ลูกค้าต้องการเช็คสถานะออเดอร์ / ติดตามพัสดุ / ของส่งหรือยัง
   - หากมีรหัสออเดอร์ในข้อความ (เช่น ORD-...) ให้ใส่ใน "orderCode"
6. "ORDER_HISTORY": ลูกค้าขอดูประวัติการสั่งซื้อที่ผ่านมา
7. "VIEW_CART": ลูกค้าขอดูตะกร้าสินค้าปัจจุบัน
8. "CLEAR_CART": ลูกค้าต้องการล้างตะกร้าสินค้า
9. "CHECKOUT_CART": ลูกค้าต้องการสรุปยอด / ยืนยันสั่งซื้อสินค้าในตะกร้า
10. "REFUND_INFO": ลูกค้าถามเรื่องขอเงินคืน / คืนเงินยังไง / โอนแล้วขอยกเลิก
11. "CONTACT_OWNER": ลูกค้าขอเบอร์โทรติดต่อเจ้าของฟาร์ม / ขอคุยกับคนหรือแอดมิน
12. "WEB_STORE": ลูกค้าขอลิงก์สั่งซื้อผ่านหน้าเว็บ / LIFF
13. "CANCEL_ORDER": ลูกค้าต้องการยกเลิกออเดอร์ที่สั่งไว้

ตอบเป็น JSON โครงสร้างนี้เท่านั้น (ห้ามมีข้อความอื่นนอก JSON):
{
  "intent": "CROP_OR_FARM_QA",
  "replyText": "ข้อความตอบกลับลูกค้าอย่างสุภาพและแม่นยำ",
  "attachMenuCard": true,
  "items": [],
  "selectingProductId": null,
  "orderCode": null
}`;

  try {
    const res = await callGeminiWithDetails({
      prompt: `ข้อความของลูกค้า: "${userText}"`,
      systemInstruction,
      temperature: 0.2,
    });
    if (res.success && res.response) {
      const jsonMatch = res.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && parsed.intent) {
          return {
            ...parsed,
            usedModel: res.usedModel,
          };
        }
      }
    }
  } catch (err) {
    console.warn("⚠️ analyzeCustomerMessageWithGemini fallback:", err.message);
  }

  return null;
}
