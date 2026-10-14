import React from 'react';
import { Plus, X, Sun, Moon } from 'lucide-react';

export default function ManualWaterModal({
  isOpen,
  onClose,
  manualForm,
  setManualForm,
  onSave,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
              <Plus className="w-4 h-4" />
            </span>
            <h3 className="font-black text-slate-900 text-sm sm:text-base">
              บันทึกการให้น้ำย้อนหลัง (1 วัน ทุกแปลง)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">วันที่บันทึก:</label>
            <input
              type="date"
              required
              value={manualForm.log_date}
              onChange={(e) => setManualForm({ ...manualForm, log_date: e.target.value })}
              className="input w-full py-1.5 px-3 rounded-xl border border-slate-200 font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">รอบการให้น้ำ:</label>
            <div className="flex items-center gap-4 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={manualForm.sessions.includes('เช้า')}
                  onChange={(e) => {
                    const s = new Set(manualForm.sessions);
                    e.target.checked ? s.add('เช้า') : s.delete('เช้า');
                    setManualForm({ ...manualForm, sessions: Array.from(s) });
                  }}
                  className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4"
                />
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-600" /> รอบเช้า
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={manualForm.sessions.includes('เย็น')}
                  onChange={(e) => {
                    const s = new Set(manualForm.sessions);
                    e.target.checked ? s.add('เย็น') : s.delete('เย็น');
                    setManualForm({ ...manualForm, sessions: Array.from(s) });
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5 text-indigo-600" /> รอบเย็น
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">สภาพอากาศ:</label>
            <select
              value={manualForm.climate_condition}
              onChange={(e) =>
                setManualForm({ ...manualForm, climate_condition: e.target.value })
              }
              className="input w-full py-1.5 px-3 rounded-xl border border-slate-200 font-bold"
            >
              <option value="normal">☀️ แดดจัดปกติ (รดน้ำเต็มอัตรา GAP)</option>
              <option value="rainy_humidity">🌧️ ฝนตก/ความชื้นสูง (รดควบคุมความชื้น)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">แหล่งน้ำสะอาด GAP:</label>
            <input
              type="text"
              required
              value={manualForm.water_source}
              onChange={(e) => setManualForm({ ...manualForm, water_source: e.target.value })}
              className="input w-full py-1.5 px-3 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">ผู้ปฏิบัติงาน:</label>
            <input
              type="text"
              value={manualForm.worker_name}
              onChange={(e) => setManualForm({ ...manualForm, worker_name: e.target.value })}
              placeholder="ชื่อผู้ปฏิบัติ เช่น เจ้าของฟาร์ม"
              className="input w-full py-1.5 px-3 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">หมายเหตุ (ถ้ามี):</label>
            <textarea
              rows={2}
              value={manualForm.notes}
              onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
              placeholder="เช่น รดบำรุงต้นอ่อนผักสลัด"
              className="input w-full py-1.5 px-3 rounded-xl border border-slate-200"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={manualForm.sessions.length === 0}
              className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold transition shadow-xs cursor-pointer"
            >
              บันทึกข้อมูล
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
