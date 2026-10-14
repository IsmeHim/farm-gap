import React from 'react';
import { format } from 'date-fns';
import {
  Clock,
  X,
  Plus,
  Sprout,
  Edit3,
  Trash2,
} from 'lucide-react';

export default function CropTimelineDrawer({
  isOpen,
  onClose,
  timelinePlot,
  timelineBatchScope,
  setTimelineBatchScope,
  onOpenAddActivity,
  onOpenEditActivity,
  onDeleteActivity,
}) {
  if (!isOpen || !timelinePlot) return null;

  const pastBatches = timelinePlot.past_batches || [];
  const isPast = timelineBatchScope !== 'current';
  const selectedPast = isPast ? pastBatches.find(b => String(b.id) === String(timelineBatchScope)) : null;
  const actCount = isPast ? (selectedPast?.activities?.length || 0) : (timelinePlot.activities?.length || 0);
  const displayActs = isPast ? (selectedPast?.activities || []) : (timelinePlot.activities || []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end overflow-hidden animate-in fade-in duration-200">
      <div className="bg-slate-50 w-full sm:max-w-xl h-full flex flex-col shadow-2xl border-l border-slate-200 text-slate-900 overflow-hidden animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200 shrink-0 shadow-2xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md shadow-teal-600/20">
                #{timelinePlot.plot_number || timelinePlot.id}
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">
                  {timelinePlot.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10.5px] font-bold px-2 py-0.2 rounded-md border ${
                    timelinePlot.status === 'growing' || timelinePlot.status === 'harvest_ready'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {timelinePlot.status === 'growing' ? `🌱 กำลังปลูก: ${timelinePlot.crop_name}` : 
                     timelinePlot.status === 'harvest_ready' ? `🔔 พร้อมเก็บ: ${timelinePlot.crop_name}` : '🌿 แปลงว่าง / เตรียมกล้า'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    • GAP ข้อ 3
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {timelineBatchScope === 'current' && (
                <button
                  type="button"
                  onClick={() => onOpenAddActivity(timelinePlot)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>จดกิจกรรม</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cycle / Batch History Selector Pills */}
          {pastBatches.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold overflow-x-auto">
              <button
                type="button"
                onClick={() => setTimelineBatchScope('current')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  timelineBatchScope === 'current'
                    ? 'bg-white text-teal-900 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>🌱 รอบปัจจุบัน</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  timelineBatchScope === 'current' ? 'bg-teal-50 text-teal-800 font-black' : 'bg-slate-200 text-slate-600'
                }`}>
                  {timelinePlot.activities?.length || 0}
                </span>
              </button>
              {pastBatches.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setTimelineBatchScope(String(b.id))}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    String(timelineBatchScope) === String(b.id)
                      ? 'bg-white text-amber-900 shadow-xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>📜 รอบที่แล้ว: {b.crop_name || b.batch_code}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    String(timelineBatchScope) === String(b.id) ? 'bg-amber-100 text-amber-900 font-black' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {b.activities?.length || 0}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Sub-bar: Summary info */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold flex items-center gap-1 text-slate-700">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>
                {isPast 
                  ? `ประวัติรอบที่เก็บเกี่ยวแล้ว (${selectedPast?.batch_code || ''}): ${actCount} รายการ`
                  : `บันทึกกิจกรรมรอบปัจจุบัน: ${actCount} รายการ`}
              </span>
            </span>
            {isPast ? (
              <span className="text-[11px] text-amber-900 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300">
                📦 ปิดรอบแล้ว (คลังประวัติ GAP)
              </span>
            ) : (
              <span className="text-[11px] text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                ไทม์ไลน์มาตรฐาน GAP
              </span>
            )}
          </div>
        </div>

        {/* Timeline Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {displayActs && displayActs.length > 0 ? (
            <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {displayActs.map((act, idx) => {
                const isSeeding = act.stage === 'seeding';
                const isNursery = act.stage === 'nursery';
                const isPlanting = act.stage === 'transplant' || act.stage === 'planting';
                const isCare = act.stage === 'maintenance';
                const isWatering = act.stage === 'watering';
                const isHarvest = act.stage === 'harvest';

                return (
                  <div key={act.id} className="relative group">
                    {/* Timeline Marker Dot */}
                    <div className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] shadow-xs ${
                      isSeeding ? 'bg-teal-500 border-teal-200 text-white' :
                      isNursery ? 'bg-emerald-500 border-emerald-200 text-white' :
                      isPlanting ? 'bg-sky-500 border-sky-200 text-white' :
                      isCare ? 'bg-lime-500 border-lime-200 text-white' :
                      isWatering ? 'bg-cyan-500 border-cyan-200 text-white' :
                      isHarvest ? 'bg-amber-500 border-amber-200 text-white' :
                      'bg-slate-500 border-slate-200 text-white'
                    }`}>
                      {idx + 1}
                    </div>

                    {/* Card Content */}
                    <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-teal-300 transition-all">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                            📅 {act.activity_date ? format(new Date(act.activity_date), 'dd/MM/yyyy') : '-'}
                          </span>
                          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-lg border ${
                            isSeeding ? 'bg-teal-50 text-teal-900 border-teal-200' :
                            isNursery ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
                            isPlanting ? 'bg-sky-50 text-sky-900 border-sky-200' :
                            isCare ? 'bg-lime-50 text-lime-900 border-lime-200' :
                            isWatering ? 'bg-cyan-50 text-cyan-900 border-cyan-200' :
                            isHarvest ? 'bg-amber-50 text-amber-900 border-amber-200' :
                            'bg-slate-50 text-slate-800 border-slate-200'
                          }`}>
                            {isSeeding ? '🌱 เพาะเมล็ด' : 
                             isNursery ? '🪴 อนุบาลกล้า' : 
                             isPlanting ? '🚜 ย้ายลงแปลง' : 
                             isCare ? '🌿 ดูแลแปลง/พ่นยา' : 
                             isWatering ? '💧 ให้น้ำ' : 
                             isHarvest ? '🧺 เก็บเกี่ยว' : '📝 บันทึก'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!isPast ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenEditActivity(act, timelinePlot)}
                                title="แก้ไขกิจกรรมนี้"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteActivity(act.id, act.title)}
                                title="ลบกิจกรรมนี้"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                              บันทึกสำเร็จ
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="text-sm font-black text-slate-900 leading-snug">
                        {act.title}
                      </h4>

                      {act.details && (
                        <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-line leading-relaxed bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                          {act.details}
                        </p>
                      )}

                      <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        {act.materials_used ? (
                          <div className="flex items-center gap-1 text-slate-700 bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-200/60 font-medium">
                            <span className="font-bold text-amber-900">อุปกรณ์/ชีวภัณฑ์:</span>
                            <span>{act.materials_used}</span>
                          </div>
                        ) : <span />}
                        <span className="text-[10.5px] text-slate-400">
                          ผู้บันทึก: {act.operator_name || 'เจ้าของฟาร์ม'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-dashed border-slate-300">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                <Sprout className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">
                {isPast ? 'ไม่มีบันทึกกิจกรรมในรอบนี้' : 'ยังไม่มีกิจกรรมที่บันทึกไว้ในรอบปัจจุบัน'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                {isPast
                  ? 'รอบการปลูกนี้ไม่มีกิจกรรมย่อยที่บันทึกไว้'
                  : 'คุณสามารถบันทึกกิจกรรมเพาะเมล็ด อนุบาลกล้า ย้ายปลูก หรือฉีดพ่นชีวภัณฑ์ตามมาตรฐาน GAP ของรอบใหม่ได้เลย'}
              </p>
              {!isPast && (
                <button
                  type="button"
                  onClick={() => onOpenAddActivity(timelinePlot)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 cursor-pointer transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เริ่มบันทึกกิจกรรมแรกของรอบนี้</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs sm:text-sm cursor-pointer transition-colors"
          >
            ปิดหน้าต่าง
          </button>
          {isPast ? (
            <button
              type="button"
              onClick={() => setTimelineBatchScope('current')}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs sm:text-sm shadow-md shadow-teal-600/20 cursor-pointer transition-colors active:scale-95 flex items-center gap-1.5"
            >
              <Sprout className="w-4 h-4" />
              <span>🌱 กลับไปดูรอบปัจจุบัน</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAddActivity(timelinePlot)}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs sm:text-sm shadow-md shadow-teal-600/20 cursor-pointer transition-colors active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>จดกิจกรรมเพิ่ม</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
