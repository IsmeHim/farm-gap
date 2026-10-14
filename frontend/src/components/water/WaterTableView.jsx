import React from 'react';
import { format, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  List,
  Plus,
  Search,
  Sun,
  Moon,
  Layers,
  CloudRain,
  ShieldCheck,
  Eye,
  Trash2,
  Check,
} from 'lucide-react';

export default function WaterTableView({
  filteredDailyLogs,
  searchDaily,
  setSearchDaily,
  onOpenManualModal,
  onSelectDate,
  onOpenDeleteModal,
}) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-slate-200/90 shadow-xs space-y-4">
      {/* Header Controller */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-slate-900 text-sm sm:text-base md:text-lg flex items-center gap-2">
              <List className="w-5 h-5 text-emerald-700" />
              ตารางประวัติบันทึกการให้น้ำมาตรฐาน GAP
            </h3>
            <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              1 วัน = 1 แถว รวมทุกแปลง
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกกิจวัตรประจำวันของฟาร์ม กะทัดรัด สะอาดตา ลดความซ้ำซ้อน และผ่านเกณฑ์ตรวจประเมิน GAP 100%
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenManualModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>บันทึกย้อนหลัง / กำหนดเอง</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Search Bar & Summary Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาวันที่, ผู้ปฏิบัติ..."
              value={searchDaily}
              onChange={(e) => setSearchDaily(e.target.value)}
              className="input pl-8 py-1.5 text-xs w-full rounded-xl bg-slate-50 border-slate-200"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium self-end sm:self-center">
            <span>
              ทั้งหมด <strong className="text-slate-900">{filteredDailyLogs.length}</strong> วันบันทึก
            </span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">
              มาตรฐาน GAP กะทัดรัด สะอาดตา
            </span>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3">วันที่</th>
                <th className="py-2.5 px-3">☀️ รอบเช้า</th>
                <th className="py-2.5 px-3">🌙 รอบเย็น</th>
                <th className="py-2.5 px-3">แปลงที่รด</th>
                <th className="py-2.5 px-3">สภาพอากาศ</th>
                <th className="py-2.5 px-3">แหล่งน้ำ (GAP)</th>
                <th className="py-2.5 px-3">ผู้ปฏิบัติ</th>
                <th className="py-2.5 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDailyLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    ไม่พบบันทึกการให้น้ำ
                  </td>
                </tr>
              ) : (
                filteredDailyLogs.map((row) => {
                  const isToday = isSameDay(new Date(row.date), new Date());
                  return (
                    <tr
                      key={row.date}
                      className={`hover:bg-slate-50/80 transition ${
                        isToday ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      {/* วันที่ */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-black text-slate-900 text-xs">
                              {format(new Date(row.date), 'd MMM yyyy', { locale: th })}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              วัน{format(new Date(row.date), 'EEEE', { locale: th })}
                            </div>
                          </div>
                          {isToday && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              วันนี้
                            </span>
                          )}
                        </div>
                      </td>

                      {/* รอบเช้า */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.morning_count > 0 ? (
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                              row.is_morning_completed
                                ? 'bg-amber-100/70 text-amber-950 border-amber-300'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              {row.is_morning_completed
                                ? row.paused_plots?.length > 0
                                  ? `รดครบ (เว้น ${row.paused_plots.length} แปลง)`
                                  : 'รดครบทุกแปลง'
                                : `รด ${row.morning_count}/${
                                    row.enabled_active_count || row.total_active_count
                                  }`}
                            </span>
                            {row.is_morning_completed && (
                              <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium text-[11px] px-2 py-0.5 rounded-md bg-slate-100/60 border border-slate-200/50">
                            — ยังไม่รด
                          </span>
                        )}
                      </td>

                      {/* รอบเย็น */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.evening_count > 0 ? (
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                              row.is_evening_completed
                                ? 'bg-indigo-100/70 text-indigo-950 border-indigo-300'
                                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            }`}
                          >
                            <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>
                              {row.is_evening_completed
                                ? row.paused_plots?.length > 0
                                  ? `รดครบ (เว้น ${row.paused_plots.length} แปลง)`
                                  : 'รดครบทุกแปลง'
                                : `รด ${row.evening_count}/${
                                    row.enabled_active_count || row.total_active_count
                                  }`}
                            </span>
                            {row.is_evening_completed && (
                              <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium text-[11px] px-2 py-0.5 rounded-md bg-slate-100/60 border border-slate-200/50">
                            — ยังไม่รด
                          </span>
                        )}
                      </td>

                      {/* แปลงที่รด */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded-lg border border-slate-200 text-xs">
                            <Layers className="w-3 h-3 text-slate-500" />
                            <span>{row.plots_watered_count} แปลง</span>
                          </span>
                          {row.paused_plots?.length > 0 && (
                            <span
                              className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300"
                              title={row.paused_plots.map((p) => p.name).join(', ')}
                            >
                              เว้น {row.paused_plots.length}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* สภาพอากาศ */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.climate_condition === 'rainy_humidity' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                            <CloudRain className="w-3 h-3 text-sky-600 shrink-0" />
                            <span>ฝนตก (คุมชื้น)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>แดดจัดปกติ</span>
                          </span>
                        )}
                      </td>

                      {/* แหล่งน้ำ GAP */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-bold text-emerald-800 text-xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[140px]">{row.water_source}</span>
                        </div>
                      </td>

                      {/* ผู้ปฏิบัติ */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                          <span>{row.workers}</span>
                          {row.is_auto && (
                            <span className="text-[9px] bg-blue-50 text-blue-700 px-1 py-0.2 rounded border border-blue-200 font-bold">
                              🤖 อัตโนมัติ
                            </span>
                          )}
                        </div>
                      </td>

                      {/* จัดการ */}
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectDate(row.date)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                            title="ดูรายละเอียดแปลงย่อย"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenDeleteModal(row.date)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="ลบบันทึกของวันนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
