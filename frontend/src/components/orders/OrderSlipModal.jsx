import React from 'react';
import { X } from 'lucide-react';

export default function OrderSlipModal({ slipModalImage, onClose }) {
  if (!slipModalImage) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-60 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-md w-full bg-white rounded-2xl p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-800">รูปภาพสลิปโอนเงิน</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-auto rounded-xl border border-slate-100 flex items-center justify-center bg-slate-900">
          <img
            src={slipModalImage}
            alt="สลิปโอนเงินขยายใหญ่"
            className="max-h-[70vh] object-contain"
          />
        </div>
      </div>
    </div>
  );
}
