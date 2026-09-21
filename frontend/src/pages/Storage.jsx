import { Link } from 'react-router-dom';
import LogManager from '../components/LogManager.jsx';
import {
  Truck,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  Package,
  AlertCircle,
  Printer,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

export default function Storage() {
  return (
    <LogManager
      title="ขนส่ง/เก็บรักษา (GAP #6)"
      endpoint="storage"
      renderTopBanner={({ rows }) => {
        const total = rows.length;
        const cleanCount = rows.filter(r => r.vehicle_clean_status).length;
        const cleanPercent = total > 0 ? Math.round((cleanCount / total) * 100) : 100;
        const goodCondition = rows.filter(r => r.delivery_condition === 'ดี' || !r.delivery_condition).length;

        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-800 border border-purple-200/60 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase truncate">บันทึกขนส่งทั้งหมด</div>
                <div className="text-base sm:text-lg font-black text-slate-800 truncate">{total} รายการ</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase truncate">รถสะอาดผ่าน GAP</div>
                <div className="text-base sm:text-lg font-black text-emerald-800 truncate">{cleanPercent}% ({cleanCount}/{total})</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-50 text-sky-800 border border-sky-200/60 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] font-bold text-sky-600 uppercase truncate">สภาพสมบูรณ์</div>
                <div className="text-base sm:text-lg font-black text-sky-900 truncate">{goodCondition} เที่ยว</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] font-bold text-amber-600 uppercase truncate">เชื่อมคำสั่งซื้อ LINE</div>
                <div className="text-base sm:text-lg font-black text-amber-900 truncate">อัตโนมัติ 100%</div>
              </div>
            </div>
          </div>
        );
      }}
      renderCard={({ item, openEdit, del }) => (
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3 transition hover:shadow-md">
          {/* Card Header: Buyer info & GAP Vehicle Status */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/80 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </span>
                <span className="font-black text-sm text-slate-900 truncate">
                  {item.buyer || 'ลูกค้าทั่วไป'}
                </span>
                {item.order_id && (
                  <Link
                    to={`/orders/${item.order_id}/print`}
                    target="_blank"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 transition shadow-2xs whitespace-nowrap cursor-pointer"
                    title="คลิกเพื่อพิมพ์ใบปะหน้าพัสดุ"
                  >
                    <Package className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>ออเดอร์ #{item.order_id}</span>
                  </Link>
                )}
              </div>
              <div className="flex items-start gap-1 text-[11px] text-slate-600 pl-0.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed break-words">{item.shipped_to || 'รับเองที่ฟาร์ม'}</span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              {item.vehicle_clean_status ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs whitespace-nowrap">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>ผ่านเกณฑ์ GAP</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs whitespace-nowrap">
                  <AlertCircle className="w-3 h-3 text-rose-500" />
                  <span>ไม่ผ่านเกณฑ์</span>
                </span>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">วันที่ & เวลา</span>
              <div className="font-mono text-slate-800 font-bold">
                {item.log_date ? format(new Date(item.log_date), 'dd/MM/yyyy') : '—'}
              </div>
              {item.transport_time && (
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{String(item.transport_time).slice(0, 5)} น.</span>
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">สภาพขนส่ง</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                item.delivery_condition === 'ดี' || !item.delivery_condition
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border border-amber-300'
              }`}>
                ✓ {item.delivery_condition || 'ดี'}
              </span>
            </div>

            <div className="col-span-2 pt-1 border-t border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">ยานพาหนะขนส่ง</span>
              <div className="font-medium text-slate-800 flex items-center gap-1.5" title={item.vehicle}>
                <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{item.vehicle || '—'}</span>
              </div>
            </div>

            <div className="col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">สถานที่เก็บรักษา</span>
              <div className="font-medium text-slate-700 text-[11px]" title={item.storage_location}>
                {item.storage_location || '—'}
              </div>
            </div>
          </div>

          {item.notes && (
            <div className="text-[11px] text-slate-600 bg-slate-100/80 p-2 rounded-lg leading-relaxed" title={item.notes}>
              <strong className="text-slate-700">หมายเหตุ:</strong> {item.notes}
            </div>
          )}

          {/* Card Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <div>
              {item.order_id && (
                <Link
                  to={`/orders/${item.order_id}/print`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 active:scale-95 px-3 py-1.5 rounded-xl border border-emerald-200 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ใบปะหน้า</span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openEdit}
                className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 font-bold px-3 py-1.5 rounded-xl text-xs border border-blue-200 transition cursor-pointer"
              >
                แก้ไข
              </button>
              <button
                type="button"
                onClick={del}
                className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold px-3 py-1.5 rounded-xl text-xs border border-rose-200 transition cursor-pointer"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
      fields={[
        {
          key: 'log_date',
          label: 'วันที่',
          type: 'date',
          placeholder: 'เลือกวันที่',
          required: true,
          render: (val, row) => (
            <div className="min-w-[110px] whitespace-nowrap space-y-0.5">
              <div className="font-mono text-xs font-bold text-slate-800">
                {val ? format(new Date(val), 'dd/MM/yyyy') : '—'}
              </div>
              {row?.transport_time && (
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{String(row.transport_time).slice(0, 5)} น.</span>
                </div>
              )}
            </div>
          ),
        },
        {
          key: 'buyer',
          label: 'ผู้ซื้อ / ลูกค้า',
          placeholder: 'ผู้ซื้อ / ชื่อลูกค้า',
          required: true,
          render: (val, row) => {
            const cleanBuyer = (val || '').trim();
            return (
              <div className="min-w-[190px] whitespace-nowrap space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                  <span className="w-6 h-6 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/80 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </span>
                  <span className="truncate max-w-[190px]" title={cleanBuyer || 'ลูกค้าทั่วไป'}>
                    {cleanBuyer || 'ลูกค้าทั่วไป'}
                  </span>
                </div>
                {row?.order_id ? (
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/orders/${row.order_id}/print`}
                      target="_blank"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition shadow-2xs whitespace-nowrap cursor-pointer"
                      title="คลิกเพื่อเปิดใบปะหน้าพัสดุออเดอร์นี้"
                    >
                      <Package className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>ออเดอร์ #{row.order_id}</span>
                    </Link>
                  </div>
                ) : cleanBuyer.includes('LINE') ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    LINE OA
                  </span>
                ) : null}
              </div>
            );
          },
        },
        {
          key: 'shipped_to',
          label: 'ส่งไปที่ (ที่อยู่)',
          placeholder: 'สถานที่ส่งมอบ / ที่อยู่',
          render: (val) => (
            <div className="min-w-[180px] max-w-[260px] text-xs text-slate-700 flex items-start gap-1.5" title={val}>
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-relaxed break-words">{val || 'รับเองที่ฟาร์ม'}</span>
            </div>
          ),
        },
        {
          key: 'vehicle',
          label: 'ยานพาหนะ',
          type: 'select',
          options: [
            'รถจักรยานยนต์ส่วนตัว (เจ้าของฟาร์มส่งเอง)',
            'รถยนต์ส่วนตัว',
            'บริการขนส่งพัสดุเอกชน',
            'ลูกค้ามารับเองที่ฟาร์ม',
          ],
          placeholder: '-- เลือกยานพาหนะ --',
          render: (val) => (
            <div className="min-w-[180px] max-w-[240px] text-xs text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <Truck className="w-3.5 h-3.5" />
              </span>
              <span className="truncate" title={val}>{val || '—'}</span>
            </div>
          ),
        },
        {
          key: 'vehicle_clean_status',
          label: 'รถสะอาด (GAP)',
          type: 'bool',
          render: (val) => val ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>ผ่านเกณฑ์ GAP</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs whitespace-nowrap">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>ไม่ผ่านเกณฑ์</span>
            </span>
          ),
        },
        {
          key: 'storage_location',
          label: 'สถานที่เก็บรักษา',
          placeholder: 'เช่น คลังบรรจุและกระจายสินค้าฟาร์ม',
          render: (val) => (
            <div className="min-w-[150px] max-w-[220px] text-xs font-medium text-slate-700 whitespace-nowrap truncate" title={val}>
              {val || '—'}
            </div>
          ),
        },
        {
          key: 'storage_conditions',
          label: 'สภาพการเก็บรักษา',
          placeholder: 'เช่น บรรจุในกล่อง/ถุงเก็บความสด ป้องกันแสงแดดและความร้อน',
          hideInTable: true,
        },
        {
          key: 'transport_time',
          label: 'เวลาขนส่ง',
          type: 'time',
          placeholder: 'เวลา',
          render: (val) => {
            if (!val) return <span className="text-slate-400">—</span>;
            const cleanTime = String(val).slice(0, 5);
            return (
              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100/90 border border-slate-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                🕒 {cleanTime} น.
              </span>
            );
          },
        },
        {
          key: 'delivery_condition',
          label: 'สภาพขนส่ง',
          type: 'select',
          options: ['ดี', 'เสียหายเล็กน้อย', 'เสียหายมาก'],
          placeholder: '-- เลือกสภาพ --',
          render: (val) => {
            const isGood = !val || val === 'ดี' || val.includes('สมบูรณ์');
            return (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shadow-2xs ${
                isGood
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border border-amber-300'
              }`}>
                {isGood ? '✓' : '⚠️'} {val || 'ดี'}
              </span>
            );
          },
        },
        {
          key: 'worker_name',
          label: 'ผู้ปฏิบัติ',
          placeholder: 'ชื่อผู้ปฏิบัติ',
          render: (val) => (
            <span className="font-semibold text-slate-800 text-xs whitespace-nowrap">
              {val || '—'}
            </span>
          ),
        },
        {
          key: 'notes',
          label: 'หมายเหตุ',
          type: 'textarea',
          placeholder: 'หมายเหตุเพิ่มเติม',
          hideInTable: true,
        },
      ]}
    />
  );
}
