import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';

// Generic CRUD UI for any /api/<endpoint>
export default function LogManager({ title, endpoint, fields, plotsLookup }) {
  const [rows, setRows] = useState([]);
  const [plots, setPlots] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});

  const load = async () => {
    const { data } = await api.get(`/api/${endpoint}`);
    setRows(data);
  };
  useEffect(() => {
    load();
    if (plotsLookup) api.get('/api/plots').then(({data}) => setPlots(data));
  }, []);

  const openNew = () => {
    const init = {};
    fields.forEach(f => {
      if (f.type === 'date') init[f.key] = format(new Date(), 'yyyy-MM-dd');
      else if (f.default !== undefined) init[f.key] = f.default;
    });
    setForm(init);
    setOpen(true);
  };

  const save = async () => {
    try {
      await api.post(`/api/${endpoint}`, form);
      toast.success('บันทึกแล้ว');
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const del = async (id) => {
    if (!confirm('ลบรายการนี้?')) return;
    await api.delete(`/api/${endpoint}/${id}`);
    load();
  };

  const plotName = (id) => plots.find(p => p.id === id)?.name || '—';
  const visible = fields.filter(f => !f.hideInTable);

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center mb-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <button className="btn w-full md:w-auto" onClick={openNew}><Plus className="w-4 h-4" /> เพิ่ม</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="table-responsive">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{visible.map(f => <th key={f.key} className="text-left px-4 py-3 font-medium text-gray-600">{f.label}</th>)}<th className="w-12"></th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={visible.length+1} className="text-center py-12 text-gray-400">ยังไม่มีข้อมูล</td></tr>}
              {rows.map(r => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                  {visible.map(f => (
                    <td key={f.key} className="px-4 py-3 align-top">
                      {f.type === 'date' && r[f.key] ? format(new Date(r[f.key]), 'dd/MM/yyyy')
                        : f.key === 'plot_id' ? plotName(r[f.key])
                        : f.type === 'bool' ? (r[f.key] ? '✓' : '—')
                        : r[f.key] ?? '—'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right"><button onClick={() => del(r.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">เพิ่มข้อมูลใหม่</h2>
              <button onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {fields.map(f => (
                <div key={f.key}>
                  <label className="label">{f.label}{f.required && ' *'}</label>
                  {f.type === 'textarea' ? (
                    <textarea className="input" rows={3} value={form[f.key] ?? ''} placeholder={f.placeholder} onChange={e => setForm({...form, [f.key]: e.target.value})} />
                  ) : f.key === 'plot_id' ? (
                    <select className="input" value={form[f.key] ?? ''} onChange={e => setForm({...form, [f.key]: Number(e.target.value)})}>
                      <option value="">{f.placeholder || '-- เลือกแปลง --'}</option>
                      {plots.map(p => <option key={p.id} value={p.id}>{p.name} ({p.crop_name})</option>)}
                    </select>
                  ) : f.type === 'select' ? (
                    <select className="input" value={form[f.key] ?? ''} onChange={e => setForm({...form, [f.key]: e.target.value})}>
                      <option value="">{f.placeholder || '-- เลือก --'}</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === 'bool' ? (
                    <input type="checkbox" checked={!!form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.checked})} />
                  ) : (
                    <input className="input" type={f.type || 'text'} step="any" value={form[f.key] ?? ''} placeholder={f.placeholder} onChange={e => setForm({...form, [f.key]: e.target.value})} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-outline" onClick={() => setOpen(false)}>ยกเลิก</button>
              <button className="btn" onClick={save}>บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
