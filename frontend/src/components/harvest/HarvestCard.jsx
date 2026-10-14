import React from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  CheckCircle2,
  PackageCheck,
  Send,
  QrCode,
  Pencil,
  Trash2,
} from 'lucide-react';

export default function HarvestCard({
  item: r,
  plotName,
  openEdit,
  del,
  openStockModal,
  openPushModal,
  setQrModalItem,
}) {
  const pName = plotName(r.plot_id);
  const batchMatch = pName.match(/\[(#BATCH-[^\]]+)\]/);
  const batchCode = batchMatch ? batchMatch[1] : null;
  const cleanPlotTitle = batchMatch ? pName.replace(batchMatch[0], '').trim() : pName;
  const isHygieneGood =
    String(r.harvest_hygiene || '').includes('สะอาด') ||
    String(r.harvest_hygiene || '').includes('ปลอดภัย') ||
    String(r.harvest_hygiene || '').includes('ผ่าน');

  const total =
    r.total_packs > 0
      ? Number(r.total_packs)
      : Math.max(1, Math.floor(Number(r.quantity || 0) / 0.4));
  const stocked = Number(r.stocked_quantity || 0);
  const remaining = Math.max(0, total - stocked);
  const isFully = r.stock_status === 'fully_stocked' || stocked >= total;

  return (
    <div className="surface rounded-3xl p-4 sm:p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5">
      <div className="space-y-3">
        {/* Header: Plot Name, Batch, Date, Badges */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-black text-sm sm:text-base text-[#173f2a] truncate">
                {cleanPlotTitle}
              </h3>
              {r.crop_name && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs">
                  <span>🥦</span>
                  <span>{r.crop_name}</span>
                </span>
              )}
              {(r.batch_code || batchCode) && (
                <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                  {r.batch_code || batchCode}
                </span>
              )}
            </div>

            {r.harvest_date && (
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{format(new Date(r.harvest_date), 'dd/MM/yyyy')}</span>
              </div>
            )}
          </div>

          {/* Badges: Quality Grade & Hygiene */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {r.quality_grade && (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300/80 px-2.5 py-0.5 rounded-lg font-black text-xs shadow-2xs">
                เกรด {r.quality_grade}
              </span>
            )}
            {r.harvest_hygiene && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                  isHygieneGood
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {isHygieneGood && (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                )}
                {r.harvest_hygiene}
              </span>
            )}
          </div>
        </div>

        {/* Hero Stat Box: Harvest Quantity & Lot Code */}
        <div className="bg-gradient-to-br from-emerald-50/80 to-green-50/50 border border-emerald-200/70 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              ปริมาณผลผลิตที่เก็บได้
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-950 font-mono">
                {Number(r.quantity || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs font-bold text-emerald-700">{r.unit || 'กก.'}</span>
            </div>
          </div>

          {r.lot_code && (
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                LOT CODE (GAP)
              </span>
              <span className="font-mono text-xs font-bold text-slate-800 bg-white/90 px-2 py-1 rounded-lg border border-slate-200/80 inline-block mt-0.5 shadow-2xs">
                {r.lot_code}
              </span>
            </div>
          )}
        </div>

        {/* Detail Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
          <div className="space-y-0.5 bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              ผู้ปฏิบัติงาน:
            </span>
            <span className="font-semibold text-slate-700 truncate block">
              {r.worker_name ? `👤 ${r.worker_name}` : '—'}
            </span>
          </div>

          <div className="space-y-0.5 bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              รายได้ (THB):
            </span>
            <span className="font-semibold text-slate-700 truncate block">
              {r.revenue ? `฿${Number(r.revenue).toLocaleString()}` : '—'}
            </span>
          </div>

          {r.postharvest_handling && (
            <div className="col-span-2 space-y-0.5 bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                การจัดการหลังเก็บผลผลิต:
              </span>
              <span className="font-medium text-slate-700 block text-[11px] line-clamp-2">
                📦 {r.postharvest_handling}
              </span>
            </div>
          )}

          {r.notes && (
            <div className="col-span-2 space-y-0.5 bg-amber-50/50 rounded-xl p-2.5 border border-amber-100 text-[11px] text-amber-900">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">
                หมายเหตุ:
              </span>
              <span className="line-clamp-2">{r.notes}</span>
            </div>
          )}

          {/* Stock Status Badge for Mobile Card */}
          <div className="col-span-2 pt-1">
            {isFully ? (
              <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>ลงสต็อกหน้าร้านครบแล้ว</span>
                </span>
                <span className="font-mono font-black text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                  {stocked}/{total} ถุง
                </span>
              </div>
            ) : stocked > 0 ? (
              <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                <span className="font-bold text-blue-800 flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>ลงสต็อกแล้ว {stocked}/{total} ถุง</span>
                </span>
                <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200">
                  เหลือรอลง {remaining}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <span>❄️</span>
                  <span>ยังไม่ลงสต็อก (ในห้องเย็น)</span>
                </span>
                <span className="font-mono font-bold text-amber-800 bg-white px-2 py-0.5 rounded-lg border border-amber-200">
                  {total} ถุง
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons: 2x2 Grid + Stock Button */}
      <div className="pt-3 border-t border-slate-100 space-y-2 mt-auto">
        {/* Primary Stock Button */}
        {isFully ? (
          <button
            type="button"
            disabled
            className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/90 font-bold py-2 rounded-xl text-xs opacity-75 cursor-not-allowed"
            title="ผลผลิตล็อตนี้ลงสต็อกขายครบทั้งหมดแล้ว (ป้องกันสต็อกเกิน)"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>✓ ลงสต็อกครบทั้งหมดแล้ว</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openStockModal(r)}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 active:scale-98 text-white font-black py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
            title={`นำผักล็อตนี้ลงสต็อกขายหน้าร้าน (เหลือรอลง ${remaining} ถุง)`}
          >
            <PackageCheck className="w-4 h-4 shrink-0" />
            <span>📦 ลงสต็อกสินค้าหน้าร้าน (เหลือ {remaining} ถุง)</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openPushModal(r)}
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-98 text-emerald-800 font-bold py-2 px-2 rounded-xl text-xs border border-emerald-200 transition cursor-pointer"
            title="ตั้งค่าและยิง LINE Push แจ้งเตือนลูกค้า"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">📢 ยิง LINE Push</span>
          </button>

          {r.lot_code ? (
            <button
              type="button"
              onClick={() => setQrModalItem(r)}
              className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold py-2 px-2 rounded-xl text-xs border border-slate-200 transition cursor-pointer"
              title="ดู QR Code สำหรับตรวจสอบย้อนกลับมาตรฐาน GAP"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="truncate">QR ย้อนกลับ</span>
            </button>
          ) : (
            <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-medium py-2">
              ไม่มี Lot QR
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openEdit(r)}
            className="inline-flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 active:scale-98 text-blue-700 font-bold py-2 px-2 rounded-xl text-xs border border-blue-200 transition cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5 shrink-0" />
            <span>แก้ไข</span>
          </button>

          <button
            type="button"
            onClick={() => del(r.id)}
            className="inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-700 font-bold py-2 px-2 rounded-xl text-xs border border-rose-200 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>ลบ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
