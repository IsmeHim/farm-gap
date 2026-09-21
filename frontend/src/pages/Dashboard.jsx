import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, format, isAfter } from 'date-fns';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  CheckCircle2,
  ClipboardList,
  Droplets,
  FileText,
  Layers,
  Leaf,
  LineChart,
  Map,
  PackageCheck,
  PlusCircle,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sprout,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

const getClusterBadgeStyle = (clusterName = '') => {
  const name = String(clusterName || '');
  if (name.includes('B2B') || name.includes('ค้าส่ง') || name.includes('ร้านอาหาร')) {
    return 'bg-amber-50 text-amber-900 border-amber-200';
  }
  if (name.includes('สุขภาพ') || name.includes('Regulars')) {
    return 'bg-emerald-50 text-emerald-900 border-emerald-200';
  }
  if (name.includes('ใหม่') || name.includes('New')) {
    return 'bg-sky-50 text-sky-900 border-sky-200';
  }
  return 'bg-teal-50 text-teal-900 border-teal-200';
};

const CustomChartTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-2xl border border-emerald-900/10 bg-white/95 p-3 shadow-xl backdrop-blur-md">
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <p className="mt-1 text-sm font-black text-[#173f2a]">
          {prefix}{Number(payload[0].value || 0).toLocaleString()}{suffix}
        </p>
      </div>
    );
  }
  return null;
};

const formatThaiDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = d.getDate();
  const month = d.getMonth() + 1;
  let year = d.getFullYear();
  if (year < 2400) year += 543;
  return `${day}/${month}/${year}`;
};

