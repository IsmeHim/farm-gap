import React from 'react';
import { QrCode, X, ExternalLink, Printer } from 'lucide-react';

export default function QrTraceModal({ item, onClose }) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-emerald-700" />
            QR Code ตรวจสอบย้อนกลับ GAP
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl flex flex-col items-center gap-3">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
              `${window.location.origin}/trace/${item.lot_code}`
            )}`}
            alt="Lot QR"
            className="w-40 h-40 bg-white p-2 rounded-xl border border-slate-200 shadow-sm"
          />
          <div className="space-y-0.5">
            <div className="text-[11px] text-slate-400 uppercase font-bold">Lot Code</div>
            <div className="font-mono font-bold text-xs text-slate-800">{item.lot_code}</div>
            <div className="text-[11px] text-slate-500">
              ปริมาณ: {item.quantity} {item.unit} (เกรด {item.quality_grade || '-'})
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-center pt-1">
          <a
            href={`/trace/${item.lot_code}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition inline-flex items-center justify-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>เปิดดูหน้าสแกน</span>
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>พิมพ์</span>
          </button>
        </div>
      </div>
    </div>
  );
}
