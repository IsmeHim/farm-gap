# 🌱 FarmGAP — ระบบบริหารจัดการสวนผัก (GAP Compliance)

ระบบบันทึกข้อมูลการทำเกษตรเพื่อส่ง GAP (Good Agricultural Practices) อัตโนมัติ
ออกแบบสำหรับฟาร์มผักสลัด (กรีนโอ๊ค, เรดโอ๊ค ฯลฯ)

## 📦 Tech Stack
- **Frontend**: React 18 + Vite + TailwindCSS v4 + React Router
- **Backend**: Node.js + Express + JWT Auth
- **Database**: MySQL 8

## ✨ Features
- 🔐 Auth (Register/Login ด้วย JWT)
- 🌾 จัดการแปลงปลูก (Plots)
- 💧 บันทึกการให้น้ำ (GAP #1)
- 🧪 บันทึกสารเคมี/ปุ๋ย + แจ้งเตือน PHI (GAP #3)
- 🐛 บันทึกศัตรูพืช/โรค (GAP #4)
- 🧺 บันทึกการเก็บเกี่ยว + Lot Code (GAP #5)
- 📦 บันทึกการเก็บรักษา/ขนส่ง (GAP #6)
- 👨‍🌾 ทะเบียนคนงาน (GAP #7)
- 💰 บันทึกต้นทุน-กำไร
- 📊 Dashboard + กราฟ
- 📄 ออก **GAP Report PDF** อัตโนมัติรายปี
- 🏷️ QR Code Traceability (ลูกค้า scan ดูที่มาผัก)

---

## 🚀 วิธีรัน

### 1. Database (MySQL)
```bash
mysql -u root -p < backend/db/schema.sql
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env   # แก้ DB credentials + JWT_SECRET
npm run dev            # http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env   # ตั้ง VITE_API_URL=http://localhost:4000
npm run dev            # http://localhost:5173
```

### 4. เปิดใช้งาน
1. เข้า http://localhost:5173
2. สมัครสมาชิก (กรอกชื่อฟาร์ม)
3. เพิ่มแปลงปลูก → เริ่มบันทึกข้อมูล
4. ไปหน้า "รายงาน" → กด Export PDF

---

## 📁 โครงสร้าง
```
farmgap/
├── backend/
│   ├── db/schema.sql           # DDL + seed
│   ├── src/
│   │   ├── index.js            # Express entry
│   │   ├── db.js               # MySQL pool
│   │   ├── middleware/auth.js  # JWT verify
│   │   └── routes/             # auth, plots, water, chemicals, ...
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx             # Router
│   │   ├── lib/api.js          # axios + token
│   │   ├── lib/auth.jsx        # AuthContext
│   │   ├── components/         # Sidebar, LogManager, ui/*
│   │   └── pages/              # Login, Dashboard, Plots, Water, ...
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js (v4 ใช้ @import in css)
│   └── .env.example
└── README.md
```

## 🔑 GAP 7 หมวดหลักในระบบ
| GAP | หน้าในระบบ | ตาราง DB |
|-----|-----------|---------|
| 1. แหล่งน้ำ | /water | water_logs |
| 2. พื้นที่ปลูก | /plots | plots |
| 3. สารเคมี | /chemicals | chemical_logs |
| 4. ศัตรูพืช | /pests | pest_logs |
| 5. เก็บเกี่ยว | /harvest | harvest_logs |
| 6. ขนส่ง | /storage | storage_logs |
| 7. ผู้ปฏิบัติงาน | /workers | workers |

## ⚠️ Notes
- PHI Alert: ระบบจะเตือนถ้าเก็บเกี่ยวก่อนครบ PHI หลังพ่นยา
- QR Code: ทุก lot_code จะ generate URL `/trace/:lot` ให้ลูกค้าสแกน
- รองรับหลาย user (แต่ละฟาร์มเห็นข้อมูลตัวเอง)

