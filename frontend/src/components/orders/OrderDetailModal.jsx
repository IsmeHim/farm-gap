import React, { useState } from 'react';
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
  ZoomIn,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Clock,
  Sparkles,
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
  updatingId,
}) {
  const [showQrSection, setShowQrSection] = useState(false);

  if (!selectedOrder) return null;

  const isCod = selectedOrder.payment_method === 'cod';
  const status = selectedOrder.status;
  const isUpdating = updatingId === selectedOrder.id;

  // Determine whether QR code should be expanded by default (only when pending & no slip yet)
  const shouldShowQrByDefault = !isCod && status === 'pending' && !selectedOrder.slip_image_url;
  const isQrExpanded = shouldShowQrByDefault || showQrSection;

  // Stepper configuration
  const steps = isCod
    ? [
        { key: 'pending', label: 'รอจัดส่ง (COD)' },
        { key: 'shipping', label: 'กำลังจัดส่ง (GAP #6)' },
        { key: 'completed', label: 'ส่งและเก็บเงินสำเร็จ' },
      ]
    : [
        { key: 'pending', label: 'รอตรวจสลิป' },
        { key: 'paid', label: 'ชำระเงินแล้ว' },
        { key: 'shipping', label: 'กำลังจัดส่ง (GAP #6)' },
        { key: 'completed', label: 'จัดส่งสำเร็จ' },
      ];

  const statusOrderMap = isCod
    ? { pending: 0, paid: 0, shipping: 1, completed: 2 }
    : { pending: 0, paid: 1, shipping: 2, completed: 3 };

  const currentStepIdx = statusOrderMap[status] ?? -1;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. FIXED HEADER */}
        <div className="shrink-0 bg-white border-b border-slate-100 px-5 sm:px-6 pt-4 pb-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-black text-base sm:text-lg text-[#173f2a] tracking-tight">
                  #{selectedOrder.order_code}
                </span>
                {getStatusBadge(selectedOrder)}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                    isCod
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {isCod ? '💵 เก็บปลายทาง (COD)' : '🏦 โอนเงินพร้อมเพย์'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  สั่งซื้อเมื่อ:{' '}
                  {selectedOrder.created_at
                    ? format(new Date(selectedOrder.created_at), 'dd/MM/yyyy HH:mm น.')
                    : '-'}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                to={`/orders/${selectedOrder.id}/print`}
                target="_blank"
                className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 border border-emerald-200/90 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer"
                title="พิมพ์ใบปะหน้าพัสดุและเช็คลิสต์แพ็คสินค้า (GAP)"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline">พิมพ์ใบปะหน้า</span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Order Lifecycle Stepper */}
          {status === 'cancelled' ? (
            <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2 flex items-center gap-2 text-xs font-bold text-rose-700">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>คำสั่งซื้อนี้ถูกยกเลิกแล้ว ไม่สามารถดำเนินการต่อได้</span>
            </div>
          ) : (
            <div className="mt-3.5 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {steps.map((step, idx) => {
                  const isDone = idx < currentStepIdx || status === 'completed';
                  const isCurrent = idx === currentStepIdx && status !== 'completed';
                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                        isDone
                          ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200'
                          : isCurrent
                            ? 'bg-[#173f2a] text-white border-[#173f2a] shadow-2xs'
                            : 'bg-slate-50 text-slate-400 border-slate-100'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                              ? 'bg-emerald-400 text-[#173f2a]'
                              : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </span>
                      <span className="truncate">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 2. SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {/* Customer & Delivery Information */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/70 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-700" />
                <span>ข้อมูลผู้สั่งซื้อและการจัดส่ง</span>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  selectedOrder.delivery_type === 'delivery'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                {selectedOrder.delivery_type === 'delivery'
                  ? '🚚 จัดส่งตามที่อยู่'
                  : '🏡 รับเองที่ฟาร์ม'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <div className="text-[11px] text-slate-400 font-medium">ชื่อลูกค้า</div>
                <div className="font-bold text-slate-800 mt-0.5">
                  {selectedOrder.customer_name || 'ลูกค้าทั่วไป'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">เบอร์โทรศัพท์</div>
                <div className="font-semibold text-slate-700 mt-0.5 flex items-center gap-1.5 font-mono">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{selectedOrder.customer_phone || '-'}</span>
                  {selectedOrder.customer_phone && (
                    <button
                      type="button"
                      onClick={() =>
                        onCopyOrderText(selectedOrder.customer_phone, 'เบอร์โทรศัพท์ลูกค้า')
                      }
                      className="text-[10px] font-sans bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      คัดลอก
                    </button>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">วันที่นัดรับ / จัดส่ง</div>
                <div className="font-bold text-emerald-800 mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{formatDeliveryDate(selectedOrder.delivery_date)}</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">สถานที่จัดส่ง</div>
                <div className="font-medium text-slate-700 mt-0.5 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>{selectedOrder.customer_address || 'รับเองที่ฟาร์ม'}</span>
                </div>
              </div>
            </div>

            {selectedOrder.notes && !selectedOrder.notes.startsWith('ผู้รับ:') && (
              <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl px-3 py-2 text-xs text-amber-900">
                <span className="font-bold">หมายเหตุจากลูกค้า:</span> "{selectedOrder.notes}"
              </div>
            )}
          </div>

          {/* Order Items List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
            <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-700" />
                <span>รายการสินค้า ({selectedOrder.items?.length || 0} รายการ)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">มาตรฐาน GAP</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto px-4">
              {selectedOrder.items?.map((it, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {it.image_url ? (
                      <img
                        src={it.image_url}
                        alt={it.product_name}
                        className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                        GAP
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{it.product_name}</div>
                      <div className="text-[11px] text-slate-400">
                        ฿{Number(it.unit_price).toLocaleString()} / {it.unit}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-slate-600">
                      x {it.quantity} {it.unit}
                    </div>
                    <div className="text-xs font-black text-emerald-800">
                      ฿{Number(it.subtotal).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-emerald-50/60 px-4 py-3 border-t border-emerald-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">ยอดชำระสุทธิทั้งหมด</span>
              <span className="text-lg font-black text-[#173f2a]">
                ฿
                {Number(selectedOrder.total_amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Payment & Slip Verification Section */}
          {isCod ? (
            <div
              className={`rounded-2xl p-4 border space-y-1.5 ${
                status === 'completed'
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-amber-50/90 border-amber-200'
              }`}
            >
              <div
                className={`flex items-center justify-between font-bold text-xs sm:text-sm ${
                  status === 'completed' ? 'text-emerald-900' : 'text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{status === 'completed' ? '✅' : '💵'}</span>
                  <span>
                    {status === 'completed'
                      ? 'เก็บเงินสดปลายทาง (COD) เรียบร้อยแล้ว'
                      : 'วิธีชำระเงิน: เก็บเงินปลายทาง (COD)'}
                  </span>
                </div>
                <span className="font-black text-sm">
                  ฿
                  {Number(selectedOrder.total_amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <p
                className={`text-xs leading-relaxed ${
                  status === 'completed' ? 'text-emerald-800' : 'text-amber-800'
                }`}
              >
                {status === 'completed'
                  ? 'ออเดอร์นี้จัดส่งถึงมือลูกค้าและรับชำระเงินสดปลายทางครบถ้วนแล้ว'
                  : 'ลูกค้าระบุชำระเงินสดเมื่อรับสินค้า ไม่ต้องรอตรวจสลิปโอนเงิน สามารถจัดเตรียมและส่งพัสดุได้ทันที'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Slip Preview Card (Primary focus for Bank Transfer) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <span>หลักฐานการโอนเงิน (สลิปธนาคาร)</span>
                  </div>
                  {selectedOrder.slip_image_url ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        status === 'paid' || status === 'shipping' || status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {status === 'paid' || status === 'shipping' || status === 'completed'
                        ? '✓ ตรวจสอบสลิปแล้ว'
                        : '📎 แนบสลิปแล้ว (รอตรวจสอบ)'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      ⏳ ยังไม่แนบสลิป
                    </span>
                  )}
                </div>

                {selectedOrder.slip_image_url ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50/90 p-3 rounded-xl border border-slate-200/70">
                    <div
                      onClick={() => onOpenSlipModal(selectedOrder.slip_image_url)}
                      className="relative group cursor-pointer shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs"
                    >
                      <img
                        src={selectedOrder.slip_image_url}
                        alt="สลิปโอนเงิน"
                        className="w-28 h-36 object-cover group-hover:scale-105 transition duration-200"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-bold gap-1">
                        <ZoomIn className="w-4 h-4" />
                        <span>ขยาย</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2 text-xs text-center sm:text-left">
                      <div className="font-bold text-slate-800">
                        ยอดโอนตามใบสั่งซื้อ:{' '}
                        <span className="text-emerald-800 font-black text-sm">
                          ฿
                          {Number(selectedOrder.total_amount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {status === 'pending'
                          ? 'กรุณาตรวจสอบชื่อบัญชี ยอดเงิน และวันเวลาในสลิปก่อนกดปุ่ม "อนุมัติสลิป" ด้านล่าง'
                          : 'หลักฐานการชำระเงินของออเดอร์นี้ได้รับการตรวจสอบและบันทึกในระบบเรียบร้อยแล้ว'}
                      </p>
                      <button
                        type="button"
                        onClick={() => onOpenSlipModal(selectedOrder.slip_image_url)}
                        className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>คลิกดูรูปสลิปขนาดเต็มจอ</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                    ลูกค้ายังไม่ได้อัปโหลดสลิปโอนเงิน หรือคุณสามารถส่ง QR พร้อมเพย์ด้านล่างให้ลูกค้าสแกนได้
                  </div>
                )}
              </div>

              {/* PromptPay QR Section (Collapsible when already has slip or already processed) */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowQrSection((prev) => !prev)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-100/70 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                      <QrCode className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <span>QR Code พร้อมเพย์สำหรับเรียกเก็บเงิน</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> ล็อกยอด ฿
                          {Number(selectedOrder.total_amount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <span>{isQrExpanded ? 'ซ่อน QR' : 'แสดง QR'}</span>
                    {isQrExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {isQrExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-200/60">
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
                              className="w-24 h-24 object-contain border border-t-0 rounded-b-md"
                            />
                          </div>
                        ) : (
                          <div className="w-24 h-24 flex items-center justify-center bg-slate-50 text-slate-400 text-xs rounded-xl border">
                            กำลังสร้าง QR...
                          </div>
                        )}

                        <div className="flex-1 space-y-2 text-xs w-full">
                          <div className="space-y-0.5">
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

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {orderPromptPayQr && (
                              <button
                                type="button"
                                onClick={() =>
                                  onDownloadOrderQr(selectedOrder, orderPromptPayQr)
                                }
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
                              <span>
                                {copiedField === 'เบอร์พร้อมเพย์' ? 'คัดลอกแล้ว' : 'คัดลอกเบอร์'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onCopyOrderText(
                                  Number(selectedOrder.total_amount).toFixed(2),
                                  'ยอดเงิน'
                                )
                              }
                              className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              <Copy className="w-3 h-3 text-slate-500" />
                              <span>
                                {copiedField === 'ยอดเงิน' ? 'คัดลอกแล้ว' : 'คัดลอกยอด'}
                              </span>
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
              </div>
            </div>
          )}
        </div>

        {/* 3. STICKY FOOTER: STRICT LIFECYCLE ACTIONS */}
        <div className="shrink-0 bg-slate-50 border-t border-slate-200/80 px-5 sm:px-6 py-3.5">
          {/* CASE 1: PENDING */}
          {status === 'pending' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(selectedOrder.id, 'cancelled')}
                className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-rose-50 active:scale-95 text-rose-600 border border-rose-200 text-xs font-bold px-3.5 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>ยกเลิกออเดอร์</span>
              </button>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {isCod ? (
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => onOpenDispatchModal(selectedOrder)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Truck className="w-4 h-4 text-emerald-300" />
                    <span>บันทึกจัดส่งสินค้า (COD)</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => onOpenDispatchModal(selectedOrder)}
                      className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-emerald-50 active:scale-95 text-[#173f2a] border border-emerald-300 text-xs font-bold px-3.5 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                      title="อนุมัติพร้อมเปิดหน้าต่างบันทึกจัดส่งสินค้าทันที"
                    >
                      <Truck className="w-3.5 h-3.5 text-emerald-700" />
                      <span>ส่งของทันที (GAP #6)</span>
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => onUpdateStatus(selectedOrder.id, 'paid')}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isUpdating ? 'กำลังบันทึก...' : 'อนุมัติสลิป (ชำระเงินแล้ว)'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* CASE 2: PAID (Waiting for Dispatch) */}
          {status === 'paid' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(selectedOrder.id, 'cancelled')}
                className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-rose-50 active:scale-95 text-rose-600 border border-rose-200 text-xs font-bold px-3.5 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>ยกเลิกออเดอร์</span>
              </button>

              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onOpenDispatchModal(selectedOrder)}
                className="inline-flex items-center justify-center gap-2 bg-[#173f2a] hover:bg-[#20573a] active:scale-95 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Truck className="w-4 h-4 text-emerald-300" />
                <span>บันทึกจัดส่งสินค้า (ลงสมุด GAP #6)</span>
              </button>
            </div>
          )}

          {/* CASE 3: SHIPPING (In Transit -> Mark Completed) */}
          {status === 'shipping' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(selectedOrder.id, 'cancelled')}
                className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-rose-50 active:scale-95 text-rose-600 border border-rose-200 text-xs font-bold px-3.5 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>ยกเลิกออเดอร์</span>
              </button>

              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(selectedOrder.id, 'completed')}
                className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>
                  {isUpdating ? 'กำลังบันทึก...' : 'ยืนยันจัดส่งสำเร็จ (ลูกค้าได้รับสินค้าแล้ว)'}
                </span>
              </button>
            </div>
          )}

          {/* CASE 4: COMPLETED (Locked Final State — No Cancel or Approve Slip!) */}
          {status === 'completed' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ออเดอร์นี้จัดส่งและรับชำระเงินเสร็จสมบูรณ์แล้ว</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Link
                  to={`/orders/${selectedOrder.id}/print`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-700" />
                  <span>พิมพ์ใบปะหน้า</span>
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          )}

          {/* CASE 5: CANCELLED (Locked Final State) */}
          {status === 'cancelled' && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-rose-700 text-xs font-bold">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>ออเดอร์นี้ถูกยกเลิกแล้ว</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
