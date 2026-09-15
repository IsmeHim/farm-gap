// Runtime configuration for the frontend.
// เปลี่ยนค่าในไฟล์นี้ได้โดยไม่ต้อง build ใหม่เมื่อ deploy จริง
window.__RUNTIME_CONFIG__ = {
  // หากปล่อยว่าง '' ระบบจะใช้ Relative Path (เช่น รันผ่าน ngrok หรือโดเมนเดียวกับ Express)
  // หาก Backend อยู่คนละ Server/พอร์ต ให้ระบุ เช่น 'https://api.yourdomain.com'
  apiUrl: '',
};
