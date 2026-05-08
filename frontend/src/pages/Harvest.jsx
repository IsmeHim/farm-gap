import LogManager from '../components/LogManager.jsx';
export default function Harvest() {
  return <LogManager title="เก็บเกี่ยว (GAP #5)" endpoint="harvest" plotsLookup fields={[
    { key: 'harvest_date', label: 'วันที่เก็บ', type: 'date', placeholder: 'เลือกวันที่เก็บ', required: true },
    { key: 'plot_id', label: 'แปลง', placeholder: '-- เลือกแปลง --', required: true },
    { key: 'quantity', label: 'จำนวน', type: 'number', placeholder: 'เช่น 100', required: true },
    { key: 'unit', label: 'หน่วย', placeholder: 'เช่น kg', default: 'kg' },
    { key: 'quality_grade', label: 'เกรด', type: 'select', options: ['A','B','C'], placeholder: '-- เลือกเกรด --' },
    { key: 'lot_code', label: 'Lot Code (สำหรับ QR)', placeholder: 'Lot Code สำหรับ QR' },
    { key: 'revenue', label: 'รายได้ (THB)', type: 'number', placeholder: 'เช่น 5000' },
    { key: 'worker_name', label: 'ผู้ปฏิบัติ', placeholder: 'ชื่อผู้ปฏิบัติ' },
    { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
  ]} />;
}
