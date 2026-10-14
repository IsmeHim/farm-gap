import React from 'react';
import {
  Edit3,
  X,
  Sparkles,
  Calendar,
  Leaf,
} from 'lucide-react';

export default function EditBatchModal({
  isOpen,
  onClose,
  editingBatch,
  editForm,
  setEditForm,
  crops,
  savingEdit,
  onSave,
}) {
  if (!isOpen || !editingBatch) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl max-w-xl md:max-w-2xl lg:max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 md:px-6 md:py-4 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-emerald-600" />
              แก้ไขข้อมูลรอบการปลูก
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {editingBatch.plot_name} • รหัสรอบ: <span className="font-mono font-bold text-emerald-700">{editingBatch.batch_code}</span>
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

        {/* Scrollable Form Body */}
        <form onSubmit={onSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">ชนิดผักที่ปลูก</label>
                <select
                  required
                  value={editForm.crop_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cropObj = crops.find(c => String(c.id) === String(val));
                    setEditForm(prev => ({
                      ...prev,
                      crop_id: val,
                      notes: cropObj?.notes || prev.notes
                    }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                >
                  {crops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.category}) — โตเต็มวัย {c.growth_days} วัน
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block mt-1">
                  * คำนวณวันคาดการณ์เก็บเกี่ยวใหม่อัตโนมัติ
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">วันที่เริ่มปลูก</label>
                <input
                  type="date"
                  required
                  value={editForm.start_date}
                  onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  จำนวนที่ลงปลูก (ต้น/หลุม)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="เช่น 200"
                  value={editForm.initial_count}
                  onChange={(e) => setEditForm({ ...editForm, initial_count: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  * ยอดคงเหลือจะคำนวณจากยอดนี้หักความเสียหายสะสม
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">หน่วยนับ</label>
                <select
                  value={editForm.planting_unit}
                  onChange={(e) => setEditForm({ ...editForm, planting_unit: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                >
                  <option value="ต้น">ต้น</option>
                  <option value="หลุม">หลุม</option>
                  <option value="กรัม">กรัม</option>
                  <option value="ขีด">ขีด</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-800 mb-1.5">ระบบรดน้ำประจำวัน</label>
                <div className="h-10.5 px-3.5 flex items-center rounded-xl bg-slate-50 border border-slate-200">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={editForm.auto_water}
                      onChange={(e) => setEditForm({ ...editForm, auto_water: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span>เปิดบันทึกรดน้ำอัตโนมัติ</span>
                  </label>
                </div>
              </div>

              {/* สูตรดินสำหรับรอบการปลูกนี้ */}
              <div className="md:col-span-2 bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/70 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <label className="block text-xs font-bold text-amber-950 items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>สูตรดิน & วันที่เตรียมแคร่ (GAP ข้อ 2)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, soil_recipe: 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)' }))}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer self-start sm:self-auto"
                  >
                    + ใช้สูตรมาตรฐานฟาร์ม (กากยาง 8 กระบะ)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-600" />
                      <span>วันที่ผสมดิน</span>
                    </label>
                    <input
                      type="date"
                      value={editForm.soil_prep_date}
                      onChange={(e) => setEditForm({ ...editForm, soil_prep_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-slate-900 font-bold focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      รายละเอียดสูตรดิน
                    </label>
                    <textarea
                      rows={2}
                      value={editForm.soil_recipe}
                      onChange={(e) => setEditForm({ ...editForm, soil_recipe: e.target.value })}
                      placeholder="เช่น ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)"
                      className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* ที่มาเมล็ดพันธุ์ & บันทึกต้นน้ำ (การแช่/เพาะเมล็ด) */}
              <div className="md:col-span-2 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/70 space-y-3">
                <label className="block text-xs font-bold text-emerald-950 items-center gap-1.5">
                  <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ที่มาเมล็ดพันธุ์ & บันทึกต้นน้ำ (การแช่/เพาะเมล็ด - ทางเลือก)</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-600" />
                      <span>วันที่เริ่มแช่/เพาะเมล็ด</span>
                    </label>
                    <input
                      type="date"
                      value={editForm.seed_prep_date}
                      onChange={(e) => setEditForm({ ...editForm, seed_prep_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-xs"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      * เว้นว่างได้หากไม่ได้แช่
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        วิธีแช่/เพาะกล้า/ที่มาเมล็ด
                      </label>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        ✨ ดึงข้อมูลจากคลังผักอัตโนมัติ
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="วิธีเพาะ/เทคนิคการปลูกจากคลังผักจะแสดงที่นี่อัตโนมัติ (แก้ไขได้)"
                      className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-xs leading-relaxed"
                    />
                  </div>
                </div>
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
              disabled={savingEdit}
              className="flex-1 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {savingEdit ? 'กำลังบันทึก...' : '💾 บันทึกการเปลี่ยนแปลง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
