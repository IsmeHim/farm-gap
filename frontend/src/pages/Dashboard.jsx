import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
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
  ShoppingBag,
  Sparkles,
  Sprout,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  Send,
  BellRing,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const formatThaiMonthKey = (yyyyMm) => {
  if (!yyyyMm || !yyyyMm.includes('-')) return yyyyMm;
  const [yStr, mStr] = yyyyMm.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return yyyyMm;
  const buddhistYearShort = String((y < 2400 ? y + 543 : y)).slice(-2);
  return `${THAI_MONTHS_SHORT[m - 1]} ${buddhistYearShort}`;
};

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
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md space-y-1.5 min-w-[160px]">
        <p className="text-xs font-black text-slate-700 border-b border-slate-100 pb-1">ประจำเดือน {label}</p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4 text-xs">
            <span className="font-semibold text-slate-500 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color || '#173f2a' }} />
              {entry.name || 'ข้อมูล'}:
            </span>
            <span className="font-black text-slate-900">
              {prefix}{Number(entry.value || 0).toLocaleString()}{suffix}
            </span>
          </div>
        ))}
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

const parseDateMidnight = (dateStr) => {
  if (!dateStr) return null;
  const cleanStr = String(dateStr).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const getDaysPlanted = (dateStr) => {
  const dZero = parseDateMidnight(dateStr);
  if (!dZero) return 0;
  const now = new Date();
  const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = nowZero.getTime() - dZero.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ plots: 0, harvest: 0, revenue: 0, cost: 0, products: 0, stockValue: 0 });
  const [plotsList, setPlotsList] = useState([]);
  const [batchesList, setBatchesList] = useState([]);
  const [chart, setChart] = useState([]);
  const [revenueChart, setRevenueChart] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [runningAi, setRunningAi] = useState(false);
  const [activePlots, setActivePlots] = useState([]);
  const [revChartMode, setRevChartMode] = useState('bar'); // 'bar' | 'area'
  const [productsList, setProductsList] = useState([]);
  const [showPushModal, setShowPushModal] = useState(false);

  const fetchAiData = async () => {
    try {
      const aiRes = await api.get('/api/ai/clusters');
      setClusters(aiRes.data.clusters || []);
      setCustomers(aiRes.data.customers || []);
    } catch (err) {
      console.warn('Failed to load AI data:', err.message);
    }
  };

  useEffect(() => {
    (async () => {
      const [plots, harvest, costs, chems, products, batches] = await Promise.all([
        api.get('/api/plots'),
        api.get('/api/harvest'),
        api.get('/api/costs'),
        api.get('/api/chemicals'),
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
      setProductsList(products.data || []);

      const monthlyMap = {};
      harvest.data.forEach(h => {
        if (!h.harvest_date) return;
        const d = new Date(h.harvest_date);
        if (isNaN(d.getTime())) return;
        const ym = format(d, 'yyyy-MM');
        if (!monthlyMap[ym]) monthlyMap[ym] = { ym, qty: 0, revenue: 0, cost: 0, count: 0 };
        monthlyMap[ym].qty += Number(h.quantity || 0);
        monthlyMap[ym].revenue += Number(h.revenue || 0);
        monthlyMap[ym].count += 1;
      });

      costs.data.forEach(c => {
        if (!c.log_date) return;
        const d = new Date(c.log_date);
        if (isNaN(d.getTime())) return;
        const ym = format(d, 'yyyy-MM');
        if (!monthlyMap[ym]) monthlyMap[ym] = { ym, qty: 0, revenue: 0, cost: 0, count: 0 };
        monthlyMap[ym].cost += Number(c.amount || 0);
      });

      const sortedMonthly = Object.values(monthlyMap)
        .sort((a, b) => a.ym.localeCompare(b.ym))
        .map(item => ({
          month: formatThaiMonthKey(item.ym),
          qty: Number(item.qty.toFixed(1)),
          revenue: Math.round(item.revenue),
          cost: Math.round(item.cost),
          profit: Math.round(item.revenue - item.cost),
          count: item.count,
        }));

      setChart(sortedMonthly.filter(m => m.qty > 0 || m.revenue > 0));
      setRevenueChart(sortedMonthly);

      fetchAiData();
    })();
  }, []);

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
  const seedingPlotsCount = useMemo(() => {
    return plotsList.filter(p => {
      const hasCrop = (p.status === 'growing' || p.status === 'harvest_ready' || p.status === 'active') &&
        p.crop_name && p.crop_name !== '-';
      if (hasCrop) return false;
      return (p.activities && p.activities.length > 0) || Boolean(p.seed_prep_date) || Boolean(p.seed_crop_id);
    }).length;
  }, [plotsList]);

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
      detail: readyPlotsCount > 0
        ? `พร้อมเก็บ ${readyPlotsCount} แปลง`
        : seedingPlotsCount > 0
        ? `เพาะกล้า ${seedingPlotsCount} แปลง`
        : `กำลังปลูก ${growingPlotsCount} แปลง`,
      icon: Map,
      accent: 'bg-emerald-100 text-emerald-800',
      badgeClass: readyPlotsCount > 0
        ? 'bg-amber-50 text-amber-800 border border-amber-200'
        : seedingPlotsCount > 0
        ? 'bg-teal-50 text-teal-800 border border-teal-200'
        : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60',
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
      label: 'สถานะ GAP',
      value: 'ปลอดภัย',
      detail: 'มาตรฐาน GAP 100%',
      icon: BadgeCheck,
      accent: 'bg-emerald-100 text-emerald-800',
      badgeClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200/60',
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
            ระบบติดตามผลผลิต ความปลอดภัย GAP สต็อกสินค้า และลูกค้าในจุดเดียว
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
            to="/plots"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#173f2a] hover:bg-[#123020] text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Layers className="w-4 h-4 text-emerald-300" />
            <span>จัดการแปลงปลูก</span>
          </Link>
        </div>
      </section>

      {/* Unified Executive KPI Cards (5 Grid) */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
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
            const growthDays = Number(batch?.growth_days || plot.growth_days || 30);

            const daysPlanted = startDate ? getDaysPlanted(startDate) : 0;
            const batchSeedDate = batch?.seed_prep_date || plot?.batch_seed_prep_date || plot?.seed_prep_date || plot?.activities?.find(a => a.stage === 'seeding')?.activity_date;
            const plantAge = batchSeedDate ? Math.max(daysPlanted, getDaysPlanted(batchSeedDate)) : daysPlanted;

            // วันคาดการณ์เก็บเกี่ยวที่แท้จริง
            let effectiveExpectedDate = batch?.expected_harvest_date || plot?.expected_harvest_date;
            if (batchSeedDate) {
              const seedMidnight = parseDateMidnight(batchSeedDate);
              if (seedMidnight) {
                effectiveExpectedDate = new Date(seedMidnight.getTime() + growthDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              }
            }
            const daysLeft = Math.max(0, growthDays - plantAge);

            const isReady = plot.status === 'harvest_ready' || batch?.status === 'harvest_ready' || daysLeft === 0 || (effectiveExpectedDate && parseDateMidnight(effectiveExpectedDate) <= new Date());
            const progress = isReady ? 100 : Math.min(100, Math.max(0, Math.round((plantAge / growthDays) * 100)));
            const isPlotReady = isReady || progress >= 100;
            const isGrowing = !isPlotReady && hasCrop;

            // ตรวจสอบสถานะการเพาะเมล็ด / อนุบาลต้นกล้าก่อนลงแปลง
            const hasActivities = plot.activities && plot.activities.length > 0;
            const isNursery = !isPlotReady && !isGrowing && (hasActivities || Boolean(plot.seed_prep_date) || Boolean(plot.seed_crop_id));
            const isEmpty = !isPlotReady && !isGrowing && !isNursery;

            // ดึงข้อมูลกิจกรรมต้นกล้าล่าสุด
            const latestAct = hasActivities ? plot.activities[plot.activities.length - 1] : null;
            const seedDate = latestAct?.activity_date || plot.seed_prep_date;
            const seedDays = seedDate ? getDaysPlanted(seedDate) : 0;
            const isTrayNursery = latestAct?.stage === 'nursery';

            return (
              <div
                key={plot.id}
                className={`bg-white rounded-2xl border transition-all hover:shadow-md relative overflow-hidden flex flex-col justify-between p-5 ${
                  isPlotReady
                    ? 'border-2 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
                    : isGrowing
                    ? 'border border-emerald-200 shadow-xs'
                    : isNursery
                    ? 'border-2 border-teal-300/80 bg-teal-50/20 shadow-xs'
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
                        isPlotReady
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : isGrowing
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1'
                          : isNursery
                          ? 'bg-teal-50 text-teal-800 border border-teal-300 flex items-center gap-1 font-bold'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isPlotReady
                        ? '🔔 พร้อมเก็บเกี่ยว'
                        : isGrowing
                        ? '🌱 กำลังปลูก'
                        : isNursery
                        ? (isTrayNursery ? '🪴 กำลังอนุบาลกล้า' : '🌱 กำลังเพาะเมล็ด')
                        : 'ว่าง / พักแปลง'}
                    </span>
                  </div>

                  {/* Middle: Crop Info or Empty State */}
                  {isGrowing || isPlotReady ? (
                    <div className={`mt-3 rounded-xl p-3.5 border ${isPlotReady ? 'bg-amber-50/40 border-amber-200/80' : 'bg-emerald-50/50 border-emerald-100'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm sm:text-base font-bold text-emerald-950 truncate max-w-[190px]" title={cropName}>
                          {cropName}
                        </span>
                        <span className="text-xs text-emerald-700 font-medium whitespace-nowrap">{cropCategory}</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-600 space-y-1">
                        {batchSeedDate && (
                          <div className="flex justify-between items-center text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            <span className="font-semibold">🌱 เริ่มเพาะเมล็ด:</span>
                            <span className="font-bold text-teal-800">
                              {formatThaiDate(batchSeedDate)} (อายุรวม {plantAge} วัน)
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>ย้ายลงแปลง:</span>
                          <span className="font-medium text-slate-800">
                            {formatThaiDate(startDate)} (ในแปลง {daysPlanted} วัน)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>คาดการณ์เก็บเกี่ยว:</span>
                          <span className="font-medium text-slate-800">
                            {formatThaiDate(effectiveExpectedDate)}
                            {daysLeft !== undefined && (
                              <span className="text-emerald-600 font-normal ml-1">
                                ({daysLeft > 0 ? `อีก ${daysLeft} วัน` : 'ครบกำหนด'})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                          <span>ความคืบหน้ารอบปลูก (อายุ {plantAge}/{growthDays} วัน)</span>
                          <span className={`font-bold ${isPlotReady ? 'text-amber-800' : 'text-emerald-700'}`}>
                            {progress}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isPlotReady ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : isNursery ? (
                    <div className="mt-3 rounded-xl p-3.5 border bg-teal-50/50 border-teal-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm sm:text-base font-bold text-teal-950 truncate max-w-[190px]">
                          🌱 {plot.seed_crop_name || 'ผักเป้าหมาย'}
                        </span>
                        <span className="text-xs text-teal-800 font-bold bg-teal-100/90 px-2 py-0.5 rounded-full border border-teal-200 whitespace-nowrap">
                          {isTrayNursery ? '🪴 อนุบาลกล้า' : '🌱 เพาะเมล็ด'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1">
                        {seedDate && (
                          <div className="flex justify-between">
                            <span>วันที่เริ่มเพาะ:</span>
                            <span className="font-semibold text-slate-800">
                              {formatThaiDate(seedDate)} ({seedDays} วัน)
                            </span>
                          </div>
                        )}
                        {latestAct ? (
                          <div className="pt-1.5 border-t border-teal-100">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-teal-900 truncate">
                                ล่าสุด: {latestAct.title}
                              </span>
                              {plot.activities?.length > 1 && (
                                <span className="text-[10px] text-teal-700 bg-white px-1.5 py-0.5 rounded border border-teal-200 shrink-0 font-medium ml-1">
                                  {plot.activities.length} กิจกรรม
                                </span>
                              )}
                            </div>
                            {latestAct.details && (
                              <p className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5">
                                {latestAct.details}
                              </p>
                            )}
                          </div>
                        ) : plot.seed_notes ? (
                          <p className="text-[11px] text-slate-600 line-clamp-2 pt-1 border-t border-teal-100 leading-relaxed">
                            {plot.seed_notes}
                          </p>
                        ) : (
                          <p className="text-[11px] text-teal-700 pt-1 border-t border-teal-100">
                            บันทึกการเตรียมเมล็ดพันธุ์เรียบร้อย
                          </p>
                        )}
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
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  {isGrowing || isPlotReady ? (
                    <button
                      onClick={() => navigate(`/harvest?plot_id=${plot.id}&smart=true`)}
                      className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer ${
                        isPlotReady
                          ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-black shadow-sm hover:shadow border border-amber-300'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs'
                      }`}
                    >
                      <ShoppingBag className={`w-3.5 h-3.5 ${isPlotReady ? 'text-slate-950' : 'text-white'}`} />
                      <span>{isPlotReady ? '🧺 เก็บเกี่ยวเข้าคลัง' : 'เก็บเกี่ยวเข้าคลัง'}</span>
                    </button>
                  ) : isNursery ? (
                    <button
                      onClick={() => navigate(`/plots?plot_id=${plot.id}&start=true`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
                      title="ย้ายต้นกล้าลงแปลงนี้ หรือเริ่มรอบปลูก"
                    >
                      <Sprout className="w-3.5 h-3.5 text-teal-200" />
                      <span>ย้ายกล้าลงแปลง</span>
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
      <section className="grid gap-6 lg:grid-cols-2">
        {/* 1. Monthly Yield Chart */}
        <div className="premium-panel rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#173f2a] flex items-center gap-2">
                  <span>ผลผลิตรายเดือน</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  เปรียบเทียบน้ำหนักผลผลิตที่เก็บเกี่ยวได้ในแต่ละเดือน (กิโลกรัม)
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shrink-0">
                <Leaf className="h-5 w-5" />
              </div>
            </div>

            {/* Quick Yield Summary Pills */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-2xl px-3 py-2">
                <div className="text-[11px] font-bold text-slate-500">ผลผลิตรวมสะสม</div>
                <div className="text-sm sm:text-base font-black text-[#173f2a] mt-0.5">
                  {stats.harvest.toFixed(1)} กก.
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200/70 rounded-2xl px-3 py-2">
                <div className="text-[11px] font-bold text-slate-500">เฉลี่ยต่อเดือน</div>
                <div className="text-sm sm:text-base font-black text-slate-800 mt-0.5">
                  {chart.length > 0 ? (stats.harvest / chart.length).toFixed(1) : '0.0'} กก.
                </div>
              </div>
              <div className="bg-lime-50/80 border border-lime-200/80 rounded-2xl px-3 py-2">
                <div className="text-[11px] font-bold text-slate-500">
                  เดือนล่าสุด ({chart[chart.length - 1]?.month || '-'})
                </div>
                <div className="text-sm sm:text-base font-black text-emerald-800 mt-0.5">
                  {chart[chart.length - 1]?.qty ?? 0} กก.
                </div>
              </div>
            </div>

            <div className="h-[250px]">
              {chart.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  ยังไม่มีข้อมูลเก็บผลผลิต
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 24, right: 16, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      unit=" กก."
                    />
                    <Tooltip content={<CustomChartTooltip suffix=" กก." />} />
                    <Bar
                      name="น้ำหนักผลผลิต"
                      dataKey="qty"
                      fill="#1f6a43"
                      radius={[10, 10, 0, 0]}
                      maxBarSize={68}
                    >
                      <LabelList
                        dataKey="qty"
                        position="top"
                        formatter={(val) => `${val} กก.`}
                        style={{ fill: '#173f2a', fontSize: 12, fontWeight: 800 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Bottom Monthly Breakdown Strip */}
          {chart.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {chart.slice(-3).map((m) => (
                  <span
                    key={m.month}
                    className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-semibold"
                  >
                    <span className="font-bold text-slate-900">{m.month}:</span>
                    <span className="text-emerald-800 font-black">{m.qty} กก.</span>
                  </span>
                ))}
              </div>
              <Link
                to="/harvest"
                className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-0.5"
              >
                <span>ดูประวัติเก็บเกี่ยว</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* 2. Monthly Revenue, Cost & Profit Chart (Redesigned for clarity) */}
        <div className="premium-panel rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#173f2a] flex items-center gap-2">
                  <span>สรุปรายได้และกำไรรายเดือน</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  เปรียบเทียบรายรับจากผลผลิต ต้นทุน และกำไรสุทธิในแต่ละเดือน
                </p>
              </div>

              {/* View Mode Toggle: Bar (Easy comparison) vs Area (Trend line) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setRevChartMode('bar')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    revChartMode === 'bar'
                      ? 'bg-white text-[#173f2a] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>แท่งเปรียบเทียบ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRevChartMode('area')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    revChartMode === 'area'
                      ? 'bg-white text-[#173f2a] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                  <span>เส้นแนวโน้ม</span>
                </button>
              </div>
            </div>

            {/* 3 Financial Summary Boxes */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl px-3 py-2">
                <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>รายได้รวม</span>
                </div>
                <div className="text-sm sm:text-base font-black text-emerald-800 mt-0.5">
                  ฿{stats.revenue.toLocaleString()}
                </div>
              </div>
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl px-3 py-2">
                <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>ต้นทุนรวม</span>
                </div>
                <div className="text-sm sm:text-base font-black text-amber-800 mt-0.5">
                  ฿{stats.cost.toLocaleString()}
                </div>
              </div>
              <div
                className={`rounded-2xl px-3 py-2 border ${
                  profit >= 0
                    ? 'bg-teal-50/80 border-teal-200/80'
                    : 'bg-rose-50/80 border-rose-200/80'
                }`}
              >
                <div className="text-[11px] font-bold text-slate-600">กำไรสุทธิ</div>
                <div
                  className={`text-sm sm:text-base font-black mt-0.5 ${
                    profit >= 0 ? 'text-[#173f2a]' : 'text-rose-700'
                  }`}
                >
                  {profit >= 0 ? '+' : ''}฿{profit.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-[250px]">
              {revenueChart.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  ยังไม่มีข้อมูลรายได้
                </div>
              ) : revChartMode === 'bar' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revenueChart}
                    margin={{ top: 24, right: 16, left: -5, bottom: 4 }}
                    barGap={8}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => `฿${v.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomChartTooltip prefix="฿" />} />
                    <Bar
                      name="รายได้จากผลผลิต"
                      dataKey="revenue"
                      fill="#10b981"
                      radius={[10, 10, 0, 0]}
                      maxBarSize={56}
                    >
                      <LabelList
                        dataKey="revenue"
                        position="top"
                        formatter={(val) => (val > 0 ? `฿${Number(val).toLocaleString()}` : '')}
                        style={{ fill: '#065f46', fontSize: 11, fontWeight: 800 }}
                      />
                    </Bar>
                    {stats.cost > 0 && (
                      <Bar
                        name="ต้นทุนการผลิต"
                        dataKey="cost"
                        fill="#f59e0b"
                        radius={[10, 10, 0, 0]}
                        maxBarSize={56}
                      >
                        <LabelList
                          dataKey="cost"
                          position="top"
                          formatter={(val) => (val > 0 ? `฿${Number(val).toLocaleString()}` : '')}
                          style={{ fill: '#92400e', fontSize: 11, fontWeight: 800 }}
                        />
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={revenueChart}
                    margin={{ top: 28, right: 32, left: 0, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      padding={{ left: 36, right: 36 }}
                      tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => `฿${v.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomChartTooltip prefix="฿" />} />
                    <Area
                      name="รายได้จากผลผลิต"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#059669"
                      fill="url(#revGradient)"
                      strokeWidth={3}
                      dot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 8 }}
                    >
                      <LabelList
                        dataKey="revenue"
                        position="top"
                        offset={10}
                        formatter={(val) => `฿${Number(val).toLocaleString()}`}
                        style={{ fill: '#065f46', fontSize: 12, fontWeight: 800 }}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Bottom Monthly Breakdown Strip */}
          {revenueChart.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {revenueChart.slice(-3).map((m) => (
                  <span
                    key={m.month}
                    className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-semibold"
                  >
                    <span className="font-bold text-slate-900">{m.month}:</span>
                    <span className="text-emerald-800 font-black">
                      ฿{m.revenue.toLocaleString()}
                    </span>
                    {m.cost > 0 && (
                      <span className="text-[11px] text-slate-500">
                        (กำไร {m.profit >= 0 ? '+' : ''}฿{m.profit.toLocaleString()})
                      </span>
                    )}
                  </span>
                ))}
              </div>
              <Link
                to="/sales-report"
                className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-0.5"
              >
                <span>รายงานยอดขาย</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Customer Intelligence Section (Full Width) */}
      <section>
        <AiPanel
          clusters={clusters}
          customers={customers}
          runningAi={runningAi}
          onRun={handleRunAi}
          onOpenPush={() => setShowPushModal(true)}
        />
      </section>

      {showPushModal && (
        <TargetedPushModal
          isOpen={showPushModal}
          onClose={() => setShowPushModal(false)}
          clusters={clusters}
          products={productsList}
        />
      )}
    </div>
  );
}

function AiPanel({ clusters, customers, runningAi, onRun, onOpenPush }) {
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
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenPush}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-bold transition shadow-xs hover:shadow-md cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            <span>ยิงแจ้งเตือน LINE</span>
          </button>
          <button
            onClick={onRun}
            disabled={runningAi}
            className="btn shrink-0 gap-2 shadow-sm hover:shadow-md transition-all"
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


function TargetedPushModal({ isOpen, onClose, clusters, products }) {
  const [targetType, setTargetType] = useState('cluster'); // 'cluster' | 'all'
  const [selectedClusterId, setSelectedClusterId] = useState(clusters[0]?.id || '');
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || '');
  const [customCropName, setCustomCropName] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [previewList, setPreviewList] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const currentProduct = products.find(p => String(p.id) === String(selectedProduct));
  const activeCropName = customCropName.trim() || currentProduct?.name || 'ผักสลัดสด GAP';

  useEffect(() => {
    if (clusters.length > 0 && !selectedClusterId) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters]);

  useEffect(() => {
    if (products.length > 0 && !selectedProduct) {
      setSelectedProduct(products[0].id);
    }
  }, [products]);

  // Real-time recipient preview
  useEffect(() => {
    if (!isOpen) return;
    let cancel = false;
    setLoadingPreview(true);
    const params = {
      target_type: targetType,
      cluster_id: targetType === 'cluster' ? selectedClusterId : undefined,
      crop_name: activeCropName,
    };
    api.get('/api/ai/push-preview', { params })
      .then(res => {
        if (!cancel) setPreviewList(res.data.customers || []);
      })
      .catch(() => {
        if (!cancel) setPreviewList([]);
      })
      .finally(() => {
        if (!cancel) setLoadingPreview(false);
      });
    return () => { cancel = true; };
  }, [isOpen, targetType, selectedClusterId, activeCropName]);

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.post('/api/ai/notify-harvest', {
        product_id: currentProduct?.id || null,
        crop_name: activeCropName,
        target_type: targetType,
        cluster_id: targetType === 'cluster' ? selectedClusterId : null,
        custom_title: customTitle.trim() || `🥦 ${activeCropName} สดๆ พร้อมส่งถึงคุณแล้ว!`,
        custom_message: customMessage.trim() || `สวัสดีครับคุณ {name} ทางฟาร์มมี ${activeCropName} สดใหม่ได้มาตรฐานความปลอดภัย GAP พร้อมส่งถึงมือคุณแล้วครับ สนใจกดสั่งซื้อได้ทันที!`,
        cta_label: `🛒 สั่งซื้อ ${activeCropName}`,
      });

      toast.success(res.data?.message || `ยิงแจ้งเตือน LINE สำเร็จ (${res.data?.notified_count || 0} ท่าน) 🎉`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">ยิงแจ้งเตือน LINE ตามกลุ่มเป้าหมาย AI</h3>
              <p className="text-xs text-slate-500">ส่งข้อความ Flex Message เจาะจงเฉพาะกลุ่มลูกค้าที่สนใจ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition border border-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSend} className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
          {/* Target Group Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              กลุ่มเป้าหมาย (Customer Cluster)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                  targetType === 'all'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold shadow-2xs'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 text-slate-700'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs">ลูกค้าทั้งหมดในระบบ</div>
                  <div className="text-[11px] text-slate-400 font-normal">ทุกคนที่มี LINE กับฟาร์ม</div>
                </div>
              </button>

              {clusters.map(c => {
                const isSelected = targetType === 'cluster' && String(selectedClusterId) === String(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setTargetType('cluster');
                      setSelectedClusterId(c.id);
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold shadow-2xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 text-slate-700'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs truncate">{c.cluster_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal truncate">{c.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product / Vegetable to Notify */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                ผัก/สินค้าจากสต็อก
              </label>
              <select
                value={selectedProduct}
                onChange={e => {
                  setSelectedProduct(e.target.value);
                  setCustomCropName('');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-emerald-600 bg-white"
              >
                {products.length === 0 ? (
                  <option value="">ไม่มีสินค้าในสต็อก</option>
                ) : (
                  products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (คงเหลือ {p.stock_quantity} {p.unit || 'ถุง'})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                หรือระบุชื่อผักเอง
              </label>
              <input
                type="text"
                value={customCropName}
                onChange={e => setCustomCropName(e.target.value)}
                placeholder="เช่น กรีนโอ๊ค, บัตเตอร์เฮด..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-emerald-600 bg-white"
              />
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              ข้อความแจ้งเตือน (ใช้ {name} แทนชื่อลูกค้าได้)
            </label>
            <textarea
              rows={2}
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              placeholder={`สวัสดีครับคุณ {name} วันนี้ฟาร์ม FarmGAP มี ${activeCropName} สดใหม่พร้อมส่งถึงมือคุณแล้วครับ...`}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-emerald-600 bg-white"
            />
          </div>

          {/* Recipient Live Preview */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                รายชื่อผู้รับที่จะได้รับแจ้งเตือน ({previewList.length} ท่าน)
              </span>
              {loadingPreview && <span className="text-[11px] text-slate-400 animate-pulse">กำลังคำนวณผู้รับ...</span>}
            </div>

            {previewList.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                {loadingPreview ? 'กำลังดึงข้อมูลผู้รับ...' : 'ไม่พบลูกค้าที่มี LINE ในกลุ่มเป้าหมายนี้'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
                {previewList.map(c => (
                  <div
                    key={c.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs shadow-2xs"
                  >
                    {c.picture_url ? (
                      <img src={c.picture_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center font-bold">
                        {c.name?.slice(0, 1) || 'L'}
                      </div>
                    )}
                    <span className="font-semibold text-slate-700 truncate max-w-[120px]">{c.name || 'ลูกค้า'}</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60">
                      {c.cluster_name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={sending || previewList.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black transition shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>กำลังส่ง Flex Message...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>ส่งแจ้งเตือน LINE ({previewList.length} ท่าน)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
