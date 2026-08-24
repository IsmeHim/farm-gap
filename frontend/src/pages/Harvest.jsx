import { useState } from 'react';
import LogManager from '../components/LogManager.jsx';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

export default function Harvest() {
  const [sendingId, setSendingId] = useState(null);

  const handlePersonalizedPush = async (harvestItem) => {
    setSendingId(harvestItem.id);
    try {
      // ดึงชื่อพืชจาก plot_id หรือ lot_code/notes
      const plotsRes = await api.get('/api/plots');
      const plot = plotsRes.data.find(p => p.id === harvestItem.plot_id);
      const cropName = plot?.crop_name || 'ผักสลัดสด';

      const res = await api.post('/api/ai/notify-harvest', {
        harvest_id: harvestItem.id,
        crop_name: cropName,
        quantity: harvestItem.quantity,
        unit: harvestItem.unit || 'kg',
        plot_name: plot?.name || 'แปลงเกษตร'
      });

      const targets = res.data.target_customers?.map(c => `${c.name} (${c.cluster})`).join(', ');
      
      toast.success(
        `📢 ยิงแจ้งเตือนผัก ${cropName} สำเร็จ! (${res.data.notified_count} ท่าน)`,
        {
          description: targets ? `ส่งถึง: ${targets}` : 'ยิงแจ้งเตือนถึงลูกค้าเรียบร้อยแล้ว',
          duration: 5000,
        }
      );
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถส่งแจ้งเตือน LINE ได้');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <LogManager
      title="เก็บเกี่ยว (GAP #5)"
      endpoint="harvest"
      plotsLookup
      renderRowAction={(item) => (
        <button
          type="button"
          onClick={() => handlePersonalizedPush(item)}
          disabled={sendingId === item.id}
          className="inline-flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 font-bold px-2.5 py-1 rounded-lg text-xs border border-green-200 transition disabled:opacity-50"
          title="ยิง LINE Push Notification หาเฉพาะลูกค้าที่ชอบผักชนิดนี้"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{sendingId === item.id ? 'กำลังส่ง...' : '📢 ยิง LINE Push'}</span>
        </button>
      )}
      fields={[
        { key: 'harvest_date', label: 'วันที่เก็บ', type: 'date', placeholder: 'เลือกวันที่เก็บ', required: true },
        { key: 'plot_id', label: 'แปลง', placeholder: '-- เลือกแปลง --', required: true },
        { key: 'quantity', label: 'จำนวน', type: 'number', placeholder: 'เช่น 100', required: true },
        { key: 'unit', label: 'หน่วย', placeholder: 'เช่น kg', default: 'kg' },
        { key: 'quality_grade', label: 'เกรด', type: 'select', options: ['A','B','C'], placeholder: '-- เลือกเกรด --' },
        { key: 'lot_code', label: 'Lot Code (สำหรับ QR)', placeholder: 'Lot Code สำหรับ QR' },
        { key: 'revenue', label: 'รายได้ (THB)', type: 'number', placeholder: 'เช่น 5000' },
        { key: 'harvest_hygiene', label: 'สุขอนามัยการเก็บเกี่ยว', type: 'select', options: ['สะอาด','ปนเปื้อน','รอตรวจสอบ'], placeholder: '-- เลือกสถานะ --' },
        { key: 'postharvest_handling', label: 'การจัดการหลังเก็บเกี่ยว', placeholder: 'เช่น ล้าง/บรรจุ' },
        { key: 'worker_name', label: 'ผู้ปฏิบัติ', placeholder: 'ชื่อผู้ปฏิบัติ' },
        { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
      ]}
    />
  );
}
