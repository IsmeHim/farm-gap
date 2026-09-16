import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, X, Search, Calendar, MapPin, CheckCircle2, AlertCircle, RefreshCw, Filter } from 'lucide-react';
import { format } from 'date-fns';

export default function LogManager({
  title,
  endpoint,
  fields,
  plotsLookup,
  renderRowAction,
  renderCard,
  renderTopBanner,
  renderHeaderExtra,
  renderModal,
  beforeSave,
  reloadTrigger,
  onDataLoaded,
}) {
  const [rows, setRows] = useState([]);
  const [plots, setPlots] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/${endpoint}`);
      setRows(data);
      if (onDataLoaded) onDataLoaded(data);
    } catch (e) {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (plotsLookup) {
      api.get('/api/plots').then(({ data }) => setPlots(data)).catch(() => {});
    }
  }, [endpoint, reloadTrigger]);

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

  const save = async (customPayload) => {
    try {
      let payload = customPayload && typeof customPayload === 'object' && !customPayload.nativeEvent ? { ...customPayload } : { ...form };
      fields.forEach(f => {
        if (f.allowCustom) {
          const customKey = `custom_${f.key}`;
          if (payload[customKey]) {
            payload[f.key] = payload[customKey];
          }
          delete payload[customKey];
        }
      });
      if (beforeSave) {
        const transformed = await beforeSave(payload, editingId);
        if (transformed === false) return;
        if (transformed && typeof transformed === 'object') {
          payload = transformed;
        }
      }
      if (editingId) {
        await api.put(`/api/${endpoint}/${editingId}`, payload);
        toast.success('บันทึกการแก้ไขเรียบร้อยแล้ว');
      } else {
        await api.post(`/api/${endpoint}`, payload);
        toast.success('เพิ่มรายการใหม่สำเร็จ');
      }
      setOpen(false);
      setEditingId(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const del = async (id) => {
    if (!confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) return;
    try {
      await api.delete(`/api/${endpoint}/${id}`);
      toast.success('ลบรายการเรียบร้อย');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  const plotName = (id) => {
    const p = plots.find(plot => plot.id === id);
    if (!p) return '—';
    const cleanName = (p.name || '').replace(/แปลง|\s|\(.*?\)/g, '').trim() || `P${p.id}`;
    const cycle = p.cycle_number || 1;
    return `${p.name} [#BATCH-${cleanName}-R${cycle}]`;
  };
  const visible = fields.filter(f => !f.hideInTable);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase().trim();
    return rows.filter(r => {
      return Object.entries(r).some(([key, val]) => {
        if (val === null || val === undefined) return false;
        if (key === 'plot_id') {
          const pName = plotName(val).toLowerCase();
          return pName.includes(q);
        }
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [rows, search, plots]);

  const renderBadge = (f, val) => {
    if (f.type === 'bool') {
      return val ? (
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[11px]">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ผ่าน/สะอาด
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[11px]">
          —
        </span>
      );
    }
    if (f.key === 'cycle_number') {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-mono font-bold text-[11px]">
          รอบที่ {val || 1}
        </span>
      );
    }
    if (f.key === 'session') {
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
          val === 'เย็น'
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}>
          {val === 'เย็น' ? '🌇 รอบเย็น' : '🌅 รอบเช้า'}
        </span>
      );
    }
    if (f.key === 'quality_grade') {
      return (
        <span className="inline-block bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-black text-[11px]">
          เกรด {val || '-'}
        </span>
      );
    }
    if (f.key === 'field_safety_status' || f.key === 'harvest_hygiene' || f.key === 'water_quality') {
      const isGood = String(val).includes('สะอาด') || String(val).includes('ปลอดภัย') || String(val).includes('ผ่าน');
      return (
        <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] border ${isGood ? 'bg-green-50 text-green-800 border-green-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
          {val || '-'}
        </span>
      );
    }
    if (f.key === 'status') {
      return (
        <span className="inline-block bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase">
          {val || 'active'}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#173f2a] flex items-center gap-2">
              {title}
              <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {filteredRows.length}
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {renderHeaderExtra && (
              <div className="flex-1 sm:flex-initial">
                {renderHeaderExtra({ load, openNew, plots, rows })}
              </div>
            )}

            <button
              onClick={openNew}
              className={`inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs shrink-0 cursor-pointer whitespace-nowrap ${
                renderHeaderExtra ? 'flex-1 sm:flex-initial' : 'w-full sm:w-auto'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรายการ</span>
            </button>
          </div>
        </div>

        {/* Quick Search Full Width */}
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="ค้นหาในตารางหรือรหัสแปลง..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input !pl-9.5 !pr-8 text-xs w-full !py-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs focus:border-emerald-600"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Optional Top Banner (e.g. Daily Routine or Quick Action Bar) */}
      {renderTopBanner && renderTopBanner({ load, openNew, plots, rows })}

      {/* MOBILE & TABLET VIEW: High-End Responsive Cards (1 col on mobile, 2 cols on tablet/iPad portrait) */}
      <div className="block lg:hidden">
        {loading ? (
          <div className="surface rounded-2xl p-12 text-center bg-white border border-slate-200/80 space-y-2">
            <div className="animate-spin text-2xl">🌱</div>
            <p className="text-xs text-slate-500 font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="surface rounded-2xl p-12 text-center bg-white border border-slate-200/80 space-y-2">
            <div className="text-3xl">📭</div>
            <p className="text-xs font-bold text-slate-600">ไม่พบรายการข้อมูล</p>
            <p className="text-[11px] text-slate-400">กดปุ่ม "+ เพิ่มรายการ" เพื่อเริ่มบันทึกข้อมูลแรกของคุณ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredRows.map(r => renderCard ? (
              <div key={r.id}>
                {renderCard({
                  item: r,
                  openEdit: () => openEdit(r),
                  del: () => del(r.id),
                  plotName,
                  renderBadge,
                })}
              </div>
            ) : (
              <div
                key={r.id}
                className="surface rounded-2xl p-4 bg-white border border-slate-200/80 shadow-xs space-y-3 transition hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: First 2 fields */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="font-bold text-sm text-[#173f2a]">
                        {visible[1]?.key === 'plot_id' ? plotName(r.plot_id) : (r[visible[0]?.key] ?? 'รายการ')}
                      </div>
                      {visible[0]?.type === 'date' && r[visible[0]?.key] && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-emerald-600" />
                          {format(new Date(r[visible[0]?.key]), 'dd/MM/yyyy')}
                        </div>
                      )}
                    </div>

                    <div>
                      {visible.map(f => {
                        const badge = renderBadge(f, r[f.key]);
                        return badge ? <div key={f.key}>{badge}</div> : null;
                      })}
                    </div>
                  </div>

                  {/* Card Content Grid: Key-Value details */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-2">
                    {visible.slice(visible[0]?.type === 'date' ? 1 : 0).map(f => {
                      if (renderBadge(f, r[f.key])) return null;
                      return (
                        <div key={f.key} className="space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400">{f.label}:</span>
                          <div className="font-semibold text-slate-700 truncate">
                            {f.key === 'plot_id' ? plotName(r[f.key])
                              : f.key === 'image_url' && r[f.key] ? (
                                <img src={r[f.key]} alt="รูป" className="w-16 h-12 rounded-lg object-cover border border-slate-200 mt-1" />
                              ) : r[f.key] ?? '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card Footer: Large, Touch-Friendly Action Buttons */}
                <div className="pt-2.5 border-t border-slate-100 space-y-2 mt-auto">
                  {renderRowAction && (
                    <div className="w-full">
                      {renderRowAction(r)}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 w-full">
                    <button
                      onClick={() => openEdit(r)}
                      className="inline-flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 active:scale-98 text-blue-700 font-bold py-2.5 px-3 rounded-xl text-xs border border-blue-200 transition cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5 shrink-0" />
                      <span>แก้ไข</span>
                    </button>

                    <button
                      onClick={() => del(r.id)}
                      className="inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-700 font-bold py-2.5 px-3 rounded-xl text-xs border border-rose-200 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>ลบ</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DESKTOP VIEW: Sleek Table (hidden on mobile/tablet portrait, block on lg:) */}
      <div className="hidden lg:block surface rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="table-responsive">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {visible.map(f => (
                  <th key={f.key} className="text-left px-4 py-3.5 font-bold text-slate-600 whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
                <th className="text-right px-4 py-3.5 font-bold text-slate-600 whitespace-nowrap">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={visible.length + 1} className="text-center py-16 text-slate-400">
                    <div className="animate-spin text-2xl mb-2">🌱</div>
                    <span>กำลังโหลดข้อมูล...</span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={visible.length + 1} className="text-center py-16 text-slate-400">
                    <div className="text-3xl mb-2">📭</div>
                    <span className="font-bold text-slate-600">ไม่พบรายการข้อมูล</span>
                  </td>
                </tr>
              ) : (
                filteredRows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    {visible.map(f => (
                      <td key={f.key} className="px-4 py-3 text-slate-700 font-medium align-middle">
                        {f.render ? f.render(r[f.key], r) : (
                          renderBadge(f, r[f.key]) || (
                            f.type === 'date' && r[f.key] ? (
                              <span className="font-mono text-slate-600">{format(new Date(r[f.key]), 'dd/MM/yyyy')}</span>
                            ) : f.key === 'plot_id' ? (
                              <span className="font-bold text-emerald-900">{plotName(r[f.key])}</span>
                            ) : f.key === 'image_url' && r[f.key] ? (
                              <img src={r[f.key]} alt="รูป" className="w-16 h-12 rounded-xl object-cover border border-slate-200" />
                            ) : (
                              r[f.key] ?? '—'
                            )
                          )
                        )}
                      </td>
                    ))}

                    <td className="px-4 py-3 text-right align-middle whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-nowrap">
                        {renderRowAction && renderRowAction(r)}

                        <button
                          onClick={() => openEdit(r)}
                          className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 font-bold px-2.5 py-1.5 rounded-xl text-xs border border-blue-200/80 transition cursor-pointer shadow-2xs"
                          title="แก้ไขรายการ"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>แก้ไข</span>
                        </button>

                        <button
                          onClick={() => del(r.id)}
                          className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold px-2.5 py-1.5 rounded-xl text-xs border border-rose-200/80 transition cursor-pointer shadow-2xs"
                          title="ลบรายการ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ลบ</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Universal Edit / Add Modal */}
      {open && (
        renderModal ? (
          renderModal({
            open,
            setOpen,
            editingId,
            form,
            setForm,
            save,
            plots,
            fields,
            title,
            endpoint,
            load,
          })
        ) : (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setOpen(false)}>
            <div
              className="bg-white rounded-t-3xl sm:rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
                <div>
                  <h2 className="text-base font-black text-[#173f2a]">
                    {editingId ? '✏️ แก้ไขข้อมูล' : '➕ เพิ่มรายการใหม่'}
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">{title}</p>
                </div>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                {fields.filter(f => !f.hideInForm).map(f => (
                  <div key={f.key} className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span>{f.label} {f.required && <span className="text-rose-500">*</span>}</span>
                    </label>

                    {f.type === 'textarea' ? (
                      <textarea
                        className="input text-xs w-full rounded-xl"
                        rows={3}
                        value={form[f.key] ?? ''}
                        placeholder={f.placeholder}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      />
                    ) : f.key === 'plot_id' ? (
                      <select
                        className="input text-xs w-full rounded-xl font-medium"
                        value={form[f.key] ?? ''}
                        onChange={e => setForm({ ...form, [f.key]: Number(e.target.value) })}
                      >
                        <option value="">{f.placeholder || '-- เลือกแปลง --'}</option>
                        {plots.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.crop_name})
                          </option>
                        ))}
                      </select>
                    ) : f.type === 'select' && f.allowCustom ? (
                      <div className="space-y-2">
                        <select
                          className="input text-xs w-full rounded-xl font-medium"
                          value={form[f.key] ?? ''}
                          onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        >
                          <option value="">{f.placeholder || '-- เลือก --'}</option>
                          {f.options.map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                        <input
                          className="input text-xs w-full rounded-xl"
                          type="text"
                          value={form[`custom_${f.key}`] ?? ''}
                          placeholder={`พิมพ์${f.label.toLowerCase()}ใหม่`}
                          onChange={e => setForm({ ...form, [`custom_${f.key}`]: e.target.value })}
                        />
                      </div>
                    ) : f.type === 'select' ? (
                      <select
                        className="input text-xs w-full rounded-xl font-medium"
                        value={form[f.key] ?? ''}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      >
                        <option value="">{f.placeholder || '-- เลือก --'}</option>
                        {f.options.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : f.type === 'bool' ? (
                      <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition">
                        <input
                          type="checkbox"
                          checked={!!form[f.key]}
                          onChange={e => setForm({ ...form, [f.key]: e.target.checked })}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">ผ่านการตรวจสอบ / ปลอดภัย</span>
                      </label>
                    ) : (
                      <input
                        className="input text-xs w-full rounded-xl"
                        type={f.type || 'text'}
                        step="any"
                        value={form[f.key] ?? ''}
                        placeholder={f.placeholder}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  className="btn btn-outline text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                  onClick={() => setOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="btn text-xs px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer shadow-md"
                  onClick={save}
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
