# 🌱 FarmGAP — ระบบบริหารจัดการสวนผัก (GAP Compliance)

ระบบ FarmGAP เป็นแพลตฟอร์มบริหารจัดการฟาร์มผักสลัด เพื่อให้เจ้าของฟาร์มสามารถจัดการข้อมูลการปลูก การเก็บเกี่ยว การขนส่ง การสั่งซื้อผ่าน LINE และระบบ AI เชิงวิเคราะห์ได้ในที่เดียว

## 📌 สถานะปัจจุบันของระบบ
ตอนนี้โครงการพัฒนาไปได้มากแล้วทั้งฝั่ง Backend และ Frontend โดยมีฟีเจอร์หลักทำงานได้จริง ดังนี้:

### ✅ Backend
- `Express` API ทำงานครบทั้งระบบ CRUD สำหรับฟาร์มและกิจกรรม GAP
- รองรับโมดูลหลัก:
  - `plots`, `water_logs`, `chemical_logs`, `pest_logs`, `harvest_logs`, `storage_logs`, `workers`, `cost_logs`, `gap_checklists`
- มีระบบ Authentication / Authorization ด้วย JWT
- มี API สำหรับจัดการ `products`, `customers`, `orders`
- มี `LINE Webhook` route (`/api/line/webhook`) ที่อ่าน event จาก LINE Official Account
- มี AI route ชุดหนึ่งที่รองรับ:
  - `GET /api/ai/recommendations/:productId`
  - `POST /api/ai/recommend`
  - `GET /api/ai/clusters`  
  - `POST /api/ai/cluster`

### ✅ Frontend
- ใช้ React + Vite + TailwindCSS (พร้อม routing)
- หน้าหลัก Dashboard สรุป:
  - จำนวนแปลงปลูก
  - ผลผลิตรวม (kg)
  - รายได้และต้นทุน
  - เตือน PHI / น้ำไม่ปลอดภัย / สุขอนามัยคนงาน
- มีหน้าสั่งซื้อผ่าน LIFF (`LiffOrder.jsx`)
  - เชื่อม LIFF ในโหมดจริงและ mock mode
  - โหลดสินค้าพร้อมขายจาก API
  - สร้างตะกร้าและสั่งซื้อ
  - อัปโหลดรูปสลิปชำระเงิน
- มีระบบ AI Recommendation ในตะกร้า
  - เมื่อเลือกสินค้าแล้ว ดึงคำแนะนำจาก `/api/ai/recommendations/:productId`

### ✅ AI / Recommendation
- มี backend engine คำนวณ `product_recommendations` จากข้อมูล `order_items`
  - ใช้ SQL คำนวณ co-occurrence matrix ของสินค้าที่ถูกซื้อคู่กัน
- มีระบบ K-Means clustering สำหรับลูกค้า
  - ดึงข้อมูล `order_count`, `total_spend`, `avg_order_value`, `total_items`
  - ทำ normalization และ cluster แบบ vanilla JS
  - อัปเดต `customers.cluster_id`
- Dashboard มีปุ่ม `ประมวลผล K-Means` เพื่อรัน clustering และ recommendation ใหม่

### ✅ LINE / Gemini AI integration
- `backend/src/routes/line.js` มีฟังก์ชัน `askGemini()` สำหรับเรียก Gemini API
- ระบบสร้าง context จาก:
  - สต็อกสินค้าใน `products`
  - ข้อมูลแปลงใน `plots`
- ถ้า `GEMINI_API_KEY` ไม่ถูกตั้งค่า จะ fallback เป็น mock responses ภาษาไทย
- LINE webhook จะตอบ:
  - เมื่อลูกค้าพิมพ์ `สั่งซื้อ` → ส่งเมนูสินค้า
  - เมื่อลูกค้าพิมพ์ `เช็คสถานะ` → สรุปสถานะออเดอร์
  - คำถามทั่วไป → ส่งไปถาม AI / Gemini fallback

### ✅ Customer sync
- มี endpoint `/api/customers/sync` สำหรับ sync ข้อมูลลูกค้าจาก LINE LIFF
- หน้า `LiffOrder` จะสร้างหรืออัปเดตลูกค้าด้วย `line_user_id`

