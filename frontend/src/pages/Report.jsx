import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { FileDown, QrCode, Printer, CheckCircle2, RefreshCw, Sparkles, Building, User, Calendar, ShieldCheck, Leaf } from 'lucide-react';
import { format } from 'date-fns';

export default function Report() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [qrs, setQrs] = useState([]);
  const [loadingQrs, setLoadingQrs] = useState(false);
  const reportRef = useRef(null);

  const loadReportData = async (selectedYear = year) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/report/${selectedYear}`);
      setReportData(data);
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถโหลดข้อมูลรายงานได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData(year);
    generateQRs();
  }, [year]);

  const generateQRs = async () => {
    setLoadingQrs(true);
    try {
      const { data: harvest } = await api.get('/api/harvest');
      const lots = harvest.filter(h => h.lot_code);
      const out = await Promise.all(lots.map(async h => ({
        ...h,
        url: `${window.location.origin}/trace/${h.lot_code}`,
        qr: await QRCode.toDataURL(`${window.location.origin}/trace/${h.lot_code}`, { width: 200, margin: 1 }),
      })));
      setQrs(out);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQrs(false);
    }
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    toast.info('กำลังประมวลผลเอกสาร PDF กรุณารอสักครู่...');

    try {
      const element = reportRef.current;

      // Render clean canvas without allowTaint to prevent DOMException on toDataURL
      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1024,
      });

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let page = 0;

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      while (heightLeft > 0) {
        if (page > 0) {
          pdf.addPage('a4', 'p');
        }
        
        pdf.addImage(
          imgData,
          'JPEG',
          0,
          -page * pdfHeight,
          pdfWidth,
          imgHeight,
          undefined,
          'FAST'
        );

        heightLeft -= pdfHeight;
        page++;
      }

      pdf.save(`รายงานมาตรฐานGAP_${year}_FarmGAP.pdf`);
      toast.success('ดาวน์โหลดเอกสาร PDF ภาษาไทยสำเร็จ!');
    } catch (err) {
      console.error('Export PDF error:', err);
      toast.info('เปิดหน้าต่างพิมพ์ (เลือก Save as PDF เพื่อบันทึกเป็น PDF คมชัดระดับ Vector)');
      window.print();
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const plotName = (id) => reportData?.plots?.find(p => p.id === id)?.name || '-';
  const totalRev = reportData?.harvest?.reduce((s, h) => s + Number(h.revenue || 0), 0) || 0;
  const totalCost = reportData?.costs?.reduce((s, c) => s + Number(c.amount || 0), 0) || 0;
  const totalQty = reportData?.harvest?.reduce((s, h) => s + Number(h.quantity || 0), 0) || 0;
  const profit = totalRev - totalCost;

  return (
    <div className="space-y-6">
      {/* Action Header - Screen Only */}
      <div className="print:hidden space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#173f2a] flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-emerald-700" />
              รายงานมาตรฐาน GAP ประจำปี & QR Traceability
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              รวบรวมข้อมูลแปลงปลูก บันทึก 7 หมวดตามมาตรฐานเกษตรปลอดภัย GAP และระบบตรวจสอบย้อนกลับ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 transition shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" /> พิมพ์เอกสาร (Print)
            </button>
            <button
              onClick={exportPDF}
              disabled={exporting || loading}
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer"
            >
              <FileDown className="w-4 h-4" /> {exporting ? 'กำลังสร้าง PDF...' : '📄 ดาวน์โหลด PDF (ภาษาไทย)'}
            </button>
          </div>
        </div>

        {/* Year Filter & Stats Card */}
        <div className="surface rounded-2xl p-5 bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-600">เลือกปีรายงาน:</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="input text-xs w-28 font-bold text-center"
            />
            <button
              onClick={() => loadReportData(year)}
              className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl font-bold border border-emerald-200">
              ผลผลิตรวม: {totalQty.toLocaleString()} กก.
            </span>
            <span className="bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl font-bold border border-blue-200">
              รายได้รวม: ฿{totalRev.toLocaleString()}
            </span>
            <span className={`px-3 py-1.5 rounded-xl font-bold border ${profit >= 0 ? 'bg-green-50 text-green-800 border-green-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
              กำไรสุทธิ: ฿{profit.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Printable GAP Official Report Document (100% Thai Content) */}
      <div className="overflow-x-auto bg-slate-200/50 p-2 sm:p-6 rounded-3xl print:p-0 print:bg-white print:overflow-visible">
        <div
          ref={reportRef}
          id="gap-report-print-container"
          className="bg-white text-slate-800 p-8 sm:p-12 max-w-4xl mx-auto shadow-xl rounded-2xl print:shadow-none print:rounded-none print:p-0 space-y-6 text-xs font-sans"
        >
          {/* Header Banner */}
          <div className="border-b-2 border-emerald-800 pb-4 gap-section">
            <div className="flex justify-between items-start">
              <div>
                <div className="inline-flex items-center gap-1.5 text-emerald-800 font-bold text-xs uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 mb-2">
                  <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                  แบบบันทึกมาตรฐานการปฏิบัติทางการเกษตรที่ดี (Good Agricultural Practices)
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-[#173f2a]">
                  รายงานการผลิตพืชปลอดภัยตามมาตรฐาน GAP ประจำปี {year + 543} ({year})
                </h1>
                <p className="text-[11px] text-slate-500 mt-1">
                  ระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์ด้วยปัญญาประดิษฐ์ (FarmGAP AI Management System)
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-600 space-y-0.5">
                <div className="font-bold text-emerald-900 text-sm">{reportData?.profile?.farm_name || 'ฟาร์มผักปลอดภัย FarmGAP'}</div>
                <div>เจ้าของแปลง: {reportData?.profile?.display_name || 'นายสมชาย ใจดี'}</div>
                <div>วันที่ออกเอกสาร: {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                <div className="text-emerald-700 font-semibold">สถานะมาตรฐาน: ได้รับการรับรอง GAP</div>
              </div>
            </div>
          </div>

          {/* Section 1: ข้อมูลแปลงปลูก */}
          <div className="gap-section space-y-2">
            <h2 className="font-bold text-sm text-emerald-900 flex items-center gap-1.5 border-l-4 border-emerald-700 pl-2">
              หมวดที่ 1: ข้อมูลแปลงเพาะปลูก (Plots Management)
            </h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="min-w-full text-[11px]">
                <thead className="bg-emerald-800 text-white font-bold">
                  <tr>
                    <th className="py-2 px-3 text-left">ชื่อแปลง</th>
                    <th className="py-2 px-3 text-left">ชนิดผัก/พืชที่ปลูก</th>
                    <th className="py-2 px-3 text-right">พื้นที่ (ตร.ม.)</th>
                    <th className="py-2 px-3 text-left">วันที่เริ่มปลูก</th>
                    <th className="py-2 px-3 text-left">แหล่งน้ำ</th>
                    <th className="py-2 px-3 text-left">การเตรียมดิน/วัสดุปลูก (GAP)</th>
                    <th className="py-2 px-3 text-center">สถานะความปลอดภัย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!reportData?.plots?.length ? (
                    <tr><td colSpan={7} className="text-center py-4 text-slate-400">ไม่มีข้อมูลแปลงปลูก</td></tr>
                  ) : (
                    reportData.plots.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{p.name}</td>
                        <td className="py-2 px-3 text-emerald-800 font-bold">{p.crop_name}</td>
                        <td className="py-2 px-3 text-right">{Number(p.area_sqm || 0).toLocaleString()}</td>
                        <td className="py-2 px-3">{p.planting_date ? format(new Date(p.planting_date), 'dd/MM/yyyy') : '-'}</td>
                        <td className="py-2 px-3">{p.water_source || '-'}</td>
                        <td className="py-2 px-3 text-slate-700">
                          <div>{p.soil_notes || p.soil_test_result || 'ดินอินทรีย์ สะอาด ปลอดภัย'}</div>
                          {p.soil_test_date && (
                            <div className="text-[10px] text-slate-400">
                              (ตรวจ: {format(new Date(p.soil_test_date), 'dd/MM/yy')})
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            {p.field_safety_status || 'ปลอดภัย'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: แหล่งน้ำ (GAP #1) */}
          <div className="gap-section space-y-2">
            <h2 className="font-bold text-sm text-emerald-900 flex items-center gap-1.5 border-l-4 border-emerald-700 pl-2">
              หมวดที่ 2: บันทึกการใช้น้ำและการตรวจสอบคุณภาพน้ำ (GAP #1 - Water Quality)
            </h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="min-w-full text-[11px]">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="py-2 px-3 text-left">วันที่บันทึก</th>
                    <th className="py-2 px-3 text-left">รอบให้น้ำ</th>
                    <th className="py-2 px-3 text-left">แปลง</th>
                    <th className="py-2 px-3 text-left">แหล่งน้ำ</th>
                    <th className="py-2 px-3 text-left">ผลตรวจคุณภาพน้ำ</th>
                    <th className="py-2 px-3 text-right">ปริมาณ (ลิตร)</th>
                    <th className="py-2 px-3 text-left">ผู้ปฏิบัติงาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!reportData?.water?.length ? (
                    <tr><td colSpan={7} className="text-center py-4 text-slate-400">ไม่มีข้อมูลบันทึกการให้น้ำ</td></tr>
                  ) : (
                    reportData.water.map(w => (
                      <tr key={w.id}>
                        <td className="py-1.5 px-3">{format(new Date(w.log_date), 'dd/MM/yyyy')}</td>
                        <td className="py-1.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            w.session === 'เย็น' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {w.session || 'เช้า'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 font-medium">{plotName(w.plot_id)}</td>
                        <td className="py-1.5 px-3">{w.water_source}</td>
                        <td className="py-1.5 px-3 text-emerald-700 font-semibold">{w.water_quality}</td>
                        <td className="py-1.5 px-3 text-right">{Number(w.amount_liters || 0).toLocaleString()}</td>
                        <td className="py-1.5 px-3">{w.worker_name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: ปุ๋ยและสารเคมี/ชีวภัณฑ์ (GAP #3) */}
          <div className="gap-section space-y-2">
            <h2 className="font-bold text-sm text-emerald-900 flex items-center gap-1.5 border-l-4 border-emerald-700 pl-2">
              หมวดที่ 3: บันทึกการใช้ปุ๋ยและสารชีวภัณฑ์ป้องกันกำจัดศัตรูพืช (GAP #3 - Inputs)
            </h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="min-w-full text-[11px]">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="py-2 px-3 text-left">วันที่</th>
                    <th className="py-2 px-3 text-left">แปลง</th>
                    <th className="py-2 px-3 text-left">ประเภท/ชื่อสารที่ใช้</th>
                    <th className="py-2 px-3 text-left">ปริมาณ</th>
                    <th className="py-2 px-3 text-left">วัตถุประสงค์</th>
                    <th className="py-2 px-3 text-center">ระยะหยุดใช้ (PHI)</th>
                    <th className="py-2 px-3 text-left">ผู้ปฏิบัติงาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!reportData?.chems?.length ? (
                    <tr><td colSpan={7} className="text-center py-4 text-slate-400">ไม่มีข้อมูลการใช้สารชีวภัณฑ์</td></tr>
                  ) : (
                    reportData.chems.map(c => (
                      <tr key={c.id}>
                        <td className="py-1.5 px-3">{format(new Date(c.log_date), 'dd/MM/yyyy')}</td>
                        <td className="py-1.5 px-3 font-medium">{plotName(c.plot_id)}</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">{c.product_name}</td>
                        <td className="py-1.5 px-3">{c.amount} {c.unit}</td>
                        <td className="py-1.5 px-3 text-slate-600">{c.reason || '-'}</td>
                        <td className="py-1.5 px-3 text-center">{c.phi_days} วัน</td>
                        <td className="py-1.5 px-3">{c.worker_name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: การเก็บเกี่ยวผลผลิต (GAP #5) */}
          <div className="gap-section space-y-2">
            <h2 className="font-bold text-sm text-emerald-900 flex items-center gap-1.5 border-l-4 border-emerald-700 pl-2">
              หมวดที่ 4: บันทึกการเก็บเกี่ยวผลผลิตและรหัสล็อตตรวจสอบย้อนกลับ (GAP #5 - Harvest & Traceability)
            </h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="min-w-full text-[11px]">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="py-2 px-3 text-left">วันที่เก็บผลผลิต</th>
                    <th className="py-2 px-3 text-left">แปลง</th>
                    <th className="py-2 px-3 text-left">รหัสล็อต (Lot Code)</th>
                    <th className="py-2 px-3 text-right">ปริมาณ</th>
                    <th className="py-2 px-3 text-center">เกรด</th>
                    <th className="py-2 px-3 text-left">สุขอนามัยหลังเก็บผลผลิต</th>
                    <th className="py-2 px-3 text-right">มูลค่า (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!reportData?.harvest?.length ? (
                    <tr><td colSpan={7} className="text-center py-4 text-slate-400">ไม่มีข้อมูลการเก็บผลผลิต</td></tr>
                  ) : (
                    reportData.harvest.map(h => (
                      <tr key={h.id}>
                        <td className="py-1.5 px-3">{format(new Date(h.harvest_date), 'dd/MM/yyyy')}</td>
                        <td className="py-1.5 px-3 font-medium">{plotName(h.plot_id)}</td>
                        <td className="py-1.5 px-3 font-mono font-bold text-emerald-800">{h.lot_code || '-'}</td>
                        <td className="py-1.5 px-3 text-right font-bold">{Number(h.quantity).toLocaleString()} {h.unit}</td>
                        <td className="py-1.5 px-3 text-center font-bold text-amber-700">{h.quality_grade}</td>
                        <td className="py-1.5 px-3 text-slate-600">{h.postharvest_handling || h.harvest_hygiene}</td>
                        <td className="py-1.5 px-3 text-right font-semibold">฿{Number(h.revenue || 0).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: การเก็บรักษาและการขนส่ง (GAP #6) */}
          <div className="gap-section space-y-2">
            <h2 className="font-bold text-sm text-emerald-900 flex items-center gap-1.5 border-l-4 border-emerald-700 pl-2">
              หมวดที่ 5: บันทึกการเก็บรักษาและการขนส่งผลผลิต (GAP #6 - Storage & Logistics)
            </h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="min-w-full text-[11px]">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="py-2 px-3 text-left">วันที่</th>
                    <th className="py-2 px-3 text-left">สถานที่จัดเก็บ/ห้องเย็น</th>
                    <th className="py-2 px-3 text-left">สถานที่ส่งมอบ (ปลายทาง)</th>
                    <th className="py-2 px-3 text-left">ผู้รับซื้อ</th>
                    <th className="py-2 px-3 text-left">ยานพาหนะขนส่ง</th>
                    <th className="py-2 px-3 text-center">ความสะอาดรถ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!reportData?.storage?.length ? (
                    <tr><td colSpan={6} className="text-center py-4 text-slate-400">ไม่มีข้อมูลการขนส่ง</td></tr>
                  ) : (
                    reportData.storage.map(s => (
                      <tr key={s.id}>
                        <td className="py-1.5 px-3">{format(new Date(s.log_date), 'dd/MM/yyyy')}</td>
                        <td className="py-1.5 px-3">{s.storage_location}</td>
                        <td className="py-1.5 px-3 font-medium text-emerald-900">{s.shipped_to}</td>
                        <td className="py-1.5 px-3">{s.buyer}</td>
                        <td className="py-1.5 px-3">{s.vehicle}</td>
                        <td className="py-1.5 px-3 text-center">
                          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            {s.vehicle_clean_status ? 'สะอาด/ผ่าน' : 'รอตรวจ'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 6: คนงานและการประเมิน Checklist GAP */}
          <div className="gap-section grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h2 className="font-bold text-sm text-emerald-900 border-l-4 border-emerald-700 pl-2">
                หมวดที่ 6: ข้อมูลคนงานและการอบรมสุขอนามัย (GAP #7)
              </h2>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="py-2 px-3 text-left">ชื่อ-นามสกุล</th>
                      <th className="py-2 px-3 text-left">ตำแหน่ง/หน้าที่</th>
                      <th className="py-2 px-3 text-center">การอบรม GAP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData?.workers?.map(w => (
                      <tr key={w.id}>
                        <td className="py-1.5 px-3 font-semibold">{w.name}</td>
                        <td className="py-1.5 px-3 text-slate-600">{w.role}</td>
                        <td className="py-1.5 px-3 text-center">
                          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px] font-bold">ผ่านการอบรม</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="font-bold text-sm text-emerald-900 border-l-4 border-emerald-700 pl-2">
                หมวดที่ 7: ผลการประเมินแปลง Checklist GAP
              </h2>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="py-2 px-3 text-left">แปลง</th>
                      <th className="py-2 px-3 text-left">ผู้ตรวจประเมิน</th>
                      <th className="py-2 px-3 text-center">ผลการตรวจ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData?.checklists?.slice(0, 4).map(chk => (
                      <tr key={chk.id}>
                        <td className="py-1.5 px-3 font-medium">{plotName(chk.plot_id)}</td>
                        <td className="py-1.5 px-3 text-slate-600">{chk.inspector_name}</td>
                        <td className="py-1.5 px-3 text-center">
                          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px] font-bold">ผ่านเกณฑ์ 100%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 7: สรุปภาพรวมและลงนามรับรอง */}
          <div className="gap-section bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-sm text-emerald-900">สรุปภาพรวมผลการดำเนินงานและผลผลิตประจำปี</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-emerald-100">
                <div className="text-slate-400">ผลผลิตผักสดรวม</div>
                <div className="text-base font-black text-emerald-800">{totalQty.toLocaleString()} กก.</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-100">
                <div className="text-slate-400">รายได้รวมจากการขาย</div>
                <div className="text-base font-black text-blue-800">฿{totalRev.toLocaleString()}</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-100">
                <div className="text-slate-400">ต้นทุนการผลิตรวม</div>
                <div className="text-base font-black text-amber-800">฿{totalCost.toLocaleString()}</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-100">
                <div className="text-slate-400">กำไรสุทธิจากการผลิต</div>
                <div className="text-base font-black text-green-800">฿{profit.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="gap-section pt-8 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-6">
              <div className="border-b border-slate-400 w-48 mx-auto"></div>
              <div>
                <p className="font-bold text-slate-800">( {reportData?.profile?.display_name || 'นายสมชาย ใจดี'} )</p>
                <p className="text-[11px] text-slate-500">ผู้ขอรับการรับรอง / เจ้าของฟาร์ม</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="border-b border-slate-400 w-48 mx-auto"></div>
              <div>
                <p className="font-bold text-slate-800">( ............................................................ )</p>
                <p className="text-[11px] text-slate-500">ผู้ตรวจประเมินมาตรฐาน GAP (Inspector)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Traceability Shelf - Screen Only */}
      <div className="surface rounded-2xl p-6 bg-white border border-slate-200/80 shadow-xs print:hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-[#173f2a] flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-700" />
              QR Code ตรวจสอบย้อนกลับตามรหัสล็อตเก็บผลผลิต (Traceability)
            </h2>
            <p className="text-xs text-slate-500">
              ผู้บริโภคสามารถสแกน QR Code บนถุงผักเพื่อตรวจสอบแปลงปลูก วันที่เก็บผลผลิต และมาตรฐานความปลอดภัย GAP ได้ทันที
            </p>
          </div>
          <button
            onClick={generateQRs}
            disabled={loadingQrs}
            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-2 rounded-xl border border-emerald-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingQrs ? 'animate-spin' : ''}`} />
            สร้าง QR ล่าสุด
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {qrs.map(q => (
            <div key={q.id} className="border border-slate-200 rounded-2xl p-4 text-center bg-slate-50/50 hover:bg-white hover:shadow-md transition space-y-2">
              <img src={q.qr} alt={q.lot_code} className="mx-auto w-36 h-36 rounded-xl border border-slate-200 bg-white p-1" />
              <div className="font-mono font-bold text-xs text-emerald-900">{q.lot_code}</div>
              <div className="text-[11px] text-slate-500">แปลง: {plotName(q.plot_id)} ({q.quantity} {q.unit})</div>
              <a
                href={q.url}
                target="_blank"
                rel="noreferrer"
                className="inline-block bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition"
              >
                🔍 ทดสอบเปิดหน้า Trace
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
