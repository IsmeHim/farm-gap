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
    { label: 'สินค้า Live', value: stats.products, icon: PackageCheck },
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
      <section className="surface overflow-hidden rounded-3xl p-5 md:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.25fr_.75fr] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[.16em] text-[#9a6721]">
              <BadgeCheck className="h-4 w-4" />
              gap command center
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-[#173f2a] md:text-6xl">
              ภาพรวมฟาร์มและหน้าร้านในจอเดียว
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              ติดตามผลผลิต ความเสี่ยง GAP สต็อกสินค้า และพฤติกรรมลูกค้า เพื่อให้ฟาร์มเดินแบบเป็นระบบและพร้อมขายทุกวัน
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {heroMetrics.map(metric => (
              <div key={metric.label} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm">
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <div key={card.label} className="premium-panel rounded-2xl p-5">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent}`}>
              <card.icon className="h-6 w-6" />
            </div>
            <div className="mt-5 text-sm font-bold uppercase tracking-[.16em] text-slate-500">{card.label}</div>
            <div className="mt-2 text-3xl font-black text-[#173f2a]">{card.value}</div>
            <p className="mt-2 text-sm text-slate-500">{card.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="premium-panel rounded-2xl p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#173f2a]">ผลผลิตรายเดือน</h2>
              <p className="text-sm text-slate-500">น้ำหนักเก็บเกี่ยวเทียบตามเดือน</p>
            </div>
            <Leaf className="h-6 w-6 text-emerald-700" />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dfe8da" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="qty" fill="#236c45" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="premium-panel rounded-2xl p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#173f2a]">รายได้จากการเก็บเกี่ยว</h2>
              <p className="text-sm text-slate-500">ดูแนวโน้มเงินสดจากผลผลิต</p>
            </div>
            <Wallet className="h-6 w-6 text-[#b5812d]" />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dfe8da" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#b5812d" fill="#f4d27a" fillOpacity={0.42} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
        <AlertHub phiAlerts={phiAlerts} waterAlerts={waterAlerts} hygieneAlerts={hygieneAlerts} checklistFails={stats.checklistFails} />
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
    { title: 'PHI ห้ามเก็บเกี่ยว', icon: AlertTriangle, items: phiAlerts.map(a => `แปลง ${a.plot_name || '-'} พ่น ${a.product_name} ปลอดภัยหลัง ${a.safe_date}`), color: 'text-amber-800 bg-amber-50 border-amber-200' },
    { title: 'น้ำไม่ปลอดภัย', icon: Droplets, items: waterAlerts.map(w => `แปลง ${w.plot_name || '-'} แหล่งน้ำ ${w.water_source_type || w.water_source || '-'} สถานะ ${w.water_quality || 'สงสัย'}`), color: 'text-rose-800 bg-rose-50 border-rose-200' },
    { title: 'สุขอนามัยคนงาน', icon: ShieldCheck, items: hygieneAlerts.map(w => `${w.name} ยังไม่ผ่านการอบรมหรือเช็กสุขอนามัย`), color: 'text-sky-800 bg-sky-50 border-sky-200' },
  ];

  return (
    <div className="premium-panel rounded-2xl p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[#173f2a]">ศูนย์เตือนความเสี่ยง</h2>
          <p className="text-sm text-slate-500">สิ่งที่ควรจัดการก่อนกระทบมาตรฐาน GAP</p>
        </div>
        {checklistFails > 0 ? <AlertTriangle className="h-6 w-6 text-rose-600" /> : <CheckCircle2 className="h-6 w-6 text-emerald-700" />}
      </div>

      {checklistFails > 0 && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
          Checklist ไม่ผ่าน {checklistFails} รายการ
        </div>
      )}

      <div className="space-y-3">
        {groups.map(group => (
          <div key={group.title} className={`rounded-xl border p-3 ${group.color}`}>
            <div className="flex items-center gap-2 font-black">
              <group.icon className="h-4 w-4" />
              {group.title}
              <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-xs">{group.items.length}</span>
            </div>
            <div className="mt-2 space-y-2 text-sm">
              {group.items.length === 0 ? (
                <p className="text-slate-500">เรียบร้อย ไม่มีรายการค้าง</p>
              ) : (
                group.items.slice(0, 4).map((item, idx) => <p key={idx}>{item}</p>)
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
    <div className="premium-panel rounded-2xl p-5">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#9a6721]">
            <Sparkles className="h-4 w-4" />
            customer intelligence
          </div>
          <h2 className="mt-2 text-xl font-black text-[#173f2a]">AI จัดกลุ่มลูกค้าและสินค้าแนะนำ</h2>
          <p className="text-sm text-slate-500">รัน K-Means และอัปเดตสินค้าแนะนำจากประวัติการซื้อ</p>
        </div>
        <button onClick={onRun} disabled={runningAi} className="btn">
          <Bot className="h-4 w-4" />
          {runningAi ? 'กำลังวิเคราะห์' : 'ประมวลผล AI'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_.8fr]">
        <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {customers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              ยังไม่มีประวัติลูกค้าสำหรับจัดกลุ่ม
            </div>
          ) : (
            customers.map(customer => (
              <div key={customer.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/75 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  {customer.picture_url ? (
                    <img src={customer.picture_url} alt={customer.display_name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                      <Users className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-black text-slate-800">{customer.display_name || 'ลูกค้า LINE'}</div>
                    <div className="text-xs text-slate-500">ออเดอร์ {customer.order_count} ครั้ง · ฿{Number(customer.total_spend || 0).toLocaleString()}</div>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                  {customer.cluster_name || 'รอวิเคราะห์'}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl bg-[#173f2a] p-4 text-white">
          <div className="flex items-center gap-2 font-black">
            <ClipboardList className="h-5 w-5 text-[#f4d27a]" />
            คำอธิบายกลุ่ม
          </div>
          <div className="mt-4 space-y-3 text-sm text-emerald-50">
            {clusters.length === 0 ? (
              <p>กดประมวลผล AI เพื่อสร้างกลุ่มลูกค้าเริ่มต้น</p>
            ) : (
              clusters.map(cluster => (
                <div key={cluster.id} className="rounded-xl bg-white/10 p-3">
                  <div className="font-black text-[#f4d27a]">{cluster.cluster_name}</div>
                  <p className="mt-1 text-xs leading-5">{cluster.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
