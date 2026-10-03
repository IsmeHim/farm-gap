import { useState } from 'react';
import LogManager from '../components/LogManager.jsx';
import { toast } from 'sonner';
import {
  Bug,
  Sparkles,
  ShieldAlert,
  Calendar,
  X,
  CheckCircle2,
  AlertTriangle,
  Scissors
} from 'lucide-react';

const PEST_PRESETS = [
  {
    icon: '🐛',
    name: 'หนอนกระทู้ / หนอนใย',
    desc: 'กัดกินใบผักเป็นรู',
    badge: 'แมลงศัตรูพืช',
    data: {
      damage_cause: 'หนอน/แมลงศัตรูพืช',
      pest_or_disease: 'หนอนกระทู้ผัก / หนอนใยผัก',
      damaged_count: 5,
      damage_unit: 'ต้น',
      severity: 'น้อย',
      treatment_method: 'เก็บตัวหนอนทำลายทิ้ง + ฉีดพ่นเชื้อบีที (BT) ช่วงแดดร่ม',
    }
  },
  {
    icon: '🦗',
    name: 'เพลี้ยไฟ / เพลี้ยอ่อน',
    desc: 'ดูดน้ำเลี้ยง ใบหงิกงอ',
    badge: 'แมลงศัตรูพืช',
    data: {
      damage_cause: 'หนอน/แมลงศัตรูพืช',
      pest_or_disease: 'เพลี้ยไฟ / เพลี้ยอ่อน',
      damaged_count: 3,
      damage_unit: 'ต้น',
      severity: 'น้อย',
      treatment_method: 'พ่นน้ำส้มควันไม้ผสมสารสกัดสะเดา + ฉีดพ่นน้ำแรงดันไล่เพลี้ย',
    }
  },
  {
    icon: '🍄',
    name: 'รากเน่า / โคนเน่า',
    desc: 'ต้นเหี่ยว โคนเน่าช้ำ',
    badge: 'โรคเชื้อรา',
    data: {
      damage_cause: 'โรคพืช/เชื้อรา/แบคทีเรีย',
      pest_or_disease: 'โรครากเน่าโคนเน่า (Damping-off)',
      damaged_count: 8,
      damage_unit: 'ต้น',
      severity: 'ปานกลาง',
      treatment_method: 'ถอนต้นเป็นโรคออกทำลาย + ราดเชื้อราไตรโคเดอร์มาคุมแปลง',
    }
  },
  {
    icon: '🍂',
    name: 'ราน้ำค้าง / ใบจุด',
    desc: 'ใบมีจุดเหลือง/ไหม้',
    badge: 'โรคพืช',
    data: {
      damage_cause: 'โรคพืช/เชื้อรา/แบคทีเรีย',
      pest_or_disease: 'โรคราน้ำค้าง / แผลใบจุด',
      damaged_count: 4,
      damage_unit: 'ต้น',
      severity: 'น้อย',
      treatment_method: 'ปลิดใบที่เป็นโรคออก + พ่นชีวภัณฑ์บาซิลลัส ซับทิลิส (BS)',
    }
  },
  {
    icon: '☀️',
    name: 'แดดเผา / Tip Burn',
    desc: 'ขอบใบไหม้จากอากาศร้อน',
    badge: 'สภาพอากาศ',
    data: {
      damage_cause: 'สภาพอากาศ/แดดเผา/น้ำท่วม',
      pest_or_disease: 'ขอบใบไหม้แดดจัด (Tip burn)',
      damaged_count: 6,
      damage_unit: 'ต้น',
      severity: 'น้อย',
      treatment_method: 'คลี่สแลนพรางแสง 50% + พ่นละอองหมอกลดอุณหภูมิโรงเรือน',
    }
  },
  {
    icon: '✂️',
    name: 'ต้นแคระแกร็น / คัดทิ้ง',
    desc: 'โตช้า ไม่สมบูรณ์',
    badge: 'คัดแยกต้น',
    data: {
      damage_cause: 'ต้นแคระแกร็น/คัดทิ้ง',
      pest_or_disease: 'ต้นแคระแกร็นไม่สมบูรณ์',
      damaged_count: 5,
      damage_unit: 'ต้น',
      severity: 'น้อย',
      treatment_method: 'ถอนคัดทิ้งเพื่อเปิดพื้นที่ให้ต้นข้างเคียงเจริญเติบโตเต็มที่',
    }
  }
];