## 🧠 Feature ที่ทำได้แล้วตอนนี้
- บันทึกทุกกิจกรรม GAP ตั้งแต่แปลงน้ำ สารเคมี ศัตรูพืช ถึงการเก็บเกี่ยวและขนส่ง
- ดู dashboard สรุปภาพรวมฟาร์ม
- แสดงเตือน PHI และน้ำ/สุขอนามัย
- สร้างรายการสั่งซื้อ พร้อม upload slip
- เชื่อม LIFF เพื่อดึง profile ลูกค้าและ sync เข้าฐานข้อมูล
- วิเคราะห์ลูกค้า K-Means และบันทึกกลุ่ม customer clusters
- คำนวณสินค้า recommend จาก order history
- LINE webhook มีระบบตอบกลับอัตโนมัติและ AI fallback

## 🛠️ สิ่งที่ยังต้องปรับปรุง / ต้องทดสอบเพิ่มเติม
- Gemini AI ยังต้องมี `GEMINI_API_KEY` เพื่อใช้งานจริง
- ระบบ LINE webhook ต้องทดสอบกับ LINE Official Account จริง
- ยังไม่มีหน้าแดชบอร์ดแยก `AiDashboard.jsx` แต่ฟีเจอร์ AI อยู่ใน `Dashboard.jsx`
- ควรเพิ่ม validation และ error handling ฝั่ง backend ให้ครอบคลุมมากขึ้น
- ระบบ order/stock อาจต้องปรับให้ลดสต็อกอัตโนมัติหลังสั่งซื้อ

## 📦 โครงสร้างโครงการปัจจุบัน
```
farmgap/
├── backend/
│   ├── db/schema.sql
│   ├── src/
│   │   ├── index.js
│   │   ├── db.js
│   │   ├── middleware/auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── crud.js
│   │   │   ├── customers.js
│   │   │   ├── line.js
│   │   │   ├── orders.js
│   │   │   ├── products.js
│   │   │   ├── report.js
│   │   │   ├── trace.js
│   │   │   └── ai.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── lib/api.js
│   │   ├── lib/auth.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── LiffOrder.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Checklists.jsx
│   │   │   ├── Chemicals.jsx
│   │   │   ├── Costs.jsx
│   │   │   ├── Harvest.jsx
│   │   │   ├── Pests.jsx
│   │   │   ├── Plots.jsx
│   │   │   ├── Products.jsx
│   │   │   ├── Report.jsx
│   │   │   ├── Storage.jsx
│   │   │   ├── Trace.jsx
│   │   │   ├── Water.jsx
│   │   │   └── Workers.jsx
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env.example
└── README.md
```

## 🚀 วิธีรันตอนนี้
### Backend
```bash
cd backend
npm install
cp .env.example .env
# ตั้งค่า DB_HOST, DB_USER, DB_PASS, DB_NAME, JWT_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET
npm run dev
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# ตั้ง VITE_API_URL=http://localhost:4000
# ตั้ง VITE_LIFF_ID=xxx หากทดสอบ LIFF
npm run dev
```

## 📌 ข้อสังเกตสำคัญ
- หากไม่มี `GEMINI_API_KEY` ระบบจะใช้ mock AI response ภาษาไทยแทน
- `LINE_CHANNEL_ACCESS_TOKEN` และ `LINE_CHANNEL_SECRET` ต้องตั้งค่าให้ถูกต้องหากใช้งาน LINE webhook
- `LiffOrder` มี mock mode รองรับการทดสอบนอก LINE client

---

## 🎯 สรุป
ตอนนี้ระบบ FarmGAP ทำงานได้ในระดับ core farm management + e-commerce + AI recommendation และมีโครงสร้าง LINE/AI integration อยู่แล้ว หากต้องการเดินต่อ ควรเน้น:
1. เชื่อม LINE OA ของจริง และทดสอบ webhook
2. เติมค่า `GEMINI_API_KEY` เพื่อเรียก AI จริง
3. ตรวจสอบ stock update หลังออเดอร์
4. ปรับปรุง UX / error handling ใน frontend

