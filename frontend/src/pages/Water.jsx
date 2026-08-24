import LogManager from '../components/LogManager.jsx';
export default function Water() {
  return <LogManager title="บันทึกการให้น้ำ (GAP #1)" endpoint="water" plotsLookup fields={[
    { key: 'log_date', label: 'วันที่', type: 'date', required: true, placeholder: 'เลือกวันที่' },
    { key: 'plot_id', label: 'แปลง', placeholder: '-- เลือกแปลง --', required: true },
    { key: 'water_source', label: 'แหล่งน้ำ', placeholder: 'เช่น น้ำบาดาล / น้ำประปา' },
    { key: 'water_source_type', label: 'ประเภทน้ำ', placeholder: 'น้ำบาดาล / น้ำประปา / น้ำฝน' },
    { key: 'water_quality', label: 'คุณภาพน้ำ', placeholder: 'เช่น ผ่าน / ไม่ผ่าน' },
    { key: 'contamination_check', label: 'น้ำสะอาด', type: 'bool' },
    { key: 'amount_liters', label: 'ปริมาณ (ลิตร)', type: 'number', placeholder: 'เช่น 100' },
    { key: 'worker_name', label: 'ผู้ปฏิบัติ', placeholder: 'ชื่อผู้ปฏิบัติ' },
    { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
  ]} />;
}
