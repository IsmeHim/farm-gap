import LogManager from '../components/LogManager.jsx';
export default function Costs() {
  return <LogManager title="ต้นทุน-รายจ่าย" endpoint="costs" plotsLookup fields={[
    { key: 'log_date', label: 'วันที่', type: 'date', placeholder: 'เลือกวันที่', required: true },
    { key: 'plot_id', label: 'แปลง (ถ้ามี)', placeholder: '-- เลือกแปลง (ถ้ามี) --' },
    { key: 'category', label: 'หมวด', type: 'select', options: ['เมล็ดพันธุ์','ปุ๋ย','สารเคมี','แรงงาน','อุปกรณ์','อื่นๆ'], placeholder: '-- เลือกหมวด --', required: true },
    { key: 'description', label: 'รายละเอียด', placeholder: 'รายละเอียดค่าใช้จ่าย' },
    { key: 'amount', label: 'จำนวนเงิน', type: 'number', placeholder: 'จำนวนเงิน (บาท)', required: true },
  ]} />;
}
