import { useState } from 'react';
import LogManager from '../components/LogManager.jsx';
import { toast } from 'sonner';
import {
  Sparkles,
  FlaskConical,
  ShieldCheck,
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const CHEMICAL_PRESETS = [
  {
    icon: '🦠',
    name: 'ไตรโคเดอร์มา',
    desc: 'กันรากเน่า/โคนเน่า',
    badge: 'ชีวภัณฑ์',
    data: {
      chem_type: 'ยาฆ่าเชื้อรา',
      product_name: 'เชื้อราไตรโคเดอร์มา (Trichoderma)',
      amount: 20,
      unit: 'g',
      application_method: 'พ่น',
      reason: 'ป้องกันโรครากเน่า โคนเน่า และเชื้อราใบจุด',
      safety_ppe: 1,
      phi_days: 0,
    }
  },
  {
    icon: '🐛',
    name: 'เชื้อบีที (BT)',
    desc: 'กำจัดหนอนผัก/หนอนใย',
    badge: 'ชีวภัณฑ์',
    data: {
      chem_type: 'ยาฆ่าแมลง',
      product_name: 'เชื้อบีที บาซิลลัส ทูริงเยนซิส (BT)',
      amount: 50,
      unit: 'ml',
      application_method: 'พ่น',
      reason: 'กำจัดหนอนกระทู้ผักและหนอนใยผัก',
      safety_ppe: 1,
      phi_days: 0,
    }
  },
  {
    icon: '🪵',
    name: 'น้ำส้มควันไม้',
    desc: 'ไล่แมลง ปรับปรุงดิน',
    badge: 'อินทรีย์',
    data: {
      chem_type: 'ฮอร์โมน/สารบำรุง',
      product_name: 'น้ำส้มควันไม้ธรรมชาติ',
      amount: 100,
      unit: 'ml',
      application_method: 'พ่น',
      reason: 'ขับไล่แมลงศัตรูพืชและป้องกันเพลี้ย',
      safety_ppe: 1,
      phi_days: 0,
    }
  },
  {
    icon: '🐟',
    name: 'น้ำหมักปลา / PSB',
    desc: 'เร่งใบ เจริญเติบโต',
    badge: 'อินทรีย์',
    data: {
      chem_type: 'ปุ๋ย',
      product_name: 'น้ำหมักปลาชีวภาพเข้มข้น',
      amount: 40,
      unit: 'ml',
      application_method: 'ราด',
      reason: 'เสริมธาตุอาหารไนโตรเจน เร่งการเจริญเติบโตของใบ',
      safety_ppe: 1,
      phi_days: 0,
    }
  },
  {
    icon: '🧄',
    name: 'สารสกัดสะเดา',
    desc: 'คุมเพลี้ย แมลงหวี่ขาว',
    badge: 'สมุนไพร',
    data: {
      chem_type: 'ยาฆ่าแมลง',
      product_name: 'สารสกัดสะเดาธรรมชาติ',
      amount: 30,
      unit: 'ml',
      application_method: 'พ่น',
      reason: 'ป้องกันเพลี้ยไฟ ไรแดง และแมลงหวี่ขาว',
      safety_ppe: 1,
      phi_days: 0,
    }
  },
  {
    icon: '🌿',
    name: 'ปุ๋ยเกล็ด 15-15-15',
    desc: 'บำรุงต้น ใบ และราก',
    badge: 'ปุ๋ยบำรุง',
    data: {
      chem_type: 'ปุ๋ย',
      product_name: 'ปุ๋ยเกล็ดสูตร 15-15-15 ละลายน้ำ',
      amount: 50,
      unit: 'g',
      application_method: 'พ่น',
      reason: 'เสริมสร้างแร่ธาตุหลัก N-P-K สม่ำเสมอ',
      safety_ppe: 1,
      phi_days: 3,
    }
  }
];

function ChemicalCustomModal({ open, setOpen, editingId, form, setForm, save, plots, title }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPresetName, setSelectedPresetName] = useState('');
  const [saving, setSaving] = useState(false);

  const applyPreset = (preset) => {
    setSelectedPresetName(preset.name);
    setForm(prev => ({
      ...prev,
      ...preset.data,
      plot_id: prev.plot_id || (plots[0]?.id || ''),
      log_date: prev.log_date || new Date().toISOString().split('T')[0],
      worker_name: prev.worker_name || 'เจ้าของฟาร์ม'
    }));
    toast.success(`✨ ใส่ข้อมูล "${preset.name}" ให้อัตโนมัติเรียบร้อย`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.plot_id) {
      toast.error('กรุณาเลือกแปลงปลูก');
      return;
    }
    if (!form.product_name || !String(form.product_name).trim()) {
      toast.error('กรุณาระบุชื่อผลิตภัณฑ์ปุ๋ย/สารเคมี');
      return;
    }

    try {
      setSaving(true);
      await save({
        ...form,
        plot_id: Number(form.plot_id),
        log_date: form.log_date || new Date().toISOString().split('T')[0],
        chem_type: form.chem_type || 'ปุ๋ย',
        amount: form.amount === '' || form.amount === null || form.amount === undefined ? null : Number(form.amount),
        unit: form.unit || 'ml',
        application_method: form.application_method || 'พ่น',
        safety_ppe: form.safety_ppe ? 1 : 0,
        phi_days: form.phi_days === '' || form.phi_days === null || form.phi_days === undefined ? 0 : Number(form.phi_days),
        worker_name: form.worker_name || 'เจ้าของฟาร์ม'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-teal-50/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {editingId ? '✏️ แก้ไขบันทึกปุ๋ย/สารเคมี' : '🌱 บันทึกการใส่ปุ๋ย & สารบำรุง'}
              </h2>
              <p className="text-[11px] text-emerald-800 font-bold flex items-center gap-1.5 mt-0.5">
                <span>มาตรฐาน GAP ข้อ 3 (การจัดการปุ๋ยและสารเคมีปลอดภัย)</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
            
            {/* Quick 1-Tap Presets */}
            {!editingId && (
              <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/70 border border-emerald-200/90 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>⚡ สูตรยอดนิยม (คลิกเดียวกรอกครบอัตโนมัติ):</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium hidden sm:inline">
                    กดเพื่อใส่ข้อมูลอัตโนมัติ
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CHEMICAL_PRESETS.map((preset) => {
                    const isSelected = selectedPresetName === preset.name;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer active:scale-97 flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                            : 'bg-white hover:bg-emerald-100/60 text-slate-800 border-emerald-200/90 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="text-base">{preset.icon}</span>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {preset.badge}
                          </span>
                        </div>
                        <div>
                          <div className={`text-xs font-black leading-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {preset.name}
                          </div>
                          <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                            {preset.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 1: Plot & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  แปลงที่ใส่ปุ๋ย/พ่นสาร <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={form.plot_id || ''}
                  onChange={e => setForm({ ...form, plot_id: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm cursor-pointer shadow-2xs"
                >
                  <option value="">-- เลือกแปลง --</option>
                  {plots.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.crop_name && p.crop_name !== '-' ? `(🌱 ${p.crop_name})` : '(แปลงว่าง)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>วันที่ให้สาร / ใส่ปุ๋ย</span> <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.log_date || new Date().toISOString().split('T')[0]}
                  onChange={e => setForm({ ...form, log_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm shadow-2xs"
                />
              </div>
            </div>

            {/* Section 2: Product & Type */}
            <div className="space-y-3 p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 border border-slate-200/90">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    ประเภทของสาร/ปุ๋ย <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={form.chem_type || 'ปุ๋ย'}
                    onChange={e => setForm({ ...form, chem_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm shadow-2xs cursor-pointer"
                  >
                    <option value="ปุ๋ย">🌿 ปุ๋ยอินทรีย์ / ปุ๋ยเคมี / ธาตุอาหาร</option>
                    <option value="ยาฆ่าเชื้อรา">🦠 ยาฆ่าเชื้อรา / ชีวภัณฑ์กันรา (ไตรโคเดอร์มา)</option>
                    <option value="ยาฆ่าแมลง">🐛 ยาฆ่าแมลง / ชีวภัณฑ์กำจัดแมลง (บีที/สะเดา)</option>
                    <option value="ฮอร์โมน/สารบำรุง">✨ ฮอร์โมน / สารบำรุงพืช / น้ำส้มควันไม้</option>
                    <option value="ยาฆ่าหญ้า">🌾 ยาฆ่าหญ้า / สารกำจัดวัชพืช</option>
                    <option value="อื่นๆ">📦 อื่นๆ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    ชื่อผลิตภัณฑ์ / ชื่อสาร <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ไตรโคเดอร์มา, น้ำหมักปลา, ปุ๋ยสูตร 15-15-15"
                    value={form.product_name || ''}
                    onChange={e => setForm({ ...form, product_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm placeholder:text-slate-400 shadow-2xs"
                  />
                </div>
              </div>

              {/* Amount, Unit, Method */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">ปริมาณที่ใช้</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="เช่น 20"
                      value={form.amount ?? ''}
                      onChange={e => setForm({ ...form, amount: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">หน่วย</label>
                    <select
                      value={form.unit || 'ml'}
                      onChange={e => setForm({ ...form, unit: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm shadow-2xs cursor-pointer"
                    >
                      <option value="ml">ml (มิลลิลิตร)</option>
                      <option value="ลิตร">ลิตร (L)</option>
                      <option value="g">g (กรัม)</option>
                      <option value="กก.">กก. (กิโลกรัม)</option>
                      <option value="ช้อนโต๊ะ">ช้อนโต๊ะ</option>
                      <option value="กระสอบ">กระสอบ</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">วิธีการใช้</label>
                  <select
                    value={form.application_method || 'พ่น'}
                    onChange={e => setForm({ ...form, application_method: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm shadow-2xs cursor-pointer"
                  >
                    <option value="พ่น">พ่นทางใบ</option>
                    <option value="ราด">ราดโคนต้น / รดลงดิน</option>
                    <option value="โรย">โรย / หว่านรอบโคน</option>
                    <option value="ฉีดราก">ฉีดเข้าระบบน้ำ / ให้ปุ๋ยน้ำ</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  วัตถุประสงค์ / เหตุผลการใช้
                </label>
                <input
                  type="text"
                  placeholder="เช่น ป้องกันเชื้อราใบจุด, บำรุงใบเขียวโตไว, ขับไล่แมลงศัตรูพืช"
                  value={form.reason || ''}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-xs sm:text-sm placeholder:text-slate-400 shadow-2xs"
                />
              </div>
            </div>

            {/* Section 3: GAP Safety & PHI */}
            <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>เกณฑ์ความปลอดภัยมาตรฐาน GAP</span>
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full border border-emerald-300/60">
                  GAP ข้อ 3
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {/* PPE Toggle Card */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-emerald-200 bg-white cursor-pointer hover:bg-emerald-50/80 transition shadow-2xs select-none">
                  <input
                    type="checkbox"
                    checked={form.safety_ppe === true || form.safety_ppe === 1 || form.safety_ppe === '1'}
                    onChange={e => setForm({ ...form, safety_ppe: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 shrink-0 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 block">สวมอุปกรณ์คุ้มครอง (PPE)</span>
                    <span className="text-[10.5px] text-slate-500 leading-tight block mt-0.5">
                      สวมหน้ากาก ถุงมือ แว่นตา/ชุดป้องกันปลอดภัย
                    </span>
                  </div>
                </label>

                {/* PHI Days */}
                <div className="p-3 rounded-xl border border-emerald-200 bg-white shadow-2xs">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ระยะหยุดพ่นก่อนเก็บเกี่ยว (PHI)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={form.phi_days ?? 0}
                      onChange={e => setForm({ ...form, phi_days: e.target.value === '' ? 0 : Number(e.target.value) })}
                      className="w-20 px-3 py-1.5 rounded-lg border border-slate-300 font-black text-center text-sm focus:border-emerald-600 outline-none text-slate-900"
                    />
                    <span className="text-xs font-bold text-slate-700">วัน</span>
                    <span className="text-[10.5px] text-emerald-700 font-medium">
                      (ชีวภัณฑ์/อินทรีย์ = 0 วัน)
                    </span>
                  </div>
                </div>
              </div>

              {/* Worker */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  ผู้ปฏิบัติงาน / ผู้พ่นสาร
                </label>
                <input
                  type="text"
                  placeholder="เช่น เจ้าของฟาร์ม หรือชื่อคนงาน"
                  value={form.worker_name || ''}
                  onChange={e => setForm({ ...form, worker_name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-emerald-200 bg-white text-slate-800 font-semibold focus:border-emerald-600 outline-none text-xs"
                />
              </div>
            </div>

            {/* Section 4: Advanced GAP details (Collapsible) */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/60">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center justify-between transition cursor-pointer select-none"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>บันทึกเลขทะเบียน / ผู้ผลิต / หมายเหตุเพิ่มเติม (ทางเลือก)</span>
                </span>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showAdvanced && (
                <div className="p-3.5 pt-0 space-y-3 bg-white border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        ผู้ผลิต / ตราสินค้า
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น ตราหวีทอง, กรมพัฒนาที่ดิน"
                        value={form.manufacturer || ''}
                        onChange={e => setForm({ ...form, manufacturer: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-600 outline-none font-medium text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        เลขทะเบียน / ข้อมูลฉลาก
                      </label>
                      <input
                        type="text"
                        placeholder="เลขทะเบียนสารเคมี/ปุ๋ย (ถ้ามี)"
                        value={form.chemical_label || ''}
                        onChange={e => setForm({ ...form, chemical_label: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-600 outline-none font-medium text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      หมายเหตุเพิ่มเติม
                    </label>
                    <textarea
                      rows={2}
                      placeholder="บันทึกสภาพอากาศ หรือข้อสังเกตเพิ่มเติม..."
                      value={form.notes || ''}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-600 outline-none font-medium text-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Fixed Footer Buttons */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
            >
              {saving ? 'กำลังบันทึก...' : editingId ? '💾 บันทึกการแก้ไข' : '🌱 บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Chemicals() {
  return (
    <LogManager
      title="ปุ๋ย/สารเคมี (GAP #3)"
      endpoint="chemicals"
      plotsLookup
      renderModal={(props) => <ChemicalCustomModal {...props} />}
      fields={[
        { key: 'log_date', label: 'วันที่', type: 'date', placeholder: 'เลือกวันที่', required: true },
        { key: 'plot_id', label: 'แปลง', placeholder: '-- เลือกแปลง --', required: true },
        {
          key: 'chem_type',
          label: 'ประเภท',
          render: (val) => {
            const isBio = String(val).includes('ชีวภัณฑ์') || String(val).includes('ไตรโค') || String(val).includes('บีที');
            const isFert = String(val).includes('ปุ๋ย') || String(val).includes('หมัก');
            return (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border whitespace-nowrap shadow-2xs ${
                  isBio
                    ? 'bg-teal-50 text-teal-900 border-teal-300'
                    : isFert
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}
              >
                {val || 'ปุ๋ย'}
              </span>
            );
          }
        },
        {
          key: 'product_name',
          label: 'ชื่อผลิตภัณฑ์',
          render: (val, r) => (
            <div className="font-bold text-slate-800 text-xs">
              {val}
              {r.reason && (
                <span className="block text-[10.5px] font-normal text-slate-400 truncate max-w-[200px]">
                  {r.reason}
                </span>
              )}
            </div>
          )
        },
        {
          key: 'amount',
          label: 'ปริมาณที่ใช้',
          render: (val, r) => (
            val ? (
              <span className="font-mono font-bold text-slate-800 text-xs whitespace-nowrap">
                {val} {r.unit || 'ml'}
              </span>
            ) : <span className="text-slate-400">—</span>
          )
        },
        { key: 'unit', label: 'หน่วย', hideInTable: true },
        {
          key: 'application_method',
          label: 'วิธีการใช้',
          render: (val) => (
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              {val || 'พ่น'}
            </span>
          )
        },
        { key: 'reason', label: 'เหตุผลการใช้', hideInTable: true },
        {
          key: 'safety_ppe',
          label: 'ความปลอดภัย (PPE)',
          render: (val) => (
            val ? (
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg text-[11px] font-bold whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>สวม PPE</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400 text-xs">—</span>
            )
          )
        },
        {
          key: 'phi_days',
          label: 'PHI (วัน)',
          render: (val) => {
            const num = Number(val) || 0;
            return num > 0 ? (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-lg text-xs font-bold whitespace-nowrap">
                ⏳ {num} วัน
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg text-[11px] font-bold whitespace-nowrap">
                0 วัน (ปลอดภัย)
              </span>
            );
          }
        },
        { key: 'worker_name', label: 'ผู้ปฏิบัติ' },
        { key: 'manufacturer', label: 'ผู้ผลิต', hideInTable: true },
        { key: 'chemical_label', label: 'ฉลากสาร', hideInTable: true },
        { key: 'notes', label: 'หมายเหตุ', type: 'textarea', hideInTable: true },
      ]}
    />
  );
}
