import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
  Layers,
  Plus,
  Sprout,
  Droplets,
  Clock,
  X,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Sparkles,
  Package,
  Leaf,
  ShoppingBag,
} from 'lucide-react';
import { format } from 'date-fns';

const getDaysPlanted = (dateStr) => {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const getBatchProgressInfo = (batch, plot) => {
  const isHarvestReady = (plot && plot.status === 'harvest_ready') || (batch && batch.status === 'harvest_ready');
  const isHarvested = (plot && plot.status === 'harvested') || (batch && batch.status === 'harvested');
  const startDate = batch?.start_date || plot?.planting_date;
  const expectedDate = batch?.expected_harvest_date || plot?.expected_harvest_date;
  const growthDays = Number(batch?.growth_days || 30);

  const daysPlanted = startDate ? getDaysPlanted(startDate) : 0;

  if (isHarvested) {
    return {
      percent: 100,
      daysPlanted,
      growthDays,
      daysLeft: 0,
      statusLabel: 'เก็บเกี่ยวแล้ว',
      color: 'slate',
    };
  }

  if (isHarvestReady || (expectedDate && new Date(expectedDate) <= new Date())) {
    return {
      percent: 100,
      daysPlanted,
      growthDays,
      daysLeft: 0,
      statusLabel: 'พร้อมเก็บเกี่ยว',
      color: 'amber',
    };
  }

  const percent = Math.min(100, Math.max(0, Math.round((daysPlanted / growthDays) * 100)));
  const daysLeft = Math.max(0, growthDays - daysPlanted);

  return {
    percent,
    daysPlanted,
    growthDays,
    daysLeft,
    statusLabel: daysLeft === 0 ? 'ครบกำหนด' : `เหลืออีก ~${daysLeft} วัน`,
    color: 'emerald',
  };
};

export default function Plots() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plots, setPlots] = useState([]);
  const [crops, setCrops] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State for Starting a Batch
  const [form, setForm] = useState({
    plot_id: '',
    crop_id: '',
    start_date: new Date().toISOString().split('T')[0],
    auto_water: true,
    water_schedule: 'เช้า-เย็น (น้ำสะอาดมาตรฐาน GAP)',
    notes: '',
    soil_recipe: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plotsRes, cropsRes, batchesRes] = await Promise.all([
        api.get('/api/plots'),
        api.get('/api/crops'),
        api.get('/api/batches')
      ]);

      const fetchedPlots = plotsRes.data || [];
      const fetchedCrops = cropsRes.data || [];
      const fetchedBatches = batchesRes.data || [];

      setPlots(fetchedPlots);
      setCrops(fetchedCrops);
      setBatches(fetchedBatches);

      if (fetchedCrops.length > 0) {
        setForm(prev => ({
          ...prev,
          crop_id: prev.crop_id || fetchedCrops[0].id
        }));
      }

      // Check query param e.g. /plots?plot_id=1&start=true
      const paramPlotId = searchParams.get('plot_id');
      const startFlag = searchParams.get('start');
      if (paramPlotId && startFlag === 'true') {
        const found = fetchedPlots.find(p => p.id === Number(paramPlotId));
        setForm(prev => ({
          ...prev,
          plot_id: Number(paramPlotId),
          soil_recipe: found?.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)'
        }));
        setShowNewModal(true);
      }
    } catch (err) {
      console.error('Failed to load plots & batches:', err);
      toast.error('ไม่สามารถโหลดข้อมูลแปลงและรอบการผลิตได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModalWithPlot = (plotId) => {
    const found = plots.find(p => p.id === plotId);
    setForm(prev => ({
      ...prev,
      plot_id: plotId,
      start_date: new Date().toISOString().split('T')[0],
      notes: '',
      soil_recipe: found?.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)'
    }));
    setShowNewModal(true);
  };

  const handleStartPlanting = async (e) => {
    e.preventDefault();
    if (!form.plot_id) {
      return toast.error('กรุณาเลือกแปลงปลูก');
    }
    if (!form.crop_id) {
      return toast.error('กรุณาเลือกชนิดผัก');
    }

    try {
      setSubmitting(true);
      const res = await api.post('/api/batches', form);
      toast.success(res.data?.message || 'เริ่มรอบการปลูกใหม่เรียบร้อยแล้ว!');
      setShowNewModal(false);
      setSearchParams({}); // clear search params
      fetchData();
    } catch (err) {
      console.error('Failed to start planting batch:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเริ่มรอบปลูก');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-xs font-bold text-emerald-800">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            Plots Management & Planting Batches
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5">
            แปลงปลูก 6 แคร่ & รอบการผลิต (Plots & Batches)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            จัดการแคร่ปลูก 2x6 เมตร สูตรดิน และบันทึกรอบการปลูกผักสลัด กวางตุ้ง ผักบุ้ง ฯลฯ
          </p>
        </div>

        <button
          onClick={() => {
            const emptyPlot = plots.find(p => p.status === 'empty' || !p.crop_name || p.crop_name === '-');
            if (emptyPlot) {
              setForm(prev => ({ ...prev, plot_id: emptyPlot.id }));
            }
            setShowNewModal(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>เริ่มรอบการปลูกใหม่</span>
        </button>
      </div>

      {/* 6 Plots Grid (ตรงตาม UI FarmXNext) */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">กำลังโหลดข้อมูลแปลงปลูก 6 แคร่...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plots.map((p) => {
            const isGrowing = p.status === 'growing' && p.crop_name && p.crop_name !== '-';
            const isHarvestReady = p.status === 'harvest_ready';
            const isEmpty = !isGrowing && !isHarvestReady;

            // Find current active batch if exists
            const currentBatch = batches.find(b => b.plot_id === p.id && (b.status === 'growing' || b.status === 'harvest_ready'));
            const progressInfo = (isGrowing || isHarvestReady) ? getBatchProgressInfo(currentBatch, p) : null;

            return (
              <div
                key={p.id}
                className={`bg-white rounded-3xl border-2 p-5 shadow-xs flex flex-col justify-between transition-all ${
                  isHarvestReady
                    ? 'border-amber-300 ring-2 ring-amber-200/50'
                    : isGrowing
                    ? 'border-emerald-200 hover:border-emerald-400'
                    : 'border-slate-200/90 bg-slate-50/40'
                }`}
              >
                <div>
                  {/* Card Header: Plot Number & Status Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-[#173f2a] text-emerald-200 font-bold text-xs flex items-center justify-center shadow-xs">
                        #{p.plot_number || p.id}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">{p.name}</h3>
                        <p className="text-[11px] text-slate-500 font-medium">{p.dimension || 'แคร่ 2 x 6 เมตร'}</p>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                        isHarvestReady
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : isGrowing
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {isHarvestReady
                        ? '🔔 พร้อมเก็บเกี่ยว'
                        : isGrowing
                        ? '🌱 กำลังปลูก'
                        : 'ว่าง / พร้อมปลูก'}
                    </span>
                  </div>

                  {/* Soil Mix Recipe Box (GAP ข้อ 2) */}
                  <div className="mt-3 bg-amber-50/80 rounded-2xl p-3 border border-amber-200/80 text-xs text-amber-950">
                    <span className="font-bold block mb-0.5 text-[11px] text-amber-900">
                      สูตรดิน (GAP ข้อ 2):
                    </span>
                    <p className="text-[11px] leading-relaxed text-amber-900 font-medium">
                      {currentBatch?.soil_recipe || p.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)'}
                    </p>
                  </div>

                  {/* Crop Info in Plot */}
                  {isGrowing || isHarvestReady ? (
                    <div
                      className={`mt-3 rounded-2xl p-3.5 border ${
                        isHarvestReady
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-emerald-50/60 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-900">รอบปลูกปัจจุบัน:</span>
                        <span className="text-[11px] font-mono font-bold text-emerald-800">
                          {currentBatch?.batch_code || `BATCH-P${p.plot_number || p.id}`}
                        </span>
                      </div>
                      <p className="text-base font-black text-slate-900 mt-1">{p.crop_name}</p>
                      <div className="mt-2 text-xs text-slate-600 font-medium space-y-1">
                        <div className="flex justify-between items-center">
                          <span>เริ่มปลูก:</span>
                          <span className="font-semibold text-slate-800">
                            {p.planting_date ? format(new Date(p.planting_date), 'dd/MM/yyyy') : '-'}
                            {progressInfo?.daysPlanted !== undefined && (
                              <span className="text-slate-500 font-normal ml-1">
                                (ปลูกแล้ว {progressInfo.daysPlanted} วัน)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>คาดการณ์เก็บเกี่ยว:</span>
                          <span className="font-semibold text-emerald-800">
                            {p.expected_harvest_date ? format(new Date(p.expected_harvest_date), 'dd/MM/yyyy') : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar (ความคืบหน้ารอบปลูก) */}
                      {progressInfo && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/70">
                          <div className="flex items-center justify-between text-[11px] mb-1.5">
                            <span className="font-bold text-slate-700 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-emerald-700" />
                              <span>ความคืบหน้ารอบปลูก</span>
                            </span>
                            <span className={`font-black ${isHarvestReady ? 'text-amber-800' : 'text-emerald-800'}`}>
                              {progressInfo.percent}% {isHarvestReady ? '🔔 พร้อมเก็บเกี่ยว' : `(${progressInfo.statusLabel})`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden p-0.5 shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isHarvestReady
                                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 animate-pulse shadow-xs'
                                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-xs'
                              }`}
                              style={{ width: `${progressInfo.percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 py-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                      <p className="text-xs font-bold text-slate-600">แปลงว่าง พร้อมลงรอบปลูกใหม่</p>
                      <p className="text-[11px] text-slate-400 mt-1">สูตรดินผสมเสร็จแล้ว สามารถลงปลูกได้ทันที</p>
                    </div>
                  )}
                </div>

                {/* Card Footer Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-blue-500" />
                    {currentBatch?.auto_water || isGrowing || isHarvestReady ? 'รดน้ำอัตโนมัติ' : 'รดน้ำปกติ'}
                  </span>

                  {isEmpty ? (
                    <button
                      onClick={() => openModalWithPlot(p.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ ลงปลูกผักในแปลงนี้</span>
                    </button>
                  ) : isHarvestReady ? (
                    <button
                      onClick={() => navigate(`/harvest?plot_id=${p.id}&smart=true`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-sm hover:shadow transition cursor-pointer active:scale-95 border border-amber-300"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-950" />
                      <span>🧺 เก็บเกี่ยวเข้าคลัง</span>
                    </button>
                  ) : isGrowing ? (
                    <button
                      onClick={() => navigate(`/harvest?plot_id=${p.id}&smart=true`)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow transition cursor-pointer active:scale-95"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>เก็บเกี่ยวเข้าคลัง</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium">ดูแลตามรอบปกติ</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batches Table (ประวัติรอบการปลูกทั้งหมด & GAP Tracing) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Sprout className="w-5 h-5 text-emerald-600" />
          ประวัติรอบการปลูกทั้งหมด (Planting History & GAP Tracing)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">รหัสรอบ (Batch)</th>
                <th className="py-3 px-4 font-semibold">ชนิดผัก</th>
                <th className="py-3 px-4 font-semibold">แปลงปลูก</th>
                <th className="py-3 px-4 font-semibold">วันที่เริ่มปลูก</th>
                <th className="py-3 px-4 font-semibold">วันเก็บเกี่ยว</th>
                <th className="py-3 px-4 font-semibold min-w-[130px]">ความคืบหน้า</th>
                <th className="py-3 px-4 font-semibold">สถานะ</th>
                <th className="py-3 px-4 font-semibold">ระบบรดน้ำ</th>
                <th className="py-3 px-4 font-semibold text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    ยังไม่มีประวัติรอบการปลูก
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const bProg = getBatchProgressInfo(b);
                  return (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.batch_code}</td>
                    <td className="py-3 px-4 font-bold text-emerald-800">{b.crop_name}</td>
                    <td className="py-3 px-4 text-slate-600">{b.plot_name}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {b.start_date ? format(new Date(b.start_date), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {b.actual_harvest_date
                        ? `${format(new Date(b.actual_harvest_date), 'dd/MM/yyyy')} (เก็บแล้ว)`
                        : b.expected_harvest_date
                        ? format(new Date(b.expected_harvest_date), 'dd/MM/yyyy')
                        : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {b.status === 'harvested' ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span>100%</span>
                            <span className="text-[10px] text-slate-400">เก็บเกี่ยวแล้ว</span>
                          </div>
                          <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-slate-400 h-full rounded-full w-full" />
                          </div>
                        </div>
                      ) : b.status === 'harvest_ready' ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-black text-amber-800">
                            <span>100%</span>
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-1 rounded font-bold">พร้อมตัด</span>
                          </div>
                          <div className="w-24 bg-amber-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full w-full animate-pulse" />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-emerald-800">{bProg.percent}%</span>
                            <span className="text-[10px] text-slate-500">{bProg.daysPlanted}/{bProg.growthDays} วัน</span>
                          </div>
                          <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all"
                              style={{ width: `${bProg.percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] ${
                          b.status === 'growing'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'harvest_ready'
                            ? 'bg-amber-100 text-amber-800'
                            : b.status === 'harvested'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {b.status === 'growing'
                          ? '🌱 กำลังปลูก'
                          : b.status === 'harvest_ready'
                          ? '🔔 พร้อมเก็บเกี่ยว'
                          : b.status === 'harvested'
                          ? '✓ เก็บเกี่ยวแล้ว'
                          : b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Droplets className="w-3.5 h-3.5 text-blue-500" />
                        {b.auto_water ? 'รดน้ำอัตโนมัติ' : 'แมนนวล'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(b.status === 'growing' || b.status === 'harvest_ready') && (
                        <button
                          onClick={() => navigate(`/harvest?plot_id=${b.plot_id}&smart=true`)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs active:scale-95 ${
                            b.status === 'harvest_ready'
                              ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-black'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>เก็บเกี่ยว</span>
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal เริ่มรอบการปลูกใหม่ (ตรงตามรูปที่ 3 เป๊ะๆ) */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900">เริ่มรอบการปลูกใหม่</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  บันทึกลงสมุด GAP ข้อ 4 (การจัดการคุณภาพการผลิต)
                </p>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartPlanting} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">เลือกแปลงปลูก (จาก 6 แปลง)</label>
                <select
                  required
                  value={form.plot_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const found = plots.find(p => p.id === Number(selectedId));
                    setForm(prev => ({
                      ...prev,
                      plot_id: selectedId,
                      soil_recipe: found?.soil_recipe || prev.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)'
                    }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                >
                  <option value="">-- เลือกแปลง --</option>
                  {plots.map((p) => {
                    const isBusy = p.status === 'growing' || p.status === 'harvest_ready';
                    return (
                      <option key={p.id} value={p.id} disabled={isBusy}>
                        {p.name} ({p.dimension || 'แคร่ 2 x 6 เมตร'}) {isBusy ? `— กำลังปลูก (${p.crop_name})` : '— ว่าง'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">เลือกชนิดผัก</label>
                <select
                  required
                  value={form.crop_id}
                  onChange={(e) => setForm({ ...form, crop_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                >
                  <option value="">-- เลือกชนิดผัก --</option>
                  {crops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.category}) — โตเต็มวัย {c.growth_days} วัน
                    </option>
                  ))}
                </select>
              </div>

              {/* สูตรดินสำหรับรอบการปลูกนี้ */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    สูตรดินสำหรับรอบนี้ (GAP ข้อ 2)
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, soil_recipe: 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)' }))}
                    className="text-[10px] text-emerald-600 hover:text-emerald-800 font-bold hover:underline cursor-pointer"
                  >
                    ใช้สูตรมาตรฐานฟาร์ม
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={form.soil_recipe}
                  onChange={(e) => setForm({ ...form, soil_recipe: e.target.value })}
                  placeholder="เช่น ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-xs leading-relaxed"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  * ปรับเปลี่ยนสูตรดินได้ตามที่ใช้จริงในรอบนี้ เพื่อเก็บบันทึกประวัติย้อนกลับและแสดงในรายงาน GAP
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">วันที่เริ่มปลูก</label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">ระบบรดน้ำประจำวัน</label>
                  <div className="pt-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={form.auto_water}
                        onChange={(e) => setForm({ ...form, auto_water: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <span>เปิดบันทึกรดน้ำอัตโนมัติ</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">บันทึกเพิ่มเติม / วิธีเพาะกล้า</label>
                <textarea
                  rows={2}
                  placeholder="เช่น เพาะเมล็ดกล่องทิชชู 7 วัน, ลงถาดหลุม 200 หลุม หรือหว่านเมล็ด 3 ขีด"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-xs leading-relaxed"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'กำลังบันทึก...' : '✓ เริ่มรอบการปลูก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
