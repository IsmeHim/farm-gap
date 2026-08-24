import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, X } from 'lucide-react';
import { format } from 'date-fns';

// Generic CRUD UI for any /api/<endpoint>
export default function LogManager({ title, endpoint, fields, plotsLookup, renderRowAction }) {

  const [rows, setRows] = useState([]);
  const [plots, setPlots] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);

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
      if (f.allowCustom) init[`custom_${f.key}`] = '';
    });
    setForm(init);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (item) => {
    const init = {};
    fields.forEach(f => {
      init[f.key] = item[f.key] ?? (f.type === 'date' ? '' : '');
      if (f.allowCustom) init[`custom_${f.key}`] = '';
    });
    setForm(init);
    setEditingId(item.id);
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload = { ...form };
      fields.forEach(f => {
        if (f.allowCustom) {
          const customKey = `custom_${f.key}`;
          if (payload[customKey]) {
            payload[f.key] = payload[customKey];
          }
          delete payload[customKey];
        }
      });
      if (editingId) {
        await api.put(`/api/${endpoint}/${editingId}`, payload);
      } else {
        await api.post(`/api/${endpoint}`, payload);
      }
      toast.success('บันทึกแล้ว');
      setOpen(false);
      setEditingId(null);
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
                        : f.key === 'image_url' && r[f.key] ? (
                          <img src={r[f.key]} alt="รูปสินค้า" className="w-24 h-16 rounded-xl object-cover border border-slate-200" />
                        ) : f.type === 'bool' ? (r[f.key] ? '✓' : '—')
                        : r[f.key] ?? '—'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right flex gap-2 justify-end items-center">
                    {renderRowAction && renderRowAction(r)}
                    <button onClick={() => openEdit(r)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => del(r.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 className="w-4 h-4" /></button>
                  </td>
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
              <h2 className="text-lg font-bold">{editingId ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูลใหม่'}</h2>
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
                  ) : f.type === 'select' && f.allowCustom ? (
                    <div className="space-y-2">
                      <select className="input" value={form[f.key] ?? ''} onChange={e => setForm({...form, [f.key]: e.target.value})}>
                        <option value="">{f.placeholder || '-- เลือก --'}</option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <input
                        className="input"
                        type="text"
                        value={form[`custom_${f.key}`] ?? ''}
                        placeholder={`เพิ่ม${f.label.toLowerCase()}ใหม่`}
                        onChange={e => setForm({...form, [`custom_${f.key}`]: e.target.value})}
                      />
                    </div>
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
