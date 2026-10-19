import React from 'react';
import {
  Sparkles,
  X,
  Calendar,
  User,
  Trash2,
  FileText,
} from 'lucide-react';

export default function SoilPrepModal({
  isOpen,
  onClose,
  soilForm,
  setSoilForm,
  savingSoil,
  onSave,
  onDelete,
}) {
  if (!isOpen) return null;

  const isEditing = Boolean(soilForm.has_prepared);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              {isEditing ? 'แก้ไขกิจกรรมเตรียมดิน / สูตรดิน' : 'บันทึกกิจกรรมเตรียมดิน / สูตรดิน'}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {soilForm.plot_name} • มาตรฐาน GAP ข้อ 2 (บันทึกเป็นกิจกรรมในประวัติแปลง)
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs sm:text-sm"
                />
                <p className="text-[10.5px] text-slate-500 mt-1">
                  * วันที่ผสมดินจริง (เช่น 10/02/69)
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-amber-600" />
                  <span>ผู้ปฏิบัติงาน</span>
                </label>
                <input
                  type="text"
                  required
                  value={soilForm.operator_name || ''}
                  onChange={(e) => setSoilForm({ ...soilForm, operator_name: e.target.value })}
                  placeholder="เช่น เจ้าของฟาร์ม / นายสมชาย"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs sm:text-sm"
                />
                <p className="text-[10.5px] text-slate-500 mt-1">
                  * ผู้รับผิดชอบตามมาตรฐาน GAP
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  สูตรดิน / วัสดุปลูกที่ผสม (GAP ข้อ 2)
                </label>
              </div>
              <textarea
                rows={3}
                required
                value={soilForm.soil_recipe}
                onChange={(e) => setSoilForm({ ...soilForm, soil_recipe: e.target.value })}
                placeholder="เช่น ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs sm:text-sm leading-relaxed"
              />
            </div>

            {/* บันทึกขั้นตอน / รายละเอียดเพิ่มเติม */}
            <div>
              <label className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>ขั้นตอนการเตรียม / บันทึกเพิ่มเติม</span>
              </label>
              <textarea
                rows={2}
                value={soilForm.details || ''}
                onChange={(e) => setSoilForm({ ...soilForm, details: e.target.value })}
                placeholder="เช่น ผสมคลุกเคล้าให้เข้ากัน ตากแดดและหมักไว้ 7-10 วัน ก่อนนำต้นกล้าลงแปลง"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs leading-relaxed"
              />
            </div>

            {/* สูตรแนะนำ / Quick Presets */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 space-y-2">
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
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(soilForm.plot_id)}
                disabled={savingSoil}
                className="py-2.5 px-3.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="ยกเลิกกิจกรรมเตรียมดินของแปลงนี้"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยกเลิกเตรียมดิน</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 sm:py-3 px-4 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                ปิด
              </button>
              <button
                type="submit"
                disabled={savingSoil}
                className="py-2.5 sm:py-3 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {savingSoil ? 'กำลังบันทึก...' : '💾 บันทึกกิจกรรมเตรียมดิน'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
