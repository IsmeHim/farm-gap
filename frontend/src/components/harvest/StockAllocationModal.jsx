import React from 'react';
import { PackageCheck, X, Store, Sparkles } from 'lucide-react';

export default function StockAllocationModal({
  stockModalItem,
  onClose,
  stockForm,
  setStockForm,
  submittingStock,
  onSubmit,
}) {
  if (!stockModalItem) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl max-w-xl md:max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800 shrink-0">
              <PackageCheck className="w-5 h-5 text-emerald-700" />
            </span>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                นำผลผลิตลงสต็อกสินค้า (LINE Shop)
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {stockModalItem.plot_name} • {stockModalItem.crop_name} • ล็อต{' '}
                <span className="font-mono font-bold text-emerald-700">
                  {stockModalItem.lot_code || '—'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
            {/* 3 Metric Cards: Total, Stocked, Remaining */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  ผลผลิตทั้งหมด
                </span>
                <span className="text-lg font-black text-slate-800 font-mono">
                  {stockModalItem.calculated_total_packs}
                </span>
                <span className="text-[10px] text-slate-400 block">ถุง (4 ขีด)</span>
              </div>

              <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-blue-600 uppercase block">
                  ลงสต็อกไปแล้ว
                </span>
                <span className="text-lg font-black text-blue-700 font-mono">
                  {stockModalItem.calculated_stocked}
                </span>
                <span className="text-[10px] text-blue-500 block">ถุง</span>
              </div>

              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 text-center shadow-xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                  รอลงสต็อกได้อีก
                </span>
                <span className="text-xl font-black text-emerald-800 font-mono">
                  {stockModalItem.calculated_remaining}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold block">ถุง</span>
              </div>
            </div>

            {/* จำนวนที่ต้องการลงสต็อก */}
            <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800">
                  จำนวนที่ต้องการลงสต็อกในรอบนี้ (ถุง) <span className="text-rose-600">*</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  สูงสุดไม่เกิน{' '}
                  <span className="font-bold font-mono text-emerald-700">
                    {stockModalItem.calculated_remaining}
                  </span>{' '}
                  ถุง
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  required
                  min="1"
                  max={stockModalItem.calculated_remaining}
                  value={stockForm.quantity_to_stock}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (isNaN(val)) {
                      setStockForm({ ...stockForm, quantity_to_stock: '' });
                    } else {
                      const clamped = Math.max(1, Math.min(val, stockModalItem.calculated_remaining));
                      setStockForm({ ...stockForm, quantity_to_stock: clamped });
                    }
                  }}
                  className="w-32 px-3.5 py-2.5 rounded-xl border-2 border-emerald-500 bg-white text-slate-900 font-black text-lg focus:ring-2 focus:ring-emerald-500 outline-none text-center"
                />
                <div className="text-xs text-slate-600 font-medium">
                  ถุง (คิดเป็นผักสดประมาณ{' '}
                  {(Number(stockForm.quantity_to_stock || 0) * 0.4).toFixed(1)} กก.)
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setStockForm({
                      ...stockForm,
                      quantity_to_stock: stockModalItem.calculated_remaining,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition active:scale-95 cursor-pointer"
                >
                  ✓ ลงทั้งหมด ({stockModalItem.calculated_remaining} ถุง)
                </button>
                {stockModalItem.calculated_remaining > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setStockForm({
                        ...stockForm,
                        quantity_to_stock: Math.ceil(stockModalItem.calculated_remaining / 2),
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition active:scale-95 cursor-pointer"
                  >
                    ครึ่งหนึ่ง ({Math.ceil(stockModalItem.calculated_remaining / 2)} ถุง)
                  </button>
                )}
                {stockModalItem.calculated_remaining >= 10 && (
                  <button
                    type="button"
                    onClick={() => setStockForm({ ...stockForm, quantity_to_stock: 10 })}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition active:scale-95 cursor-pointer"
                  >
                    10 ถุง
                  </button>
                )}
                {stockModalItem.calculated_remaining >= 20 && (
                  <button
                    type="button"
                    onClick={() => setStockForm({ ...stockForm, quantity_to_stock: 20 })}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition active:scale-95 cursor-pointer"
                  >
                    20 ถุง
                  </button>
                )}
              </div>
            </div>

            {/* ข้อมูลสินค้าหน้าร้าน (ระบบจับคู่ให้อัตโนมัติ 100% ตามชนิดผัก ไม่ต้องเลือกเอง) */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-emerald-600" />
                  <span>สินค้าหน้าร้านที่จะลงสต็อก (จับคู่ตรงชนิดผักให้อัตโนมัติ)</span>
                </span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                  {stockModalItem.matched_product
                    ? '✓ ผูกกับสินค้าเดิมในร้าน'
                    : '✨ เตรียมสร้างสินค้าใหม่อัตโนมัติ'}
                </span>
              </div>

              <div className="flex items-center gap-3.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                {stockModalItem.matched_product?.image_url ? (
                  <img
                    src={stockModalItem.matched_product.image_url}
                    alt={stockForm.product_name}
                    className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl shrink-0">
                    🥬
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="font-black text-slate-900 text-sm truncate">
                    {stockForm.product_name}
                  </h4>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                    <span>
                      สต็อกปัจจุบันในร้าน:{' '}
                      <strong className="font-mono text-slate-800">
                        {Number(stockModalItem.matched_product?.stock_quantity || 0)} ถุง
                      </strong>
                    </span>
                    <span>→</span>
                    <span className="text-emerald-700 font-bold">
                      หลังลงสต็อก:{' '}
                      <strong className="font-mono text-emerald-800">
                        {Number(stockModalItem.matched_product?.stock_quantity || 0) +
                          Number(stockForm.quantity_to_stock || 0)}{' '}
                        ถุง
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ราคาขาย & สวิตช์สถานะพร้อมจำหน่าย */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  ราคาขาย (บาท / ถุง)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={stockForm.price}
                  onChange={(e) => setStockForm({ ...stockForm, price: e.target.value })}
                  placeholder="เช่น 20"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-black focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                />
              </div>

              <div className="flex items-end">
                <div className="h-[44px] w-full px-3.5 flex items-center rounded-xl bg-slate-50 border border-slate-200">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={stockForm.is_available}
                      onChange={(e) =>
                        setStockForm({ ...stockForm, is_available: e.target.checked })
                      }
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span>เปิดสถานะ "พร้อมจำหน่ายทันที" บน LINE Shop</span>
                  </label>
                </div>
              </div>
            </div>

            {/* ข้อความสรุป */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>สรุปการลงสต็อก:</span>
              </div>
              <div>
                เมื่อกดยืนยัน ระบบจะบวกสต็อก{' '}
                <span className="font-bold text-emerald-800">
                  {stockForm.quantity_to_stock || 0} ถุง
                </span>{' '}
                เข้าสินค้าหน้าร้าน และปรับสถานะของล็อตนี้เป็น{' '}
                <span className="font-bold text-emerald-800">
                  {Number(stockForm.quantity_to_stock || 0) >= stockModalItem.calculated_remaining
                    ? '✓ ลงสต็อกครบแล้ว (100%)'
                    : `ลงสต็อกบางส่วน (คงเหลืออีก ${
                        stockModalItem.calculated_remaining -
                        Number(stockForm.quantity_to_stock || 0)
                      } ถุง)`}
                </span>
              </div>
            </div>
          </div>

          {/* Fixed Footer Buttons */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 sm:py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submittingStock}
              className="flex-1 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              <PackageCheck className="w-4 h-4" />
              <span>
                {submittingStock
                  ? 'กำลังบันทึกสต็อก...'
                  : `✓ ยืนยันการลงสต็อก (${stockForm.quantity_to_stock || 0} ถุง)`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
