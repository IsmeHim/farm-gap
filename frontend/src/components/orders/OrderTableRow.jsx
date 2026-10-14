import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Phone, Receipt, Printer, Eye, Truck, Check, CheckCircle2 } from 'lucide-react';

export default function OrderTableRow({
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
    <tr className="hover:bg-emerald-50/40 transition">
      <td className="px-4 py-3.5 font-bold text-[#173f2a] whitespace-nowrap min-w-[150px]">
        <button
          type="button"
          onClick={() => onViewDetails(o)}
          className="text-left hover:underline text-emerald-800 font-mono font-bold cursor-pointer"
          title="คลิกเพื่อดูรายละเอียดออเดอร์"
        >
          {o.order_code}
        </button>
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap min-w-[200px]">
        <div
          className="font-bold text-slate-800 text-xs truncate max-w-[240px]"
          title={o.customer_name}
        >
          {o.customer_name || 'ลูกค้าทั่วไป'}
        </div>
        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
          <span>{o.customer_phone || '-'}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap min-w-[160px]">
        <div>
          สั่งเมื่อ: {o.created_at ? format(new Date(o.created_at), 'dd/MM/yy HH:mm') : '-'}
        </div>
        <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
          นัดรับ: {formatDeliveryDate(o.delivery_date)}
        </div>
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
            o.delivery_type === 'delivery'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {o.delivery_type === 'delivery' ? '🚚 ส่งตามที่อยู่' : '🏡 รับเองที่ฟาร์ม'}
        </span>
      </td>
      <td className="px-4 py-3.5 text-right font-black text-slate-900 whitespace-nowrap">
        ฿{Number(o.total_amount).toLocaleString()}
      </td>
      <td className="px-4 py-3.5 text-center whitespace-nowrap">
        {o.payment_method === 'cod' ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
            💵 เก็บปลายทาง
          </span>
        ) : o.slip_image_url ? (
          <button
            type="button"
            onClick={() => onOpenSlipModal(o.slip_image_url)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100 active:bg-blue-200 px-2.5 py-1 rounded-lg border border-blue-200 transition shadow-2xs cursor-pointer"
          >
            <Receipt className="w-3 h-3 text-blue-600" />
            <span>ดูสลิป</span>
          </button>
        ) : (
          <span className="text-[11px] text-slate-400 italic">ยังไม่แนบ</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-center whitespace-nowrap">{getStatusBadge(o)}</td>
      <td className="px-4 py-3.5 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
          {/* Print Label Button */}
          <Link
            to={`/orders/${o.id}/print`}
            target="_blank"
            className="inline-flex items-center gap-1 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-2.5 py-1.5 rounded-xl transition shadow-2xs whitespace-nowrap cursor-pointer"
            title="พิมพ์ใบปะหน้าพัสดุและเช็คลิสต์แพ็คสินค้า"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>ใบปะหน้า</span>
          </Link>

          {/* Details Button */}
          <button
            type="button"
            onClick={() => onViewDetails(o)}
            className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2.5 py-1.5 rounded-xl transition shadow-2xs whitespace-nowrap cursor-pointer"
            title="ดูรายละเอียดออเดอร์"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>รายละเอียด</span>
          </button>

          {/* Primary Action Button on Desktop */}
          {o.status === 'pending' && o.payment_method === 'cod' && (
            <button
              type="button"
              onClick={() => onOpenDispatchModal(o)}
              disabled={updatingId === o.id}
              className="inline-flex items-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5 text-emerald-300" />
              <span>ส่งของ (COD)</span>
            </button>
          )}
          {o.status === 'pending' && o.payment_method !== 'cod' && (
            <button
              type="button"
              onClick={() => onUpdateStatus(o.id, 'paid')}
              disabled={updatingId === o.id}
              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>อนุมัติสลิป</span>
            </button>
          )}
          {o.status === 'paid' && (
            <button
              type="button"
              onClick={() => onOpenDispatchModal(o)}
              disabled={updatingId === o.id}
              className="inline-flex items-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5 text-emerald-300" />
              <span>ส่งของ (GAP)</span>
            </button>
          )}
          {o.status === 'shipping' && (
            <button
              type="button"
              onClick={() => onUpdateStatus(o.id, 'completed')}
              disabled={updatingId === o.id}
              className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
              <span>สำเร็จ</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
