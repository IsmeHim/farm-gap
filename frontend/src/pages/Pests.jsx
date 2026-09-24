import LogManager from '../components/LogManager.jsx';

export default function Pests() {
  return (
    <LogManager
      title="ศัตรูพืช โรค & บันทึกความเสียหาย (GAP #4)"
      endpoint="pests"
      plotsLookup
      fields={[
        { key: 'log_date', label: 'วันที่', type: 'date', placeholder: 'เลือกวันที่', required: true },
        { key: 'plot_id', label: 'แปลง', placeholder: '-- เลือกแปลง --', required: true },
        { key: 'pest_or_disease', label: 'ศัตรูพืช / โรค / อาการ', placeholder: 'เช่น หนอนกระทู้ผัก, ราสนิมขาว, รากเน่าโคนเน่า', required: true },
        { key: 'damage_cause', label: 'สาเหตุความเสียหาย', type: 'select', options: ['หนอน/แมลงศัตรูพืช', 'โรคพืช/เชื้อรา/แบคทีเรีย', 'สภาพอากาศ/แดดเผา/น้ำท่วม', 'ต้นแคระแกร็น/คัดทิ้ง', 'สัตว์รบกวน/นก/หนู', 'อื่นๆ'], placeholder: '-- เลือกสาเหตุ --', allowCustom: true },
        { key: 'damaged_count', label: 'จำนวนต้นที่เสียหาย (ต้น)', type: 'number', placeholder: 'เช่น 5 (ตัดยอดแปลงอัตโนมัติ)', default: 0 },
        { key: 'severity', label: 'ความรุนแรง', type: 'select', options: ['น้อย', 'ปานกลาง', 'รุนแรง'], placeholder: '-- เลือกระดับความรุนแรง --' },
        { key: 'treatment_method', label: 'วิธีจัดการ / กำจัด', placeholder: 'เช่น เก็บตัวหนอนทิ้ง, ฉีดพ่นเชื้อบิวเวอร์เรีย, คัดแยกต้นทิ้ง' },
        { key: 'worker_name', label: 'ผู้ปฏิบัติ', placeholder: 'ชื่อผู้ปฏิบัติ' },
        { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
      ]}
    />
  );
}
