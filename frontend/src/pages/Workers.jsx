import LogManager from '../components/LogManager.jsx';
export default function Workers() {
  return <LogManager title="ผู้ปฏิบัติงาน (GAP #7)" endpoint="workers" fields={[
    { key: 'name', label: 'ชื่อ', placeholder: 'ชื่อพนักงาน', required: true },
    { key: 'role', label: 'ตำแหน่ง', placeholder: 'ตำแหน่งงาน' },
    { key: 'phone', label: 'เบอร์โทร', placeholder: 'เบอร์โทรศัพท์' },
    { key: 'hygiene_training', label: 'ผ่านอบรมสุขอนามัย', type: 'bool' },
  ]} />;
}
