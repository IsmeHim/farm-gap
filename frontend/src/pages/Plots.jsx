import { useState, useEffect } from 'react';
import LogManager from '../components/LogManager.jsx';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
  Sprout,
  RotateCcw,
  Calendar,
  History,
  X,
  CheckCircle2,
  Droplets,
  Sparkles,
  Tag,
  Layers,
  Pencil,
  Trash2,
  Search,
  ArrowRight,
  ExternalLink,
  QrCode,
  Filter,
  Package,
  Clock,
  Award,
  Shovel,
  FlaskConical,
} from 'lucide-react';
import { format } from 'date-fns';
import { getCropCycleId } from '../lib/cropCycle.js';

export default function Plots() {
  const [activeTab, setActiveTab] = useState('plots'); // 'plots' | 'cycles'
  const [reloadKey, setReloadKey] = useState(0);
  const [newCropModal, setNewCropModal] = useState(null); // plot object
  const [historyModal, setHistoryModal] = useState(null); // plot object
  const [plotCycles, setPlotCycles] = useState([]);
  const [loadingPlotCycles, setLoadingPlotCycles] = useState(false);

  // New Crop Form state
  const [newCropForm, setNewCropForm] = useState({
    crop_name: '',
    planting_date: format(new Date(), 'yyyy-MM-dd'),
    expected_harvest_date: '',
    default_water_liters: 50,
    soil_notes: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // When historyModal opens, fetch cycles for this specific plot
  useEffect(() => {
    if (historyModal) {
      setLoadingPlotCycles(true);
      api.get(`/api/plots/cycles?plot_id=${historyModal.id}`)
        .then(res => setPlotCycles(res.data || []))
        .catch(() => setPlotCycles([]))
        .finally(() => setLoadingPlotCycles(false));
    } else {
      setPlotCycles([]);
    }
  }, [historyModal]);

  const openNewCrop = (plot) => {
    setNewCropModal(plot);
    setNewCropForm({
      crop_name: plot.crop_name || '',
      planting_date: format(new Date(), 'yyyy-MM-dd'),
      expected_harvest_date: '',
      default_water_liters: plot.default_water_liters || 50,
      soil_notes: plot.soil_notes || '',
      notes: '',
    });
  };

  const handleStartNewCrop = async (e) => {
    e.preventDefault();
    if (!newCropForm.crop_name) {
      toast.error('กรุณาระบุชื่อพืชที่จะปลูกรอบใหม่');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/api/plots/${newCropModal.id}/new-crop`, newCropForm);
      toast.success(res.data.message || 'เริ่มรอบการปลูกใหม่สำเร็จ!');
      setNewCropModal(null);
      setReloadKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเริ่มรอบการปลูกใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center font-bold">
            🌱
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
              การจัดการแปลงปลูก & รอบการผลิต (GAP)
            </h1>
            <p className="text-xs text-slate-500">
              ควบคุมรอบการเพาะปลูก บันทึกประวัติแปลง และระบบตรวจสอบย้อนกลับ
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('plots')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'plots'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>แปลงปัจจุบัน (Active Plots)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cycles')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'cycles'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <History className="w-4 h-4 text-amber-300" />
            <span>ประวัติรอบการปลูก (Cycle Archive)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
              GAP
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: แปลงปลูกปัจจุบัน (Active Plots) */}
      {activeTab === 'plots' && (
        <LogManager
          title="แปลงปลูก (GAP #2)"
          endpoint="plots"
          reloadTrigger={reloadKey}
          renderTopBanner={({ rows }) => {
            const total = rows.length;
            const active = rows.filter(r => r.status === 'active' || !r.status).length;
            const harvested = rows.filter(r => r.status === 'harvested').length;
            const fallow = rows.filter(r => r.status === 'fallow').length;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase">แปลงทั้งหมด</div>
                    <div className="text-lg font-black text-slate-800">{total} แปลง</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-700 border border-emerald-300/60 flex items-center justify-center shrink-0">
                    <Sprout className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase">กำลังปลูก</div>
                    <div className="text-lg font-black text-emerald-800">{active} แปลง</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-300/60 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[11px] font-bold text-amber-600 uppercase">รอปลูกรอบใหม่</div>
                    <div className="text-lg font-black text-amber-900">{harvested} แปลง</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase">พักแปลง</div>
                    <div className="text-lg font-black text-slate-700">{fallow} แปลง</div>
                  </div>
                </div>
              </div>
            );
          }}
          renderRowAction={(item) => (
            <div className="inline-flex items-center gap-1.5 flex-nowrap">
              {item.status === 'harvested' ? (
                <button
                  type="button"
                  onClick={() => openNewCrop(item)}
                  className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs shadow-xs transition cursor-pointer whitespace-nowrap"
                  title="เริ่มรอบการปลูกใหม่บนแปลงนี้"
                >
                  <Sprout className="w-3.5 h-3.5" />
                  <span>เริ่มรอบใหม่</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openNewCrop(item)}
                  className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 font-bold px-2.5 py-1.5 rounded-xl text-xs border border-emerald-200 transition cursor-pointer whitespace-nowrap"
                  title="เปลี่ยนหรือเริ่มรอบการปลูกใหม่"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ปลูกรอบใหม่</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setHistoryModal(item)}
                className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-medium px-2 py-1.5 rounded-xl text-xs border border-slate-200 transition cursor-pointer whitespace-nowrap"
                title="ดูประวัติรอบการปลูกที่ผ่านมาของแปลงนี้"
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>ประวัติ</span>
              </button>
            </div>
          )}
          renderCard={({ item, openEdit, del }) => (
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3.5 transition hover:shadow-md">
              {/* Top Row: Plot Name + Status Chip */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="space-y-1">
                  <div className="font-black text-base text-slate-900 leading-tight">
                    {item.name}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setHistoryModal(item)}
                      className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-lg font-mono font-black text-xs shadow-2xs transition cursor-pointer"
                      title="กดเพื่อดูประวัติรอบปลูกของแปลงนี้"
                    >
                      <Tag className="w-3 h-3 text-amber-700 shrink-0" />
                      <span>#{getCropCycleId(item)}</span>
                    </button>
                    <span className="text-[11px] text-slate-500 font-semibold">
                      รอบที่ {item.cycle_number || 1}
                    </span>
                  </div>
                </div>

                {item.status === 'harvested' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300/70 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    เก็บเกี่ยวแล้ว
                  </span>
                ) : item.status === 'fallow' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    พักแปลง
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/70 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    กำลังปลูก
                  </span>
                )}
              </div>

              {/* Details Grid: 2x2 Clean layout */}
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50/70 rounded-xl p-3 border border-slate-100 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">พืชปัจจุบัน</span>
                  <span className="font-bold text-emerald-950 flex items-center gap-1">
                    <Sprout className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{item.crop_name || '—'}</span>
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">น้ำ Preset</span>
                  <span className="font-bold text-sky-900 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span>{item.default_water_liters ?? 50} ลิตร/ครั้ง</span>
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">วันเริ่มปลูก</span>
                  <span className="font-medium text-slate-700 block">
                    {item.planting_date ? format(new Date(item.planting_date), 'dd/MM/yyyy') : '—'}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">คาดเก็บเกี่ยว</span>
                  <span className="font-medium text-slate-700 block">
                    {item.expected_harvest_date ? format(new Date(item.expected_harvest_date), 'dd/MM/yyyy') : '—'}
                  </span>
                </div>
              </div>

              {/* Soil / Growing Medium (GAP Information) */}
              {(item.soil_notes || item.soil_test_result) && (
                <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-2.5 text-xs text-amber-950 flex items-start gap-2">
                  <Shovel className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {item.soil_notes && (
                      <div className="font-medium text-slate-800 leading-snug">
                        <span className="font-bold text-amber-900">ดิน/วัสดุปลูก: </span>
                        {item.soil_notes}
                      </div>
                    )}
                    {item.soil_test_result && (
                      <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-emerald-800">ผลตรวจดิน:</span>
                        <span>{item.soil_test_result}</span>
                        {item.soil_test_date && (
                          <span className="text-slate-400 font-mono text-[10px]">
                            ({format(new Date(item.soil_test_date), 'dd/MM/yy')})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {item.status === 'harvested' ? (
                  <button
                    type="button"
                    onClick={() => openNewCrop(item)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black py-2.5 px-3 rounded-xl text-xs shadow-sm transition cursor-pointer"
                  >
                    <Sprout className="w-4 h-4" />
                    <span>🌱 เริ่มรอบการปลูกใหม่</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openNewCrop(item)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 font-bold py-2.5 px-3 rounded-xl text-xs border border-emerald-200 transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-emerald-600" />
                    <span>ปลูกรอบใหม่</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setHistoryModal(item)}
                  className="inline-flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-medium py-2.5 px-3 rounded-xl text-xs border border-slate-200 transition cursor-pointer"
                  title="ดูประวัติรอบปลูก"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>ประวัติ</span>
                </button>

                <button
                  type="button"
                  onClick={openEdit}
                  className="inline-flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 font-bold py-2.5 px-3 rounded-xl text-xs border border-blue-200 transition cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>แก้ไข</span>
                </button>

                <button
                  type="button"
                  onClick={del}
                  className="inline-flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold py-2.5 px-3 rounded-xl text-xs border border-rose-200 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบ</span>
                </button>
              </div>
            </div>
          )}
          fields={[
            {
              key: 'name',
              label: 'แปลงปลูก',
              required: true,
              placeholder: 'เช่น แปลง A1 (Hydro NFT)',
              render: (val, item) => (
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 text-sm">{val}</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setHistoryModal(item)}
                      className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-lg font-mono font-black text-xs shadow-2xs transition cursor-pointer"
                      title="กดเพื่อดูประวัติรอบปลูกของแปลงนี้"
                    >
                      <Tag className="w-3 h-3 text-amber-700 shrink-0" />
                      <span>#{getCropCycleId(item)}</span>
                    </button>
                    <span className="text-[11px] text-slate-400 font-medium">
                      รอบที่ {item.cycle_number || 1}
                    </span>
                  </div>
                </div>
              )
            },
            {
              key: 'crop_name',
              label: 'พืชปัจจุบัน',
              required: true,
              placeholder: 'เช่น ผักกรีนโอ๊ค (Green Oak)',
              render: (val) => (
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sprout className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{val || '—'}</span>
                </div>
              )
            },
            {
              key: 'status',
              label: 'สถานะ',
              type: 'select',
              options: ['active','harvested','fallow'],
              placeholder: '-- เลือกสถานะ --',
              default: 'active',
              render: (val) => {
                if (val === 'harvested') {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100/90 text-amber-900 border border-amber-300/70 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      เก็บเกี่ยวแล้ว
                    </span>
                  );
                }
                if (val === 'fallow') {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      พักแปลง
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100/90 text-emerald-900 border border-emerald-300/70 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    กำลังปลูก
                  </span>
                );
              }
            },
            {
              key: 'planting_date',
              label: 'ระยะเวลาปลูก',
              type: 'date',
              placeholder: 'เลือกวันปลูก',
              required: true,
              render: (val, item) => (
                <div className="text-[11px] space-y-0.5 whitespace-nowrap">
                  <div className="text-slate-600 flex items-center gap-1">
                    <span className="text-slate-400 font-medium">ปลูก:</span>
                    <span className="font-mono font-semibold">{val ? format(new Date(val), 'dd/MM/yy') : '—'}</span>
                  </div>
                  {item.expected_harvest_date ? (
                    <div className="text-slate-500 flex items-center gap-1">
                      <span className="text-slate-400 font-medium">เก็บ:</span>
                      <span className="font-mono font-semibold text-amber-800">{format(new Date(item.expected_harvest_date), 'dd/MM/yy')}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-300">—</div>
                  )}
                </div>
              )
            },
            {
              key: 'default_water_liters',
              label: 'น้ำ Preset',
              type: 'number',
              placeholder: 'เช่น 50',
              default: 50,
              render: (val, item) => (
                <div className="text-xs">
                  <div className="font-bold text-sky-900 flex items-center gap-1 whitespace-nowrap">
                    <Droplets className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span>{val ?? 50} ลิตร/ครั้ง</span>
                  </div>
                  {item.water_source && (
                    <div className="text-[10px] text-slate-400 truncate max-w-[130px]" title={item.water_source}>
                      {item.water_source}
                    </div>
                  )}
                </div>
              )
            },
            {
              key: 'area_sqm',
              label: 'พื้นที่',
              type: 'number',
              placeholder: 'เช่น 100',
              render: (val) => val ? (
                <span className="font-mono font-semibold text-slate-700 text-xs whitespace-nowrap">{val} ตร.ม.</span>
              ) : <span className="text-slate-300">—</span>
            },
            // Form fields - cycle_number is hidden completely from form because it auto-defaults to 1!
            { key: 'cycle_number', label: 'รอบปลูก', type: 'number', default: 1, hideInTable: true, hideInForm: true },
            { key: 'expected_harvest_date', label: 'วันคาดเก็บ', type: 'date', placeholder: 'เลือกวันคาดเก็บ', hideInTable: true },
            { key: 'water_source', label: 'แหล่งน้ำ', placeholder: 'เช่น น้ำบาดาล / น้ำประปา', hideInTable: true },
            { key: 'water_source_type', label: 'ประเภทน้ำ', placeholder: 'เช่น บาดาล / ประปา', hideInTable: true },
            { key: 'default_worker_name', label: 'ผู้ดูแลประจำ', placeholder: 'ชื่อผู้ดูแลแปลง', hideInTable: true },
            { key: 'field_safety_status', label: 'ความปลอดภัยแปลง', type: 'select', options: ['ปลอดภัย','มีสารตกค้าง','รอตรวจสอบ'], placeholder: '-- เลือกสถานะ --', hideInTable: true },
            { key: 'soil_notes', label: 'การเตรียมดิน / วัสดุปลูก (GAP)', type: 'textarea', placeholder: 'เช่น ผสมดินในกระบะปูน ดินร่วน 2 ส่วน + ปุ๋ยหมัก 1 ส่วน + ขุยมะพร้าว 1 ส่วน', hideInTable: true },
            { key: 'soil_test_result', label: 'ผลตรวจวิเคราะห์ดิน/วัสดุปลูก', placeholder: 'เช่น ดินอินทรีย์ pH 6.5, ไม่พบสารเคมีและเชื้อปนเปื้อน', hideInTable: true },
            { key: 'soil_test_date', label: 'วันที่ตรวจวิเคราะห์ดิน', type: 'date', placeholder: 'เลือกวันที่ตรวจดิน', hideInTable: true },
            { key: 'previous_crop_history', label: 'ประวัติพืชก่อนหน้า', type: 'textarea', placeholder: 'พืชก่อนหน้านี้', hideInTable: true, hideInForm: true },
            { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
          ]}
        />
      )}

      {/* TAB 2: ประวัติรอบการปลูกทั้งหมด (Crop Cycle Archive) */}
      {activeTab === 'cycles' && (
        <CropCyclesArchive onViewPlot={(plotId) => {
          setActiveTab('plots');
        }} />
      )}

      {/* Modal: เริ่มรอบการปลูกใหม่ (New Crop Cycle Modal) */}
      {newCropModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800">
                    <Sprout className="w-5 h-5 text-emerald-700" />
                  </span>
                  <h3 className="font-bold text-slate-800 text-base">
                    เริ่มรอบการปลูกใหม่บนแปลง {newCropModal.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span>พืชเดิม: <strong>{newCropModal.crop_name}</strong></span>
                  <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                    #{getCropCycleId(newCropModal)}
                  </span>
                  <span>➔ รอบใหม่:</span>
                  <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    #{getCropCycleId({ ...newCropModal, cycle_number: (newCropModal.cycle_number || 1) + 1 })}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setNewCropModal(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleStartNewCrop} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  พืชที่จะปลูกรอบใหม่ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ผักเรดโอ๊ค, แตงกวา, ผักเคล"
                  value={newCropForm.crop_name}
                  onChange={e => setNewCropForm(f => ({ ...f, crop_name: e.target.value }))}
                  className="input text-xs w-full rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    วันที่เริ่มปลูกจริง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newCropForm.planting_date}
                    onChange={e => setNewCropForm(f => ({ ...f, planting_date: e.target.value }))}
                    className="input text-xs w-full rounded-xl border border-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    วันที่คาดว่าจะเก็บเกี่ยว
                  </label>
                  <input
                    type="date"
                    value={newCropForm.expected_harvest_date}
                    onChange={e => setNewCropForm(f => ({ ...f, expected_harvest_date: e.target.value }))}
                    className="input text-xs w-full rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-sky-500" />
                  ปริมาณน้ำ Preset ประจำแปลง (ลิตร/ครั้ง)
                </label>
                <input
                  type="number"
                  value={newCropForm.default_water_liters}
                  onChange={e => setNewCropForm(f => ({ ...f, default_water_liters: Number(e.target.value) }))}
                  className="input text-xs w-full rounded-xl border border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Shovel className="w-3.5 h-3.5 text-amber-700" />
                  การเตรียมดิน / วัสดุปลูกรอบนี้ (GAP)
                </label>
                <textarea
                  rows={2}
                  value={newCropForm.soil_notes}
                  onChange={e => setNewCropForm(f => ({ ...f, soil_notes: e.target.value }))}
                  placeholder="เช่น ผสมดินในกระบะปูน ดินร่วน 2 ส่วน + ปุ๋ยหมัก 1 ส่วน + ขุยมะพร้าว 1 ส่วน, ตากดิน 7 วัน"
                  className="input text-xs w-full rounded-xl border border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">หมายเหตุรอบปลูกใหม่</label>
                <textarea
                  rows={2}
                  value={newCropForm.notes}
                  onChange={e => setNewCropForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="เช่น ทำความสะอาดแปลงแล้ว, ปลูกแบบอินทรีย์รอบ 2"
                  className="input text-xs w-full rounded-xl border border-slate-200"
                />
              </div>

              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/60 text-xs text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>ระบบบันทึกมาตรฐาน GAP อัตโนมัติ:</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed pl-5">
                  ระบบจะทำการเก็บประวัติพืชเดิม ({newCropModal.crop_name}) เข้าสู่แฟ้มประวัติรอบการปลูกย้อนหลัง และปรับสถานะแปลงเป็น <strong>กำลังปลูก (Active)</strong> ให้พร้อมบันทึกกิจกรรมประจำวันทันที
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewCropModal(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Sprout className="w-4 h-4" />
                  {submitting ? 'กำลังบันทึกรอบใหม่...' : 'ยืนยันเริ่มรอบการปลูกใหม่'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: ประวัติรอบการปลูกย้อนหลังของแปลงนั้น (Plot Cycle History Modal) */}
      {historyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-700" />
                  ประวัติรอบการปลูก: {historyModal.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  รอบปัจจุบัน: รอบที่ {historyModal.cycle_number || 1} ({historyModal.crop_name})
                </p>
              </div>
              <button
                onClick={() => setHistoryModal(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cycles List */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>บันทึกรอบการปลูกทั้งหมด (GAP Records):</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  พบ {plotCycles.length} รอบการผลิต
                </span>
              </div>

              {loadingPlotCycles ? (
                <div className="p-8 text-center text-xs text-slate-400">กำลังโหลดประวัติรอบปลูก...</div>
              ) : plotCycles.length > 0 ? (
                <div className="space-y-2.5">
                  {plotCycles.map((c) => (
                    <div
                      key={c.id}
                      className={`p-3.5 rounded-2xl border transition ${
                        c.status === 'active'
                          ? 'bg-emerald-50/70 border-emerald-200/90 shadow-2xs'
                          : 'bg-slate-50/80 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300/80">
                            #{c.cycle_code || `BATCH-R${c.cycle_number}`}
                          </span>
                          <span className="font-bold text-slate-800 text-xs">
                            {c.crop_name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            (รอบที่ {c.cycle_number})
                          </span>
                        </div>

                        {c.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            กำลังปลูก
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 text-slate-700 border border-slate-300/60">
                            เก็บเกี่ยวแล้ว
                          </span>
                        )}
                      </div>

                      {/* Detail row */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 mt-2 bg-white/80 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">วันเริ่มปลูก</span>
                          <span className="font-mono font-medium">
                            {c.planting_date ? format(new Date(c.planting_date), 'dd/MM/yyyy') : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">
                            {c.status === 'harvested' ? 'วันเก็บเกี่ยวจริง' : 'วันคาดเก็บเกี่ยว'}
                          </span>
                          <span className="font-mono font-medium">
                            {c.harvest_date
                              ? format(new Date(c.harvest_date), 'dd/MM/yyyy')
                              : c.expected_harvest_date
                              ? format(new Date(c.expected_harvest_date), 'dd/MM/yyyy')
                              : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">ผลผลิตที่ได้</span>
                          <span className="font-bold text-emerald-900">
                            {c.harvest_quantity ? `${c.harvest_quantity} ${c.harvest_unit || 'kg'}` : '— กำลังปลูก'}
                          </span>
                        </div>
                      </div>

                      {c.lot_code && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                          <span className="font-mono text-slate-500">
                            ล็อต: <strong>{c.lot_code}</strong>
                          </span>
                          <a
                            href={`/trace/${c.lot_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold"
                          >
                            <span>ดู QR ตรวจสอบย้อนกลับ</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-6 text-center text-xs text-slate-400">
                  ไม่มีประวัติการปลูกรอบก่อนหน้า (รอบนี้เป็นรอบแรก)
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setHistoryModal(null);
                  setActiveTab('cycles');
                }}
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 text-xs font-bold transition cursor-pointer"
              >
                <span>เปิดดูหน้ารวมประวัติทุกแปลง</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setHistoryModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: ประวัติรอบการปลูกทั้งหมด (Crop Cycles Archive)
// -----------------------------------------------------------------------------
function CropCyclesArchive({ onViewPlot }) {
  const [cycles, setCycles] = useState([]);
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPlot, setSelectedPlot] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        api.get('/api/plots/cycles'),
        api.get('/api/plots')
      ]);
      setCycles(cRes.data || []);
      setPlots(pRes.data || []);
    } catch (err) {
      toast.error('ไม่สามารถโหลดประวัติรอบปลูกได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter cycles
  const filteredCycles = cycles.filter(c => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      (c.cycle_code && c.cycle_code.toLowerCase().includes(q)) ||
      (c.crop_name && c.crop_name.toLowerCase().includes(q)) ||
      (c.plot_name && c.plot_name.toLowerCase().includes(q)) ||
      (c.lot_code && c.lot_code.toLowerCase().includes(q));

    const matchPlot = selectedPlot === 'all' || String(c.plot_id) === String(selectedPlot);
    const matchStatus = selectedStatus === 'all' || c.status === selectedStatus;

    return matchSearch && matchPlot && matchStatus;
  });

  // Calculate stats
  const totalCycles = cycles.length;
  const activeCycles = cycles.filter(c => c.status === 'active').length;
  const harvestedCycles = cycles.filter(c => c.status === 'harvested').length;
  const totalYieldKg = cycles
    .filter(c => c.status === 'harvested' && c.harvest_quantity)
    .reduce((sum, c) => sum + Number(c.harvest_quantity || 0), 0);

  return (
    <div className="space-y-4">
      {/* Stat Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center justify-center shrink-0">
            <History className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase">รอบปลูกทั้งหมด</div>
            <div className="text-lg font-black text-slate-800">{totalCycles} รอบ</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-700 border border-emerald-300/60 flex items-center justify-center shrink-0">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase">กำลังเพาะปลูก</div>
            <div className="text-lg font-black text-emerald-800">{activeCycles} รอบ</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-800 border border-sky-200/60 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-sky-600 uppercase">เก็บเกี่ยวแล้ว</div>
            <div className="text-lg font-black text-sky-900">{harvestedCycles} รอบ</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 border border-purple-200/60 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-purple-600 uppercase">ผลผลิตสะสมรวม</div>
            <div className="text-lg font-black text-purple-900">{totalYieldKg.toFixed(1)} กก.</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหา: รหัสรอบ, พืช, แปลง, หรือล็อต..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input !pl-9 !pr-8 text-xs w-full rounded-xl border border-slate-200"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Plot filter */}
          <select
            value={selectedPlot}
            onChange={e => setSelectedPlot(e.target.value)}
            className="input text-xs rounded-xl border border-slate-200 flex-1 sm:w-48 font-medium"
          >
            <option value="all">🌱 ทุกแปลงปลูก</option>
            {plots.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="input text-xs rounded-xl border border-slate-200 font-medium"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">กำลังปลูก</option>
            <option value="harvested">เก็บเกี่ยวแล้ว</option>
          </select>

          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cycles List / Table */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400 space-y-2">
            <div className="animate-spin text-2xl">🌱</div>
            <p>กำลังโหลดประวัติรอบการปลูกทั้งหมด...</p>
          </div>
        ) : filteredCycles.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <div className="text-3xl">📭</div>
            <p className="text-sm font-bold text-slate-700">ไม่พบประวัติรอบการปลูกที่ตรงกับเงื่อนไข</p>
            <p className="text-xs text-slate-400">ลองเปลี่ยนคำค้นหาหรือตัวกรองแปลงดูใหม่ครับ</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/90 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3.5 whitespace-nowrap">รหัสรอบ (Batch Code)</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">แปลงปลูก</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">พืชที่ปลูก</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">ระยะเวลาปลูก - เก็บเกี่ยว</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">ผลผลิตที่ได้</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">รหัสล็อต (GAP Lot)</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">สถานะ</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap">การตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCycles.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3.5 align-middle">
                        <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-lg font-mono font-black text-xs">
                          <Tag className="w-3 h-3 text-amber-700" />
                          <span>#{c.cycle_code || `BATCH-R${c.cycle_number}`}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          รอบการผลิตที่ {c.cycle_number}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <span className="font-bold text-slate-900 text-sm">{c.plot_name}</span>
                        {c.area_sqm && (
                          <div className="text-[11px] text-slate-400 font-mono">{c.area_sqm} ตร.ม.</div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <div className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                          <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{c.crop_name}</span>
                        </div>
                        {c.notes && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={c.notes}>
                            {c.notes}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 align-middle whitespace-nowrap font-mono text-[11px]">
                        <div className="text-slate-600">
                          ปลูก: <strong>{c.planting_date ? format(new Date(c.planting_date), 'dd/MM/yyyy') : '—'}</strong>
                        </div>
                        <div className="text-slate-500">
                          {c.status === 'harvested' ? 'เก็บ:' : 'คาดเก็บ:'}{' '}
                          <strong className={c.status === 'harvested' ? 'text-amber-800' : 'text-slate-600'}>
                            {c.harvest_date
                              ? format(new Date(c.harvest_date), 'dd/MM/yyyy')
                              : c.expected_harvest_date
                              ? format(new Date(c.expected_harvest_date), 'dd/MM/yyyy')
                              : '—'}
                          </strong>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        {c.harvest_quantity ? (
                          <div>
                            <span className="font-black text-slate-900 text-sm">
                              {c.harvest_quantity} {c.harvest_unit || 'kg'}
                            </span>
                            {c.quality_grade && (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                เกรด {c.quality_grade}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">กำลังเพาะปลูก</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 align-middle whitespace-nowrap font-mono">
                        {c.lot_code ? (
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs font-semibold">
                            {c.lot_code}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        {c.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            กำลังปลูก
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                            เก็บเกี่ยวแล้ว
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                        {c.lot_code ? (
                          <a
                            href={`/trace/${c.lot_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1.5 rounded-xl text-xs border border-emerald-200 transition"
                            title="สแกน QR หรือดูหน้าตรวจสอบย้อนกลับ GAP"
                          >
                            <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                            <span>สืบย้อน GAP</span>
                          </a>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredCycles.map(c => (
                <div key={c.id} className="bg-slate-50/70 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-lg font-mono font-black text-xs">
                        <Tag className="w-3 h-3 text-amber-700" />
                        <span>#{c.cycle_code || `BATCH-R${c.cycle_number}`}</span>
                      </div>
                      <div className="font-black text-slate-900 text-base">{c.plot_name}</div>
                      <div className="font-bold text-emerald-800 text-xs flex items-center gap-1">
                        <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{c.crop_name} (รอบที่ {c.cycle_number})</span>
                      </div>
                    </div>

                    {c.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        กำลังปลูก
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200/80 text-slate-700 border border-slate-300/60 shrink-0">
                        เก็บเกี่ยวแล้ว
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px]">วันเริ่มปลูก</span>
                      <span className="font-mono font-medium text-slate-700">
                        {c.planting_date ? format(new Date(c.planting_date), 'dd/MM/yyyy') : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        {c.status === 'harvested' ? 'วันเก็บเกี่ยวจริง' : 'วันคาดเก็บ'}
                      </span>
                      <span className="font-mono font-medium text-slate-700">
                        {c.harvest_date
                          ? format(new Date(c.harvest_date), 'dd/MM/yyyy')
                          : c.expected_harvest_date
                          ? format(new Date(c.expected_harvest_date), 'dd/MM/yyyy')
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ผลผลิต</span>
                      <span className="font-black text-slate-900">
                        {c.harvest_quantity ? `${c.harvest_quantity} ${c.harvest_unit || 'kg'}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">รหัสล็อต</span>
                      <span className="font-mono text-slate-600 truncate block">
                        {c.lot_code || '—'}
                      </span>
                    </div>
                  </div>

                  {c.lot_code && (
                    <div className="pt-2 border-t border-slate-200/60 flex justify-end">
                      <a
                        href={`/trace/${c.lot_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 text-xs font-bold"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>สืบย้อนข้อมูล GAP (Traceability)</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
