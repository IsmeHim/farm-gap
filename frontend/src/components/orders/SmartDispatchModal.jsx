import React from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  User,
  MapPin,
  Package,
  Truck,
  ShieldCheck,
} from 'lucide-react';

export default function SmartDispatchModal({
  dispatchModalOrder,
  onClose,
  dispatchForm,
  setDispatchForm,
  onSubmit,
  submitting,
}) {
  if (!dispatchModalOrder) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
              🚚
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                จัดส่งสินค้าอัจฉริยะ (Smart Dispatch)
              </h3>
              <p className="text-xs text-slate-500">
                อ้างอิงออเดอร์{' '}
                <strong className="font-mono text-[#173f2a]">
                  #{dispatchModalOrder.order_code}
                </strong>{' '}
                • {dispatchModalOrder.customer_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Smart Sync Info Banner */}
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl text-xs space-y-1">
          <div className="font-bold text-emerald-950 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>ระบบดึงข้อมูลจากคำสั่งซื้อและเตรียมบันทึก GAP #6 ให้อัตโนมัติ:</span>
          </div>
          <p className="text-[11px] text-emerald-800 pl-5 leading-relaxed">
            เมื่อยืนยัน ระบบจะเปลี่ยนสถานะออเดอร์เป็น <strong>กำลังจัดส่ง</strong>{' '}
            และนำข้อมูลด้านล่างไปลงบันทึกในสมุด <strong>"ขนส่ง/เก็บรักษา (GAP #6)"</strong>{' '}
            ให้ทันทีในคลิกเดียว
          </p>
        </div>

        {/* Dispatch Form */}
        <form onSubmit={onSubmit} className="space-y-3.5 text-xs">
          {/* Row 1: Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                วันที่จัดส่ง <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dispatchForm.log_date}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, log_date: e.target.value }))
                }
                className="input text-xs w-full rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                เวลาขนส่ง
              </label>
              <input
                type="time"
                value={dispatchForm.transport_time}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, transport_time: e.target.value }))
                }
                className="input text-xs w-full rounded-xl font-mono"
              />
            </div>
          </div>

          {/* Row 2: Buyer & Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                ผู้ซื้อ (ลูกค้า) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={dispatchForm.buyer}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, buyer: e.target.value }))
                }
                className="input text-xs w-full rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                ส่งไปที่ (สถานที่ส่งมอบ) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={dispatchForm.shipped_to}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, shipped_to: e.target.value }))
                }
                className="input text-xs w-full rounded-xl"
              />
            </div>
          </div>

          {/* Row 3: Storage Location & Vehicle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                สถานที่เก็บก่อนส่ง
              </label>
              <select
                value={dispatchForm.storage_location}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, storage_location: e.target.value }))
                }
                className="input text-xs w-full rounded-xl font-medium"
              >
                <option value="คลังบรรจุและกระจายสินค้าฟาร์ม">คลังบรรจุและกระจายสินค้าฟาร์ม</option>
                <option value="ลานพักผลผลิตชั่วคราว สะอาด มีหลังคา">ลานพักผลผลิตชั่วคราว สะอาด มีหลังคา</option>
                <option value="อุณหภูมิห้อง ถ่ายเทอากาศดี">อุณหภูมิห้อง ถ่ายเทอากาศดี</option>
                <option value="ห้องเย็นฟาร์ม Temp 4°C">ห้องเย็นฟาร์ม Temp 4°C</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                ยานพาหนะขนส่ง
              </label>
              <select
                value={dispatchForm.vehicle}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, vehicle: e.target.value }))
                }
                className="input text-xs w-full rounded-xl font-medium"
              >
                <option value="รถจักรยานยนต์ส่วนตัว (เจ้าของฟาร์มส่งเอง)">🏍️ รถจักรยานยนต์ส่วนตัว (เจ้าของฟาร์มส่งเอง)</option>
                <option value="รถยนต์ส่วนตัว">🚗 รถยนต์ส่วนตัว</option>
                <option value="บริการขนส่งพัสดุเอกชน">📦 บริการขนส่งพัสดุเอกชน</option>
                <option value="ลูกค้ามารับเองที่ฟาร์ม">🏡 ลูกค้ามารับเองที่ฟาร์ม</option>
              </select>
            </div>
          </div>

          {/* Row 4: Clean vehicle check & storage conditions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                การตรวจความสะอาดรถ (GAP #6)
              </label>
              <label className="flex items-center gap-2 p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={dispatchForm.vehicle_clean_status}
                  onChange={(e) =>
                    setDispatchForm((f) => ({ ...f, vehicle_clean_status: e.target.checked }))
                  }
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-emerald-900">
                  รถสะอาด ผ่านการตรวจสุขอนามัย
                </span>
              </label>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">สภาพการเก็บรักษา</label>
              <input
                type="text"
                value={dispatchForm.storage_conditions}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, storage_conditions: e.target.value }))
                }
                className="input text-xs w-full rounded-xl"
              />
            </div>
          </div>

          {/* Row 5: Delivery condition & Worker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">สภาพผลผลิตตอนขนส่ง</label>
              <select
                value={dispatchForm.delivery_condition}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, delivery_condition: e.target.value }))
                }
                className="input text-xs w-full rounded-xl font-medium"
              >
                <option value="ดี">ดี (สดสมบูรณ์ 100%)</option>
                <option value="เสียหายเล็กน้อย">เสียหายเล็กน้อย</option>
                <option value="เสียหายมาก">เสียหายมาก</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">ผู้ปฏิบัติ (ผู้จัดส่ง)</label>
              <input
                type="text"
                value={dispatchForm.worker_name}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, worker_name: e.target.value }))
                }
                className="input text-xs w-full rounded-xl"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700">หมายเหตุ</label>
            <textarea
              rows={2}
              value={dispatchForm.notes}
              onChange={(e) =>
                setDispatchForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="input text-xs w-full rounded-xl"
            />
          </div>

          {/* Auto Sync Toggle */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={dispatchForm.sync_to_storage}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, sync_to_storage: e.target.checked }))
                }
                className="w-4 h-4 text-emerald-700 rounded cursor-pointer"
              />
              <span>บันทึกลงสมุด ขนส่ง/เก็บรักษา (GAP #6) อัตโนมัติ</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-[#173f2a] hover:bg-[#20573a] text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Truck className="w-4 h-4 text-emerald-300" />
              <span>{submitting ? 'กำลังบันทึกจัดส่ง...' : '🚀 ยืนยันการจัดส่ง & ลงสมุด GAP #6'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
