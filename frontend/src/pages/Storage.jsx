import LogManager from '../components/LogManager.jsx';
import { Truck, ShieldCheck, CheckCircle2, Clock, MapPin, User, Package, AlertCircle } from 'lucide-react';
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 border border-purple-200/60 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase">บันทึกขนส่งทั้งหมด</div>
                <div className="text-lg font-black text-slate-800">{total} รายการ</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase">รถสะอาดผ่าน GAP</div>
                <div className="text-lg font-black text-emerald-800">{cleanPercent}% ({cleanCount}/{total})</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-800 border border-sky-200/60 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <div className="text-[10px] sm:text-[11px] font-bold text-sky-600 uppercase">ผลผลิตสภาพสมบูรณ์</div>
                <div className="text-lg font-black text-sky-900">{goodCondition} เที่ยว</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-[10px] sm:text-[11px] font-bold text-amber-600 uppercase">เชื่อมคำสั่งซื้อ LINE</div>
                <div className="text-lg font-black text-amber-900">อัตโนมัติ 100%</div>
              </div>
            </div>
          </div>
        );
      }}
      renderCard={({ item, openEdit, del }) => (
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3 transition hover:shadow-md">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-black text-sm text-slate-900 flex-wrap">
                <User className="w-4 h-4 text-purple-700 shrink-0" />
                <span>{item.buyer || 'ลูกค้าทั่วไป'}</span>
                {item.order_id && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <Package className="w-3 h-3 text-amber-600" />
                    ออเดอร์ #{item.order_id}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate max-w-[220px]">{item.shipped_to || '—'}</span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              {item.vehicle_clean_status ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  รถสะอาด GAP
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  ไม่ผ่านเกณฑ์
                </span>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">วันที่ & เวลา</span>
              <span className="font-mono text-slate-700">
                {item.log_date ? format(new Date(item.log_date), 'dd/MM/yyyy') : '—'}{' '}
                <span className="text-slate-400 font-normal">{item.transport_time ? `(${item.transport_time})` : ''}</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">ยานพาหนะ</span>
              <span className="font-medium text-slate-800 truncate block" title={item.vehicle}>
                {item.vehicle || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">สถานที่เก็บ</span>
              <span className="font-medium text-slate-800 truncate block">
                {item.storage_location || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">สภาพขนส่ง</span>
              <span className="font-bold text-emerald-800">
                {item.delivery_condition || 'ดี'}
              </span>
            </div>
          </div>

          {item.notes && (
            <div className="text-[11px] text-slate-500 bg-slate-100/70 px-2.5 py-1.5 rounded-lg truncate" title={item.notes}>
              {item.notes}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-xl text-xs border border-blue-200 transition cursor-pointer"
            >
              แก้ไข
            </button>
            <button
              type="button"
              onClick={del}
              className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-1.5 rounded-xl text-xs border border-rose-200 transition cursor-pointer"
            >
              ลบ
            </button>
          </div>
        </div>
      )}
      fields={[
        { key: 'log_date', label: 'วันที่', type: 'date', placeholder: 'เลือกวันที่', required: true },
        { 
          key: 'buyer', 
          label: 'ผู้ซื้อ', 
          placeholder: 'ผู้ซื้อ / ชื่อลูกค้า', 
          required: true,
          render: (val, row) => (
            <div className="space-y-0.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>{val || '—'}</span>
              </div>
              {row?.order_id && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <Package className="w-2.5 h-2.5 text-amber-600" />
                  ออเดอร์ #{row.order_id}
                </span>
              )}
            </div>
          )
        },
        { 
          key: 'shipped_to', 
          label: 'ส่งไปที่', 
          placeholder: 'สถานที่ส่งมอบ / ที่อยู่',
          render: (val) => (
            <div className="text-slate-600 flex items-center gap-1 truncate max-w-[200px]" title={val}>
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{val || '—'}</span>
            </div>
          )
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
            <div className="text-slate-700 flex items-center gap-1 truncate max-w-[180px]" title={val}>
              <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{val || '—'}</span>
            </div>
          )
        },
        { 
          key: 'vehicle_clean_status', 
          label: 'รถสะอาด', 
          type: 'bool',
          render: (val) => val ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              ผ่าน/สะอาด
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
              <AlertCircle className="w-3 h-3 text-rose-500" />
              ไม่ผ่าน
            </span>
          )
        },
        { key: 'storage_location', label: 'สถานที่เก็บ', placeholder: 'เช่น คลังบรรจุและกระจายสินค้าฟาร์ม' },
        { key: 'storage_conditions', label: 'สภาพการเก็บรักษา', placeholder: 'เช่น บรรจุในกล่อง/ถุงเก็บความสด ป้องกันแสงแดดและความร้อน', hideInTable: true },
        { key: 'transport_time', label: 'เวลาขนส่ง', type: 'time', placeholder: 'เวลา' },
        { 
          key: 'delivery_condition', 
          label: 'สภาพขนส่ง', 
          type: 'select', 
          options: ['ดี','เสียหายเล็กน้อย','เสียหายมาก'], 
          placeholder: '-- เลือกสภาพ --',
          render: (val) => (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
              val === 'ดี' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {val || 'ดี'}
            </span>
          )
        },
        { key: 'worker_name', label: 'ผู้ปฏิบัติ', placeholder: 'ชื่อผู้ปฏิบัติ' },
        { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
      ]} 
    />
  );
}
