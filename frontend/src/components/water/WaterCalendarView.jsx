import React from 'react';
import { format, subMonths, addMonths, isSameMonth, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CloudRain, Check } from 'lucide-react';

export default function WaterCalendarView({
  currentMonth,
  setCurrentMonth,
  calendarDays,
  logMapByDate,
  onSelectDate,
}) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-slate-200/90 shadow-xs space-y-3 sm:space-y-4">
      {/* Month Header Controller */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-black text-slate-900 text-sm sm:text-base md:text-lg">
            {format(currentMonth, 'MMMM yyyy', { locale: th })}
          </h3>
          <span className="hidden sm:inline text-xs text-slate-500 font-medium">
            (คลิกวันที่เพื่อดูบันทึก)
          </span>
        </div>

        <div className="flex items-center gap-1 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="เดือนก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date())}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            เดือนปัจจุบัน
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="เดือนถัดไป"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        {/* Day Name Headers */}
        <div className="grid grid-cols-7 bg-slate-100/90 border-b border-slate-200 text-center text-[10px] sm:text-xs font-black text-slate-700 py-1.5 sm:py-2.5">
          <div><span className="sm:hidden">จ.</span><span className="hidden sm:inline">จันทร์</span></div>
          <div><span className="sm:hidden">อ.</span><span className="hidden sm:inline">อังคาร</span></div>
          <div><span className="sm:hidden">พ.</span><span className="hidden sm:inline">พุธ</span></div>
          <div><span className="sm:hidden">พฤ.</span><span className="hidden sm:inline">พฤหัสบดี</span></div>
          <div><span className="sm:hidden">ศ.</span><span className="hidden sm:inline">ศุกร์</span></div>
          <div><span className="sm:hidden">ส.</span><span className="hidden sm:inline">เสาร์</span></div>
          <div><span className="sm:hidden">อา.</span><span className="hidden sm:inline">อาทิตย์</span></div>
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-50/40">
          {calendarDays.map((day) => {
            const dStr = format(day, 'yyyy-MM-dd');
            const logData = logMapByDate[dStr];
            const inCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            let statusBadge = null;
            if (logData) {
              const isBoth = logData.morning_logs > 0 && logData.evening_logs > 0;
              const isRainy = logData.climate_condition === 'rainy_humidity';

              if (isBoth) {
                statusBadge = isRainy ? (
                  <div className="text-[9px] sm:text-[10px] font-bold bg-sky-100 text-sky-900 px-1 py-0.5 rounded border border-sky-300 truncate flex items-center gap-1">
                    <CloudRain className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-700 shrink-0" />
                    <span className="truncate">
                      <span className="sm:hidden">คุมชื้น</span>
                      <span className="hidden sm:inline">รดคุมชื้น ({logData.plot_count})</span>
                    </span>
                  </div>
                ) : (
                  <div className="text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded border border-emerald-300 truncate flex items-center gap-1">
                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-700 shrink-0" />
                    <span className="truncate">
                      <span className="sm:hidden">2 รอบ</span>
                      <span className="hidden sm:inline">รดครบ 2 รอบ ({logData.plot_count})</span>
                    </span>
                  </div>
                );
              } else {
                statusBadge = (
                  <div className="text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-900 px-1 py-0.5 rounded border border-amber-300 truncate text-center">
                    <span className="sm:hidden">{logData.morning_logs > 0 ? 'เช้า' : 'เย็น'}</span>
                    <span className="hidden sm:inline">
                      {logData.morning_logs > 0 ? 'รอบเช้า' : 'รอบเย็น'} ({logData.plot_count})
                    </span>
                  </div>
                );
              }
            }

            return (
              <div
                key={dStr}
                onClick={() => logData && onSelectDate(dStr)}
                className={`min-h-[54px] sm:min-h-[72px] md:min-h-[85px] p-1 sm:p-2 flex flex-col justify-between transition ${
                  inCurrentMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-300'
                } ${isToday ? 'ring-2 ring-emerald-500/80 ring-inset bg-emerald-50/20' : ''} ${
                  logData ? 'cursor-pointer hover:bg-slate-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] sm:text-xs font-mono font-bold ${
                      isToday
                        ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[10px] sm:text-xs'
                        : ''
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {isToday && (
                    <span className="text-[8px] sm:text-[9px] font-black text-emerald-700 uppercase">
                      วันนี้
                    </span>
                  )}
                </div>

                <div className="mt-0.5 sm:mt-1 space-y-1">{statusBadge}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
