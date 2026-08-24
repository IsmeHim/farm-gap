import LogManager from '../components/LogManager.jsx';
export default function Workers() {
  return <LogManager title="ผู้ปฏิบัติงาน (GAP #7)" endpoint="workers" fields={[
    { key: 'name', label: 'ชื่อ', placeholder: 'ชื่อพนักงาน', required: true },
    { key: 'role', label: 'ตำแหน่ง', placeholder: 'ตำแหน่งงาน' },
    { key: 'phone', label: 'เบอร์โทร', placeholder: 'เบอร์โทรศัพท์' },
    { key: 'hygiene_training', label: 'ผ่านอบรมสุขอนามัย', type: 'bool' },
    { key: 'training_date', label: 'วันที่อบรม', type: 'date', placeholder: 'วันที่อบรม' },
    { key: 'personal_hygiene_check', label: 'สุขอนามัยส่วนบุคคล', type: 'bool' },
    { key: 'health_status', label: 'สถานะสุขภาพ', type: 'select', options: ['แข็งแรง','ป่วย','รอตรวจ'], placeholder: '-- เลือกสถานะ --' },
  ]} />;
}
