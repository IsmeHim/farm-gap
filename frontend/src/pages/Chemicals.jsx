import LogManager from '../components/LogManager.jsx';
export default function Chemicals() {
  return <LogManager title="ปุ๋ย/สารเคมี (GAP #3)" endpoint="chemicals" plotsLookup fields={[
    { key: 'log_date', label: 'วันที่', type: 'date', placeholder: 'เลือกวันที่', required: true },
    { key: 'plot_id', label: 'แปลง', placeholder: '-- เลือกแปลง --', required: true },
    { key: 'chem_type', label: 'ประเภท', type: 'select', options: ['ปุ๋ย','ยาฆ่าแมลง','ยาฆ่าเชื้อรา','ยาฆ่าหญ้า','อื่นๆ'], placeholder: '-- เลือกประเภท --', required: true },
    { key: 'product_name', label: 'ชื่อผลิตภัณฑ์', placeholder: 'ชื่อผลิตภัณฑ์', required: true },
    { key: 'amount', label: 'ปริมาณ', type: 'number', placeholder: 'เช่น 10' },
    { key: 'unit', label: 'หน่วย', placeholder: 'เช่น ml', default: 'ml' },
    { key: 'application_method', label: 'วิธีการใช้', type: 'select', options: ['พ่น','โรย','ราด','ฉีดราก','อื่นๆ'], placeholder: '-- เลือกวิธี --' },
    { key: 'reason', label: 'เหตุผลการใช้', placeholder: 'เหตุผลการใช้' },
    { key: 'manufacturer', label: 'ผู้ผลิต', placeholder: 'ผู้ผลิต' },
    { key: 'chemical_label', label: 'ฉลากสาร', placeholder: 'ข้อมูลฉลาก' },
    { key: 'safety_ppe', label: 'ใช้ PPE', type: 'bool' },
    { key: 'phi_days', label: 'PHI (วัน)', type: 'number', placeholder: 'จำนวนวัน PHI', default: 0 },
    { key: 'worker_name', label: 'ผู้ปฏิบัติ', placeholder: 'ชื่อผู้ปฏิบัติ' },
    { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
  ]} />;
}
