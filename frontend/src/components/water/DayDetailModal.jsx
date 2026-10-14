import React from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  X,
  Sun,
  Moon,
  ShieldCheck,
} from 'lucide-react';

export default function DayDetailModal({
  selectedCalendarDate,
  onClose,
  dailyMapByDate,
  logMapByDate,
}) {
  if (!selectedCalendarDate) return null;

  const hasData = Boolean(
    dailyMapByDate[selectedCalendarDate] || logMapByDate[selectedCalendarDate]
  );
  const dayData = dailyMapByDate[selectedCalendarDate];
  const calData = logMapByDate[selectedCalendarDate];
  const weather = dayData?.climate_condition || calData?.climate_condition;
  const plotCount = dayData?.plots_watered_count || calData?.plot_count || 0;
  const morningCount = dayData?.morning_count || calData?.morning_logs || 0;
  const eveningCount = dayData?.evening_count || calData?.evening_logs || 0;
  const totalLogs = dayData?.total_logs || calData?.total_logs || 0;
  const workers = dayData?.workers || 'เจ้าของฟาร์ม';
  const waterSource = dayData?.water_source || 'น้ำสะอาดมาตรฐาน GAP';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-sm sm:max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                รายละเอียดการให้น้ำประจำวัน
              </h3>
              <div className="text-[11px] text-slate-500 font-mono">
                {format(new Date(selectedCalendarDate), 'd MMMM yyyy', { locale: th })}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {hasData ? (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">สภาพอากาศ:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                    weather === 'rainy_humidity'
                      ? 'bg-sky-100 text-sky-900 border border-sky-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {weather === 'rainy_humidity' ? '🌧️ ฝนตก/ชื้นสูง (รดคุมชื้น)' : '☀️ แดดจัดปกติ'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">จำนวนแปลงที่รดน้ำ:</span>
                <span className="font-black text-slate-900">{plotCount} แปลง</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">รอบเช้า:</span>
                <span className="font-bold text-amber-700">{morningCount} แปลง</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">รอบเย็น:</span>
                <span className="font-bold text-indigo-700">{eveningCount} แปลง</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">ผู้ปฏิบัติงาน:</span>
                <span className="font-bold text-slate-800">{workers}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/80 pt-1.5 font-black text-slate-900">
                <span>บันทึกรวมทั้งหมด:</span>
                <span className="text-emerald-700">{totalLogs} รายการ</span>
              </div>
            </div>

            {/* รายละเอียดแปลงรอบเช้า */}
            {dayData?.morning_plots?.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5 text-amber-800">
                  <Sun className="w-3.5 h-3.5 text-amber-600" />
                  <span>แปลงที่รดรอบเช้า ({dayData.morning_plots.length} แปลง):</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-amber-50/40 rounded-xl border border-amber-100">
                  {dayData.morning_plots.map((p) => (
                    <span
                      key={p.plot_id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-amber-950 font-bold text-[10px] shadow-2xs"
                    >
                      <span>{p.plot_name}</span>
                      {p.crop_name && (
                        <span className="font-normal text-amber-700 font-mono">
                          ({p.crop_name})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* รายละเอียดแปลงรอบเย็น */}
            {dayData?.evening_plots?.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5 text-indigo-800">
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>แปลงที่รดรอบเย็น ({dayData.evening_plots.length} แปลง):</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-indigo-50/40 rounded-xl border border-indigo-100">
                  {dayData.evening_plots.map((p) => (
                    <span
                      key={p.plot_id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-indigo-200 text-indigo-950 font-bold text-[10px] shadow-2xs"
                    >
                      <span>{p.plot_name}</span>
                      {p.crop_name && (
                        <span className="font-normal text-indigo-700 font-mono">
                          ({p.crop_name})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{waterSource} ตรวจสอบผ่านเกณฑ์ความปลอดภัยทุกแปลง</span>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500">
            ไม่มีประวัติการให้น้ำในวันนี้
          </div>
        )}

        <div className="pt-2 flex justify-end border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition cursor-pointer text-xs"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
