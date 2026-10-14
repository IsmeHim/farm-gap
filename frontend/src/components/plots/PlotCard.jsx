import React from 'react';
import { format } from 'date-fns';
import {
  Droplets,
  Trash2,
  Edit3,
  Sprout,
  Calendar,
  Sparkles,
  Clock,
  ShoppingBag,
  List,
  RotateCcw,
} from 'lucide-react';
import { getBatchProgressInfo, getDaysPlanted, parseDateMidnight } from '../../utils/plotUtils';

export default function PlotCard({
  plot,
  currentBatch,
  onToggleAutoWater,
  onDeletePlot,
  deletingPlotId,
  onOpenSoilModal,
  onOpenTimeline,
  onOpenNurseryModal,
  onHarvest,
  onOpenEditBatch,
  onCancelBatch,
  cancellingBatchId,
  onOpenModalWithPlot,
}) {
  const p = plot;
  // สถานะของแปลง:
  // 1. มีผักลงแปลงแล้ว (Growing / Harvest Ready)
  const hasCrop = (p.status === 'growing' || p.status === 'harvest_ready') && p.crop_name && p.crop_name !== '-';
  const progressInfo = hasCrop ? getBatchProgressInfo(currentBatch, p) : null;
  const daysPlanted = progressInfo?.daysPlanted ?? 0;

  // 2. อยู่ระหว่างเพาะกล้า (Nursery Pending) - บันทึกเมล็ด/กล้าไว้แล้ว แต่ยังไม่ได้ย้ายลงแปลง
  const isNurseryPending = !hasCrop && Boolean(p.seed_prep_date || p.seed_crop_id);

  // 3. พร้อมเก็บเกี่ยว: ถึง 100% หรือสถานะ harvest_ready
  const isHarvestReady = hasCrop && (
    p.status === 'harvest_ready' ||
    currentBatch?.status === 'harvest_ready' ||
    (progressInfo && (progressInfo.percent >= 100 || progressInfo.daysLeft === 0))
  );
  const isGrowing = hasCrop && !isHarvestReady;
  const isEmpty = !hasCrop && !isNurseryPending;

  return (
    <div
      className={`bg-white rounded-3xl transition-all duration-300 overflow-hidden flex flex-col justify-between ${
        isHarvestReady
          ? 'border-2 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.30)] ring-1 ring-amber-300/50 hover:shadow-[0_0_26px_rgba(245,158,11,0.45)]'
          : isGrowing
          ? 'border-2 border-emerald-500/80 shadow-[0_0_16px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/30 hover:shadow-[0_0_22px_rgba(16,185,129,0.32)]'
          : isNurseryPending
          ? 'border-2 border-teal-400/80 shadow-[0_0_15px_rgba(20,184,166,0.20)] ring-1 ring-teal-300/30 hover:shadow-[0_0_20px_rgba(20,184,166,0.28)]'
          : 'border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300'
      }`}
    >
      <div>
        {/* 1. ส่วน Header แปลง & สถานะ & ระบบรดน้ำ (Top Plot Header Bar) */}
        <div className={`p-3.5 pb-2.5 flex items-center justify-between border-b transition-colors ${
          isHarvestReady
            ? 'border-amber-100 bg-amber-50/60'
            : isGrowing
            ? 'border-emerald-100 bg-emerald-50/40'
            : isNurseryPending
            ? 'border-teal-100 bg-teal-50/40'
            : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-800 text-white font-black text-xs flex items-center justify-center shadow-xs">
              #{p.plot_number || p.id}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-slate-900 text-sm leading-tight">
                  {p.name}
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {p.dimension || 'แคร่ 2 x 6 ม.'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* ปุ่มรดน้ำออโต้ */}
            <button
              type="button"
              onClick={() => onToggleAutoWater(p.id)}
              title={p.auto_water_enabled !== 0 ? 'คลิกเพื่องดรดน้ำอัตโนมัติ' : 'คลิกเพื่อเปิดโหมดรดน้ำอัตโนมัติ'}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer shadow-2xs ${
                p.auto_water_enabled !== 0
                  ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
              }`}
            >
              <Droplets className="w-3 h-3 text-current" />
              <span>{p.auto_water_enabled !== 0 ? 'ออโต้' : 'เว้นน้ำ'}</span>
            </button>

            {/* สถานะแปลง Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                isHarvestReady
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : isGrowing
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : (p.seed_prep_date || p.seed_crop_id)
                  ? 'bg-teal-100 text-teal-900 border-teal-300'
                  : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                isHarvestReady ? 'bg-amber-500 animate-pulse' :
                isGrowing ? 'bg-emerald-500' :
                (p.seed_prep_date || p.seed_crop_id) ? 'bg-teal-500' : 'bg-slate-400'
              }`} />
              <span>
                {isHarvestReady
                  ? 'พร้อมเก็บเกี่ยว'
                  : isGrowing
                  ? 'กำลังปลูก'
                  : (p.seed_prep_date || p.seed_crop_id)
                  ? 'เพาะกล้าแล้ว'
                  : 'ว่าง'}
              </span>
            </span>

            {/* ปุ่มลบแปลงถ้าเป็นแปลงว่าง */}
            {isEmpty && (
              <button
                type="button"
                onClick={() => onDeletePlot(p)}
                disabled={deletingPlotId === p.id}
                title={`ลบ ${p.name}`}
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 2. กล่องแสดงสูตรดินประจำแคร่ (GAP ข้อ 2) */}
        <div className="p-3.5 pb-2">
          <div className="rounded-2xl p-3 border bg-gradient-to-br from-amber-50/70 via-stone-50/90 to-amber-50/40 border-amber-200/90 text-xs shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-amber-950 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                <span>สูตรดิน (GAP ข้อ 2)</span>
              </span>
              <div className="flex items-center gap-1">
                {p.soil_prep_date ? (
                  <span className="font-semibold text-amber-800 text-[10px] bg-amber-100/80 px-1.5 py-0.2 rounded border border-amber-300">
                    ✓ {format(new Date(p.soil_prep_date), 'dd/MM/yy')}
                  </span>
                ) : (
                  <span className="font-bold text-orange-700 text-[10px] bg-orange-100 px-1.5 py-0.2 rounded border border-orange-300">
                    รอเตรียมดิน
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenSoilModal(p)}
                  className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-amber-800 hover:text-amber-950 hover:bg-amber-200/70 px-1.5 py-0.5 rounded transition cursor-pointer"
                  title="ปรับปรุงสูตรดินและวันที่เตรียมแคร่"
                >
                  <Edit3 className="w-3 h-3 text-amber-700" />
                  <span>ปรับสูตร</span>
                </button>
              </div>
            </div>

            {/* ข้อความสูตรดิน */}
            <p className="text-[11px] leading-relaxed text-stone-700 font-medium line-clamp-2">
              {p.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)'}
            </p>
          </div>
        </div>

        {/* 3. ส่วนข้อมูลการเพาะปลูก & รอบการผลิต (Crop Info & Timeline Details) */}
        <div className="px-3.5 pb-3 space-y-2.5">
          {/* ชื่อพืช & Batch Code */}
          <div className="flex items-center justify-between gap-1 pt-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`p-1.5 rounded-xl shrink-0 ${
                hasCrop ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
              }`}>
                <Sprout className="w-4 h-4" />
              </span>
              <div className="truncate">
                <h4 className="font-black text-slate-900 text-sm truncate">
                  {hasCrop ? p.crop_name : (p.seed_crop_name ? `🌱 ${p.seed_crop_name}` : 'แปลงว่าง (ยังไม่ได้ปลูก)')}
                </h4>
                {currentBatch?.batch_code && (
                  <span className="text-[10px] font-mono text-slate-400 font-medium">
                    {currentBatch.batch_code}
                  </span>
                )}
              </div>
            </div>

            {/* ประวัติรอบก่อนหน้าสำหรับแปลงว่าง */}
            {isEmpty && p.past_batches && p.past_batches.length > 0 && (
              <span className="text-[10.5px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80 shrink-0">
                เคยเก็บ {p.past_batches.length} รอบ
              </span>
            )}
          </div>

          {/* อายุพืช & Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px] font-medium">
                {hasCrop ? 'อายุพืช' : isNurseryPending ? 'อายุต้นกล้า' : 'ยังไม่ได้ปลูก'}
              </span>
              <span className="font-extrabold text-slate-800 text-[11.5px]">
                {hasCrop && progressInfo ? (
                  `${progressInfo.plantAge || 0} / ${progressInfo.growthDays || 30} วัน`
                ) : isNurseryPending && p.seed_prep_date ? (
                  `${getDaysPlanted(p.seed_prep_date)} วัน (ระยะกล้า)`
                ) : (
                  '0 / 30 วัน'
                )}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isHarvestReady
                    ? 'bg-amber-500 animate-pulse'
                    : hasCrop
                    ? 'bg-emerald-600'
                    : isNurseryPending
                    ? 'bg-teal-500'
                    : 'bg-slate-200'
                }`}
                style={{
                  width: `${hasCrop && progressInfo ? Math.min(100, Math.max(5, progressInfo.percent)) : isNurseryPending && p.seed_prep_date ? Math.min(100, Math.max(8, Math.round((getDaysPlanted(p.seed_prep_date) / (p.growth_days || 30)) * 100))) : 0}%`
                }}
              />
            </div>
          </div>

          {/* ตารางคู่วันที่: ปลูกเมื่อ & คาดเก็บเกี่ยว */}
          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100 text-xs">
            {isNurseryPending ? (
              <>
                <div className="bg-teal-50/80 rounded-xl p-2 border border-teal-200/70">
                  <div className="flex items-center gap-1 text-teal-700 text-[10.5px] font-bold">
                    <Sprout className="w-3 h-3 text-teal-600" />
                    <span>เพาะเมล็ดเมื่อ</span>
                  </div>
                  <p className="font-extrabold text-teal-950 text-[11.5px] mt-0.5">
                    {p.seed_prep_date ? format(new Date(p.seed_prep_date), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>

                <div className="bg-teal-50/80 rounded-xl p-2 border border-teal-200/70">
                  <div className="flex items-center gap-1 text-teal-700 text-[10.5px] font-bold">
                    <Sparkles className="w-3 h-3 text-teal-600" />
                    <span>สถานะกล้า</span>
                  </div>
                  <p className="font-extrabold text-teal-900 text-[11.5px] mt-0.5">
                    🌱 รอย้ายลงแปลง
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-200/70">
                  <div className="flex items-center gap-1 text-slate-400 text-[10.5px] font-medium">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>ปลูกเมื่อ</span>
                  </div>
                  <p className="font-extrabold text-slate-800 text-[11.5px] mt-0.5">
                    {hasCrop && p.planting_date ? format(new Date(p.planting_date), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>

                <div className={`rounded-xl p-2 border ${
                  isHarvestReady
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-slate-50/80 border-slate-200/70 text-slate-800'
                }`}>
                  <div className="flex items-center gap-1 text-slate-400 text-[10.5px] font-medium">
                    <Sparkles className="w-3 h-3 text-slate-400" />
                    <span>คาดเก็บเกี่ยว</span>
                  </div>
                  <p className={`font-extrabold text-[11.5px] mt-0.5 ${isHarvestReady ? 'text-amber-900 font-black' : 'text-slate-800'}`}>
                    {hasCrop ? (
                      progressInfo?.effectiveExpectedDate
                        ? format(parseDateMidnight(progressInfo.effectiveExpectedDate), 'dd/MM/yyyy')
                        : (p.expected_harvest_date ? format(new Date(p.expected_harvest_date), 'dd/MM/yyyy') : '-')
                    ) : '-'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* แถบสรุปกิจกรรม GAP ย่อย */}
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
            <span className="flex items-center gap-1 truncate">
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>กิจกรรม GAP: {p.activities?.length || 0} รายการ</span>
            </span>
            {hasCrop && (
              <button
                type="button"
                onClick={() => onOpenTimeline(p)}
                className="text-emerald-700 hover:text-emerald-900 font-bold shrink-0 hover:underline cursor-pointer"
              >
                ดูไทม์ไลน์
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. ส่วนปุ่มกด Action ล่างสุด */}
      <div className="p-3.5 pt-0">
        {hasCrop ? (
          /* 1. แปลงที่กำลังปลูก: [✏️ บันทึกกิจกรรม] คู่กับ [🧺 เก็บเกี่ยว] */
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 items-stretch">
              <button
                type="button"
                onClick={() => onOpenNurseryModal(p)}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>บันทึกกิจกรรม</span>
              </button>

              <button
                type="button"
                onClick={() => onHarvest(p.id)}
                className={`inline-flex items-center justify-center gap-1.5 h-10 px-2.5 rounded-xl text-xs font-bold transition shadow-md cursor-pointer active:scale-95 border whitespace-nowrap ${
                  isHarvestReady
                    ? 'bg-amber-500 hover:bg-amber-600 text-white font-bold border-amber-400 shadow-amber-500/25'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-600 shadow-emerald-700/20'
                }`}
                title="สามารถเก็บผลผลิตเข้าคลังได้ตลอดเวลา"
              >
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <span>เก็บผลผลิต</span>
              </button>
            </div>

            {/* แถบเครื่องมือรอง: [ดูประวัติแปลง] | [แก้ไขรอบปลูก] | [ยกเลิกรอบปลูก] */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => onOpenTimeline(p)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-2 py-0.5 rounded-lg transition cursor-pointer"
              >
                <List className="w-3 h-3 text-slate-400" />
                <span>ดูประวัติ</span>
              </button>

              {!isHarvestReady && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenEditBatch(currentBatch, p)}
                    className="inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-500 hover:text-emerald-700 hover:bg-slate-50 px-1.5 py-0.5 rounded-lg transition cursor-pointer"
                    title="แก้ไขข้อมูลรอบการปลูกนี้"
                  >
                    <Edit3 className="w-3 h-3 text-slate-400" />
                    <span>แก้ไข</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onCancelBatch(currentBatch, p)}
                    disabled={cancellingBatchId === (currentBatch?.id || p.id)}
                    className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-1.5 py-0.5 rounded-lg transition cursor-pointer disabled:opacity-50"
                    title="ยกเลิกรอบปลูกและรีเซ็ตแปลงกลับเป็นว่าง"
                  >
                    <RotateCcw className="w-3 h-3 text-rose-400" />
                    <span>{cancellingBatchId === (currentBatch?.id || p.id) ? 'ยกเลิก...' : 'ยกเลิก'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : isNurseryPending ? (
          /* 2. แปลงที่กำลังเพาะกล้า (รอลงแปลง): [✏️ บันทึกกิจกรรมกล้า] คู่กับ [🚜 ย้ายกล้าลงแปลง] */
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 items-stretch">
              <button
                type="button"
                onClick={() => onOpenNurseryModal(p)}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-2.5 rounded-xl bg-white border border-teal-300 hover:bg-teal-50 text-teal-900 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
                title="บันทึกกิจกรรมต้นกล้า เช่น รดน้ำต้นกล้า ย้ายถาดหลุม พ่นชีวภัณฑ์"
              >
                <Edit3 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>บันทึกกิจกรรมกล้า</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenModalWithPlot(p.id, 'direct')}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-md shadow-emerald-700/20 cursor-pointer active:scale-95 whitespace-nowrap"
                title="ต้นกล้าพร้อมแล้ว ย้ายลงแปลงปลูกจริง"
              >
                <Sprout className="w-3.5 h-3.5 shrink-0" />
                <span>ย้ายกล้าลงแปลง</span>
              </button>
            </div>

            {/* แถบเครื่องมือรอง: [ดูประวัติแปลง] | [ยกเลิกการเพาะกล้า] */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => onOpenTimeline(p)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-2 py-0.5 rounded-lg transition cursor-pointer"
              >
                <List className="w-3 h-3 text-slate-400" />
                <span>ดูประวัติ</span>
              </button>

              <button
                type="button"
                onClick={() => onCancelBatch(null, p)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded-lg transition cursor-pointer"
                title="ยกเลิกกิจกรรมต้นกล้าและคืนสถานะแปลงว่าง"
              >
                <RotateCcw className="w-3 h-3 text-rose-400" />
                <span>ยกเลิกต้นกล้า</span>
              </button>
            </div>
          </div>
        ) : (
          /* 3. แปลงว่างเอี่ยม: [📋 ดูประวัติแปลง] คู่กับ [🌱 เริ่มรอบปลูก] + [✏️ บันทึกกิจกรรม] ด้านล่าง */
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 items-stretch">
              <button
                type="button"
                onClick={() => onOpenTimeline(p)}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <List className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>ดูประวัติแปลง</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenModalWithPlot(p.id)}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-md shadow-emerald-700/20 cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Sprout className="w-3.5 h-3.5 shrink-0" />
                <span>เริ่มรอบปลูก</span>
              </button>
            </div>

            {/* แถบเครื่องมือรองใต้ปุ่มดูประวัติแปลง เพื่อให้ความสูงและการจัดวางเท่ากันทุกแปลง */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => onOpenNurseryModal(p)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-0.5 rounded-lg transition cursor-pointer"
                title="บันทึกกิจกรรมเตรียมแปลง หรือเพาะเมล็ดก่อนเริ่มรอบปลูก"
              >
                <Edit3 className="w-3 h-3 text-slate-400" />
                <span>บันทึกกิจกรรม</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
