import React from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { AlertCircle } from 'lucide-react';

export default function DeleteDailyLogModal({
  deleteConfirmDate,
  onClose,
  onConfirmDelete,
}) {
  if (!deleteConfirmDate) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 text-rose-600 font-black text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>ยืนยันการลบบันทึกการให้น้ำ</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          คุณต้องการลบบันทึกการให้น้ำประจำวันที่{' '}
          <strong className="text-slate-900 font-bold">
            {format(new Date(deleteConfirmDate), 'd MMMM yyyy', { locale: th })}
          </strong>{' '}
          (ทุกแปลงในวันนี้) ใช่หรือไม่? ข้อมูลจะถูกลบออกจากฐานข้อมูล
        </p>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onConfirmDelete(deleteConfirmDate)}
            className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            ยืนยันการลบ
          </button>
        </div>
      </div>
    </div>
  );
}
