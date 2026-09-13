import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, format, isAfter } from 'date-fns';
import {
  AlertTriangle,
  BadgeCheck,
  Bot,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Leaf,
  LineChart,
  Map,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';

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

export default function Dashboard() {
  const [stats, setStats] = useState({ plots: 0, harvest: 0, revenue: 0, cost: 0, checklistFails: 0, products: 0, stockValue: 0 });
  const [chart, setChart] = useState([]);
  const [revenueChart, setRevenueChart] = useState([]);
  const [phiAlerts, setPhiAlerts] = useState([]);
  const [waterAlerts, setWaterAlerts] = useState([]);
  const [hygieneAlerts, setHygieneAlerts] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [runningAi, setRunningAi] = useState(false);

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
      const [plots, harvest, costs, chems, water, workers, checklists, products] = await Promise.all([
        api.get('/api/plots'),
        api.get('/api/harvest'),
        api.get('/api/costs'),
        api.get('/api/chemicals'),
        api.get('/api/water'),
        api.get('/api/workers'),
        api.get('/api/checklists'),
        api.get('/api/products').catch(() => ({ data: [] })),
      ]);

      const rev = harvest.data.reduce((s, h) => s + Number(h.revenue || 0), 0);
      const cost = costs.data.reduce((s, c) => s + Number(c.amount || 0), 0);
      const qty = harvest.data.reduce((s, h) => s + Number(h.quantity || 0), 0);
      const checklistFails = checklists.data.filter(c => !c.field_inspection_pass || !c.hygiene_check).length;
      const availableProducts = products.data.filter(p => p.status === 'available' && Number(p.stock_quantity) > 0);
      const stockValue = products.data.reduce((s, p) => s + Number(p.price || 0) * Number(p.stock_quantity || 0), 0);
      setStats({ plots: plots.data.length, harvest: qty, revenue: rev, cost, checklistFails, products: availableProducts.length, stockValue });

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

      const hygieneList = workers.data.filter(w => !w.hygiene_training || !w.personal_hygiene_check);
      setHygieneAlerts(hygieneList);
      fetchAiData();
    })();
  }, []);

  const totalAlerts = phiAlerts.length + waterAlerts.length + hygieneAlerts.length + stats.checklistFails;
  const profit = stats.revenue - stats.cost;

  const heroMetrics = useMemo(() => [
    { label: 'รายได้', value: `฿${stats.revenue.toLocaleString()}`, icon: Wallet },
    { label: 'กำไรโดยประมาณ', value: `฿${profit.toLocaleString()}`, icon: LineChart },
    { label: 'สินค้า Live', value: `${stats.products} รายการ`, icon: PackageCheck },
  ], [stats, profit]);

  const cards = [
    { label: 'แปลงปลูก', value: stats.plots, detail: 'แปลงที่อยู่ในระบบ', icon: Map, accent: 'bg-emerald-100 text-emerald-800' },
    { label: 'ผลผลิตรวม', value: `${stats.harvest.toFixed(1)} kg`, detail: 'จากบันทึกเก็บเกี่ยว', icon: Leaf, accent: 'bg-lime-100 text-lime-800' },
    { label: 'มูลค่าสต็อก', value: `฿${stats.stockValue.toLocaleString()}`, detail: 'สินค้าคงเหลือพร้อมขาย', icon: PackageCheck, accent: 'bg-amber-100 text-amber-800' },
    { label: 'จุดที่ต้องดูแล', value: totalAlerts, detail: 'รวม alert GAP และงานค้าง', icon: AlertTriangle, accent: 'bg-rose-100 text-rose-800' },
  ];

  const handleRunAi = async () => {
    setRunningAi(true);
    try {
      await api.post('/api/ai/cluster');
      await api.post('/api/ai/recommend');
      await fetchAiData();
      alert('ประมวลผล K-Means และอัปเดตสินค้าแนะนำเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการวิเคราะห์ AI');
    } finally {
      setRunningAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <section className="surface overflow-hidden rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="grid gap-8 xl:grid-cols-[1.25fr_.75fr] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-black uppercase tracking-[.16em] text-[#9a6721]">
              <BadgeCheck className="h-4 w-4" />
              gap command center
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-[#173f2a] md:text-5xl">
              ภาพรวมฟาร์มและหน้าร้านในจอเดียว
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
              ติดตามผลผลิต ความเสี่ยง GAP สต็อกสินค้า และพฤติกรรมลูกค้า เพื่อให้ฟาร์มเดินแบบเป็นระบบและพร้อมขายทุกวัน
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {heroMetrics.map(metric => (
              <div key={metric.label} className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-xs backdrop-blur-sm transition hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">{metric.label}</div>
                  <metric.icon className="h-4 w-4 text-[#b5812d]" />
                </div>
                <div className="mt-2 text-2xl font-black text-[#173f2a]">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <div key={card.label} className="premium-panel rounded-3xl p-5 shadow-xs transition hover:shadow-md hover:-translate-y-0.5">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent} shadow-2xs`}>
              <card.icon className="h-6 w-6" />
            </div>
            <div className="mt-4 text-xs font-bold uppercase tracking-[.16em] text-slate-500">{card.label}</div>
            <div className="mt-1.5 text-3xl font-black text-[#173f2a]">{card.value}</div>
            <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
          </div>
        ))}
      </section>

      {/* Charts Section */}
      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <div className="premium-panel rounded-3xl p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#173f2a]">ผลผลิตรายเดือน</h2>
              <p className="text-sm text-slate-500">น้ำหนักเก็บเกี่ยวเทียบตามเดือน</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Leaf className="h-5 w-5" />
            </div>
          </div>
          <div className="h-[300px]">
            {chart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">ยังไม่มีข้อมูลเก็บเกี่ยว</div>
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
              <h2 className="text-xl font-black text-[#173f2a]">รายได้จากการเก็บเกี่ยว</h2>
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
        <AlertHub phiAlerts={phiAlerts} waterAlerts={waterAlerts} hygieneAlerts={hygieneAlerts} checklistFails={stats.checklistFails} />
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

function AlertHub({ phiAlerts, waterAlerts, hygieneAlerts, checklistFails }) {
  const groups = [
    {
      title: 'PHI ห้ามเก็บเกี่ยว',
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
    {
      title: 'สุขอนามัยคนงาน',
      icon: ShieldCheck,
      items: hygieneAlerts.map(w => `${w.name} ยังไม่ผ่านการอบรมหรือเช็กสุขอนามัย`),
      color: 'border-sky-200 bg-sky-50/80 text-sky-900',
      badgeColor: 'bg-sky-100 text-sky-800',
      iconColor: 'text-sky-600',
    },
  ];

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
        {checklistFails > 0 ? (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-rose-100 border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 self-start sm:self-auto">
            <AlertTriangle className="h-4 w-4" />
            Checklist ไม่ผ่าน {checklistFails} รายการ
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800 self-start sm:self-auto">
            <CheckCircle2 className="h-4 w-4" />
            Checklist ผ่านเกณฑ์ทั้งหมด
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
