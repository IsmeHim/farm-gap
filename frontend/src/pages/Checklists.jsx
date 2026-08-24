import LogManager from '../components/LogManager.jsx';

export default function Checklists() {
  return <LogManager title="Checklist GAP" endpoint="checklists" plotsLookup fields={[
    { key: 'check_date', label: 'วันที่ตรวจ', type: 'date', required: true, placeholder: 'เลือกวันที่ตรวจ' },
    { key: 'plot_id', label: 'แปลง', required: true, placeholder: '-- เลือกแปลง --' },
    { key: 'inspector_name', label: 'ชื่อผู้ตรวจ', placeholder: 'ชื่อผู้ตรวจ' },
    { key: 'field_inspection_pass', label: 'ตรวจแปลงผ่าน', type: 'bool' },
    { key: 'cleaning_check', label: 'ความสะอาดผ่าน', type: 'bool' },
    { key: 'pest_management_check', label: 'จัดการศัตรูพืชได้', type: 'bool' },
    { key: 'water_quality_check', label: 'น้ำสะอาด', type: 'bool' },
    { key: 'chemical_usage_check', label: 'ใช้สารเคมีถูกต้อง', type: 'bool' },
    { key: 'hygiene_check', label: 'สุขอนามัยผ่าน', type: 'bool' },
    { key: 'notes', label: 'หมายเหตุ', type: 'textarea', hideInTable: true, placeholder: 'รายละเอียดเพิ่มเติม' },
  ]} />;
}
