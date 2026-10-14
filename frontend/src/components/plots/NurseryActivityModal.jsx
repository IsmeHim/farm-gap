import React from 'react';
import {
  Sprout,
  X,
  Sparkles,
  Calendar,
} from 'lucide-react';

export default function NurseryActivityModal({
  isOpen,
  onClose,
  nurseryForm,
  setNurseryForm,
  crops,
  savingNursery,
  onSave,
  onDelete,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-teal-600" />
              {nurseryForm.activity_id ? 'แก้ไขกิจกรรม' : 'บันทึกกิจกรรมแปลง/ต้นกล้า'}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {nurseryForm.plot_name} • มาตรฐาน GAP ข้อ 3 (การจัดการเมล็ดพันธุ์และแปลงปลูก)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={onSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
            {/* ปุ่มลัดเลือกกิจกรรม (Quick Presets) */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>ตัวอย่างกิจกรรมทั่วไป (คลิกเพื่อเติมข้อความด่วน)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const matchedCrop = crops.find(c => String(c.id) === String(nurseryForm.seed_crop_id));
                    const cropName = matchedCrop ? matchedCrop.name : 'ผัก';
                    setNurseryForm(prev => ({
                      ...prev,
                      stage: 'seeding',
                      title: `เพาะเมล็ดพันธุ์${cropName}ในกล่องพลาสติก`,
                      details: 'วางกระดาษทิชชูในกล่องพลาสติก พ่นน้ำเดินให้ทั่วกระดาษทิชชูหมาดๆ โรยเมล็ดบางๆ แล้วปิดทับด้วยกระดาษทิชชู พ่นน้ำให้หมาดๆ เสร็จแล้วปิดฝากล่องพลาสติกให้มิดชิด',
                      materials_used: 'กล่องพลาสติกมีฝาปิด, กระดาษทิชชู, ฟ็อกกี้พ่นน้ำ'
                    }));
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold border border-teal-200/80 transition cursor-pointer active:scale-95"
                >
                  🌱 1. เพาะเมล็ด (กล่อง/ทิชชู)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNurseryForm(prev => ({
                      ...prev,
                      stage: 'nursery',
                      title: 'ย้ายต้นกล้าลงถาดหลุม 200 หลุม',
                      details: 'ย้ายต้นกล้าลงถาดหลุม 200 หลุม ใส่พีทมอส รดน้ำ เช้า-เที่ยง-เย็น อนุบาลประมาณ 14–15 วัน',
                      materials_used: 'ถาดหลุม 200 หลุม, พีทมอส, บัวรดน้ำฝอย'
                    }));
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200/80 transition cursor-pointer active:scale-95"
                >
                  🪴 2. ย้ายลงถาดหลุม 200 หลุม
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNurseryForm(prev => ({
                      ...prev,
                      stage: 'nursery',
                      title: 'รดน้ำและอนุบาลต้นกล้า',
                      details: 'รดน้ำ เช้า-เที่ยง-เย็น ตรวจสอบความชื้นให้เหมาะสม รับแสงแดดรำไร',
                      materials_used: 'น้ำสะอาดมาตรฐาน GAP'
                    }));
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold border border-sky-200/80 transition cursor-pointer active:scale-95"
                >
                  💧 3. รดน้ำ/อนุบาลต้นกล้า
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNurseryForm(prev => ({
                      ...prev,
                      stage: 'maintenance',
                      title: 'ฉีดพ่นน้ำหมักชีวภาพ / กำจัดศัตรูพืช',
                      details: 'ฉีดพ่นน้ำหมักชีวภาพ/บิวเวอร์เรีย ป้องกันหนอนและแมลงศัตรูพืช ตรวจสภาพแปลง ช่วงแดดร่ม',
                      materials_used: 'น้ำหมักชีวภาพสะเดา, สารชีวภัณฑ์, ถังพ่นยา'
                    }));
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-lime-50 hover:bg-lime-100 text-lime-800 font-bold border border-lime-200/80 transition cursor-pointer active:scale-95"
                >
                  🌿 4. พ่นชีวภัณฑ์/ดูแลแปลง
                </button>
              </div>
            </div>

            {/* ชนิดผักที่จะปลูก */}
            <div>
              <label className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-teal-600" />
                <span>ชนิดผักที่เพาะ/ปลูก</span>
              </label>
              <select
                value={nurseryForm.seed_crop_id}
                onChange={(e) => {
                  const val = e.target.value;
                  const cropObj = crops.find(c => String(c.id) === String(val));
                  const cropName = cropObj ? cropObj.name : 'ผัก';
                  setNurseryForm(prev => ({
                    ...prev,
                    seed_crop_id: val,
                    title: !prev.activity_id ? `เพาะเมล็ดพันธุ์${cropName}` : prev.title,
                    details: cropObj?.notes || prev.details
                  }));
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm cursor-pointer"
              >
                <option value="">-- ไม่ระบุ / เลือกภายหลัง --</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.category || 'ผักใบ'} • รอบปลูก {c.growth_days || 30} วัน)
                  </option>
                ))}
              </select>
            </div>

            {/* วันที่ และ ระยะกิจกรรม */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    วันที่ทำกิจกรรม
                  </span>
                </label>
                <input
                  type="date"
                  required
                  value={nurseryForm.activity_date}
                  onChange={(e) => setNurseryForm({ ...nurseryForm, activity_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  ระยะ / ประเภทกิจกรรม
                </label>
                <select
                  value={nurseryForm.stage}
                  onChange={(e) => setNurseryForm({ ...nurseryForm, stage: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm cursor-pointer"
                >
                  <option value="seeding">🌱 เพาะเมล็ด / แช่น้ำอุ่น</option>
                  <option value="nursery">🪴 อนุบาลต้นกล้า / ถาดหลุม</option>
                  <option value="transplant">🚜 ย้ายกล้าลงแปลง</option>
                  <option value="maintenance">🌿 ดูแลรักษา / พ่นชีวภัณฑ์ / กำจัดวัชพืช</option>
                  <option value="watering">💧 ให้น้ำตามรอบ</option>
                  <option value="prep">📝 บันทึกเตรียมการทั่วไป</option>
                </select>
              </div>
            </div>

            {/* หัวข้อกิจกรรม */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                ชื่อกิจกรรม / การปฏิบัติ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nurseryForm.title}
                onChange={(e) => setNurseryForm({ ...nurseryForm, title: e.target.value })}
                placeholder="เช่น เพาะเมล็ดพันธุ์ผักกวางตุ้ง หรือ ย้ายต้นกล้าลงถาดหลุม 200 หลุม"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm"
              />
            </div>

            {/* รายละเอียดขั้นตอน */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  รายละเอียดการปฏิบัติ (จะถูกส่งไปแสดงในรายงาน GAP)
                </label>
                <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60">
                  ✨ ดึงวิธีเพาะจากคลังชนิดผักอัตโนมัติ
                </span>
              </div>
              <textarea
                rows={3}
                value={nurseryForm.details}
                onChange={(e) => setNurseryForm({ ...nurseryForm, details: e.target.value })}
                placeholder="วิธีเพาะ/เทคนิคการปลูกจากคลังผักจะแสดงที่นี่อัตโนมัติ (แก้ไขได้)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-xs sm:text-sm leading-relaxed"
              />
            </div>

            {/* วัสดุอุปกรณ์ และ ผู้ปฏิบัติงาน */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  วัสดุ / อุปกรณ์ที่ใช้
                </label>
                <input
                  type="text"
                  value={nurseryForm.materials_used}
                  onChange={(e) => setNurseryForm({ ...nurseryForm, materials_used: e.target.value })}
                  placeholder="เช่น พีทมอส, ถาด 200 หลุม, ทิชชู"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  ผู้ปฏิบัติงาน
                </label>
                <input
                  type="text"
                  value={nurseryForm.operator_name}
                  onChange={(e) => setNurseryForm({ ...nurseryForm, operator_name: e.target.value })}
                  placeholder="เช่น เจ้าของฟาร์ม"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Fixed Footer Buttons */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2.5 shrink-0 flex-wrap">
            {nurseryForm.activity_id ? (
              <button
                type="button"
                onClick={() => onDelete(nurseryForm.activity_id, nurseryForm.title)}
                disabled={savingNursery}
                className="px-3.5 py-2.5 sm:py-3 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold text-xs sm:text-sm cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
              >
                ลบกิจกรรมนี้
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2 flex-1 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={savingNursery}
                className="px-5 py-2.5 sm:py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs sm:text-sm shadow-md shadow-teal-600/20 disabled:opacity-50 cursor-pointer transition-colors active:scale-95"
              >
                {savingNursery ? 'กำลังบันทึก...' : (nurseryForm.activity_id ? '💾 บันทึกการแก้ไข' : '💾 บันทึกกิจกรรม')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