const getDaysPlanted = (dateStr) => {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ plots: 0, harvest: 0, revenue: 0, cost: 0, products: 0, stockValue: 0 });
  const [plotsList, setPlotsList] = useState([]);
  const [batchesList, setBatchesList] = useState([]);
  const [chart, setChart] = useState([]);
  const [revenueChart, setRevenueChart] = useState([]);
  const [phiAlerts, setPhiAlerts] = useState([]);
  const [waterAlerts, setWaterAlerts] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [runningAi, setRunningAi] = useState(false);
  const [todayWater, setTodayWater] = useState({ wateredPlotIds: [] });
  const [activePlots, setActivePlots] = useState([]);
  const [wateringLoading, setWateringLoading] = useState(false);

  const fetchAiData = async () => {
    try {
      const aiRes = await api.get('/api/ai/clusters');
      setClusters(aiRes.data.clusters || []);
      setCustomers(aiRes.data.customers || []);
    } catch (err) {
      console.warn('Failed to load AI data:', err.message);
    }
  };

  const fetchWaterStatus = async () => {
    try {
      const res = await api.get('/api/water/today-status');
      setTodayWater(res.data);
    } catch (e) {
      console.warn('Water status fetch error:', e.message);
    }
  };

  useEffect(() => {
    (async () => {
      const [plots, harvest, costs, chems, water, products, batches] = await Promise.all([
        api.get('/api/plots'),
        api.get('/api/harvest'),
        api.get('/api/costs'),
        api.get('/api/chemicals'),
        api.get('/api/water'),
        api.get('/api/products').catch(() => ({ data: [] })),
        api.get('/api/batches').catch(() => ({ data: [] })),
      ]);

      const sortedPlots = (plots.data || []).slice().sort((a, b) => (a.plot_number || a.id) - (b.plot_number || b.id));
      setPlotsList(sortedPlots);
      setBatchesList(batches.data || []);

      const actPlots = plots.data.filter(p => p.status === 'active' || p.status === 'growing' || p.status === 'harvest_ready');
      setActivePlots(actPlots);

      const rev = harvest.data.reduce((s, h) => s + Number(h.revenue || 0), 0);
      const cost = costs.data.reduce((s, c) => s + Number(c.amount || 0), 0);
      const qty = harvest.data.reduce((s, h) => s + Number(h.quantity || 0), 0);
      const availableProducts = products.data.filter(p => p.status === 'available' && Number(p.stock_quantity) > 0);
      const stockValue = products.data.reduce((s, p) => s + Number(p.price || 0) * Number(p.stock_quantity || 0), 0);
      setStats({ plots: plots.data.length, harvest: qty, revenue: rev, cost, products: availableProducts.length, stockValue });

      const harvestByMonth = {};
      const revenueByMonth = {};
      harvest.data.forEach(h => {
        const key = format(new Date(h.harvest_date), 'MM/yy');
        harvestByMonth[key] = (harvestByMonth[key] || 0) + Number(h.quantity || 0);
        revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(h.revenue || 0);
      });
      setChart(Object.entries(harvestByMonth).map(([month, qty]) => ({ month, qty })).reverse());
      setRevenueChart(Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue })).reverse());

      const today = new Date();
      const phiList = chems.data
        .filter(c => isAfter(addDays(new Date(c.log_date), Number(c.phi_days || 0)), today))
        .map(c => ({ ...c, safe_date: format(addDays(new Date(c.log_date), Number(c.phi_days || 0)), 'dd/MM/yyyy'), plot_name: plots.data.find(p => p.id === c.plot_id)?.name }));
      setPhiAlerts(phiList);

      const waterList = water.data.filter(w => w.contamination_check || w.water_quality === 'ไม่ผ่าน');
      setWaterAlerts(waterList.map(w => ({ ...w, plot_name: plots.data.find(p => p.id === w.plot_id)?.name })));

      fetchAiData();
      fetchWaterStatus();
    })();
  }, []);

  const handleWaterAllToday = async () => {
    setWateringLoading(true);
    try {
      const res = await api.post('/api/water/quick-all');
      if (res.data.already_watered) {
        toast.info(res.data.message);
      } else {
        toast.success(res.data.message || 'บันทึกรดน้ำทุกแปลงสำเร็จ!');
      }
      await fetchWaterStatus();
    } catch (e) {
      toast.error('ไม่สามารถบันทึกรดน้ำได้');
    } finally {
      setWateringLoading(false);
    }
  };

  const totalAlerts = phiAlerts.length + waterAlerts.length;
  const profit = stats.revenue - stats.cost;

  const readyPlotsCount = useMemo(() => {
    return plotsList.filter(p => {
      const batch = batchesList.find(b => b.plot_id === p.id && (b.status === 'growing' || b.status === 'harvest_ready'))
        || batchesList.find(b => b.id === p.current_batch_id);
      const expectedDate = batch?.expected_harvest_date || p.expected_harvest_date;
      return p.status === 'harvest_ready' || batch?.status === 'harvest_ready' || (expectedDate && new Date(expectedDate) <= new Date());
    }).length;
  }, [plotsList, batchesList]);

  const growingPlotsCount = Math.max(0, activePlots.length - readyPlotsCount);
  const isAllWatered = activePlots.length > 0 && (todayWater.wateredPlotIds || []).length >= activePlots.length;

  const cards = [
    {
      label: 'รายได้รวม',
      value: `฿${stats.revenue.toLocaleString()}`,
      detail: `กำไรสุทธิ ฿${profit.toLocaleString()}`,
      icon: Wallet,
      accent: 'bg-amber-100 text-amber-800',
      badgeClass: profit >= 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' : 'bg-rose-50 text-rose-800 border border-rose-200/60',
    },
    {
      label: 'แปลงปลูก',
      value: `${activePlots.length}/${stats.plots} แปลง`,
      detail: readyPlotsCount > 0 ? `พร้อมเก็บ ${readyPlotsCount} แปลง` : `กำลังปลูก ${growingPlotsCount} แปลง`,
      icon: Map,
      accent: 'bg-emerald-100 text-emerald-800',
      badgeClass: readyPlotsCount > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60',
    },
    {
      label: 'ผลผลิตรวม',
      value: `${stats.harvest.toFixed(1)} kg`,
      detail: 'เก็บเกี่ยวสะสม',
      icon: Leaf,
      accent: 'bg-lime-100 text-lime-800',
      badgeClass: 'bg-lime-50 text-lime-800 border border-lime-200/60',
    },
    {
      label: 'สินค้า Live',
      value: `${stats.products} รายการ`,
      detail: `มูลค่าสต็อก ฿${stats.stockValue.toLocaleString()}`,
      icon: PackageCheck,
      accent: 'bg-sky-100 text-sky-800',
      badgeClass: 'bg-sky-50 text-sky-800 border border-sky-200/60',
    },
    {
      label: 'รดน้ำวันนี้',
      value: `${(todayWater.wateredPlotIds || []).length}/${activePlots.length}`,
      detail: isAllWatered ? '✓ ครบทุกแปลงแล้ว' : `ขาด ${activePlots.length - (todayWater.wateredPlotIds || []).length} แปลง`,
      icon: Droplets,
      accent: isAllWatered ? 'bg-emerald-100 text-emerald-800' : 'bg-teal-100 text-teal-800',
      badgeClass: isAllWatered ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' : 'bg-amber-50 text-amber-900 border border-amber-200',
    },
    {
      label: 'สถานะ GAP',
      value: totalAlerts === 0 ? 'ปลอดภัย' : `${totalAlerts} จุดเสี่ยง`,
      detail: totalAlerts === 0 ? 'เกณฑ์ปลอดภัย 100%' : `PHI: ${phiAlerts.length} | น้ำ: ${waterAlerts.length}`,
      icon: totalAlerts === 0 ? ShieldCheck : AlertTriangle,
      accent: totalAlerts === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
      badgeClass: totalAlerts === 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' : 'bg-rose-50 text-rose-800 border border-rose-200/60',
    },
  ];

  const handleRunAi = async () => {
    setRunningAi(true);
    try {
      const res = await api.post('/api/ai/cluster');
      await api.post('/api/ai/recommend');
      await fetchAiData();
      toast.success(res.data?.message || 'ประมวลผล K-Means และอัปเดตสินค้าแนะนำเรียบร้อยแล้ว ✨');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการวิเคราะห์ AI');
    } finally {
      setRunningAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Modern Executive Header */}
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/90 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-xs font-bold text-emerald-800">
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
              มาตรฐาน GAP เกษตรปลอดภัย
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              <Sprout className="h-3.5 w-3.5 text-emerald-600" />
              ผักสลัด 6 แคร่
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-[#173f2a]">
            แดชบอร์ดภาพรวมฟาร์ม (Farm Overview)
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            ระบบติดตามผลผลิต การให้น้ำ ความเสี่ยง GAP สต็อกสินค้า และลูกค้าในจุดเดียว
          </p>
        </div>

        {/* Quick Navigation Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link
            to="/report"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>พิมพ์รายงาน GAP</span>
          </Link>
          <Link
            to="/water"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs font-bold transition cursor-pointer"
          >
            <Droplets className="w-4 h-4 text-emerald-600" />
            <span>จัดการระบบน้ำ</span>
          </Link>
          <Link
            to="/plots"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#173f2a] hover:bg-[#123020] text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Layers className="w-4 h-4 text-emerald-300" />
            <span>จัดการแปลงปลูก</span>
          </Link>
        </div>
      </section>

      {/* Daily Routine Quick Action Bar */}
      {activePlots.length > 0 && (
        <section className={`rounded-2xl p-4 sm:p-5 border transition shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          isAllWatered
            ? 'bg-emerald-50/60 border-emerald-200/90'
            : 'bg-white border-slate-200/90'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl border shrink-0 ${
              isAllWatered
                ? 'bg-emerald-100/80 border-emerald-300 text-emerald-800'
                : 'bg-teal-50 border-teal-200 text-teal-700'
            }`}>
              <Droplets className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-slate-900 text-sm sm:text-base tracking-tight">
                  ⚡ กิจวัตรการให้น้ำประจำวัน (Daily Watering Routine)
                </h3>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isAllWatered
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-amber-100 text-amber-900 border-amber-200'
                }`}>
                  รดแล้ว {(todayWater.wateredPlotIds || []).length} / {activePlots.length} แปลง
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {isAllWatered
                  ? 'ระบบบันทึกการให้น้ำครบถ้วนทุกแปลงแล้ววันนี้ ข้อมูลพร้อมเข้าสมุดจด GAP'
                  : 'กดปุ่มเพื่อบันทึกการรดน้ำอัตโนมัติพร้อมกันทุกแปลงที่กำลังปลูก โดยไม่ต้องเข้าไปจดทีละแปลง'}
              </p>
            </div>
          </div>

          <button
            onClick={handleWaterAllToday}
            disabled={wateringLoading || isAllWatered}
            className={`inline-flex items-center justify-center gap-2 font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0 w-full sm:w-auto ${
              isAllWatered
                ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-200 cursor-not-allowed'
                : 'bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-200/50'
            }`}
          >
            {isAllWatered ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>รดน้ำครบทุกแปลงแล้ววันนี้</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current text-slate-950" />
                <span>⚡ รดน้ำทุกแปลงทันที ({activePlots.length - (todayWater.wateredPlotIds || []).length} แปลง)</span>
              </>
            )}
          </button>
        </section>
      )}

      {/* Unified Executive KPI Cards (6 Grid) */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {cards.map(card => (
          <div
            key={card.label}
            className="bg-white/95 rounded-2xl p-4 sm:p-4.5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-200/80 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate" title={card.label}>
                {card.label}
              </span>
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${card.accent} shrink-0`}>
                <card.icon className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-xl sm:text-2xl font-black tracking-tight text-[#173f2a] truncate" title={String(card.value)}>
                {card.value}
              </div>
              <div className="mt-1.5 flex items-center text-[11px] font-semibold">
                <span className={`px-2 py-0.5 rounded-md truncate max-w-full ${card.badgeClass || 'bg-slate-100 text-slate-600'}`}>
                  {card.detail}
                </span>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 6 Plots Overview (ผังแปลงปลูก 6 แคร่ - Current Plots Status) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#173f2a] flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              ผังแปลงปลูก 6 แคร่ (Current Plots Status)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">ติดตามสถานะการเพาะปลูกและการเก็บเกี่ยวแบบ Real-time</p>
          </div>
          <Link
            to="/plots"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
          >
            <span>จัดการแปลงทั้งหมด</span> <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plotsList.map((plot) => {
            // Find active batch for this plot
            const batch = batchesList.find(b => b.plot_id === plot.id && (b.status === 'growing' || b.status === 'harvest_ready'))
              || batchesList.find(b => b.id === plot.current_batch_id);

            const hasCrop = (plot.status === 'growing' || plot.status === 'harvest_ready' || plot.status === 'active') &&
              plot.crop_name && plot.crop_name !== '-';

            const cropName = batch?.crop_name || (hasCrop ? plot.crop_name : '');
            const cropCategory = batch?.crop_category || (
              cropName.includes('โอ๊ค') || cropName.includes('ฟิลเล่ย์') || cropName.includes('คอส') || cropName.includes('บัตเตอร์')
                ? 'ผักสลัด'
                : 'ผักกินใบ'
            );

            const startDate = batch?.start_date || plot.planting_date;
            const expectedDate = batch?.expected_harvest_date || plot.expected_harvest_date;
            const growthDays = batch?.growth_days || 30;
            const autoWater = batch?.auto_water !== undefined ? Boolean(batch.auto_water) : true;

            const daysPlanted = startDate ? getDaysPlanted(startDate) : 0;
            const isReady = plot.status === 'harvest_ready' || batch?.status === 'harvest_ready' || (expectedDate && new Date(expectedDate) <= new Date());
            const isGrowing = !isReady && hasCrop;
            const isEmpty = !isReady && !isGrowing;

            const progress = isReady ? 100 : Math.min(100, Math.max(0, Math.round((daysPlanted / (growthDays || 30)) * 100)));

            return (
              <div
                key={plot.id}
                className={`bg-white rounded-2xl border transition-all hover:shadow-md relative overflow-hidden flex flex-col justify-between p-5 ${
                  isReady
                    ? 'border-2 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
                    : isGrowing
                    ? 'border border-emerald-200 shadow-xs'
                    : 'border border-slate-200 bg-slate-50/40'
                }`}
              >
                {/* Top: Plot Number & Status Badge */}
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        #{plot.plot_number || plot.id}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm">{plot.name}</h3>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        isReady
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : isGrowing
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isReady ? '🔔 พร้อมเก็บเกี่ยว' : isGrowing ? '🌱 กำลังปลูก' : 'ว่าง / พักแปลง'}
                    </span>
                  </div>

                  {/* Middle: Crop Info or Empty State */}
                  {isGrowing || isReady ? (
                    <div className="mt-3 bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm sm:text-base font-bold text-emerald-950 truncate max-w-[190px]" title={cropName}>
                          {cropName}
                        </span>
                        <span className="text-xs text-emerald-700 font-medium whitespace-nowrap">{cropCategory}</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-600 space-y-1">
                        <div className="flex justify-between">
                          <span>วันที่ปลูก:</span>
                          <span className="font-medium text-slate-800">
                            {formatThaiDate(startDate)} ({daysPlanted} วัน)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>คาดการณ์เก็บเกี่ยว:</span>
                          <span className="font-medium text-slate-800">
                            {formatThaiDate(expectedDate)}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                          <span>ความคืบหน้ารอบปลูก</span>
                          <span className="font-bold text-emerald-700">
                            {progress}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 bg-slate-100/70 rounded-xl p-4 text-center border border-dashed border-slate-300">
                      <p className="text-xs text-slate-500 font-medium">แปลงว่าง พร้อมเริ่มรอบปลูกใหม่</p>
                      <p className="text-[11px] text-slate-400 mt-1 truncate" title={plot.soil_recipe}>
                        {plot.soil_recipe ? `${plot.soil_recipe.substring(0, 45)}...` : 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ...'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-blue-500" />
                    {autoWater ? 'รดน้ำอัตโนมัติ' : 'รดน้ำปกติ'}
                  </span>

                  {isGrowing || isReady ? (
                    <button
                      onClick={() => navigate(`/harvest?plot_id=${plot.id}&smart=true`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>เก็บเกี่ยวเข้าคลัง</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/plots?plot_id=${plot.id}&start=true`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>เริ่มปลูกผัก</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Charts Section */}
      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.2fr_.8fr]">
        <div className="premium-panel rounded-3xl p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#173f2a]">ผลผลิตรายเดือน</h2>
              <p className="text-sm text-slate-500">น้ำหนักเก็บผลผลิตเทียบตามเดือน</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Leaf className="h-5 w-5" />
            </div>
          </div>
          <div className="h-[300px]">
            {chart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">ยังไม่มีข้อมูลเก็บผลผลิต</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dfe8da" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#dfe8da' }} />
                  <YAxis tickLine={false} axisLine={{ stroke: '#dfe8da' }} />
                  <Tooltip content={<CustomChartTooltip suffix=" kg" />} />
                  <Bar dataKey="qty" fill="#236c45" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="premium-panel rounded-3xl p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#173f2a]">รายได้จากการเก็บผลผลิต</h2>
              <p className="text-sm text-slate-500">ดูแนวโน้มเงินสดจากผลผลิต</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-[#b5812d]">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="h-[300px]">
            {revenueChart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">ยังไม่มีข้อมูลรายได้</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dfe8da" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#dfe8da' }} />
                  <YAxis tickLine={false} axisLine={{ stroke: '#dfe8da' }} />
                  <Tooltip content={<CustomChartTooltip prefix="฿" />} />
                  <Area type="monotone" dataKey="revenue" stroke="#b5812d" fill="#f4d27a" fillOpacity={0.4} strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* GAP Risk Center Section (Full Width) */}
      <section>
        <AlertHub phiAlerts={phiAlerts} waterAlerts={waterAlerts} />
      </section>

      {/* Customer Intelligence Section (Full Width) */}
      <section>
        <AiPanel
          clusters={clusters}
          customers={customers}
          runningAi={runningAi}
          onRun={handleRunAi}
        />
      </section>
    </div>
  );
}

function AlertHub({ phiAlerts, waterAlerts }) {
  const groups = [
    {
      title: 'PHI ห้ามเก็บผลผลิต',
      icon: AlertTriangle,
      items: phiAlerts.map(a => `แปลง ${a.plot_name || '-'} พ่น ${a.product_name} ปลอดภัยหลัง ${a.safe_date}`),
      color: 'border-amber-200 bg-amber-50/80 text-amber-900',
      badgeColor: 'bg-amber-100 text-amber-800',
      iconColor: 'text-amber-600',
    },
    {
      title: 'น้ำไม่ปลอดภัย',
      icon: Droplets,
      items: waterAlerts.map(w => `แปลง ${w.plot_name || '-'} แหล่งน้ำ ${w.water_source_type || w.water_source || '-'} สถานะ ${w.water_quality || 'สงสัย'}`),
      color: 'border-rose-200 bg-rose-50/80 text-rose-900',
      badgeColor: 'bg-rose-100 text-rose-800',
      iconColor: 'text-rose-600',
    },
  ];

  const totalWarnings = phiAlerts.length + waterAlerts.length;

  return (
    <div className="premium-panel rounded-3xl p-6 shadow-xs border border-emerald-900/10">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-xs font-black uppercase tracking-[.16em] text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            gap risk center
          </div>
          <h2 className="mt-2 text-xl font-black text-[#173f2a]">ศูนย์เตือนความเสี่ยง GAP</h2>
          <p className="text-sm text-slate-500">จุดที่ต้องจัดการและเฝ้าระวังก่อนกระทบมาตรฐานการรับรอง GAP</p>
        </div>
        {totalWarnings > 0 ? (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-100 border border-amber-200 px-4 py-2 text-xs font-bold text-amber-800 self-start sm:self-auto">
            <AlertTriangle className="h-4 w-4" />
            มีจุดเฝ้าระวัง {totalWarnings} รายการ
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800 self-start sm:self-auto">
            <CheckCircle2 className="h-4 w-4" />
            ความเสี่ยงอยู่ในเกณฑ์ปลอดภัย
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map(group => (
          <div key={group.title} className={`rounded-2xl border p-4 shadow-2xs ${group.color}`}>
            <div className="flex items-center justify-between font-black pb-2 border-b border-current/10">
              <div className="flex items-center gap-2 text-sm">
                <group.icon className={`h-4 w-4 ${group.iconColor}`} />
                <span>{group.title}</span>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${group.badgeColor}`}>
                {group.items.length} รายการ
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs min-h-[50px]">
              {group.items.length === 0 ? (
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>ปลอดภัย ไม่มีรายการค้าง</span>
                </div>
              ) : (
                group.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 py-0.5">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                    <span className="line-clamp-2">{item}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiPanel({ clusters, customers, runningAi, onRun }) {
  return (
    <div className="premium-panel rounded-3xl p-6 shadow-xs border border-emerald-900/10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200/80 px-3 py-1 text-xs font-black uppercase tracking-[.16em] text-[#9a6721]">
            <Sparkles className="h-3.5 w-3.5" />
            customer intelligence
          </div>
          <h2 className="mt-2 text-xl font-black text-[#173f2a]">AI จัดกลุ่มลูกค้าและสินค้าแนะนำ</h2>
          <p className="text-sm text-slate-500">รัน K-Means แบ่งกลุ่มพฤติกรรมลูกค้าและอัปเดตสินค้าแนะนำอัตโนมัติ</p>
        </div>
        <button
          onClick={onRun}
          disabled={runningAi}
          className="btn shrink-0 gap-2 shadow-sm hover:shadow-md transition-all self-start sm:self-auto"
        >
          {runningAi ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>กำลังวิเคราะห์...</span>
            </>
          ) : (
            <>
              <Bot className="h-4 w-4" />
              <span>ประมวลผล AI</span>
            </>
          )}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Customer List Column */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              รายชื่อลูกค้า ({customers.length})
            </span>
            <span className="text-xs text-slate-400">เรียงตามยอดสั่งซื้อ</span>
          </div>

          <div className="max-h-[380px] space-y-3 overflow-y-auto pr-1">
            {customers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
                <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                ยังไม่มีประวัติลูกค้าสำหรับจัดกลุ่ม
              </div>
            ) : (
              customers.map(customer => {
                const badgeStyle = getClusterBadgeStyle(customer.cluster_name);
                return (
                  <div
                    key={customer.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-xs transition hover:shadow-md hover:border-emerald-200"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {customer.picture_url ? (
                        <img
                          src={customer.picture_url}
                          alt={customer.display_name}
                          className="h-11 w-11 shrink-0 rounded-full object-cover border-2 border-emerald-100 shadow-xs"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-800 font-bold border border-emerald-200/60">
                          <Users className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-sm sm:text-base truncate">
                          {customer.display_name || 'ลูกค้า LINE'}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
                          <span className="font-medium text-slate-600">ออเดอร์ {customer.order_count || 0} ครั้ง</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-emerald-700">
                            ยอดรวม ฿{Number(customer.total_spend || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="self-start sm:self-center shrink-0">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-2xs ${badgeStyle}`}>
                        <Sparkles className="h-3.5 w-3.5 shrink-0" />
                        <span>{customer.cluster_name || 'รอวิเคราะห์'}</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cluster Explanation Column */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col rounded-2xl bg-[#173f2a] p-5 text-white shadow-xs">
          <div className="flex items-center gap-2 font-bold text-[#f4d27a] pb-3 border-b border-white/10">
            <ClipboardList className="h-4 w-4" />
            <span className="text-sm">คำอธิบายกลุ่มเป้าหมาย</span>
          </div>

          <div className="mt-3 flex-1 space-y-3 overflow-y-auto max-h-[340px] pr-1 text-sm text-emerald-50">
            {clusters.length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-200/70">
                กดปุ่ม "ประมวลผล AI" เพื่อสร้างกลุ่มลูกค้าและวิเคราะห์พฤติกรรม
              </div>
            ) : (
              clusters.map(cluster => (
                <div key={cluster.id} className="rounded-xl bg-white/10 p-3.5 backdrop-blur-xs border border-white/5">
                  <div className="font-bold text-[#f4d27a] text-xs flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f4d27a]" />
                    {cluster.cluster_name}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-emerald-100/90">{cluster.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
