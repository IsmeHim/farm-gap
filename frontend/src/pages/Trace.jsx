import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Sprout } from 'lucide-react';
import { format } from 'date-fns';

export default function Trace() {
  const { lot } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get(`/api/trace/${lot}`).then(r => setData(r.data)).catch(e => setErr(e.response?.data?.error || e.message));
  }, [lot]);

  if (err) return <div className="min-h-screen flex items-center justify-center text-red-500">ไม่พบ Lot นี้</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-primary flex items-center justify-center mb-4"><Sprout className="w-7 h-7 text-white" /></div>
        <h1 className="text-2xl font-bold mb-2">{data.crop_name}</h1>
        <div className="text-gray-500 mb-6">Lot: <span className="font-mono">{data.lot_code}</span></div>
        <div className="text-left space-y-2 text-sm">
          <div><b>ฟาร์ม:</b> {data.farm_name || '-'}</div>
          <div><b>แปลง:</b> {data.plot_name}</div>
          <div>
            <b>รอบการปลูก (Crop Cycle):</b>{' '}
            <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
              #BATCH-{(data.plot_name || '').replace(/แปลง|\s|\(.*?\)/g, '') || 'P'}-R{data.cycle_number || 1} (รอบที่ {data.cycle_number || 1})
            </span>
          </div>
          <div><b>วันเก็บผลผลิต:</b> {format(new Date(data.harvest_date), 'dd/MM/yyyy')}</div>
          <div><b>เกรด:</b> {data.quality_grade || '-'}</div>
          <div><b>ปริมาณ:</b> {data.quantity} {data.unit}</div>
        </div>
        <div className="mt-6 text-xs text-gray-400">✓ ผ่านมาตรฐาน GAP</div>
      </div>
    </div>
  );
}
