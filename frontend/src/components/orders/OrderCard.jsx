import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Receipt, Printer, Eye, Truck, Check, CheckCircle2 } from 'lucide-react';

export default function OrderCard({
  order,
  getStatusBadge,
  formatDeliveryDate,
  onOpenSlipModal,
  onViewDetails,
  onOpenDispatchModal,
  onUpdateStatus,
  updatingId,
}) {
  const o = order;

  return (
    <div className="surface rounded-2xl p-4 sm:p-5 bg-white border border-slate-200/80 shadow-xs space-y-3.5 flex flex-col justify-between hover:border-emerald-200 transition">
      {/* Card Header: Code, Customer, Status */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-sm text-[#173f2a] tracking-tight">
              {o.order_code}
            </span>
          </div>
          <div className="text-xs font-bold text-slate-800 mt-1 truncate">
            {o.customer_name || 'ลูกค้าทั่วไป'}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{o.customer_phone || '-'}</span>
          </div>
        </div>
        <div className="shrink-0">{getStatusBadge(o)}</div>
      </div>

      {/* Card Body: Delivery, Appointment, Price, Slip */}
      <div className="grid grid-cols-2 gap-3 text-xs py-0.5">
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400">การจัดส่ง</span>
          <div className="font-semibold text-slate-700 text-xs">
            {o.delivery_type === 'delivery' ? '🚚 ส่งตามที่อยู่' : '🏡 รับเองที่ฟาร์ม'}
          </div>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400">นัดหมาย</span>
          <div
            className="font-semibold text-emerald-800 text-xs truncate"
            title={o.delivery_date}
          >
            {formatDeliveryDate(o.delivery_date)}
          </div>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400">ยอดชำระสุทธิ</span>
          <div className="text-base font-black text-slate-900 tracking-tight">
            ฿{Number(o.total_amount).toLocaleString()}
          </div>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400">สลิปโอนเงิน</span>
          <div className="mt-0.5">
            {o.payment_method === 'cod' ? (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                💵 เก็บปลายทาง
              </span>
            ) : o.slip_image_url ? (
              <button
                type="button"
                onClick={() => onOpenSlipModal(o.slip_image_url)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50/90 hover:bg-blue-100 active:bg-blue-200 px-2.5 py-1 rounded-lg border border-blue-200/90 transition cursor-pointer shadow-2xs"
              >
                <Receipt className="w-3 h-3 text-blue-600" />
                <span>ดูสลิป</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 italic">ยังไม่แนบสลิป</span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Card Action Buttons */}
      <div className="pt-3 border-t border-slate-100 space-y-2">
        {/* Utility Actions (Print & Details) - 2 equal columns */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/orders/${o.id}/print`}
            target="_blank"
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-50/80 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 text-xs font-bold py-2.5 px-2.5 rounded-xl border border-emerald-200/90 transition shadow-2xs whitespace-nowrap cursor-pointer"
            title="พิมพ์ใบปะหน้าพัสดุและเช็คลิสต์แพ็คสินค้า"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>ใบปะหน้า</span>
          </Link>

          <button
            type="button"
            onClick={() => onViewDetails(o)}
            className="inline-flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-2.5 rounded-xl border border-slate-200 transition shadow-2xs whitespace-nowrap cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>รายละเอียด</span>
          </button>
        </div>

        {/* Lifecycle Primary Action Button (Full-width prominence) */}
        {o.status === 'pending' &&
          (o.payment_method === 'cod' ? (
            <button
              type="button"
              onClick={() => onOpenDispatchModal(o)}
              disabled={updatingId === o.id}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-[0.99] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Truck className="w-4 h-4 text-emerald-300" />
              <span>บันทึกจัดส่งสินค้า (เก็บเงินปลายทาง)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onUpdateStatus(o.id, 'paid')}
              disabled={updatingId === o.id}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              <span>
                {updatingId === o.id ? 'กำลังบันทึก...' : 'อนุมัติสลิป (ชำระแล้ว)'}
              </span>
            </button>
          ))}
        {o.status === 'paid' && (
          <button
            type="button"
            onClick={() => onOpenDispatchModal(o)}
            disabled={updatingId === o.id}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-[0.99] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Truck className="w-4 h-4 text-emerald-300" />
            <span>บันทึกจัดส่งสินค้า (ลง GAP #6)</span>
          </button>
        )}
        {o.status === 'shipping' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(o.id, 'completed')}
            disabled={updatingId === o.id}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>
              {updatingId === o.id ? 'กำลังบันทึก...' : 'ยืนยันจัดส่งสำเร็จเรียบร้อย'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
