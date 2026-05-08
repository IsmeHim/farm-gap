import LogManager from '../components/LogManager.jsx';
export default function Pests() {
  return <LogManager title="ศัตรูพืช/โรค (GAP #4)" endpoint="pests" plotsLookup fields={[
    { key: 'log_date', label: 'วันที่', type: 'date', placeholder: 'เลือกวันที่', required: true },
    { key: 'plot_id', label: 'แปลง', placeholder: '-- เลือกแปลง --', required: true },
    { key: 'pest_or_disease', label: 'ศัตรูพืช/โรค', placeholder: 'ชื่อศัตรูพืชหรือโรค', required: true },
    { key: 'severity', label: 'ความรุนแรง', type: 'select', options: ['น้อย','ปานกลาง','รุนแรง'], placeholder: '-- เลือกระดับความรุนแรง --' },
    { key: 'treatment_method', label: 'วิธีจัดการ', placeholder: 'วิธีจัดการ' },
    { key: 'worker_name', label: 'ผู้ปฏิบัติ', placeholder: 'ชื่อผู้ปฏิบัติ' },
    { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
  ]} />;
}
