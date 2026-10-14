import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  X,
  User,
  Phone,
  MapPin,
  Calendar,
  QrCode,
  Lock,
  Download,
  Copy,
  Receipt,
  Printer,
  Check,
  Truck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export default function OrderDetailModal({
  selectedOrder,
  onClose,
  getStatusBadge,
  formatDeliveryDate,
  promptPayNumber,
  orderPromptPayQr,
  copiedField,
  onDownloadOrderQr,
  onCopyOrderText,
  onOpenSlipModal,
  onUpdateStatus,
  onOpenDispatchModal,
}) {
  if (!selectedOrder) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start border-b pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
              <span>ใบสั่งซื้อ #{selectedOrder.order_code}</span>
              {getStatusBadge(selectedOrder)}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              สั่งซื้อเมื่อ:{' '}
              {selectedOrder.created_at
                ? format(new Date(selectedOrder.created_at), 'dd/MM/yyyy HH:mm น.')
                : '-'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer info */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-1.5">
          <div className="font-bold text-slate-700 flex items-center gap-1.5">
            <User className="w-4 h-4 text-emerald-700" /> ข้อมูลผู้สั่งซื้อ
          </div>
          <div className="text-slate-800 font-semibold">{selectedOrder.customer_name}</div>
          <div className="text-slate-600 flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedOrder.customer_phone || '-'}
          </div>
          <div className="text-slate-600 flex items-start gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />{' '}
            {selectedOrder.customer_address || 'รับเองที่ฟาร์ม'}
          </div>
          <div className="text-slate-600 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" /> วันที่นัดหมาย:{' '}
            {formatDeliveryDate(selectedOrder.delivery_date)}
          </div>
          {selectedOrder.notes && !selectedOrder.notes.startsWith('ผู้รับ:') && (
            <div className="text-slate-500 italic mt-1">
              หมายเหตุจากลูกค้า: "{selectedOrder.notes}"
            </div>
          )}
        </div>

        {/* Items list */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700">
            รายการสินค้า ({selectedOrder.items?.length || 0} รายการ):
          </div>
          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
            {selectedOrder.items?.map((it, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {it.image_url ? (
                    <img
                      src={it.image_url}
                      alt={it.product_name}
                      className="w-8 h-8 rounded-lg object-cover border"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                      GAP
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-slate-800">{it.product_name}</div>
                    <div className="text-[11px] text-slate-400">
                      ฿{Number(it.unit_price).toLocaleString()} / {it.unit}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-700">x {it.quantity}</div>
                  <div className="text-xs font-black text-emerald-800">
                    ฿{Number(it.subtotal).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t flex justify-between items-center text-sm font-black text-slate-900">
            <span>ยอดชำระทั้งหมด:</span>
            <span className="text-[#173f2a] text-base">
              ฿{Number(selectedOrder.total_amount).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Payment Method Details (COD vs PromptPay) */}
        {selectedOrder.payment_method === 'cod' ? (
          <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
              <span className="text-lg">💵</span>
              <span>วิธีชำระเงิน: เก็บเงินปลายทาง (COD)</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              ลูกค้าระบุชำระเงินสดปลายทางเมื่อรับสินค้า <strong>ไม่ต้องรอตรวจสลิปโอนเงิน</strong>{' '}
              สามารถจัดเตรียมและส่งพัสดุได้ทันที โดยพนักงานจัดส่งจะเรียกเก็บเงินสดจำนวน{' '}
              <span className="font-black text-emerald-800 text-sm">
                ฿
                {Number(selectedOrder.total_amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </p>
          </div>
        ) : (
          /* PromptPay Dynamic QR with Locked Amount */
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span>QR Code พร้อมเพย์ สำหรับออเดอร์นี้</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> ล็อกยอด ฿
                      {Number(selectedOrder.total_amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    EMVCo Dynamic QR ลูกค้าสแกนแล้วยอดเงินจะขึ้นตรงเป๊ะทันที ป้องกันโอนผิด
                  </p>
                </div>
              </div>
            </div>

            {promptPayNumber ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-xl border border-slate-100">
                {orderPromptPayQr ? (
                  <div className="flex flex-col items-center shrink-0">
                    <div className="bg-[#003B71] text-white py-0.5 px-3 rounded-t-md text-center w-full">
                      <span className="text-[8px] font-black uppercase tracking-wider">
                        THAI QR PAYMENT
                      </span>
                    </div>
                    <img
                      src={orderPromptPayQr}
                      alt="Order PromptPay QR"
                      className="w-28 h-28 object-contain border border-t-0 rounded-b-md"
                    />
                  </div>
                ) : (
                  <div className="w-28 h-28 flex items-center justify-center bg-slate-50 text-slate-400 text-xs rounded-xl border">
                    กำลังสร้าง QR...
                  </div>
                )}

                <div className="flex-1 space-y-2 text-xs w-full">
                  <div className="space-y-1">
                    <div className="text-slate-500 text-[11px]">
                      เบอร์พร้อมเพย์:{' '}
                      <span className="font-mono font-bold text-slate-800">
                        {promptPayNumber}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      ยอดชำระที่ล็อก:{' '}
                      <span className="font-black text-emerald-800 text-sm">
                        ฿
                        {Number(selectedOrder.total_amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {orderPromptPayQr && (
                      <button
                        type="button"
                        onClick={() => onDownloadOrderQr(selectedOrder, orderPromptPayQr)}
                        className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>บันทึกรูป QR ส่งลูกค้า</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCopyOrderText(promptPayNumber, 'เบอร์พร้อมเพย์')}
                      className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>{copiedField === 'เบอร์พร้อมเพย์' ? 'คัดลอกแล้ว' : 'คัดลอกเบอร์'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onCopyOrderText(Number(selectedOrder.total_amount).toFixed(2), 'ยอดเงิน')
                      }
                      className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>{copiedField === 'ยอดเงิน' ? 'คัดลอกแล้ว' : 'คัดลอกยอด'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center justify-between">
                <span>ยังไม่ได้ตั้งค่าเบอร์พร้อมเพย์ของฟาร์ม</span>
                <Link
                  to="/profile"
                  className="font-bold underline text-amber-900 hover:text-emerald-700"
                >
                  ไปตั้งค่าในโปรไฟล์ &rarr;
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Payment slip preview */}
        {selectedOrder.slip_image_url && (
          <div className="space-y-1.5 pt-2 border-t">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-blue-600" /> หลักฐานการชำระเงิน (สลิปโอนเงิน)
            </div>
            <div className="p-2 bg-slate-50 rounded-xl border flex flex-col items-center">
              <img
                src={selectedOrder.slip_image_url}
                alt="สลิปโอนเงิน"
                className="max-h-40 rounded-lg object-contain cursor-pointer hover:opacity-90"
                onClick={() => onOpenSlipModal(selectedOrder.slip_image_url)}
              />
              <div className="text-[10px] text-center text-slate-400 mt-1">
                คลิกที่รูปเพื่อขยายเต็มจอ
              </div>
            </div>
          </div>
        )}

        {/* Print Shipping Label Quick Action */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>ใบปะหน้าพัสดุ & เช็คลิสต์แพ็คสินค้า (GAP Shipping Label)</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              พิมพ์ใบปะหน้าแปะกล่องพัสดุ (100x150mm หรือ A4) พร้อม QR Code มาตรฐาน GAP
              ให้ลูกค้าสแกนตรวจสอบย้อนกลับ
            </p>
          </div>

          <Link
            to={`/orders/${selectedOrder.id}/print`}
            target="_blank"
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-xs shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>🖨️ พิมพ์ใบปะหน้า</span>
          </Link>
        </div>

        {/* Status Update Controls */}
        <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-500">เปลี่ยนสถานะออเดอร์:</div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedOrder.status !== 'paid' && selectedOrder.payment_method !== 'cod' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(selectedOrder.id, 'paid')}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>อนุมัติสลิป (ชำระแล้ว)</span>
              </button>
            )}
            {selectedOrder.status === 'pending' && selectedOrder.payment_method === 'cod' && (
              <button
                type="button"
                onClick={() => onOpenDispatchModal(selectedOrder)}
                className="inline-flex items-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5 text-emerald-300" />
                <span>ส่งของ (COD)</span>
              </button>
            )}
            {selectedOrder.status === 'paid' && (
              <button
                type="button"
                onClick={() => onOpenDispatchModal(selectedOrder)}
                className="inline-flex items-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5 text-emerald-300" />
                <span>จัดส่งสินค้า (ลงสมุด GAP #6)</span>
              </button>
            )}
            {selectedOrder.status !== 'completed' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(selectedOrder.id, 'completed')}
                className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                <span>จัดส่งสำเร็จ</span>
              </button>
            )}
            {selectedOrder.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(selectedOrder.id, 'cancelled')}
                className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>ยกเลิกออเดอร์</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
