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
  ShieldCheck,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { getCropCycleId } from '../lib/cropCycle.js';

// Calculate expected harvest date from planting date and number of days
export const calculateHarvestDate = (plantDate, days) => {
  if (!plantDate || !days || isNaN(days)) return '';
  const d = new Date(plantDate);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + parseInt(days, 10));
  return d.toISOString().split('T')[0];
};

// Calculate difference in days between start and harvest date
export const calculateDaysDiff = (plantDate, harvestDate) => {
  if (!plantDate || !harvestDate) return '';
  const start = new Date(plantDate);
  const end = new Date(harvestDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
  return diffDays > 0 ? diffDays : '';
};

export const formatThaiDateFull = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const dayName = thaiDays[d.getDay()];
    const day = d.getDate();
    const month = thaiMonths[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${dayName}ที่ ${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
};

function PlotFormModal({
  open,
  setOpen,
  editingId,
  form,
  setForm,
  save,
}) {
  const [growthDays, setGrowthDays] = useState(45);

  useEffect(() => {
    const pDate = form.planting_date || format(new Date(), 'yyyy-MM-dd');
    let days = 45;
    if (form.planting_date && form.expected_harvest_date) {
      const diff = calculateDaysDiff(form.planting_date, form.expected_harvest_date);
      if (diff) days = diff;
    }
    setGrowthDays(days);
    const expDate = calculateHarvestDate(pDate, days);
    setForm(prev => ({
      ...prev,
      planting_date: pDate,
      expected_harvest_date: prev.expected_harvest_date || expDate,
    }));
  }, [editingId]);

  const handlePlantDateChange = (newDate) => {
    const expDate = calculateHarvestDate(newDate, growthDays);
    setForm(prev => ({
      ...prev,
      planting_date: newDate,
      expected_harvest_date: expDate,
    }));
  };

  const handleGrowthDaysChange = (daysVal) => {
    setGrowthDays(daysVal);
    const pDate = form.planting_date || format(new Date(), 'yyyy-MM-dd');
    const expDate = calculateHarvestDate(pDate, daysVal);
    setForm(prev => ({
      ...prev,
      planting_date: pDate,
      expected_harvest_date: expDate,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto" onClick={() => setOpen(false)}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl lg:max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0 bg-white/95 rounded-t-3xl backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 text-white flex items-center justify-center shadow-md shadow-emerald-700/20">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#173f2a]">
                {editingId ? '✏️ แก้ไขข้อมูลแปลงปลูก' : '➕ เพิ่มแปลงปลูกใหม่'}
              </h2>
              <p className="text-[11px] text-slate-400">
                ระบบจัดการแปลงเพาะปลูก & คำนวณวันเก็บผลผลิตอัจฉริยะ (Smart GAP)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs"
        >
          {/* Section 1: ข้อมูลแปลงและพืชเพาะปลูก */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Sprout className="w-4 h-4 text-emerald-700" />
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                1. ข้อมูลแปลงและพืชเพาะปลูก (General Information)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  ชื่อแปลงปลูก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="input text-xs w-full rounded-xl border border-slate-200"
                  placeholder="เช่น แปลง A1 (Hydro NFT)"
                  value={form.name || ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  พืชที่ปลูกในแปลง <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="input text-xs w-full rounded-xl border border-slate-200"
                  placeholder="เช่น ผักกรีนโอ๊ค (Green Oak)"
                  value={form.crop_name || ''}
                  onChange={e => setForm(f => ({ ...f, crop_name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">สถานะแปลง</label>
                <select
                  className="input text-xs w-full rounded-xl border border-slate-200 font-medium"
                  value={form.status || 'active'}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                >
                  <option value="active">🌱 กำลังปลูก (Active)</option>
                  <option value="harvested">🧺 เก็บผลผลิตแล้ว / รอเริ่มรอบใหม่ (Harvested)</option>
                  <option value="fallow">⏸️ พักแปลง (Fallow)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">พื้นที่แปลง (ตร.ม.)</label>
                <input
                  type="number"
                  step="any"
                  className="input text-xs w-full rounded-xl border border-slate-200 font-mono"
                  placeholder="เช่น 100"
                  value={form.area_sqm || ''}
                  onChange={e => setForm(f => ({ ...f, area_sqm: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Section 2: ระยะเวลาเพาะปลูก & คำนวณวันเก็บผลผลิตอัตโนมัติ */}
          <div className="space-y-3 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                  2. ระยะเวลาเพาะปลูก & คำนวณวันเก็บเกี่ยว (Smart Harvest Forecast)
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300/60">
                ระบบคำนวณให้อัตโนมัติ
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  วันที่เริ่มปลูก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="input text-xs w-full rounded-xl border border-slate-200 font-mono"
                  value={form.planting_date || format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => handlePlantDateChange(e.target.value)}
                />
                <span className="text-[10px] text-slate-400">เริ่มต้นคือวันที่ปัจจุบัน (ปรับเปลี่ยนได้หากปลูกไปก่อนหน้านี้)</span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    ระยะเวลาการปลูก (จำนวนวัน) <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[11px] font-mono font-black text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded-md">
                    {growthDays || 0} วัน
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    placeholder="กรอกจำนวนวัน เช่น 45"
                    className="input text-xs w-full rounded-xl border border-slate-200 font-mono font-bold pr-12"
                    value={growthDays}
                    onChange={e => handleGrowthDaysChange(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    วัน
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: แหล่งน้ำ & ผู้ดูแลแปลง */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Droplets className="w-4 h-4 text-sky-600" />
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                3. การจัดการน้ำ & ผู้ดูแลแปลง (Water & Workers)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">ปริมาณน้ำ Preset (ลิตร/ครั้ง)</label>
                <input
                  type="number"
                  step="any"
                  className="input text-xs w-full rounded-xl border border-slate-200"
                  placeholder="เช่น 50"
                  value={form.default_water_liters ?? 50}
                  onChange={e => setForm(f => ({ ...f, default_water_liters: Number(e.target.value) }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">ผู้ดูแลประจำแปลง</label>
                <input
                  type="text"
                  className="input text-xs w-full rounded-xl border border-slate-200"
                  placeholder="เช่น นายสมชาย ใจดี"
                  value={form.default_worker_name || ''}
                  onChange={e => setForm(f => ({ ...f, default_worker_name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">แหล่งน้ำที่ใช้ (GAP)</label>
                <input
                  type="text"
                  className="input text-xs w-full rounded-xl border border-slate-200"
                  placeholder="เช่น น้ำบาดาล, น้ำประปา, แหล่งน้ำผิวดิน"
                  value={form.water_source || ''}
                  onChange={e => setForm(f => ({ ...f, water_source: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">ประเภทแหล่งน้ำ</label>
                <input
                  type="text"
                  className="input text-xs w-full rounded-xl border border-slate-200"
                  placeholder="เช่น บาดาล / ประปา"
                  value={form.water_source_type || ''}
                  onChange={e => setForm(f => ({ ...f, water_source_type: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Section 4: มาตรฐานดิน & ความปลอดภัย GAP */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Shovel className="w-4 h-4 text-amber-700" />
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                4. การเตรียมดิน & มาตรฐานความปลอดภัยแปลง (GAP Standards)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-slate-700">การเตรียมดิน / วัสดุปลูก (GAP)</label>
                <textarea
                  rows={2}
                  className="input text-xs w-full rounded-xl border border-slate-200"
                  placeholder="เช่น ผสมดินในกระบะปูน ดินร่วน 2 ส่วน + ปุ๋ยหมัก 1 ส่วน + ขุยมะพร้าว 1 ส่วน, ตากดิน 7 วัน"
                  value={form.soil_notes || ''}
                  onChange={e => setForm(f => ({ ...f, soil_notes: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">ผลตรวจวิเคราะห์ดิน/วัสดุปลูก</label>
                <input
                  type="text"
                  className="input text-xs w-full rounded-xl border border-slate-200"
                  placeholder="เช่น ดินอินทรีย์ pH 6.5, ปลอดสารเคมี"
                  value={form.soil_test_result || ''}
                  onChange={e => setForm(f => ({ ...f, soil_test_result: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">วันที่ตรวจวิเคราะห์ดิน</label>
                <input
                  type="date"
                  className="input text-xs w-full rounded-xl border border-slate-200 font-mono"
                  value={form.soil_test_date || ''}
                  onChange={e => setForm(f => ({ ...f, soil_test_date: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">สถานะความปลอดภัยแปลง</label>
                <select
                  className="input text-xs w-full rounded-xl border border-slate-200 font-medium"
                  value={form.field_safety_status || 'ปลอดภัย'}
                  onChange={e => setForm(f => ({ ...f, field_safety_status: e.target.value }))}
                >
                  <option value="ปลอดภัย">✅ ปลอดภัย (GAP Certified)</option>
                  <option value="รอตรวจสอบ">⏳ รอตรวจสอบ</option>
                  <option value="มีสารตกค้าง">⚠️ มีสารตกค้าง</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  className="input text-xs w-full rounded-xl border border-slate-200"
                  placeholder="หมายเหตุอื่นๆ"
                  value={form.notes || ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Sticky Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              className="btn btn-outline text-xs px-4 py-2.5 rounded-xl cursor-pointer"
              onClick={() => setOpen(false)}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn text-xs px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <span>💾 บันทึกข้อมูลแปลงปลูก</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
    const defaultDays = 45;
    const pDate = format(new Date(), 'yyyy-MM-dd');
    const hDate = calculateHarvestDate(pDate, defaultDays);
    setNewCropModal(plot);
    setNewCropForm({
      crop_name: plot.crop_name || '',
      planting_date: pDate,
      growth_days: defaultDays,
      expected_harvest_date: hDate,
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

        {/* Tab Buttons (Segmented Control) */}
        <div className="grid grid-cols-2 sm:flex items-center gap-1 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 w-full sm:w-auto shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('plots')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
              activeTab === 'plots'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">แปลงปัจจุบัน</span>
            <span className="hidden md:inline text-[11px] opacity-80">(Active)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cycles')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
              activeTab === 'cycles'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <History className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'cycles' ? 'text-amber-300' : 'text-amber-600'}`} />
            <span className="whitespace-nowrap">ประวัติรอบปลูก</span>
            <span className="hidden md:inline text-[11px] opacity-80">(Archive)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wide ${
              activeTab === 'cycles' ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-800'
            }`}>
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
          renderModal={props => <PlotFormModal {...props} />}
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
                    เก็บผลผลิตแล้ว
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
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">คาดเก็บผลผลิต</span>
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
              <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Primary Action Button (ปลูกรอบใหม่ / เริ่มรอบการปลูกใหม่) */}
                {item.status === 'harvested' ? (
                  <button
                    type="button"
                    onClick={() => openNewCrop(item)}
                    className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-98 text-slate-950 font-black py-2.5 px-3.5 rounded-xl text-xs shadow-xs transition cursor-pointer"
                  >
                    <Sprout className="w-4 h-4 shrink-0 text-slate-950" />
                    <span className="truncate">เริ่มรอบการปลูกใหม่</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openNewCrop(item)}
                    className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold py-2.5 px-3.5 rounded-xl text-xs shadow-xs transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0 text-emerald-100" />
                    <span className="truncate">ปลูกรอบใหม่</span>
                  </button>
                )}

                {/* Secondary Actions (History, Edit, Delete) */}
                <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setHistoryModal(item)}
                    className="inline-flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-semibold py-2 sm:py-2.5 px-2.5 rounded-xl text-xs border border-slate-200/80 transition cursor-pointer"
                    title="ดูประวัติรอบปลูก"
                  >
                    <History className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <span>ประวัติ</span>
                  </button>

                  <button
                    type="button"
                    onClick={openEdit}
                    className="inline-flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 font-bold py-2 sm:py-2.5 px-2.5 rounded-xl text-xs border border-blue-200/80 transition cursor-pointer"
                    title="แก้ไขข้อมูลแปลง"
                  >
                    <Pencil className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                    <span>แก้ไข</span>
                  </button>

                  <button
                    type="button"
                    onClick={del}
                    className="inline-flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold py-2 sm:py-2.5 px-2.5 rounded-xl text-xs border border-rose-200/80 transition cursor-pointer"
                    title="ลบแปลงปลูก"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                    <span>ลบ</span>
                  </button>
                </div>
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
                      เก็บผลผลิตแล้ว
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
              label: 'วันที่เริ่มปลูก',
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
            { key: 'expected_harvest_date', label: 'วันคาดเก็บ', type: 'date', placeholder: 'เลือกวันคาดเก็บ', hideInTable: true, hideInForm: true },
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

              {/* Smart Harvest Forecast Section */}
              <div className="space-y-3 bg-slate-50/80 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80">
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
                      onChange={e => {
                        const newPlantDate = e.target.value;
                        const expDate = calculateHarvestDate(newPlantDate, newCropForm.growth_days || 45);
                        setNewCropForm(f => ({ ...f, planting_date: newPlantDate, expected_harvest_date: expDate }));
                      }}
                      className="input text-xs w-full rounded-xl border border-slate-200 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        ระยะเวลาการปลูก (วัน) <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                        {newCropForm.growth_days || 45} วัน
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        required
                        placeholder="กรอกจำนวนวัน เช่น 45"
                        value={newCropForm.growth_days || 45}
                        onChange={e => {
                          const days = e.target.value;
                          const expDate = calculateHarvestDate(newCropForm.planting_date, days);
                          setNewCropForm(f => ({ ...f, growth_days: days, expected_harvest_date: expDate }));
                        }}
                        className="input text-xs w-full rounded-xl border border-slate-200 font-mono font-bold pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                        วัน
                      </span>
                    </div>
                  </div>
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
                            เก็บผลผลิตแล้ว
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
                            {c.status === 'harvested' ? 'วันเก็บผลผลิตจริง' : 'วันคาดเก็บผลผลิต'}
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
                            {c.harvest_quantity ? `${c.harvest_quantity} ${c.harvest_unit || 'kg'}` : c.status === 'harvested' ? '—' : '— กำลังปลูก'}
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
            <div className="text-[10px] sm:text-[11px] font-bold text-sky-600 uppercase">เก็บผลผลิตแล้ว</div>
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
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="ค้นหา: รหัสรอบ, พืช, แปลง, หรือล็อต..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input !pl-9.5 !pr-8 text-xs w-full rounded-xl border border-slate-200"
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
            <option value="harvested">เก็บผลผลิตแล้ว</option>
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
            {/* Desktop Table (lg+) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/90 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3.5 whitespace-nowrap">รหัสรอบ (Batch Code)</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">แปลงปลูก</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">พืชที่ปลูก</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">ระยะเวลาปลูก - เก็บผลผลิต</th>
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
                        ) : c.status === 'harvested' ? (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
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
                            เก็บผลผลิตแล้ว
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

            {/* Mobile & Tablet Cards (<lg) */}
            <div className="block lg:hidden p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredCycles.map(c => (
                  <div key={c.id} className="bg-slate-50/70 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-2">
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
                            เก็บผลผลิตแล้ว
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
                            {c.status === 'harvested' ? 'วันเก็บผลผลิตจริง' : 'วันคาดเก็บ'}
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
