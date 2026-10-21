import React from 'react';
import { X } from 'lucide-react';

export default function AddPlotModal({
  isOpen,
  onClose,
  addPlotForm,
  setAddPlotForm,
  creatingPlot,
  onCreate,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl max-w-xl md:max-w-2xl lg:max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 md:px-6 md:py-4 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900">เพิ่มแปลง / แคร่ปลูกใหม่</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              ขยายพื้นที่ปลูกและกำหนดคุณลักษณะตามมาตรฐาน GAP
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
        <form onSubmit={onCreate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">หมายเลขแคร่</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={addPlotForm.plot_number}
                  onChange={(e) => setAddPlotForm({ ...addPlotForm, plot_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">ชื่อแปลง / แคร่</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น แปลง/แคร่ที่ 7"
                  value={addPlotForm.name}
                  onChange={(e) => setAddPlotForm({ ...addPlotForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">ขนาดแคร่</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น แคร่ 2 x 6 เมตร"
                  value={addPlotForm.dimension}
                  onChange={(e) => setAddPlotForm({ ...addPlotForm, dimension: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">พื้นที่ (ตร.ม.)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={addPlotForm.area_sqm}
                  onChange={(e) => setAddPlotForm({ ...addPlotForm, area_sqm: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-800 mb-1.5">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  placeholder="เช่น แปลงในโรงเรือนยกแคร่"
                  value={addPlotForm.notes}
                  onChange={(e) => setAddPlotForm({ ...addPlotForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                />
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
              disabled={creatingPlot}
              className="flex-1 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {creatingPlot ? 'กำลังสร้าง...' : '✓ บันทึกแปลงใหม่'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
