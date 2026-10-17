import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Sparkles,
  X,
  CheckCircle2,
  ExternalLink,
  PackageCheck,
  Store,
  Layers,
  AlertTriangle,
  Sprout,
  Clock,
  Calendar,
} from 'lucide-react';
import { getCropCycleId } from '../../lib/cropCycle';

export default function SmartHarvestModal({
  isOpen,
  onClose,
  successResult,
  setSuccessResult,
  onSubmit,
  form,
  setForm,
  submitting,
  plots,
  crops,
  batches,
  products,
  getPlotProgressInfo,
}) {
  if (!isOpen) return null;

  const selectedPlot = plots.find((p) => p.id === Number(form.plot_id));
  const activePlots = plots.filter(
    (p) =>
      (p.status === 'growing' || p.status === 'harvest_ready') &&
      p.crop_name &&
      p.crop_name !== '-'
  );
  const emptyPlots = plots.filter((p) => !activePlots.some((ap) => ap.id === p.id));

  // Categorize active plots by ready vs growing
  const readyPlots = [];
  const growingPlots = [];

  activePlots.forEach((p) => {
    const currentBatch = batches.find(
      (b) => b.plot_id === p.id && (b.status === 'growing' || b.status === 'harvest_ready')
    );
    const prog = getPlotProgressInfo(p, currentBatch);
    const remaining =
      currentBatch?.remaining_count ??
      p.remaining_count ??
      0;
    if (prog.isReady) {
      readyPlots.push({ plot: p, batch: currentBatch, prog, remaining });
    } else {
      growingPlots.push({ plot: p, batch: currentBatch, prog, remaining });
    }
  });

  const matchedProduct = selectedPlot
    ? products.find((pr) => {
        const crop = selectedPlot.crop_name || '';
        return (
          pr.name?.toLowerCase().includes(crop.toLowerCase()) ||
          crop.toLowerCase().includes(pr.name?.toLowerCase())
        );
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header (Pinned Top) */}
        <div className="px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-100 flex items-start justify-between shrink-0 bg-white">
          <div className="space-y-0.5 pr-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-100 text-amber-900 shrink-0">
                <Sparkles className="w-4 h-4 text-amber-700 fill-current" />
              </span>
              <h3 className="font-black text-slate-800 text-base sm:text-lg leading-tight">
                บันทึกเก็บผลผลิตอัจฉริยะ (Smart Harvest)
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500">
              ระบบจะบันทึกมาตรฐาน GAP ปรับสถานะแปลง และโยกผลผลิตเข้าสต็อกขายหน้าร้าน LINE ให้อัตโนมัติ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If Already Submitted and Success Result is available */}
        {successResult ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-emerald-900 text-base">
                  บันทึกการเก็บผลผลิตและอัปเดตสต็อกเรียบร้อย!
                </h4>
                <p className="text-xs text-emerald-700">{successResult.message}</p>
              </div>

              {/* Lot Code & QR Traceability Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                    `${window.location.origin}/trace/${successResult.lot_code}`
                  )}`}
                  alt="Trace QR Code"
                  className="w-24 h-24 bg-white p-1 rounded-xl border border-slate-200 shadow-xs shrink-0"
                />
                <div className="space-y-1 text-xs">
                  <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    GAP Lot Code
                  </div>
                  <div className="font-mono font-bold text-sm text-slate-800">
                    {successResult.lot_code}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    สแกนเพื่อเปิดดูประวัติแปลง การใช้น้ำ และความปลอดภัยมาตรฐาน GAP
                  </p>
                  <div className="pt-1 flex gap-2 justify-center sm:justify-start">
                    <a
                      href={`/trace/${successResult.lot_code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      เปิดหน้าตรวจสอบย้อนกลับ <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Destination & Mode Summary */}
              {successResult.destination === 'cold_storage' ? (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 text-xs text-blue-900 flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>
                    ❄️ ผลผลิตถูกนำเข้าพักใน{' '}
                    <strong>ตู้เย็น / ห้องเย็นพักผักฟาร์ม (GAP ข้อ 5)</strong> เรียบร้อย
                    (เมื่อพร้อมจำหน่ายสามารถกดปุ่ม [📦 ลงสต็อกสินค้า] ที่ท้ายแถวในตารางหน้านี้ได้ทันที)
                  </span>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>🛒 ผลผลิตพร้อมจำหน่ายหน้าร้าน LINE Shop ทันที</span>
                </div>
              )}

              {successResult.is_partial && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 flex items-center gap-2">
                  <span className="text-base">🌱</span>
                  <span>
                    <strong>ทยอยเก็บเกี่ยวบางส่วน:</strong> แปลงและรอบปลูกยังคงสถานะ{' '}
                    <strong>กำลังปลูก</strong> ต่อ เพื่อรอตัดต้นที่เหลือ
                  </span>
                </div>
              )}

              {/* Synced Product Summary */}
              {successResult.product && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-600" />
                    <span>
                      สต็อกสินค้า <strong>{successResult.product.name}</strong>: ปัจจุบันมี{' '}
                      <strong>{successResult.product.stock_quantity} ถุง</strong> (เพิ่มขึ้น +
                      {successResult.product.added_stock} ถุง)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setSuccessResult(null);
                }}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition shadow cursor-pointer"
              >
                เรียบร้อย (ปิดหน้าต่าง)
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* 1. Select Plot */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-700" />
                    <span>เลือกแปลงที่ต้องการเก็บผลผลิต</span> <span className="text-rose-500">*</span>
                  </label>
                  {activePlots.length > 0 && (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      แปลงมีผัก {activePlots.length} แปลง (พร้อมเก็บ {readyPlots.length} แปลง)
                    </span>
                  )}
                </div>

                {activePlots.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 space-y-2">
                    <div className="flex items-center gap-2 font-black text-amber-950">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>ไม่มีแปลงที่กำลังปลูกผักในขณะนี้ (ทุกแปลงว่าง)</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      กรุณาเริ่มรอบการปลูกใหม่ที่หน้า "แปลงปลูก & รอบการผลิต" ก่อน จึงจะสามารถบันทึกการเก็บเกี่ยวได้
                    </p>
                    <div className="pt-1">
                      <Link
                        to="/plots"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        <Sprout className="w-3.5 h-3.5" />
                        <span>ไปที่หน้าแปลงปลูกเพื่อเริ่มรอบใหม่</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <select
                    required
                    value={form.plot_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, plot_id: e.target.value }))}
                    className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white font-medium text-slate-800 shadow-xs"
                  >
                    <option value="">-- กรุณาเลือกแปลงปลูกที่มีผัก --</option>

                    {/* กลุ่มที่ 1: พร้อมเก็บเกี่ยว (100%) */}
                    {readyPlots.length > 0 && (
                      <optgroup label="✨ แปลงที่พร้อมเก็บเกี่ยวแล้ว (100%)">
                        {readyPlots.map(({ plot: p, remaining }) => (
                          <option key={p.id} value={p.id}>
                            🟢 {p.name} — {p.crop_name} (คงเหลือ {Number(remaining).toLocaleString()} ต้น • พร้อมเก็บ 100%)
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {/* กลุ่มที่ 2: กำลังปลูก (ยังไม่ครบวันแต่สามารถเก็บเกี่ยวได้) */}
                    {growingPlots.length > 0 && (
                      <optgroup label="🌱 แปลงที่กำลังปลูก (อยู่ระหว่างการเติบโต)">
                        {growingPlots.map(({ plot: p, remaining, prog }) => (
                          <option key={p.id} value={p.id}>
                            🟡 {p.name} — {p.crop_name} (คงเหลือ {Number(remaining).toLocaleString()} ต้น • โต {prog.percent}% เหลือ ~{prog.daysLeft} วัน)
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {/* กลุ่มที่ 3: แปลงว่าง (ปิดการเลือก ป้องกันกดผิด) */}
                    {emptyPlots.length > 0 && (
                      <optgroup label="⚪ แปลงว่าง (ยังไม่ได้ลงปลูก - ไม่สามารถเก็บเกี่ยวได้)">
                        {emptyPlots.map((p) => (
                          <option key={p.id} value={p.id} disabled className="text-slate-400 bg-slate-100">
                            ⚪ {p.name} (แปลงว่าง - ไม่มีผักปลูก)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>

              {/* Plot Quick Info */}
              {selectedPlot && selectedPlot.crop_name && selectedPlot.crop_name !== '-' && (() => {
                const currentBatch = batches.find(
                  (b) => b.plot_id === selectedPlot.id && (b.status === 'growing' || b.status === 'harvest_ready')
                );
                const remaining =
                  currentBatch?.remaining_count ??
                  selectedPlot.remaining_count ??
                  0;
                const prog = getPlotProgressInfo(selectedPlot, currentBatch);
                const matchedCrop = crops.find(
                  (c) =>
                    selectedPlot.crop_name.toLowerCase().includes(c.name.toLowerCase()) ||
                    c.name.toLowerCase().includes(selectedPlot.crop_name.toLowerCase())
                );

                return (
                  <div className="p-3.5 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 space-y-2.5 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-xl shrink-0 shadow-xs">
                          {matchedCrop?.icon || '🥬'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-slate-900">{selectedPlot.crop_name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {selectedPlot.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            วันลงปลูก: {selectedPlot.planting_date ? format(new Date(selectedPlot.planting_date), 'dd/MM/yyyy') : '-'}
                          </div>
                        </div>
                      </div>

                      <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-100/90 text-amber-900 border border-amber-300 shrink-0">
                        #{getCropCycleId(selectedPlot)} (รอบที่ {selectedPlot.cycle_number || 1})
                      </span>
                    </div>

                    {/* Progress Indicator & Status Bar */}
                    <div className="pt-2 border-t border-emerald-200/70 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${prog.isReady ? 'text-emerald-600' : 'text-amber-500'}`} />
                          <span>สถานะความพร้อม:</span>
                        </span>
                        {prog.isReady ? (
                          <span className="font-black text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            พร้อมเก็บเกี่ยวแล้ว (100%)
                          </span>
                        ) : (
                          <span className="font-bold text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-amber-600" />
                            โต {prog.percent}% (เหลืออีก ~{prog.daysLeft} วัน)
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            prog.isReady ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, prog.percent))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* โหมดการเก็บเกี่ยว: ทยอยเก็บเกี่ยว VS ปิดรอบแปลง */}
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <label className="text-xs font-bold text-slate-800 block">รูปแบบการเก็บเกี่ยว</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, is_partial: false }))}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      !form.is_partial
                        ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 font-bold'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <span>🧹 เก็บเกี่ยวหมดแปลง (ปิดรอบ)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 font-normal">
                      ตัดหมดแปลง ปิดรอบการปลูก และรีเซ็ตแปลงเป็น "ว่าง"
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const currentBatch = batches.find(
                        (b) => b.plot_id === Number(form.plot_id) && (b.status === 'growing' || b.status === 'harvest_ready')
                      );
                      const currentRemaining =
                        currentBatch?.remaining_count ??
                        selectedPlot?.remaining_count ??
                        '';
                      setForm((prev) => ({
                        ...prev,
                        is_partial: true,
                        harvested_plants_count:
                          prev.harvested_plants_count || (currentRemaining ? String(currentRemaining) : ''),
                      }));
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      form.is_partial
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/40 text-emerald-950 font-bold'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <span>🌱 ทยอยเก็บเกี่ยวบางส่วน</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 font-normal">
                      ตัดเฉพาะต้นที่พร้อม แปลงยังคงสถานะ "กำลังปลูก" ต่อ
                    </p>
                  </button>
                </div>

                {form.is_partial && (() => {
                  const currentBatch = batches.find(
                    (b) => b.plot_id === Number(form.plot_id) && (b.status === 'growing' || b.status === 'harvest_ready')
                  );
                  const currentRem = Number(
                    currentBatch?.remaining_count ??
                    selectedPlot?.remaining_count ??
                    0
                  );
                  const harvestNum = Number(form.harvested_plants_count || 0);
                  const willDrainPlot = currentRem > 0 && harvestNum >= currentRem;

                  return (
                    <div className="pt-2 border-t border-slate-200/80">
                      <label className="text-[11px] font-bold text-emerald-900 block mb-1">
                        จำนวนต้นที่ตัดในรอบนี้ (ต้น){' '}
                        {currentRem > 0 && (
                          <span className="text-slate-500 font-normal">
                            (คงเหลือในแปลง: {currentRem} ต้น)
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="เช่น 50"
                        value={form.harvested_plants_count}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, harvested_plants_count: e.target.value }))
                        }
                        className="input text-xs w-full py-2 px-3 rounded-xl border border-emerald-300 bg-white font-bold text-emerald-900 focus:border-emerald-600"
                      />
                      {willDrainPlot ? (
                        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                          <span className="text-base leading-none">✨</span>
                          <div>
                            <p className="font-bold">
                              คุณกำลังตัดจนครบยอดที่เหลือทั้งหมดในแปลง ({currentRem} ต้น)
                            </p>
                            <p className="text-amber-700 text-[10px] mt-0.5">
                              ระบบจะปิดรอบการปลูกของชุดนี้ให้อัตโนมัติ และรีเซ็ตสถานะแปลงเป็น "ว่าง" พร้อมลงรอบใหม่
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-700 block mt-1">
                          * ระบบจะตัดยอดออกจากแปลงให้อัตโนมัติ แปลงจะยังคงเหลือ{' '}
                          {Math.max(0, currentRem - harvestNum)} ต้นไว้ให้ดูแลต่อ
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ปลายทางผลผลิตหลังเก็บเกี่ยว (Storage vs Direct LINE Shop) */}
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <label className="text-xs font-bold text-slate-800 block">
                  ปลายทางของผลผลิตหลังตัด (GAP ข้อ 5)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        destination: 'cold_storage',
                        sync_to_stock: false,
                        is_available: false,
                      }))
                    }
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      form.destination === 'cold_storage'
                        ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300/40 text-blue-950 font-bold'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <span>❄️ เข้าห้องเย็น / ตู้เย็นพักผัก</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 font-normal">
                      พักผักในตู้เย็น/ห้องเย็น 4-8°C รอดัดเกรด/แพ็กถุง (กดลงสต็อกที่หน้านี้เมื่อพร้อมขาย)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        destination: 'direct_stock',
                        sync_to_stock: true,
                        is_available: true,
                      }))
                    }
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      form.destination === 'direct_stock'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/40 text-emerald-950 font-bold'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <span>🛒 วางขายหน้าร้าน (LINE Shop) ทันที</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 font-normal">
                      เพิ่มสต็อกและเปิดขายใน LINE ให้ลูกค้าสั่งซื้อได้ทันที
                    </p>
                  </button>
                </div>
              </div>

              {/* Harvest Details: Total Weight & Packaging */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> วันที่เก็บเกี่ยว
                  </label>
                  <input
                    type="date"
                    required
                    value={form.harvest_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, harvest_date: e.target.value }))}
                    className="input text-xs w-full py-2.5 px-3 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900">
                    น้ำหนักรวมที่เก็บได้ (กก.) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="เช่น 30"
                    value={form.total_weight_kg}
                    onChange={(e) => setForm((prev) => ({ ...prev, total_weight_kg: e.target.value }))}
                    className="input text-xs w-full py-2.5 px-3 rounded-xl border-2 border-slate-300 focus:outline-none focus:border-emerald-600 font-bold text-slate-950 bg-white"
                  />
                  <span className="text-[11px] text-slate-500">ผลผลิตเฉลี่ย 30 กก. ต่อ 1 แคร่</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900">
                    น้ำหนักต่อถุง (กก.) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={form.weight_per_unit_kg}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, weight_per_unit_kg: e.target.value }))
                    }
                    className="input text-xs w-full py-2.5 px-3 rounded-xl border-2 border-slate-300 focus:outline-none focus:border-emerald-600 font-bold text-slate-950 bg-white"
                  />
                  <span className="text-[11px] text-slate-500">0.40 = 4 ขีด (มาตรฐานบรรจุฟาร์ม)</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900">ขนาดบรรจุภัณฑ์</label>
                  <input
                    type="text"
                    value={form.package_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, package_type: e.target.value }))}
                    className="input text-xs w-full py-2.5 px-3 rounded-xl border-2 border-slate-300 focus:outline-none focus:border-emerald-600 font-semibold text-slate-950 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900">
                    ราคาขายต่อถุง (บาท) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={form.price}
                    onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                    className="input text-base w-full py-2 px-3 rounded-xl border-2 border-emerald-500 font-black text-emerald-800 bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900">เกรดคุณภาพ</label>
                  <select
                    value={form.quality_grade}
                    onChange={(e) => setForm((prev) => ({ ...prev, quality_grade: e.target.value }))}
                    className="input text-xs w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="A">เกรด A (พรีเมียม สด กรอบ)</option>
                    <option value="B">เกรด B (มาตรฐาน)</option>
                    <option value="C">เกรด C (คละ/แปรรูป)</option>
                  </select>
                </div>
              </div>

              {/* Auto Calculated Summary Preview */}
              <div className="bg-emerald-50/80 rounded-2xl p-4 border-2 border-emerald-200 flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-emerald-900">คำนวณจำนวนถุงอัตโนมัติ:</span>
                  <p className="text-2xl font-black text-emerald-950 mt-0.5">
                    {Math.max(
                      1,
                      Math.floor(
                        Number(form.total_weight_kg || 0) /
                          (Number(form.weight_per_unit_kg) || 0.4)
                      )
                    )}{' '}
                    <span className="text-xs font-medium text-emerald-800">ถุง</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-900">มูลค่ารวมคาดการณ์:</span>
                  <p className="text-2xl font-black text-emerald-950 mt-0.5">
                    ฿
                    {(
                      Math.max(
                        1,
                        Math.floor(
                          Number(form.total_weight_kg || 0) /
                            (Number(form.weight_per_unit_kg) || 0.4)
                        )
                      ) * Number(form.price || 0)
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900">ช่องทางการจำหน่าย</label>
                  <input
                    type="text"
                    value={form.sale_channel}
                    onChange={(e) => setForm((prev) => ({ ...prev, sale_channel: e.target.value }))}
                    className="input text-xs w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900">ผู้ปฏิบัติงาน</label>
                  <input
                    type="text"
                    placeholder="ชื่อผู้ตัด/คัดเกรด"
                    value={form.worker_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, worker_name: e.target.value }))}
                    className="input text-xs w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900">
                  บันทึกขั้นตอนหลังเก็บเกี่ยว (GAP ข้อ 5-6)
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium"
                />
              </div>

              {/* 3. Destination-driven Stock Section */}
              {form.destination === 'cold_storage' ? (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-3 text-blue-950">
                  <div className="text-2xl shrink-0 mt-0.5">❄️</div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-blue-900 text-sm">
                      นำเข้าเก็บรักษาในห้องเย็น / ตู้เย็นพักผัก (GAP ข้อ 5)
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed font-normal">
                      ผลผลิต{' '}
                      <strong>
                        {Math.max(
                          1,
                          Math.floor(
                            Number(form.total_weight_kg || 0) /
                              (Number(form.weight_per_unit_kg) || 0.4)
                          )
                        )}{' '}
                        ถุง
                      </strong>{' '}
                      จะถูกบันทึกสถานะเป็น{' '}
                      <strong className="text-blue-950 font-bold">"รอลงสต็อก"</strong>{' '}
                      (ยังไม่เปิดขายหน้าร้าน LINE เพื่อรอคัดเกรด/แพ็กถุง)
                      <br />
                      เมื่อพร้อมจำหน่าย สามารถกดปุ่ม{' '}
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-white border border-blue-300 rounded font-bold text-[10px] text-blue-900">
                        📦 ลงสต็อกสินค้า
                      </span>{' '}
                      ในตารางหน้านี้ได้ทุกเมื่อ
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                      <Store className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        📦 วางขายหน้าร้าน LINE Shop ทันที (+
                        {Math.max(
                          1,
                          Math.floor(
                            Number(form.total_weight_kg || 0) /
                              (Number(form.weight_per_unit_kg) || 0.4)
                          )
                        )}{' '}
                        ถุง)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white border border-emerald-300 px-2 py-0.5 rounded-full">
                      เปิดขายทันที
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    {matchedProduct ? (
                      /* Case 1: Product Exists */
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          พบสินค้าในคลัง: "{matchedProduct.name}"
                        </div>
                        {(() => {
                          const calculatedBags = Math.max(
                            1,
                            Math.floor(
                              Number(form.total_weight_kg || 0) /
                                (Number(form.weight_per_unit_kg) || 0.4)
                            )
                          );
                          const oldStock = Number(matchedProduct.stock_quantity) || 0;
                          return (
                            <p className="text-[11px] text-slate-600">
                              สต็อกเดิม: <strong>{oldStock} ถุง</strong> ➔ บวกเพิ่ม{' '}
                              <strong className="text-emerald-700">+{calculatedBags} ถุง</strong>{' '}
                              ({form.package_type}) = สต็อกใหม่รวมเป็น{' '}
                              <strong className="text-slate-900">
                                {oldStock + calculatedBags} ถุง
                              </strong>
                            </p>
                          );
                        })()}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600">
                              ราคาขายต่อถุง (บาท)
                            </label>
                            <input
                              type="number"
                              step="1"
                              value={form.price}
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, price: e.target.value }))
                              }
                              placeholder={`เดิม ${matchedProduct.price} บาท`}
                              className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600">
                              สถานะสินค้า
                            </label>
                            <select
                              value={form.is_available ? 'yes' : 'no'}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  is_available: e.target.value === 'yes',
                                }))
                              }
                              className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white"
                            >
                              <option value="yes">เปิดขายทันที (Available)</option>
                              <option value="no">เก็บเข้าคลังไว้ก่อน (ยังไม่เปิดขาย)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Case 2: New Product Detected */
                      <div className="space-y-3">
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          ✨ ตรวจพบว่าเป็นผักรายการใหม่! ระบบจะสร้างสินค้าถุงละ 4 ขีด และเปิดขายหน้าร้านให้อัตโนมัติ
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">
                              ราคาขายต่อถุง (บาท) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="number"
                              required={form.sync_to_stock}
                              step="1"
                              placeholder="เช่น 20"
                              value={form.price}
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, price: e.target.value }))
                              }
                              className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-bold text-emerald-800"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700">การแสดงผล</label>
                            <select
                              value={form.is_available ? 'yes' : 'no'}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  is_available: e.target.value === 'yes',
                                }))
                              }
                              className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 bg-white"
                            >
                              <option value="yes">เปิดขายหน้าร้านทันที</option>
                              <option value="no">เก็บเป็นสต็อกไว้ก่อน (ยังไม่เปิดขาย)</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700">
                            ลิงก์รูปภาพผักสด (เว้นว่างไว้ได้ ระบบจะใช้รูปมาตรฐานผักสดให้)
                          </label>
                          <input
                            type="url"
                            placeholder="https://... (สามารถมาอัปโหลดรูปสวยๆ ในหน้าสินค้าทีหลังได้)"
                            value={form.image_url}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, image_url: e.target.value }))
                            }
                            className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pinned Footer Action Bar */}
            <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-100 bg-slate-50/95 backdrop-blur-xs flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2.5 active:scale-95 text-white rounded-xl text-xs font-black shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 ${
                  form.destination === 'cold_storage'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700'
                }`}
              >
                {form.destination === 'cold_storage' ? (
                  <>
                    <span className="text-sm">❄️</span>
                    <span>
                      {submitting
                        ? 'กำลังบันทึกนำเข้าห้องเย็น...'
                        : '✓ บันทึกเก็บผลผลิต (นำเข้าห้องเย็น)'}
                    </span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'กำลังบันทึกและวางขาย...'
                        : `✓ บันทึกและวางขายหน้าร้าน (+${Math.max(
                            1,
                            Math.floor(
                              Number(form.total_weight_kg || 0) /
                                (Number(form.weight_per_unit_kg) || 0.4)
                            )
                          )} ถุง)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
