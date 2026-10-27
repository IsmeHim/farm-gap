import React, { useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../lib/auth.jsx';
import {
  Clock,
  X,
  Plus,
  Sprout,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  List,
  LayoutList,
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
  const { user } = useAuth();
  const ownerName = user?.display_name || 'เจ้าของฟาร์ม';
  // โหมดการแสดงผล: 'compact' (กระชับ ดูได้หลายรายการพร้อมกัน คลิกกางดูได้) หรือ 'expanded' (กางรายละเอียดทุกอัน)
  const [viewMode, setViewMode] = useState('compact');
  const [expandedIds, setExpandedIds] = useState({});

  if (!isOpen || !timelinePlot) return null;

  const pastBatches = timelinePlot.past_batches || [];
  const isPast = timelineBatchScope !== 'current';
  const selectedPast = isPast ? pastBatches.find(b => String(b.id) === String(timelineBatchScope)) : null;
  const actCount = isPast ? (selectedPast?.activities?.length || 0) : (timelinePlot.activities?.length || 0);
  const displayActs = isPast ? (selectedPast?.activities || []) : (timelinePlot.activities || []);

  const toggleExpand = (id) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end overflow-hidden animate-in fade-in duration-200">
      <div className="bg-slate-50 w-full sm:max-w-xl h-full flex flex-col shadow-2xl border-l border-slate-200 text-slate-900 overflow-hidden animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="p-3.5 sm:p-4 bg-white border-b border-slate-200 shrink-0 shadow-2xs">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                #{timelinePlot.plot_number || timelinePlot.id}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                  {timelinePlot.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] font-bold px-2 py-0.2 rounded-md border ${
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

            <div className="flex items-center gap-1.5 shrink-0">
              {timelineBatchScope === 'current' && (
                <button
                  type="button"
                  onClick={() => onOpenAddActivity(timelinePlot)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
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
            <div className="mt-2.5 flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-[11px] font-bold overflow-x-auto">
              <button
                type="button"
                onClick={() => setTimelineBatchScope('current')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  timelineBatchScope === 'current'
                    ? 'bg-white text-teal-900 shadow-2xs font-black'
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
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    String(timelineBatchScope) === String(b.id)
                      ? 'bg-white text-amber-900 shadow-2xs font-black'
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

          {/* Sub-bar: Summary info & View Mode Toggle */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-600">
            <span className="font-semibold flex items-center gap-1 text-slate-700 truncate">
              <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="truncate">
                {isPast 
                  ? `รอบเก็บเกี่ยวแล้ว (${selectedPast?.batch_code || ''}): ${actCount} รายการ`
                  : `กิจกรรมรอบปัจจุบัน: ${actCount} รายการ`}
              </span>
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              {actCount > 0 && (
                <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setViewMode('compact')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition cursor-pointer ${
                      viewMode === 'compact'
                        ? 'bg-white text-teal-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="แสดงแบบกระชับ ดูได้หลายรายการพร้อมกัน"
                  >
                    <List className="w-3 h-3" />
                    <span>กระชับ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('expanded')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition cursor-pointer ${
                      viewMode === 'expanded'
                        ? 'bg-white text-teal-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="กางรายละเอียดทั้งหมด"
                  >
                    <LayoutList className="w-3 h-3" />
                    <span>กางทั้งหมด</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline Body (Compact & Clean) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {displayActs && displayActs.length > 0 ? (
            <div className="relative pl-5 sm:pl-6 space-y-2 before:absolute before:left-2 sm:before:left-2.5 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-slate-200">
              {displayActs.map((act, idx) => {
                const isSeeding = act.stage === 'seeding';
                const isNursery = act.stage === 'nursery';
                const isPlanting = act.stage === 'transplant' || act.stage === 'planting';
                const isChemical = act.source_type === 'chemical';
                const isPest = act.source_type === 'pest';
                const isCare = act.stage === 'maintenance' && !isChemical && !isPest;
                const isHarvest = act.stage === 'harvest';

                const isItemExpanded = viewMode === 'expanded' || Boolean(expandedIds[act.id]);
                const hasExtraDetails = Boolean(
                  (act.details && act.details.trim() !== '' && act.details.trim() !== act.title?.trim()) ||
                  (act.materials_used && act.materials_used.trim() !== '')
                );

                return (
                  <div key={act.id} className="relative group">
                    {/* Compact Timeline Marker Dot */}
                    <div className={`absolute -left-5 sm:-left-6 top-2.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center text-[9.5px] font-black shadow-2xs ${
                      isSeeding ? 'bg-teal-500 border-teal-200 text-white' :
                      isNursery ? 'bg-emerald-500 border-emerald-200 text-white' :
                      isPlanting ? 'bg-sky-500 border-sky-200 text-white' :
                      isChemical ? 'bg-indigo-500 border-indigo-200 text-white' :
                      isPest ? 'bg-rose-500 border-rose-200 text-white' :
                      isCare ? 'bg-lime-500 border-lime-200 text-white' :
                      isHarvest ? 'bg-amber-500 border-amber-200 text-white' :
                      'bg-slate-500 border-slate-200 text-white'
                    }`}>
                      {idx + 1}
                    </div>

                    {/* Sleek Compact Card */}
                    <div
                      onClick={() => {
                        if (viewMode === 'compact' && hasExtraDetails) {
                          toggleExpand(act.id);
                        }
                      }}
                      className={`bg-white rounded-xl px-3 py-2.5 border border-slate-200/90 shadow-2xs hover:border-teal-300 transition-all ${
                        viewMode === 'compact' && hasExtraDetails ? 'cursor-pointer hover:bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Top Single Row: Date + Stage Badge + Title + Action/Toggle */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {act.activity_date ? format(new Date(act.activity_date), 'dd/MM/yyyy') : '-'}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              isSeeding ? 'bg-teal-50 text-teal-900 border-teal-200' :
                              isNursery ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
                              isPlanting ? 'bg-sky-50 text-sky-900 border-sky-200' :
                              isChemical ? 'bg-indigo-50 text-indigo-900 border-indigo-200' :
                              isPest ? 'bg-rose-50 text-rose-900 border-rose-200' :
                              isCare ? 'bg-lime-50 text-lime-900 border-lime-200' :
                              isHarvest ? 'bg-amber-50 text-amber-900 border-amber-200' :
                              'bg-slate-50 text-slate-800 border-slate-200'
                            }`}>
                              {isSeeding ? '🌱 เพาะเมล็ด' : 
                               isNursery ? '🪴 อนุบาลกล้า' : 
                               isPlanting ? '🚜 ย้ายลงแปลง' : 
                               isChemical ? '🧪 ปุ๋ย/ชีวภัณฑ์ (GAP #3)' :
                               isPest ? '🐛 ศัตรูพืช/โรค (GAP #4)' :
                               isCare ? '🌿 ดูแลแปลง/พ่นยา' : 
                               isHarvest ? '🧺 เก็บเกี่ยว' : '📝 บันทึก'}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-auto sm:ml-0">
                              • {act.operator_name && act.operator_name !== 'เจ้าของฟาร์ม' ? act.operator_name : ownerName}
                            </span>
                          </div>

                          <h4 className="text-xs sm:text-[13px] font-black text-slate-900 leading-snug mt-1">
                            {act.title}
                          </h4>

                          {/* Inline 1-line preview when collapsed in compact mode */}
                          {!isItemExpanded && hasExtraDetails && (
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {act.details && act.details.trim() !== act.title?.trim()
                                ? act.details
                                : `อุปกรณ์/ชีวภัณฑ์: ${act.materials_used}`}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                          {!isPast && (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenEditActivity(act, timelinePlot)}
                                title="แก้ไขกิจกรรมนี้"
                                className="p-1 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteActivity(act.id, act.title)}
                                title="ลบกิจกรรมนี้"
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {viewMode === 'compact' && hasExtraDetails && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(act.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                              title={isItemExpanded ? 'ย่อรายละเอียด' : 'ดูรายละเอียดเพิ่ม'}
                            >
                              {isItemExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Details Section */}
                      {isItemExpanded && hasExtraDetails && (
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5 text-[11px]">
                          {act.details && act.details.trim() !== act.title?.trim() && (
                            <p className="text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                              {act.details}
                            </p>
                          )}
                          {act.materials_used && (
                            <div className="flex items-start gap-1 text-slate-700 bg-amber-50/70 px-2 py-1 rounded-md border border-amber-200/60">
                              <span className="font-bold text-amber-900 shrink-0">อุปกรณ์/ชีวภัณฑ์:</span>
                              <span className="leading-snug">{act.materials_used}</span>
                            </div>
                          )}
                        </div>
                      )}
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
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer transition-colors"
          >
            ปิดหน้าต่าง
          </button>
          {isPast ? (
            <button
              type="button"
              onClick={() => setTimelineBatchScope('current')}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs shadow-md shadow-teal-600/20 cursor-pointer transition-colors active:scale-95 flex items-center gap-1.5"
            >
              <Sprout className="w-3.5 h-3.5" />
              <span>🌱 กลับไปดูรอบปัจจุบัน</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAddActivity(timelinePlot)}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs shadow-md shadow-teal-600/20 cursor-pointer transition-colors active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>จดกิจกรรมเพิ่ม</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
