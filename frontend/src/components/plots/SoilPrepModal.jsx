import React from 'react';
import {
  Edit3,
  X,
  Calendar,
} from 'lucide-react';

export default function SoilPrepModal({
  isOpen,
  onClose,
  soilForm,
  setSoilForm,
  savingSoil,
  onSave,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-amber-600" />
              ปรับปรุงสูตรดิน / การเตรียมแคร่
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {soilForm.plot_name} • มาตรฐาน GAP ข้อ 2 (การจัดการดินและวัสดุปลูก)
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
            <div>
              <label className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>วันที่ผสมดิน / เตรียมแคร่</span>
              </label>
              <input
                type="date"
                required
                value={soilForm.soil_prep_date}
                onChange={(e) => setSoilForm({ ...soilForm, soil_prep_date: e.target.value })}
                className="w-full sm:w-64 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                * ระบุวันที่เริ่มผสมดินเตรียมแปลงล่วงหน้า (เช่น วันที่ 01/02/2569)
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  รายละเอียดสูตรดิน / การผสมดินในแปลงนี้
                </label>
              </div>
              <textarea
                rows={4}
                required
                value={soilForm.soil_recipe}
                onChange={(e) => setSoilForm({ ...soilForm, soil_recipe: e.target.value })}
                placeholder="เช่น ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs sm:text-sm leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                💡 สามารถบันทึกการเตรียมดินล่วงหน้าได้ตลอดเวลา (เช่น ผสมดินกี่กระบะปูน ใส่กากยาง ขี้ไก่ วันที่ผสม) เมื่อเริ่มรอบปลูกระบบจะดึงสูตรนี้ไปใช้อัตโนมัติ
              </p>
            </div>

            {/* สูตรแนะนำ / Quick Presets */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 space-y-2">
              <span className="text-[11px] font-bold text-amber-900 block">
                ⚡ เลือกสูตรมาตรฐานที่ใช้บ่อย (คลิกเพื่อแทนที่):
              </span>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setSoilForm({ ...soilForm, soil_recipe: 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)' })}
                  className="text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left"
                >
                  🌱 สูตรมาตรฐานฟาร์ม (กากยาง 8 กระบะ)
                </button>
                <button
                  type="button"
                  onClick={() => setSoilForm({ ...soilForm, soil_recipe: 'หน้าดินร่วน 4 ส่วน + แกลบดำ 2 ส่วน + ปุ๋ยหมักมูลวัว 2 ส่วน หมัก 14 วันก่อนลงแปลง' })}
                  className="text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left"
                >
                  🍂 สูตรดินหมักอินทรีย์ + แกลบดำ
                </button>
                <button
                  type="button"
                  onClick={() => setSoilForm({ ...soilForm, soil_recipe: 'พักแปลงตากดิน 7 วัน โรยปูนขาวโดโลไมท์ปรับสภาพกรดด่าง ก่อนเติมปุ๋ยคอกหมัก' })}
                  className="text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left"
                >
                  ☀️ ตากดิน + โดโลไมท์ปรับค่า pH
                </button>
              </div>
            </div>
          </div>

          {/* Fixed Footer Buttons */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 sm:py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={savingSoil}
              className="flex-1 py-2.5 sm:py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {savingSoil ? 'กำลังบันทึก...' : '💾 บันทึกสูตรดินแปลงนี้'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