function PestCustomModal({ open, setOpen, editingId, form, setForm, save, plots, title }) {
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
    if (!form.pest_or_disease && !form.damage_cause) {
      toast.error('กรุณาระบุศัตรูพืช โรค หรือสาเหตุความเสียหาย');
      return;
    }

    try {
      setSaving(true);
      await save({
        ...form,
        plot_id: Number(form.plot_id),
        log_date: form.log_date || new Date().toISOString().split('T')[0],
        pest_or_disease: form.pest_or_disease || form.damage_cause,
        damage_cause: form.damage_cause || 'หนอน/แมลงศัตรูพืช',
        damaged_count: form.damaged_count === '' || form.damaged_count === null || form.damaged_count === undefined ? 0 : Number(form.damaged_count),
        damage_unit: form.damage_unit || 'ต้น',
        severity: form.severity || 'น้อย',
        treatment_method: form.treatment_method || '',
        worker_name: form.worker_name || 'เจ้าของฟาร์ม',
        notes: form.notes || ''
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
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-rose-50/70 via-white to-amber-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20 shrink-0">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {editingId ? '✏️ แก้ไขบันทึกศัตรูพืช & ความเสียหาย' : '🐛 บันทึกโรค แมลง & ความเสียหายแปลง'}
              </h2>
              <p className="text-[11px] text-rose-800 font-bold flex items-center gap-1.5 mt-0.5">
                <span>มาตรฐาน GAP ข้อ 4 (การควบคุมศัตรูพืชและการตัดยอดผลผลิตเสียหาย)</span>
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
              <div className="bg-gradient-to-br from-rose-50/80 to-amber-50/60 border border-rose-200/80 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-rose-600" />
                    <span>⚡ รายการพบบ่อย (คลิกเดียวกรอกครบอัตโนมัติ):</span>
                  </span>
                  <span className="text-[10px] text-rose-700 font-medium hidden sm:inline">
                    กดเพื่อกรอกอาการและวิธีแก้อัตโนมัติ
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PEST_PRESETS.map((preset) => {
                    const isSelected = selectedPresetName === preset.name;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer active:scale-97 flex flex-col justify-between ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                            : 'bg-white hover:bg-rose-100/60 text-slate-800 border-rose-200/80 hover:border-rose-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="text-base">{preset.icon}</span>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {preset.badge}
                          </span>
                        </div>
                        <div>
                          <div className={`text-xs font-black leading-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {preset.name}
                          </div>
                          <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-rose-100' : 'text-slate-500'}`}>
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
                  แปลงที่พบปัญหา / เสียหาย <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={form.plot_id || ''}
                  onChange={e => setForm({ ...form, plot_id: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-rose-600 focus:ring-1 focus:ring-rose-600 outline-none text-sm cursor-pointer shadow-2xs"
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
                  <span>วันที่ตรวจพบ</span> <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.log_date || new Date().toISOString().split('T')[0]}
                  onChange={e => setForm({ ...form, log_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-rose-600 focus:ring-1 focus:ring-rose-600 outline-none text-sm shadow-2xs"
                />
              </div>
            </div>

            {/* Section 2: Pest & Damage Detail */}
            <div className="space-y-3 p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 border border-slate-200/90">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    สาเหตุความเสียหาย <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={form.damage_cause || 'หนอน/แมลงศัตรูพืช'}
                    onChange={e => setForm({ ...form, damage_cause: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-rose-600 focus:ring-1 focus:ring-rose-600 outline-none text-sm shadow-2xs cursor-pointer"
                  >
                    <option value="หนอน/แมลงศัตรูพืช">🐛 หนอน / แมลงศัตรูพืช</option>
                    <option value="โรคพืช/เชื้อรา/แบคทีเรีย">🍄 โรคพืช / เชื้อรา / แบคทีเรีย</option>
                    <option value="สภาพอากาศ/แดดเผา/น้ำท่วม">☀️ สภาพอากาศ / แดดเผา / น้ำขัง</option>
                    <option value="ต้นแคระแกร็น/คัดทิ้ง">✂️ ต้นแคระแกร็น / คัดแยกทิ้ง</option>
                    <option value="สัตว์รบกวน/นก/หนู">🐀 สัตว์รบกวน / นก / หนู / หอยทาก</option>
                    <option value="อื่นๆ">📦 อื่นๆ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    ศัตรูพืช / โรค / อาการที่พบ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น หนอนกระทู้ผัก, รากเน่าโคนเน่า, เพลี้ยอ่อน"
                    value={form.pest_or_disease || ''}
                    onChange={e => setForm({ ...form, pest_or_disease: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-rose-600 focus:ring-1 focus:ring-rose-600 outline-none text-sm placeholder:text-slate-400 shadow-2xs"
                  />
                </div>
              </div>

              {/* Damaged Count & Severity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Damaged Count Box */}
                <div className="p-3 rounded-xl border border-rose-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      จำนวนต้นที่เสียหาย / คัดทิ้ง
                    </label>
                    <span className="text-[10px] text-rose-600 font-bold">ตัดยอดแปลงออโต้</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.damaged_count ?? ''}
                      onChange={e => setForm({ ...form, damaged_count: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-24 px-3 py-1.5 rounded-lg border border-slate-300 font-black text-center text-sm focus:border-rose-600 outline-none text-rose-700 bg-rose-50/50"
                    />
                    <span className="text-xs font-bold text-slate-700">ต้น</span>
                    <span className="text-[10px] text-slate-400">
                      (ลดจำนวนต้นคงเหลือในรอบปลูก)
                    </span>
                  </div>
                </div>

                {/* Severity Pills */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between">
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    ระดับความรุนแรง
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: 'น้อย', label: 'น้อย', bg: 'hover:bg-teal-50 border-teal-200', active: 'bg-teal-600 text-white border-teal-600' },
                      { key: 'ปานกลาง', label: 'ปานกลาง', bg: 'hover:bg-amber-50 border-amber-200', active: 'bg-amber-500 text-white border-amber-500' },
                      { key: 'รุนแรง', label: 'รุนแรง', bg: 'hover:bg-rose-50 border-rose-200', active: 'bg-rose-600 text-white border-rose-600' },
                    ].map(s => {
                      const isCurrent = (form.severity || 'น้อย') === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setForm({ ...form, severity: s.key })}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition text-center cursor-pointer ${
                            isCurrent ? s.active + ' font-black shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 ' + s.bg
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Treatment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  วิธีจัดการ / กำจัด / แก้ไขปัญหา
                </label>
                <input
                  type="text"
                  placeholder="เช่น เก็บตัวหนอนทิ้ง + พ่นเชื้อบีที, ถอนต้นเป็นโรคออกทำลาย, พ่นน้ำส้มควันไม้"
                  value={form.treatment_method || ''}
                  onChange={e => setForm({ ...form, treatment_method: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-rose-600 focus:ring-1 focus:ring-rose-600 outline-none text-xs sm:text-sm placeholder:text-slate-400 shadow-2xs"
                />
              </div>
            </div>

            {/* Section 3: Worker & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  ผู้ปฏิบัติงาน / ผู้สำรวจ
                </label>
                <input
                  type="text"
                  placeholder="เช่น เจ้าของฟาร์ม หรือชื่อคนงาน"
                  value={form.worker_name || ''}
                  onChange={e => setForm({ ...form, worker_name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold focus:border-rose-600 outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  หมายเหตุเพิ่มเติม (ทางเลือก)
                </label>
                <input
                  type="text"
                  placeholder="ข้อสังเกตเพิ่มเติม เช่น ลามจากแปลงข้างเคียง"
                  value={form.notes || ''}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium focus:border-rose-600 outline-none text-xs"
                />
              </div>
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
              className="px-6 py-2.5 sm:py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
            >
              {saving ? 'กำลังบันทึก...' : editingId ? '💾 บันทึกการแก้ไข' : '🐛 บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Pests() {
  return (
    <LogManager
      title="ศัตรูพืช โรค & บันทึกความเสียหาย (GAP #4)"
      endpoint="pests"
      plotsLookup
      renderModal={(props) => <PestCustomModal {...props} />}
      fields={[
        { key: 'log_date', label: 'วันที่', type: 'date', placeholder: 'เลือกวันที่', required: true },
        { key: 'plot_id', label: 'แปลง', placeholder: '-- เลือกแปลง --', required: true },
        {
          key: 'pest_or_disease',
          label: 'ศัตรูพืช / โรค / อาการ',
          render: (val, r) => (
            <div className="font-bold text-slate-800 text-xs">
              <span className="text-slate-900">{val || r.damage_cause}</span>
              {r.treatment_method && (
                <span className="block text-[10.5px] font-normal text-slate-500 truncate max-w-[200px]">
                  💊 {r.treatment_method}
                </span>
              )}
            </div>
          )
        },
        {
          key: 'damage_cause',
          label: 'สาเหตุ',
          render: (val) => {
            const isPest = String(val).includes('หนอน') || String(val).includes('แมลง');
            const isDisease = String(val).includes('โรค') || String(val).includes('เชื้อรา');
            const isWeather = String(val).includes('อากาศ') || String(val).includes('แดด');
            return (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border whitespace-nowrap shadow-2xs ${
                  isPest
                    ? 'bg-rose-50 text-rose-900 border-rose-300'
                    : isDisease
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : isWeather
                    ? 'bg-sky-50 text-sky-900 border-sky-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {val || 'ศัตรูพืช'}
              </span>
            );
          }
        },
        {
          key: 'damaged_count',
          label: 'ต้นที่เสียหาย',
          render: (val) => {
            const count = Number(val) || 0;
            return count > 0 ? (
              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-bold px-2.5 py-0.5 rounded-lg border border-rose-200 text-xs whitespace-nowrap shadow-2xs">
                ⚠️ {count.toLocaleString()} ต้น
              </span>
            ) : (
              <span className="text-slate-400 text-xs">—</span>
            );
          }
        },
        {
          key: 'severity',
          label: 'ความรุนแรง',
          render: (val) => {
            const isHigh = val === 'รุนแรง';
            const isMed = val === 'ปานกลาง';
            return (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-lg font-bold text-xs border whitespace-nowrap shadow-2xs ${
                  isHigh
                    ? 'bg-rose-100 text-rose-900 border-rose-300'
                    : isMed
                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                    : 'bg-teal-50 text-teal-900 border-teal-300'
                }`}
              >
                {val || 'น้อย'}
              </span>
            );
          }
        },
        { key: 'treatment_method', label: 'วิธีจัดการ / กำจัด', hideInTable: true },
        { key: 'worker_name', label: 'ผู้ปฏิบัติ' },
        { key: 'notes', label: 'หมายเหตุ', type: 'textarea', hideInTable: true },
      ]}
    />
  );
}
