import LogManager from '../components/LogManager.jsx';
export default function Storage() {
  return <LogManager title="ขนส่ง/เก็บรักษา (GAP #6)" endpoint="storage" fields={[
    { key: 'log_date', label: 'วันที่', type: 'date', placeholder: 'เลือกวันที่', required: true },
    { key: 'storage_location', label: 'สถานที่เก็บ', placeholder: 'สถานที่เก็บ' },
    { key: 'shipped_to', label: 'ส่งไปที่', placeholder: 'ส่งไปที่' },
    { key: 'buyer', label: 'ผู้ซื้อ', placeholder: 'ผู้ซื้อ' },
    { key: 'vehicle', label: 'ยานพาหนะ', placeholder: 'ยานพาหนะ' },
    { key: 'worker_name', label: 'ผู้ปฏิบัติ', placeholder: 'ชื่อผู้ปฏิบัติ' },
    { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
  ]} />;
}
