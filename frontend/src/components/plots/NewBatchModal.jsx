import React from 'react';
import { format } from 'date-fns';
import {
  X,
  Sprout,
  CheckCircle2,
  Calendar,
  Sparkles,
  User,
  FileText,
} from 'lucide-react';
import { getTodayLocalStr, formatDateForInput } from '../../utils/plotUtils';

export default function NewBatchModal({
  isOpen,
  onClose,
  plantingMode,
  setPlantingMode,
  form,
  setForm,
  plots,
  crops,
  submitting,
  onSubmit,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl max-w-lg md:max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 md:px-6 md:py-4 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <span>{plantingMode === 'nursery' ? '🌱 บันทึกการเพาะเมล็ด / เพาะกล้า' : '🚜 เริ่มรอบการปลูกใหม่'}</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {plantingMode === 'nursery'
                ? 'บันทึกข้อมูลเมล็ดพันธุ์และการเพาะกล้าลงสมุด GAP ข้อ 4 (รอย้ายลงแปลง)'
                : 'บันทึกลงแปลงปลูกจริงและเปิดรอบการผลิต GAP ข้อ 4'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 space-y-4">
            {/* 1. ตัวเลือกรูปแบบการปลูกตามธรรมชาติของผัก (Dynamic Stage Selector) */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-800">
                เลือกลำดับขั้นตอนตามธรรมชาติของผัก:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option A: เพาะกล้าก่อน */}
                <div
                  onClick={() => {
                    setPlantingMode('nursery');
                    const matched = crops.find(c => String(c.id) === String(form.crop_id));
                    setForm(prev => ({
                      ...prev,
                      seed_prep_date: prev.seed_prep_date || getTodayLocalStr(),
                      notes: matched?.notes || ''
                    }));
                  }}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    plantingMode === 'nursery'
                      ? 'border-teal-600 bg-teal-50/70 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex items-center gap-1.5 font-black text-xs text-teal-900">
                        <Sprout className="w-4 h-4 text-teal-600" />
                        <span>Option A: เพาะกล้าก่อน</span>
                      </span>
                      <input
                        type="radio"
                        name="plantingMode"
                        checked={plantingMode === 'nursery'}
                        onChange={() => {
                          setPlantingMode('nursery');
                          const matched = crops.find(c => String(c.id) === String(form.crop_id));
                          setForm(prev => ({
                            ...prev,
                            seed_prep_date: prev.seed_prep_date || getTodayLocalStr(),
                            notes: matched?.notes || ''
                          }));
                        }}
                        className="w-4 h-4 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] font-bold text-teal-950 mt-1">
                      🌱 เพาะเมล็ด/ถาดหลุมก่อน 10-15 วัน
                    </p>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                      เหมาะสำหรับ: ผักสลัด (กรีนโอ๊ค, เรดโอ๊ค, คอส, ฟิลเล่ย์), มะเขือเทศ ฯลฯ
                    </p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-teal-200/50 flex items-center justify-between text-[10px] text-teal-800 font-bold">
                    <span>สถานะแปลง:</span>
                    <span className="bg-teal-100/90 text-teal-900 px-2 py-0.5 rounded-md">🌱 กำลังเพาะกล้า (รอลงแปลง)</span>
                  </div>
                </div>

                {/* Option B: หยอดเมล็ด / ลงแปลงทันที */}
                <div
                  onClick={() => {
                    setPlantingMode('direct');
                    const found = plots.find(p => p.id === Number(form.plot_id));
                    setForm(prev => ({
                      ...prev,
                      seed_prep_date: found?.seed_prep_date ? formatDateForInput(found.seed_prep_date) : '',
                      notes: ''
                    }));
                  }}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    plantingMode === 'direct'
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex items-center gap-1.5 font-black text-xs text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Option B: หยอดเมล็ด/ลงแปลงทันที</span>
                      </span>
                      <input
                        type="radio"
                        name="plantingMode"
                        checked={plantingMode === 'direct'}
                        onChange={() => {
                          setPlantingMode('direct');
                          const found = plots.find(p => p.id === Number(form.plot_id));
                          setForm(prev => ({
                            ...prev,
                            seed_prep_date: found?.seed_prep_date ? formatDateForInput(found.seed_prep_date) : '',
                            notes: ''
                          }));
                        }}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] font-bold text-emerald-950 mt-1">
                      🚜 หยอดตรงลงดิน หรือ ย้ายกล้าลงแปลง
                    </p>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                      เหมาะสำหรับ: ผักบุ้ง, ผักชี, กวางตุ้ง หรือต้นกล้าที่พร้อมย้ายลงแคร่แล้ว
                    </p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-emerald-200/50 flex items-center justify-between text-[10px] text-emerald-800 font-bold">
                    <span>สถานะแปลง:</span>
                    <span className="bg-emerald-100/90 text-emerald-900 px-2 py-0.5 rounded-md">🟢 กำลังปลูกในแปลง</span>
                  </div>
                </div>
              </div>
            </div>

            {/* แถบแจ้งเตือนถ้าแปลงนี้มีประวัติเพาะกล้าอยู่แล้ว */}
            {(() => {
              const plotFound = plots.find(p => p.id === Number(form.plot_id));
              if (!plotFound || (!plotFound.seed_prep_date && !plotFound.seed_crop_id)) return null;
              return (
                <div className="p-3 bg-teal-50 border border-teal-200/90 rounded-2xl flex items-center justify-between text-xs text-teal-950">
                  <div className="flex items-center gap-2">
                    <Sprout className="w-4 h-4 text-teal-600 shrink-0" />
                    <div>
                      <span className="font-bold">แปลงนี้มีต้นกล้าที่เพาะไว้แล้ว:</span>{' '}
                      <span className="font-extrabold text-teal-900">{plotFound.seed_crop_name || 'ต้นกล้า'}</span>
                      {plotFound.seed_prep_date && (
                        <span className="text-teal-700 font-medium"> (เพาะเมื่อ {format(new Date(plotFound.seed_prep_date), 'dd/MM/yyyy')})</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10.5px] bg-teal-200/80 text-teal-900 px-2 py-0.5 rounded-lg font-black shrink-0">
                    พร้อมย้ายลงแปลง
                  </span>
                </div>
              );
            })()}

            {/* 2. ฟอร์มตาม Option ที่เลือก */}
            {plantingMode === 'nursery' ? (
              /* ฟอร์มสำหรับการเพาะเมล็ด / เพาะกล้าก่อนลงแปลง */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* เลือกแปลงที่จะรองรับ */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    เลือกแปลง/แคร่ปลูกที่จะรองรับ (จาก {plots.length} แปลง)
                  </label>
                  <select
                    required
                    value={form.plot_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const found = plots.find(p => p.id === Number(selectedId));
                      setForm(prev => ({
                        ...prev,
                        plot_id: selectedId,
                        soil_recipe: found?.soil_recipe || prev.soil_recipe,
                        soil_prep_date: found?.soil_prep_date
                          ? formatDateForInput(found.soil_prep_date)
                          : prev.soil_prep_date
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-teal-300 bg-white text-slate-900 font-bold focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm"
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

                {/* เลือกชนิดผักที่เพาะ */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">เลือกชนิดผักที่ต้องการเพาะเมล็ด</label>
                  <select
                    required
                    value={form.crop_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = crops.find(c => String(c.id) === String(val));
                      setForm(prev => ({
                        ...prev,
                        crop_id: val,
                        notes: matched?.notes || ''
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-teal-300 bg-white text-slate-900 font-bold focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm"
                  >
                    <option value="">-- เลือกชนิดผัก --</option>
                    {crops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.category}) — อายุเต็มวัย {c.growth_days} วัน
                      </option>
                    ))}
                  </select>
                </div>

                {/* วันที่เริ่มเพาะเมล็ด */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>วันที่เริ่มเพาะเมล็ด / เพาะกล้า</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.seed_prep_date || form.start_date}
                    onChange={(e) => setForm({ ...form, seed_prep_date: e.target.value, start_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-teal-300 bg-white text-slate-900 font-bold focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    * บันทึกลงสมุด GAP ข้อ 4 ใช้คำนวณอายุเก็บเกี่ยวเมื่อย้ายลงแปลง
                  </span>
                </div>

                {/* ผู้ปฏิบัติงาน */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">ผู้ปฏิบัติงาน / ผู้บันทึก</label>
                  <input
                    type="text"
                    value={form.operator_name ?? ''}
                    onChange={(e) => setForm({ ...form, operator_name: e.target.value })}
                    placeholder="ชื่อผู้ปฏิบัติงาน / เจ้าของฟาร์ม"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-teal-300 bg-white text-slate-900 font-bold focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm"
                  />
                </div>

                {/* รายละเอียด / วิธีการเพาะ */}
                <div className="md:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-teal-600" />
                      <span>วิธีการเพาะเมล็ด / บันทึกการจัดการกล้า (GAP ข้อ 4)</span>
                    </label>
                    {(() => {
                      const matched = crops.find((c) => String(c.id) === String(form.crop_id));
                      if (!matched?.notes) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, notes: matched.notes }))}
                          className="text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-100/70 hover:bg-teal-200/80 px-2.5 py-0.5 rounded-lg border border-teal-300 transition cursor-pointer flex items-center gap-1"
                          title="ดึงข้อมูลวิธีการเพาะจากคลังชนิดผักอีกครั้ง"
                        >
                          <Sparkles className="w-3 h-3 text-teal-600" />
                          <span>ดึงจากคลังชนิดผัก</span>
                        </button>
                      );
                    })()}
                  </div>
                  <textarea
                    rows={3}
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="ดึงจากคลังชนิดผักอัตโนมัติ หรือพิมพ์ระบุ เช่น แช่น้ำอุ่น 3 ชม. เทน้ำออก ผสมดิน หรือเพาะในกล่องปิดทิชชูหมาด 7 วัน..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-teal-300 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-xs sm:text-sm leading-relaxed"
                  />
                  <p className="text-[10.5px] text-teal-700 font-medium">
                    * ดึงข้อมูลวิธีเพาะเมล็ดจากคลังชนิดผักอัตโนมัติ (สามารถแก้ไขเพิ่มเติมตามการทำจริงได้)
                  </p>
                </div>
              </div>
            ) : (
              /* ฟอร์มสำหรับการหยอดเมล็ด / ลงแปลงปลูกทันที */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">เลือกแปลงปลูก (จาก {plots.length} แปลง)</label>
                  <select
                    required
                    value={form.plot_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const found = plots.find(p => p.id === Number(selectedId));
                      setForm(prev => ({
                        ...prev,
                        plot_id: selectedId,
                        crop_id: found?.seed_crop_id || prev.crop_id,
                        seed_prep_date: found?.seed_prep_date
                          ? formatDateForInput(found.seed_prep_date)
                          : '',
                        soil_recipe: found?.soil_recipe || prev.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
                        soil_prep_date: found?.soil_prep_date
                          ? formatDateForInput(found.soil_prep_date)
                          : (prev.soil_prep_date || getTodayLocalStr())
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
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        crop_id: val,
                        notes: ''
                      }));
                    }}
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



                {/* วันที่เริ่มปลูกลงแปลง */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>วันที่เริ่มลงแปลงปลูก</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                  />
                  <span className="text-[10.5px] text-slate-400 block mt-1">
                    * วันที่หว่านเมล็ดลงแคร่ หรือวันที่ย้ายกล้าลงแปลงจริง
                  </span>
                </div>

                {/* ผู้ปฏิบัติงาน / ผู้บันทึก */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ผู้ปฏิบัติงาน / ผู้บันทึก</span>
                  </label>
                  <input
                    type="text"
                    value={form.operator_name ?? ''}
                    onChange={(e) => setForm({ ...form, operator_name: e.target.value })}
                    placeholder="ชื่อผู้ปฏิบัติงาน / เจ้าของฟาร์ม"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                  />
                  <span className="text-[10.5px] text-slate-400 block mt-1">
                    * ผู้รับผิดชอบตามมาตรฐาน GAP
                  </span>
                </div>

                {/* บันทึกการปฏิบัติงานจริง (รายละเอียดการลงแปลง) */}
                <div className="md:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>บันทึกการปฏิบัติงานจริง (รายละเอียดการลงแปลง)</span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      * บันทึกลงสมุด GAP ข้อ 4
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="เช่น หว่านเมล็ดผักบุ้ง 3 ขีดใน 1 แคร่ รดน้ำเช้าเย็น"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-xs sm:text-sm leading-relaxed"
                  />

                  {/* Preset Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10.5px] font-bold text-slate-500">ตัวอย่างบันทึกด่วน:</span>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, notes: 'หว่านเมล็ดผักบุ้ง 3 ขีดใน 1 แคร่ รดน้ำเช้าเย็น' }))}
                      className="text-[10.5px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      🌱 หว่านเมล็ดผักบุ้ง 3 ขีดใน 1 แคร่ รดน้ำเช้าเย็น
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, notes: 'ย้ายต้นกล้า 200 ต้นลงแคร่ปลูก รดน้ำเช้า-เย็น' }))}
                      className="text-[10.5px] font-semibold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      🌿 ย้ายต้นกล้า 200 ต้นลงแคร่ รดน้ำเช้า-เย็น
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, notes: 'หยอดเมล็ดแถวละ 10 ซม. คลุมฟางบางๆ รดน้ำชุ่มเช้า-เย็น' }))}
                      className="text-[10.5px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      🌾 คลุมฟาง รดน้ำชุ่ม
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fixed Footer Buttons */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 sm:py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-2.5 sm:py-3 rounded-xl text-white font-black text-xs sm:text-sm shadow-md disabled:opacity-50 cursor-pointer transition-colors ${
                plantingMode === 'nursery'
                  ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              {submitting
                ? 'กำลังบันทึก...'
                : plantingMode === 'nursery'
                ? '🌱 บันทึกการเพาะกล้า (รอลงแปลง)'
                : '✓ เริ่มรอบการปลูก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
