import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Map, Leaf, Wallet, AlertTriangle } from 'lucide-react';
import { format, addDays, isAfter } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState({ plots: 0, harvest: 0, revenue: 0, cost: 0 });
  const [chart, setChart] = useState([]);
  const [phiAlerts, setPhiAlerts] = useState([]);

  useEffect(() => {
    (async () => {
      const [plots, harvest, costs, chems] = await Promise.all([
        api.get('/api/plots'), api.get('/api/harvest'), api.get('/api/costs'), api.get('/api/chemicals'),
      ]);
      const rev = harvest.data.reduce((s, h) => s + Number(h.revenue || 0), 0);
      const cost = costs.data.reduce((s, c) => s + Number(c.amount || 0), 0);
      const qty = harvest.data.reduce((s, h) => s + Number(h.quantity || 0), 0);
      setStats({ plots: plots.data.length, harvest: qty, revenue: rev, cost });

      // monthly harvest
      const m = {};
      harvest.data.forEach(h => {
        const k = format(new Date(h.harvest_date), 'MM/yy');
        m[k] = (m[k] || 0) + Number(h.quantity || 0);
      });
      setChart(Object.entries(m).map(([month, qty]) => ({ month, qty })).reverse());

      // PHI alerts: chems where log_date + phi_days >= today and plot active
      const today = new Date();
      const alerts = chems.data.filter(c => {
        const safe = addDays(new Date(c.log_date), Number(c.phi_days || 0));
        return isAfter(safe, today);
      }).map(c => ({ ...c, safe_date: format(addDays(new Date(c.log_date), Number(c.phi_days||0)), 'dd/MM/yyyy'), plot_name: plots.data.find(p=>p.id===c.plot_id)?.name }));
      setPhiAlerts(alerts);
    })();
  }, []);

  const cards = [
    { label: 'แปลงปลูก', value: stats.plots, icon: Map },
    { label: 'ผลผลิต (kg)', value: stats.harvest.toFixed(1), icon: Leaf },
    { label: 'รายได้ (THB)', value: stats.revenue.toLocaleString(), icon: Wallet },
    { label: 'กำไร (THB)', value: (stats.revenue - stats.cost).toLocaleString(), icon: Wallet },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">แดชบอร์ด</h1>
          <p className="text-sm text-gray-500 mt-1">สรุปภาพรวมฟาร์มและการจัดการ GAP ในมุมมองเดียว</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.label} className="card flex flex-col gap-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-3xl bg-primary/10 text-primary">
              <c.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm uppercase tracking-[.18em] text-gray-500">{c.label}</div>
              <div className="mt-3 text-3xl font-bold">{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {phiAlerts.length > 0 && (
        <div className="card mb-6 border-amber-300 bg-amber-50">
          <div className="flex items-center gap-2 mb-3 font-bold text-amber-900"><AlertTriangle className="w-5 h-5" /> เตือน PHI (ห้ามเก็บเกี่ยว)</div>
          <ul className="text-sm space-y-2">
            {phiAlerts.map(a => (
              <li key={a.id} className="rounded-2xl border border-amber-100 bg-white/80 p-3">แปลง <b>{a.plot_name}</b> พ่น {a.product_name} — ห้ามเก็บก่อน {a.safe_date}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="font-bold mb-4">ผลผลิตรายเดือน (kg)</h2>
        <div className="min-h-[300px]">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qty" fill="#4c7d3c" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
