import LogManager from '../components/LogManager.jsx';
export default function Plots() {
  return <LogManager title="แปลงปลูก (GAP #2)" endpoint="plots" fields={[
    { key: 'name', label: 'ชื่อแปลง', placeholder: 'ชื่อแปลง', required: true },
    { key: 'crop_name', label: 'พืช', type: 'select', allowCustom: true, options: ['กรีนโอ๊ค','เรดโอ๊ค','ฟินเล่ย์','ผักสลัดอื่นๆ'], placeholder: '-- เลือกพืช --', required: true },
    { key: 'area_sqm', label: 'พื้นที่ (ตร.ม.)', type: 'number', placeholder: 'เช่น 100' },
    { key: 'planting_date', label: 'วันปลูก', type: 'date', placeholder: 'เลือกวันปลูก', required: true },
    { key: 'expected_harvest_date', label: 'วันคาดเก็บ', type: 'date', placeholder: 'เลือกวันคาดเก็บ' },
    { key: 'water_source', label: 'แหล่งน้ำ', placeholder: 'เช่น น้ำบาดาล / น้ำฝน' },
    { key: 'water_source_type', label: 'ประเภทน้ำ', placeholder: 'เช่น น้ำบาดาล / น้ำประปา' },
    { key: 'soil_test_date', label: 'วันที่ตรวจดิน', type: 'date', placeholder: 'วันที่ตรวจดิน' },
    { key: 'soil_test_result', label: 'ผลตรวจดิน', placeholder: 'ผลตรวจดิน' },
    { key: 'previous_crop_history', label: 'ประวัติพืชก่อนหน้า', type: 'textarea', placeholder: 'พืชก่อนหน้านี้', hideInTable: true },
    { key: 'field_safety_status', label: 'ความปลอดภัยของแปลง', type: 'select', options: ['ปลอดภัย','มีสารตกค้าง','รอตรวจสอบ'], placeholder: '-- เลือกสถานะ --' },
    { key: 'soil_notes', label: 'หมายเหตุดิน', type: 'textarea', placeholder: 'สภาพดินและคำแนะนำ', hideInTable: true },
    { key: 'status', label: 'สถานะ', type: 'select', options: ['active','harvested','fallow'], placeholder: '-- เลือกสถานะ --', default: 'active' },
    { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
  ]} />;
}
