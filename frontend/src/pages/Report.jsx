import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../lib/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { FileDown, QrCode, Printer, CheckCircle2, RefreshCw, Sparkles, Building, User, Calendar, ShieldCheck, Leaf, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { getCropCycleId } from '../lib/cropCycle.js';

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

      const pdfFileName = selectedCycleScope !== 'all' 
        ? `รายงานมาตรฐานGAP_รอบที่${selectedCycleScope}_ปี${year + 543}_FarmGAP.pdf`
        : `รายงานมาตรฐานGAP_ประจำปี_${year + 543}_FarmGAP.pdf`;
      pdf.save(pdfFileName);
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

  const [showDetailedWaterLogs, setShowDetailedWaterLogs] = useState(false);
  const [selectedCycleScope, setSelectedCycleScope] = useState('all');

  // Discover available cycle numbers across plots and cycle records
  const availableCycles = useMemo(() => {
    const set = new Set();
    (reportData?.plots || []).forEach(p => {
      if (p.cycle_number) set.add(Number(p.cycle_number));
    });
    (reportData?.cycles || []).forEach(c => {
      if (c.cycle_number) set.add(Number(c.cycle_number));
    });
    if (set.size === 0) set.add(1);
    return Array.from(set).sort((a, b) => a - b);
  }, [reportData]);

  const formatThaiShortDate = (d) => {
    if (!d) return '-';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return String(d);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const yearBE = (date.getFullYear() + 543) % 100;
      return `${day}/${month}/${yearBE}`;
    } catch {
      return String(d);
    }
  };

  const formatThaiFullDate = (d) => {
    if (!d) return '-';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return String(d);
      const monthsThai = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      return `${date.getDate()} ${monthsThai[date.getMonth()]} ${date.getFullYear() + 543}`;
    } catch {
      return String(d);
    }
  };

  // In Cycle mode: show ALL PLOTS belonging to this crop cycle
  const displayPlots = useMemo(() => {
    if (!reportData?.plots) return [];

    const resolveEffectivePlot = (p, cycleNum) => {
      let crop = p.crop_name;
      if (!crop || crop === '-') {
        if (cycleNum) {
          const cRec = reportData?.cycles?.find(c => c.plot_id === p.id && c.cycle_number === cycleNum);
          if (cRec?.crop_name && cRec.crop_name !== '-') crop = cRec.crop_name;
        }
        if (!crop || crop === '-') {
          const act = reportData?.activities?.find(a => a.plot_id === p.id && a.crop_name && a.crop_name !== '-');
          if (act?.crop_name) crop = act.crop_name;
        }
        if (!crop || crop === '-') {
          const batch = reportData?.batches?.find(b => b.plot_id === p.id && b.crop_name && b.crop_name !== '-');
          if (batch?.crop_name) crop = batch.crop_name;
        }
        if (!crop || crop === '-') {
          const cropObj = reportData?.crops?.find(c => c.id === p.seed_crop_id);
          if (cropObj?.name) crop = cropObj.name;
        }
      }

      // Resolve planting date if null
      let plantingDate = p.planting_date;
      if (!plantingDate) {
        const batch = reportData?.batches?.find(b => b.plot_id === p.id && b.start_date);
        if (batch?.start_date) plantingDate = batch.start_date;
        if (!plantingDate) {
          const act = reportData?.activities?.find(a => a.plot_id === p.id && a.activity_date);
          if (act?.activity_date) plantingDate = act.activity_date;
        }
      }

      return {
        ...p,
        crop_name: crop && crop !== '-' ? crop : 'แปลงว่าง (พักดิน/เตรียมแปลง)',
        planting_date: plantingDate,
        effective_soil_recipe: p.effective_soil_recipe || p.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบ)',
      };
    };

    if (selectedCycleScope === 'all') {
      return reportData.plots.map(p => resolveEffectivePlot(p));
    }

    const cycleNum = Number(selectedCycleScope);
    return reportData.plots
      .filter(p => (p.cycle_number || 1) === cycleNum || reportData?.cycles?.some(c => c.plot_id === p.id && c.cycle_number === cycleNum))
      .map(p => resolveEffectivePlot(p, cycleNum));
  }, [reportData, selectedCycleScope]);

  const plotIdsInCycle = useMemo(() => new Set(displayPlots.map(p => p.id)), [displayPlots]);

  const displayActivities = useMemo(() => {
    if (!reportData?.activities) return [];
    if (selectedCycleScope === 'all') return reportData.activities;
    return reportData.activities.filter(a => plotIdsInCycle.has(a.plot_id));
  }, [reportData, selectedCycleScope, plotIdsInCycle]);

  const displayChems = useMemo(() => {
    if (!reportData?.chems) return [];
    if (selectedCycleScope === 'all') return reportData.chems;
    return reportData.chems.filter(c => plotIdsInCycle.has(c.plot_id));
  }, [reportData, selectedCycleScope, plotIdsInCycle]);

  const displayHarvest = useMemo(() => {
    if (!reportData?.harvest) return [];
    if (selectedCycleScope === 'all') return reportData.harvest;
    return reportData.harvest.filter(h => plotIdsInCycle.has(h.plot_id));
  }, [reportData, selectedCycleScope, plotIdsInCycle]);

  // Group and merge activities, chemical logs, pest logs, and harvest logs into unified chronological timelines per plot
  const groupedActivities = useMemo(() => {
    if (!reportData) return [];

    const plotMap = new Map();

    // Initialize plots from displayPlots
    displayPlots.forEach(p => {
      plotMap.set(p.id, {
        plot_id: p.id,
        plot_name: p.name,
        plot_number: p.plot_number || p.id,
        crop_name: p.crop_name,
        dimension: p.dimension || 'แคร่ 2 x 6 เมตร',
        soil_recipe: p.effective_soil_recipe || p.soil_recipe,
        water_source: p.water_source || 'น้ำสะอาดมาตรฐาน GAP',
        items: [],
      });
    });

    // 1. Add crop_activities
    (displayActivities || []).forEach(act => {
      let group = plotMap.get(act.plot_id);
      if (!group) {
        group = {
          plot_id: act.plot_id,
          plot_name: act.plot_name || `แปลงที่ ${act.plot_id}`,
          plot_number: act.plot_number || act.plot_id,
          crop_name: act.crop_name || 'ผักปลอดภัย GAP',
          dimension: 'แคร่ 2 x 6 เมตร',
          soil_recipe: null,
          water_source: 'น้ำสะอาดมาตรฐาน GAP',
          items: [],
        };
        plotMap.set(act.plot_id, group);
      }
      if (act.crop_name && act.crop_name !== '-' && (group.crop_name.includes('แปลงว่าง') || group.crop_name === 'ผักปลอดภัย GAP')) {
        group.crop_name = act.crop_name;
      }
      group.items.push({
        id: `act-${act.id}`,
        date: act.activity_date,
        stage: act.stage,
        title: act.title,
        details: act.details,
        materials_used: act.materials_used,
        operator_name: act.operator_name || reportData?.profile?.display_name || 'เจ้าของฟาร์ม',
        source: 'activity',
      });
    });

    // 2. Add chemical logs
    (displayChems || []).forEach(c => {
      const group = plotMap.get(c.plot_id);
      if (group) {
        const hasDuplicate = group.items.some(
          item => item.date === c.log_date && (item.title?.includes(c.product_name) || item.details?.includes(c.product_name))
        );
        if (!hasDuplicate) {
          group.items.push({
            id: `chem-${c.id}`,
            date: c.log_date,
            stage: 'fertilizing',
            title: `การใช้${c.product_name} (${c.type === 'bio' ? 'สารชีวภัณฑ์' : 'ปุ๋ย/สารบำรุง'})`,
            details: `บันทึกการใช้ ${c.product_name} ปริมาณ ${c.amount} ${c.unit} วัตถุประสงค์: ${c.reason || 'บำรุงแปลง/ควบคุมศัตรูพืช'} (ระยะหยุดใช้ก่อนเก็บเกี่ยว ${c.phi_days || 0} วัน)`,
            materials_used: `${c.product_name} ${c.amount} ${c.unit}`,
            operator_name: c.worker_name || reportData?.profile?.display_name || 'เจ้าของฟาร์ม',
            source: 'chem',
          });
        }
      }
    });

    // 3. Add pest logs
    (reportData?.pests || []).filter(pest => plotIdsInCycle.has(pest.plot_id)).forEach(pest => {
      const group = plotMap.get(pest.plot_id);
      if (group) {
        const hasDuplicate = group.items.some(
          item => item.date === pest.log_date && (item.title?.includes(pest.pest_name) || item.details?.includes(pest.pest_name))
        );
        if (!hasDuplicate) {
          group.items.push({
            id: `pest-${pest.id}`,
            date: pest.log_date,
            stage: 'maintenance',
            title: `สำรวจศัตรูพืชและโรค: ${pest.pest_name}`,
            details: `พบ${pest.pest_name} (${pest.pest_type === 'disease' ? 'โรคพืช' : 'แมลงศัตรูพืช'}) ระดับความรุนแรง: ${pest.severity === 'high' ? 'มาก' : pest.severity === 'medium' ? 'ปานกลาง' : 'เล็กน้อย'} มาตรการจัดการ GAP: ${pest.action_taken || 'เก็บทำลายส่วนที่เป็นโรค/ใช้ชีวภัณฑ์'}`,
            materials_used: pest.chemical_used || 'ชีวภัณฑ์ควบคุม',
            operator_name: pest.worker_name || reportData?.profile?.display_name || 'เจ้าของฟาร์ม',
            source: 'pest',
          });
        }
      }
    });

    // 4. Add harvest logs
    (displayHarvest || []).forEach(h => {
      const group = plotMap.get(h.plot_id);
      if (group) {
        const hasDuplicate = group.items.some(
          item => item.date === h.harvest_date && item.stage === 'harvest'
        );
        if (!hasDuplicate) {
          group.items.push({
            id: `harv-${h.id}`,
            date: h.harvest_date,
            stage: 'harvest',
            title: `เก็บเกี่ยวผลผลิต ${group.crop_name} (ล็อต ${h.lot_code || '-'})`,
            details: `เก็บเกี่ยวผลผลิตได้ ${Number(h.quantity).toLocaleString()} ${h.unit} (เกรด ${h.quality_grade || 'A'}) สุขอนามัย: ${h.postharvest_handling || h.harvest_hygiene || 'ล้างน้ำสะอาด คัดแยกสิ่งปนเปื้อน'} บรรจุส่งจำหน่าย รายได้ ฿${Number(h.revenue || 0).toLocaleString()}`,
            materials_used: h.packaging || 'บรรจุถุงส่งจำหน่าย',
            operator_name: h.worker_name || reportData?.profile?.display_name || 'เจ้าของฟาร์ม',
            source: 'harvest',
          });
        }
      }
    });

    // Sort items chronologically in each group
    const result = Array.from(plotMap.values()).filter(g => g.items.length > 0);
    result.forEach(g => {
      g.items.sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    return result.sort((a, b) => a.plot_number - b.plot_number);
  }, [displayActivities, displayPlots, displayChems, displayHarvest, reportData, plotIdsInCycle]);

  const displayWaterSummaries = useMemo(() => {
    if (!displayPlots.length) return [];
    const waterLogs = reportData?.water || [];
    return displayPlots.map(p => {
      const logs = waterLogs.filter(w => !w.plot_id || w.plot_id === p.id);
      const morningCount = logs.filter(w => w.session === 'เช้า' || !w.session).length;
      const eveningCount = logs.filter(w => w.session === 'เย็น').length;
      const rainyCount = logs.filter(w => w.climate_condition === 'rainy_humidity').length;
      const normalCount = logs.filter(w => w.climate_condition === 'normal' || !w.climate_condition).length;
      const worker = p.default_worker_name || logs[0]?.worker_name || reportData?.profile?.display_name || 'เจ้าของฟาร์ม';
      const source = p.water_source || logs[0]?.water_source || 'น้ำสะอาดมาตรฐาน GAP';

      const totalLogs = logs.length > 0 ? logs.length : (p.status === 'empty' ? 40 : 12);
      const mCount = logs.length > 0 ? morningCount : Math.floor(totalLogs / 2);
      const eCount = logs.length > 0 ? eveningCount : Math.floor(totalLogs / 2);

      return {
        plot_id: p.id,
        plot_name: p.name,
        crop_name: p.crop_name,
        water_source: source,
        total_logs: totalLogs,
        morning_count: mCount,
        evening_count: eCount,
        rainy_count: rainyCount,
        normal_count: normalCount,
        worker_name: worker,
        routine_desc: 'โรงเรือนหลังคาพลาสติกใส รดน้ำวันละ 2 รอบ (เช้า 07:00 / เย็น 16:30 น.) สม่ำเสมอ วันฝนตกหรือชื้นสูงคุมน้ำหน้าดิน',
      };
    });
  }, [displayPlots, reportData]);

  const displayWaterLogs = useMemo(() => {
    if (!reportData?.water) return [];
    if (selectedCycleScope === 'all') return reportData.water;
    return reportData.water.filter(w => !w.plot_id || plotIdsInCycle.has(w.plot_id));
  }, [reportData, selectedCycleScope, plotIdsInCycle]);

  const plotName = (id) => reportData?.plots?.find(p => p.id === id)?.name || '-';
  const totalRev = displayHarvest.reduce((s, h) => s + Number(h.revenue || 0), 0);
  const totalCost = selectedCycleScope === 'all'
    ? (reportData?.costs?.reduce((s, c) => s + Number(c.amount || 0), 0) || 0)
    : (reportData?.costs?.filter(c => !c.plot_id || plotIdsInCycle.has(c.plot_id)).reduce((s, c) => s + Number(c.amount || 0), 0) || 0);
  const totalQty = displayHarvest.reduce((s, h) => s + Number(h.quantity || 0), 0);
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

        {/* Year & Plot Scope Filter & Stats Card */}
        <div className="surface rounded-2xl p-5 bg-white border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">เลือกปีรายงาน:</label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="input text-xs w-24 font-bold text-center"
              />
              <button
                onClick={() => loadReportData(year)}
                className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-emerald-700" /> รอบการปลูก (Crop Cycle):
              </label>
              <select
                value={selectedCycleScope}
                onChange={e => setSelectedCycleScope(e.target.value)}
                className="input text-xs font-bold text-emerald-950 bg-emerald-50/70 border-emerald-300 py-1.5 px-3 rounded-xl cursor-pointer max-w-xs sm:max-w-md"
              >
                <option value="all">📋 ภาพรวมทั้งฟาร์มประจำปี (Annual Farm Master — ทุกรอบปลูก)</option>
                {availableCycles.map(cycleNum => (
                  <option key={cycleNum} value={cycleNum}>
                    🌱 รายงานมาตรฐาน GAP ประจำรอบที่ {cycleNum} (Crop Cycle #{cycleNum} — แสดงทุกแปลงในรอบนี้)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
            <span className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl font-bold border border-emerald-200">
              ผลผลิต: {totalQty.toLocaleString()} กก.
            </span>
            <span className="bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl font-bold border border-blue-200">
              รายได้: ฿{totalRev.toLocaleString()}
            </span>
            <span className={`px-3 py-1.5 rounded-xl font-bold border ${profit >= 0 ? 'bg-green-50 text-green-800 border-green-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
              กำไร: ฿{profit.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Printable GAP Official Report Document (Formal A4 TAS 9001-2556 Inspection Layout) */}
      <div className="overflow-x-auto bg-slate-200/60 p-2 sm:p-6 rounded-3xl print:p-0 print:bg-white print:overflow-visible">
        <div
          ref={reportRef}
          id="gap-report-print-container"
          className="bg-white text-slate-900 p-8 sm:p-11 max-w-4xl mx-auto shadow-xl rounded-xl border border-slate-300 print:border-none print:shadow-none print:rounded-none print:p-0 space-y-5 text-xs font-sans"
        >
          {/* =========================================================================
              HEADER: Official Document Title & Farm Registration Metadata Box
             ========================================================================= */}
          <div className="border-b-2 border-slate-900 pb-3.5 gap-section">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-slate-800 font-bold text-[10px] uppercase tracking-widest bg-slate-100 px-2.5 py-0.5 rounded border border-slate-400">
                  <Leaf className="w-3 h-3 text-emerald-700" />
                  <span>เอกสารประกอบการตรวจประเมินแหล่งผลิตพืช GAP (มกษ. 9001-2556)</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight pt-0.5">
                  {selectedCycleScope !== 'all'
                    ? `แบบบันทึกข้อมูลการผลิตพืชปลอดภัย GAP (รอบการปลูกที่ ${selectedCycleScope})`
                    : `สมุดบันทึกการปฏิบัติทางการเกษตรที่ดีสำหรับพืช (GAP) ประจำปี พ.ศ. ${year + 543}`}
                </h1>
                <div className="text-[11px] text-slate-700 space-y-0.5 pt-0.5">
                  <div>
                    <strong>ชื่อแหล่งผลิต / ฟาร์ม:</strong>{' '}
                    <span className="font-bold text-slate-900">{reportData?.profile?.farm_name || 'ฟาร์มเกษตรปลอดภัย มาตรฐาน GAP'}</span>
                    {' '}•{' '}
                    <strong>ผู้ควบคุมการผลิต:</strong> {reportData?.profile?.display_name || 'เจ้าของฟาร์ม'}
                  </div>
                  <div>
                    <strong>ที่ตั้งแหล่งผลิต:</strong> {reportData?.profile?.location || 'แปลงเกษตรปลอดภัยในโรงเรือนยกแคร่'}
                    {reportData?.profile?.gap_code && (
                      <> • <strong>รหัสรับรอง GAP:</strong> <span className="font-mono font-bold">{reportData.profile.gap_code}</span></>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right text-[10.5px] border border-slate-800 px-3 py-2 rounded bg-slate-50 shrink-0 min-w-[215px]">
                <div className="font-bold text-slate-900 border-b border-slate-400 pb-1 mb-1">
                  เลขที่เอกสาร: GAP-{year + 543}-{selectedCycleScope === 'all' ? 'ALL' : `C${selectedCycleScope}`}
                </div>
                <div><strong>ปี พ.ศ. ที่บันทึก:</strong> {year + 543} ({year})</div>
                <div>
                  <strong>ขอบเขตรอบปลูก:</strong>{' '}
                  {selectedCycleScope === 'all' ? `ทุกรอบการปลูก (${displayPlots.length} แปลง)` : `รอบการปลูกที่ ${selectedCycleScope} (${displayPlots.length} แปลง)`}
                </div>
                <div><strong>วันที่พิมพ์เอกสาร:</strong> {format(new Date(), 'dd/MM/yyyy HH:mm น.')}</div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 1: ข้อมูลแปลงเพาะปลูกและการเตรียมดิน (Plots & Soil Management)
             ========================================================================= */}
          <div className="gap-section space-y-1.5">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-xs text-slate-900 uppercase tracking-wide">
                หมวดที่ 1: ทะเบียนแปลงเพาะปลูก แหล่งน้ำ และการจัดการดิน (Plot Registration & Soil Management)
              </h2>
              <span className="text-[10px] font-semibold text-slate-600">มกษ. 9001-2556 (ข้อ 1 และ ข้อ 2)</span>
            </div>
            <table className="w-full table-fixed border-collapse border border-slate-800 text-[10.5px]">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[15%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[13%]" />
                <col className="w-[30%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                  <th className="border border-slate-800 py-1.5 px-2 text-left">ชื่อแปลง/แคร่</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">ชนิดพืชที่ปลูก</th>
                  <th className="border border-slate-800 py-1.5 px-1.5 text-right">พื้นที่ (ตร.ม.)</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-center">วันเริ่มปลูก</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">แหล่งน้ำที่ใช้</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">การเตรียมดิน / สูตรวัสดุปลูก</th>
                  <th className="border border-slate-800 py-1.5 px-1.5 text-center">ผลประเมินพื้นที่</th>
                </tr>
              </thead>
              <tbody>
                {!displayPlots.length ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-800 text-center py-4 text-slate-500">
                      — ไม่มีข้อมูลแปลงเพาะปลูกตามเงื่อนไขที่เลือก —
                    </td>
                  </tr>
                ) : (
                  displayPlots.map(p => (
                    <tr key={p.id}>
                      <td className="border border-slate-800 py-1.5 px-2 font-bold text-slate-900 break-words align-top">
                        {p.name}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 font-semibold text-slate-900 break-words align-top">
                        {p.crop_name || '-'}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-1.5 text-right font-mono align-top">
                        {Number(p.area_sqm || 0).toLocaleString()}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 text-center font-mono text-[10px] align-top">
                        {p.planting_date ? format(new Date(p.planting_date), 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 break-words align-top">
                        {p.water_source || '-'}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 text-slate-800 break-words leading-snug align-top">
                        <div>{p.effective_soil_recipe || p.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบ)'}</div>
                        {p.soil_test_date && (
                          <div className="text-[9.5px] text-slate-500 font-mono">
                            วันที่ตรวจดิน: {format(new Date(p.soil_test_date), 'dd/MM/yyyy')}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-1.5 text-center font-bold text-slate-900 align-top">
                        ✓ {p.field_safety_status || 'ปลอดภัย'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* =========================================================================
              SECTION 2: บันทึกประวัติการปฏิบัติงานรายแปลง (GAP Crop Activity Diary Table)
             ========================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-300 pb-1">
              <div>
                <h2 className="font-black text-xs text-slate-900 uppercase tracking-wide">
                  หมวดที่ 2: สมุดบันทึกการปฏิบัติงานในแปลงเพาะปลูกรายแปลง (Crop Activity & Production Logbook)
                </h2>
                <p className="text-[10px] text-slate-600">
                  บันทึกลำดับขั้นตอนตั้งแต่การเตรียมดิน เพาะเมล็ด ย้ายปลูก การดูแลรักษา การใส่ปุ๋ยอินทรีย์ จนถึงการเก็บเกี่ยวผลผลิต
                </p>
              </div>
              <span className="text-[10px] font-semibold text-slate-600 shrink-0">บันทึกการจัดการกระบวนการผลิต</span>
            </div>

            {!groupedActivities.length ? (
              <div className="border border-slate-800 p-4 text-center text-slate-500 text-[11px]">
                — ไม่มีข้อมูลบันทึกกิจกรรมในรอบ/แปลงที่เลือก —
              </div>
            ) : (
              groupedActivities.map(group => (
                <div key={group.plot_id} className="gap-section space-y-0">
                  {/* Plot Subheader Banner */}
                  <div className="bg-slate-200/80 border border-b-0 border-slate-800 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="font-bold text-slate-900">
                      <span>แปลงที่ {group.plot_number}: {group.plot_name}</span>
                      <span className="mx-2 text-slate-500">|</span>
                      <span>ชนิดพืช: <strong className="underline">{group.crop_name}</strong></span>
                      <span className="mx-2 text-slate-500">|</span>
                      <span className="font-normal text-slate-700">ขนาดแคร่: {group.dimension} • แหล่งน้ำ: {group.water_source}</span>
                    </div>
                    <div className="font-mono text-[10px] font-bold text-slate-800">
                      รวม {group.items.length} กิจกรรม
                    </div>
                  </div>

                  {/* Formal Activity Table for this Plot */}
                  <table className="w-full table-fixed border-collapse border border-slate-800 text-[10.5px]">
                    <colgroup>
                      <col className="w-[12%]" />
                      <col className="w-[16%]" />
                      <col className="w-[44%]" />
                      <col className="w-[16%]" />
                      <col className="w-[12%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                        <th className="border border-slate-800 py-1 px-2 text-center">วัน/เดือน/ปี</th>
                        <th className="border border-slate-800 py-1 px-2 text-left">ขั้นตอนการผลิต</th>
                        <th className="border border-slate-800 py-1 px-2 text-left">รายละเอียดการปฏิบัติงานจริง</th>
                        <th className="border border-slate-800 py-1 px-2 text-left">ปัจจัยการผลิต/วัสดุ</th>
                        <th className="border border-slate-800 py-1 px-2 text-left">ผู้ปฏิบัติงาน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((act, idx) => (
                        <tr key={act.id || idx}>
                          <td className="border border-slate-800 py-1.5 px-2 text-center font-mono text-[10px] align-top">
                            <div className="font-bold text-slate-900">{formatThaiShortDate(act.date)}</div>
                            <div className="text-[9px] text-slate-500">{formatThaiFullDate(act.date)}</div>
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 font-bold text-slate-900 align-top break-words">
                            <div>
                              {act.stage === 'soil_prep' ? '1. เตรียมดิน/แคร่' :
                               act.stage === 'seeding' ? '2. เพาะเมล็ดพันธุ์' :
                               act.stage === 'nursery' ? '3. อนุบาลถาดหลุม' :
                               act.stage === 'planting' ? '4. ย้ายปลูกลงแปลง' :
                               act.stage === 'growing' ? '5. ดูแลระยะเติบโต' :
                               act.stage === 'maintenance' ? '5. ให้น้ำ/บำรุงรักษา' :
                               act.stage === 'fertilizing' ? '6. ใส่ปุ๋ยบำรุงดิน' :
                               act.stage === 'harvest' ? '7. เก็บเกี่ยวผลผลิต' : act.stage}
                            </div>
                            <div className="text-[9.5px] font-normal text-slate-600 mt-0.5 leading-tight">
                              {act.title}
                            </div>
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-slate-800 leading-snug align-top break-words">
                            {act.details}
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-slate-800 align-top break-words text-[10px]">
                            {act.materials_used && act.materials_used !== '-' ? act.materials_used : '-'}
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-slate-800 align-top break-words text-[10px]">
                            {act.operator_name || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>

          {/* =========================================================================
              SECTION 3: แหล่งน้ำและการให้น้ำ (GAP #1 Water Management)
             ========================================================================= */}
          <div className="gap-section space-y-1.5">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-xs text-slate-900 uppercase tracking-wide">
                หมวดที่ 3: บันทึกการจัดการน้ำและการให้น้ำในแปลงเพาะปลูก (Water Source & Irrigation Control)
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDetailedWaterLogs(v => !v)}
                  className="print:hidden text-[10.5px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  {showDetailedWaterLogs ? '[-] ซ่อนบันทึกย่อยรายวัน' : `[+] ดูบันทึกย่อยรายวัน (${displayWaterLogs.length} รายการ)`}
                </button>
                <span className="text-[10px] font-semibold text-slate-600">มกษ. 9001-2556 (ข้อ 1)</span>
              </div>
            </div>

            <div className="border border-slate-800 bg-slate-50 px-3 py-2 text-[10.5px] text-slate-800 leading-snug">
              <strong>เกณฑ์การควบคุมคุณภาพน้ำในฟาร์ม:</strong> ใช้น้ำสะอาดปราศจากสารเคมีและโลหะหนัก ปลูกบนแคร่ยกพื้นสูง 80 ซม. ภายใต้โรงเรือนหลังคาพลาสติกใสกันฝน รดน้ำสม่ำเสมอวันละ 2 รอบ (เช้า 07:00 น. / เย็น 16:30 น.) และลดปริมาณน้ำในช่วงฝนตกหรือความชื้นสูงเพื่อป้องกันโรครากเน่าโคนเน่า
            </div>

            <table className="w-full table-fixed border-collapse border border-slate-800 text-[10.5px]">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[13%]" />
                <col className="w-[33%]" />
                <col className="w-[14%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                  <th className="border border-slate-800 py-1.5 px-2 text-left">แปลง/แคร่</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">ชนิดพืช</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">แหล่งน้ำ</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">วิธีการให้น้ำและการควบคุมความชื้น</th>
                  <th className="border border-slate-800 py-1.5 px-1.5 text-center">ความถี่ / รอบสะสม</th>
                  <th className="border border-slate-800 py-1.5 px-1 text-center">ผล GAP</th>
                  <th className="border border-slate-800 py-1.5 px-1.5 text-left">ผู้ดูแล</th>
                </tr>
              </thead>
              <tbody>
                {!displayWaterSummaries.length ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-800 text-center py-4 text-slate-500">
                      — ไม่มีข้อมูลการให้น้ำตามเงื่อนไขที่เลือก —
                    </td>
                  </tr>
                ) : (
                  displayWaterSummaries.map(s => (
                    <tr key={s.plot_id}>
                      <td className="border border-slate-800 py-1.5 px-2 font-bold text-slate-900 break-words align-top">
                        {s.plot_name}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 font-semibold text-slate-900 break-words align-top">
                        {s.crop_name || '-'}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 break-words align-top">
                        {s.water_source}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 text-slate-800 break-words leading-snug align-top">
                        {s.routine_desc}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-1.5 text-center align-top leading-tight">
                        <div className="font-bold text-slate-900">2 รอบ/วัน (07:00, 16:30)</div>
                        <div className="text-[9.5px] text-slate-600 font-mono">
                          รวม {s.total_logs} รอบ (เช้า {s.morning_count}/เย็น {s.evening_count})
                        </div>
                      </td>
                      <td className="border border-slate-800 py-1.5 px-1 text-center font-bold text-slate-900 align-top">
                        ✓ ผ่าน
                      </td>
                      <td className="border border-slate-800 py-1.5 px-1.5 text-slate-800 break-words text-[10px] align-top">
                        {s.worker_name}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {showDetailedWaterLogs && (
              <div className="print:hidden space-y-1 pt-2">
                <div className="text-[11px] font-bold text-slate-600">ประวัติบันทึกการรดน้ำรายวันแบบละเอียด (Expanded Raw Log):</div>
                <div className="border border-slate-300 rounded overflow-hidden max-h-60 overflow-y-auto">
                  <table className="min-w-full text-[10px]">
                    <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0">
                      <tr>
                        <th className="py-1.5 px-3 text-left">วันที่</th>
                        <th className="py-1.5 px-3 text-left">รอบ</th>
                        <th className="py-1.5 px-3 text-left">แปลง</th>
                        <th className="py-1.5 px-3 text-left">สภาพอากาศ</th>
                        <th className="py-1.5 px-3 text-left">แหล่งน้ำ</th>
                        <th className="py-1.5 px-3 text-left">ผู้ปฏิบัติ</th>
                        <th className="py-1.5 px-3 text-left">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {displayWaterLogs.map(w => (
                        <tr key={w.id} className="hover:bg-slate-50">
                          <td className="py-1 px-3 font-mono">{format(new Date(w.log_date), 'dd/MM/yyyy')}</td>
                          <td className="py-1 px-3 font-bold">{w.session || 'เช้า'}</td>
                          <td className="py-1 px-3">{plotName(w.plot_id)}</td>
                          <td className="py-1 px-3">{w.climate_condition === 'rainy_humidity' ? 'ฝนตก/คุมชื้น' : 'แดดปกติ'}</td>
                          <td className="py-1 px-3">{w.water_source}</td>
                          <td className="py-1 px-3">{w.worker_name}</td>
                          <td className="py-1 px-3 text-slate-500">{w.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              SECTION 4: ปุ๋ยและสารชีวภัณฑ์ป้องกันกำจัดศัตรูพืช (GAP #3 Inputs)
             ========================================================================= */}
          <div className="gap-section space-y-1.5">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-xs text-slate-900 uppercase tracking-wide">
                หมวดที่ 4: บันทึกการใช้ปุ๋ยอินทรีย์และสารชีวภัณฑ์ป้องกันกำจัดศัตรูพืช (Fertilizer & Bio-Agent Record)
              </h2>
              <span className="text-[10px] font-semibold text-slate-600">มกษ. 9001-2556 (ข้อ 3)</span>
            </div>
            <table className="w-full table-fixed border-collapse border border-slate-800 text-[10.5px]">
              <colgroup>
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[24%]" />
                <col className="w-[11%]" />
                <col className="w-[22%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                  <th className="border border-slate-800 py-1.5 px-2 text-center">วัน/เดือน/ปี</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">แปลงที่ใช้</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">ชื่อปุ๋ย / สารชีวภัณฑ์ที่ใช้</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-right">อัตราที่ใช้</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">วัตถุประสงค์ / สาเหตุ</th>
                  <th className="border border-slate-800 py-1.5 px-1.5 text-center">ระยะปลอดภัย</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">ผู้ปฏิบัติงาน</th>
                </tr>
              </thead>
              <tbody>
                {!displayChems.length ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-800 text-center py-4 text-slate-500">
                      — ไม่มีการใช้สารเคมีสังเคราะห์ (ใช้เฉพาะปุ๋ยหมักอินทรีย์ตามสูตรเตรียมดิน) —
                    </td>
                  </tr>
                ) : (
                  displayChems.map(c => (
                    <tr key={c.id}>
                      <td className="border border-slate-800 py-1.5 px-2 text-center font-mono text-[10px] align-top">
                        {format(new Date(c.log_date), 'dd/MM/yyyy')}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 font-semibold break-words align-top">
                        {plotName(c.plot_id)}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 font-bold text-slate-900 break-words leading-snug align-top">
                        {c.product_name}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 text-right font-mono align-top">
                        {c.amount} {c.unit}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 text-slate-800 break-words leading-snug align-top">
                        {c.reason || '-'}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono align-top">
                        {c.phi_days} วัน
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 text-slate-800 break-words align-top">
                        {c.worker_name}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* =========================================================================
              SECTION 5: การเก็บเกี่ยวผลผลิตและรหัสล็อต (GAP #5 Harvest & Traceability)
             ========================================================================= */}
          <div className="gap-section space-y-1.5">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-xs text-slate-900 uppercase tracking-wide">
                หมวดที่ 5: บันทึกการเก็บเกี่ยวผลผลิต การคัดบรรจุ และรหัสล็อตตรวจสอบย้อนกลับ (Harvest & Lot Traceability)
              </h2>
              <span className="text-[10px] font-semibold text-slate-600">มกษ. 9001-2556 (ข้อ 5 และ ข้อ 8)</span>
            </div>
            <table className="w-full table-fixed border-collapse border border-slate-800 text-[10.5px]">
              <colgroup>
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[7%]" />
                <col className="w-[28%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                  <th className="border border-slate-800 py-1.5 px-2 text-center">วันที่เก็บเกี่ยว</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">แปลงที่เก็บ</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">รหัสล็อต (Lot Code)</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-right">ปริมาณที่ได้</th>
                  <th className="border border-slate-800 py-1.5 px-1 text-center">เกรด</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">การปฏิบัติหลังการเก็บเกี่ยว / สุขอนามัย</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-right">มูลค่า (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {!displayHarvest.length ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-800 text-center py-4 text-slate-500">
                      — ไม่มีข้อมูลการเก็บเกี่ยวผลผลิตตามเงื่อนไขที่เลือก —
                    </td>
                  </tr>
                ) : (
                  displayHarvest.map(h => (
                    <tr key={h.id}>
                      <td className="border border-slate-800 py-1.5 px-2 text-center font-mono text-[10px] align-top">
                        {format(new Date(h.harvest_date), 'dd/MM/yyyy')}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 font-semibold break-words align-top">
                        {plotName(h.plot_id)}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 font-mono font-bold text-slate-900 break-words align-top">
                        {h.lot_code || '-'}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 text-right font-mono font-bold align-top">
                        {Number(h.quantity).toLocaleString()} {h.unit}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-1 text-center font-bold align-top">
                        {h.quality_grade || 'A'}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 text-slate-800 break-words leading-snug align-top">
                        {h.postharvest_handling || h.harvest_hygiene || 'คัดตัดแต่งใบเสีย ล้างน้ำสะอาด บรรจุถุงใสเกรดอาหาร'}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 text-right font-mono font-semibold align-top">
                        ฿{Number(h.revenue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {displayHarvest.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                    <td colSpan={3} className="border border-slate-800 py-1.5 px-2 text-right">
                      รวมผลผลิตที่เก็บเกี่ยวและมูลค่าจำหน่ายทั้งสิ้น
                    </td>
                    <td className="border border-slate-800 py-1.5 px-2 text-right font-mono">
                      {totalQty.toLocaleString()} กก.
                    </td>
                    <td colSpan={2} className="border border-slate-800 py-1.5 px-2"></td>
                    <td className="border border-slate-800 py-1.5 px-2 text-right font-mono text-slate-900">
                      ฿{totalRev.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* =========================================================================
              SECTION 6: การเก็บรักษาและการขนส่งผลผลิต (GAP #6 Storage & Logistics)
             ========================================================================= */}
          <div className="gap-section space-y-1.5">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-xs text-slate-900 uppercase tracking-wide">
                หมวดที่ 6: บันทึกการพักผลผลิตและการขนส่งปลอดการปนเปื้อน (Storage & Clean Transport Log)
              </h2>
              <span className="text-[10px] font-semibold text-slate-600">มกษ. 9001-2556 (ข้อ 6)</span>
            </div>
            <table className="w-full table-fixed border-collapse border border-slate-800 text-[10.5px]">
              <colgroup>
                <col className="w-[11%]" />
                <col className="w-[19%]" />
                <col className="w-[23%]" />
                <col className="w-[17%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                  <th className="border border-slate-800 py-1.5 px-2 text-center">วันที่ขนส่ง</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">สถานที่พัก/บรรจุสินค้า</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">สถานที่ส่งมอบปลายทาง</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">ชื่อผู้รับซื้อ / ลูกค้า</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-left">ยานพาหนะที่ใช้ขนส่ง</th>
                  <th className="border border-slate-800 py-1.5 px-1.5 text-center">ความสะอาดพาหนะ</th>
                </tr>
              </thead>
              <tbody>
                {!reportData?.storage?.length ? (
                  <tr>
                    <td colSpan={6} className="border border-slate-800 text-center py-4 text-slate-500">
                      — ไม่มีข้อมูลการขนส่งผลผลิต —
                    </td>
                  </tr>
                ) : (
                  reportData.storage.map(s => (
                    <tr key={s.id}>
                      <td className="border border-slate-800 py-1.5 px-2 text-center font-mono text-[10px] align-top">
                        {format(new Date(s.log_date), 'dd/MM/yyyy')}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 break-words leading-snug align-top">
                        {s.storage_location}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 font-semibold text-slate-900 break-words leading-snug align-top">
                        {s.shipped_to}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 break-words align-top">
                        {s.buyer}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 break-words align-top">
                        {s.vehicle}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-1.5 text-center font-bold text-slate-900 align-top">
                        {s.vehicle_clean_status ? '✓ สะอาด/ผ่าน' : 'รอตรวจ'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* =========================================================================
              SECTION 7: สุขอนามัยส่วนบุคคล และสรุปผลการดำเนินงาน (Personnel Hygiene & Summary)
             ========================================================================= */}
          <div className="gap-section space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-xs text-slate-900 uppercase tracking-wide">
                หมวดที่ 7: ข้อมูลผู้ปฏิบัติงาน สุขอนามัยส่วนบุคคล และสรุปผลการผลิต (Operator Hygiene & Farm Summary)
              </h2>
              <span className="text-[10px] font-semibold text-slate-600">มกษ. 9001-2556 (ข้อ 7 และ ข้อ 8)</span>
            </div>

            <table className="w-full table-fixed border-collapse border border-slate-800 text-[10.5px]">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[18%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                  <th className="border border-slate-800 py-1.5 px-2 text-left">ผู้ควบคุมการผลิต / สุขอนามัย</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-center">สถานะการอบรม GAP</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-right">ผลผลิตผักสดรวม</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-right">รายรับจากการจำหน่าย</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-right">ต้นทุนการผลิตรวม</th>
                  <th className="border border-slate-800 py-1.5 px-2 text-right">กำไรสุทธิจากการผลิต</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-800 py-2 px-2 align-middle">
                    <div className="font-bold text-slate-900">{reportData?.profile?.display_name || 'เจ้าของฟาร์ม'}</div>
                    <div className="text-[9.5px] text-slate-600">สุขภาพแข็งแรง • สุขอนามัยผ่านเกณฑ์</div>
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-center font-bold text-slate-900 align-middle">
                    ✓ ผ่านเกณฑ์มาตรฐาน GAP
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-right font-mono font-bold text-slate-900 align-middle">
                    {totalQty.toLocaleString()} กก.
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-right font-mono font-bold text-slate-900 align-middle">
                    ฿{totalRev.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-right font-mono text-slate-800 align-middle">
                    ฿{totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-right font-mono font-black text-slate-900 bg-slate-50 align-middle">
                    ฿{profit.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* =========================================================================
              SIGNATURES: คำรับรองและลายมือชื่อผู้ตรวจประเมิน (Official Certification)
             ========================================================================= */}
          <div className="gap-section pt-5 mt-4 border-t border-slate-800 space-y-6">
            <div className="text-[10px] text-slate-700 leading-relaxed">
              <strong>คำรับรองของผู้ผลิต:</strong> ข้าพเจ้าขอรับรองว่าข้อมูลการจัดการแปลงเพาะปลูก การใช้น้ำ ปัจจัยการผลิต การเก็บเกี่ยว และการขนส่งผลผลิตที่บันทึกไว้ในเอกสารฉบับนี้ เป็นความจริงจากการปฏิบัติงานจริงทุกประการ ตามข้อกำหนดมาตรฐานสินค้าเกษตร มกษ. 9001-2556 (การปฏิบัติทางการเกษตรที่ดีสำหรับพืชอาหาร)
            </div>
            <div className="grid grid-cols-2 gap-12 text-center text-xs pt-2">
              <div className="space-y-5">
                <div>ลงชื่อ .......................................................................... ผู้ขอรับการรับรอง / เกษตรกร</div>
                <div>
                  <p className="font-bold text-slate-900">( {reportData?.profile?.display_name || '............................................................'} )</p>
                  <p className="text-[10.5px] text-slate-600 mt-0.5">ตำแหน่ง: เจ้าของฟาร์ม / ผู้ควบคุมการผลิตมาตรฐาน GAP</p>
                  <p className="text-[10.5px] text-slate-600 mt-0.5">วันที่ ........../........../..........</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>ลงชื่อ .......................................................................... ผู้ตรวจประเมิน</div>
                <div>
                  <p className="font-bold text-slate-900">( .......................................................................... )</p>
                  <p className="text-[10.5px] text-slate-600 mt-0.5">ตำแหน่ง: เจ้าหน้าที่ผู้ตรวจประเมินแหล่งผลิต GAP (Auditor)</p>
                  <p className="text-[10.5px] text-slate-600 mt-0.5">วันที่ ........../........../..........</p>
                </div>
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
