import React from 'react';
import { format } from 'date-fns';
import { Settings, X, Sun, Moon, Calendar as CalendarIcon } from 'lucide-react';

export default function WaterSettingsModal({
  isOpen,
  onClose,
  settingsForm,
  setSettingsForm,
  onSave,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 sm:space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
              <Settings className="w-4 h-4" />
            </span>
            <h3 className="font-black text-slate-900 text-sm sm:text-base">
              ตั้งค่าตารางเวลากิจวัตรอัจฉริยะ
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

        <form onSubmit={onSave} className="space-y-3.5 sm:space-y-4 text-xs">
          {/* Auto Routine Toggle */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-bold text-slate-900">เปิดระบบบันทึกกิจวัตรอัตโนมัติ</div>
              <div className="text-[11px] text-slate-600">
                ระบบจะบันทึกน้ำสะอาด GAP ให้แปลงที่กำลังปลูกอัตโนมัติ เจ้าของไม่ต้องเข้ามากดปุ่มทุกวัน
              </div>
            </div>
            <input
              type="checkbox"
              checked={settingsForm.auto_routine_enabled}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, auto_routine_enabled: e.target.checked }))
              }
              className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
            />
          </div>

          {/* Mode Duration Selection (Until Harvest vs Custom Date) */}
          {settingsForm.auto_routine_enabled && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <label className="font-bold text-slate-900 block text-xs">
                ระยะเวลาที่ต้องการให้รดน้ำอัตโนมัติ:
              </label>

              <div className="space-y-1.5">
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer border border-transparent hover:border-slate-200">
                  <input
                    type="radio"
                    name="auto_mode_type"
                    value="until_harvest"
                    checked={settingsForm.auto_mode_type === 'until_harvest'}
                    onChange={() =>
                      setSettingsForm((f) => ({ ...f, auto_mode_type: 'until_harvest' }))
                    }
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🌱 รดต่อเนื่องจนถึงวันเก็บเกี่ยว</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                        แนะนำ
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      รดน้ำทุกวันให้ทุกแปลงที่กำลังปลูก จนกระทั่งตัดผลผลิตขายตามรอบ GAP
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer border border-transparent hover:border-slate-200">
                  <input
                    type="radio"
                    name="auto_mode_type"
                    value="custom_date"
                    checked={settingsForm.auto_mode_type === 'custom_date'}
                    onChange={() =>
                      setSettingsForm((f) => ({ ...f, auto_mode_type: 'custom_date' }))
                    }
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-800">📅 กำหนดวันสิ้นสุดเอง</div>
                    <div className="text-[11px] text-slate-500">
                      กำหนดวันที่ต้องการให้ระบบหยุดรดน้ำอัตโนมัติ
                    </div>
                  </div>
                </label>
              </div>

              {settingsForm.auto_mode_type === 'custom_date' && (
                <div className="pt-2 pl-6 border-t border-slate-200/80 space-y-1.5 animate-in fade-in duration-150">
                  <label className="font-bold text-slate-800 flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>เปิดใช้งานถึงวันที่:</span>
                  </label>
                  <input
                    type="date"
                    required={settingsForm.auto_mode_type === 'custom_date'}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    value={settingsForm.auto_until_date || ''}
                    onChange={(e) =>
                      setSettingsForm((f) => ({ ...f, auto_until_date: e.target.value }))
                    }
                    className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500">
                    เมื่อพ้นวันที่นี้ ระบบจะหยุดลงบันทึกอัตโนมัติเพื่อรอคำสั่งรอบใหม่
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Times */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-800 flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" /> เวลารอบเช้า
              </label>
              <input
                type="time"
                required
                value={settingsForm.morning_time}
                onChange={(e) =>
                  setSettingsForm((f) => ({ ...f, morning_time: e.target.value }))
                }
                className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-800 flex items-center gap-1">
                <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> เวลารอบเย็น
              </label>
              <input
                type="time"
                required
                value={settingsForm.evening_time}
                onChange={(e) =>
                  setSettingsForm((f) => ({ ...f, evening_time: e.target.value }))
                }
                className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white font-mono"
              />
            </div>
          </div>

          {/* Default Water Source */}
          <div className="space-y-1">
            <label className="font-bold text-slate-800">แหล่งน้ำสะอาดมาตรฐาน GAP</label>
            <input
              type="text"
              required
              value={settingsForm.water_source}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, water_source: e.target.value }))
              }
              className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer text-xs"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow cursor-pointer text-xs"
            >
              บันทึกการตั้งค่า
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
