import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Image, Leaf, PackageCheck, Pencil, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react';

const emptyForm = {
  plot_id: '',
  name: '',
  category: 'ผักสลัด',
  price: '',
  unit: 'กก.',
  stock_quantity: '',
  image_url: '',
  status: 'available',
};

const statusStyle = {
  available: 'bg-emerald-100 text-emerald-800',
  unavailable: 'bg-slate-100 text-slate-700',
  out_of_stock: 'bg-rose-100 text-rose-800',
};

const statusText = {
  available: 'พร้อมขาย',
  unavailable: 'พักขาย',
  out_of_stock: 'หมดสต็อก',
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [plots, setPlots] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [productRes, plotRes] = await Promise.all([
      api.get('/api/products'),
      api.get('/api/plots').catch(() => ({ data: [] })),
    ]);
    setProducts(productRes.data);
    setPlots(plotRes.data);
  };

  useEffect(() => {
    load();

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    const refreshTimer = window.setInterval(refreshWhenVisible, 10000);

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(p =>
      [p.name, p.category, p.plot_name, p.status].some(v => String(v || '').toLowerCase().includes(needle))
    );
  }, [products, query]);

  const stats = useMemo(() => {
    const available = products.filter(p => p.status === 'available' && Number(p.stock_quantity) > 0).length;
    const stock = products.reduce((sum, p) => sum + Number(p.stock_quantity || 0), 0);
    const value = products.reduce((sum, p) => sum + Number(p.stock_quantity || 0) * Number(p.price || 0), 0);
    return { available, stock, value };
  }, [products]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (product) => {
    setEditingId(product.id);
    setForm({
      plot_id: product.plot_id || '',
      name: product.name || '',
      category: product.category || 'ผักสลัด',
      price: product.price ?? '',
      unit: product.unit || 'กก.',
      stock_quantity: product.stock_quantity ?? '',
      image_url: product.image_url || '',
      status: product.status || 'available',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name || form.price === '') {
      toast.error('กรุณากรอกชื่อสินค้าและราคา');
      return;
    }

    const payload = {
      ...form,
      plot_id: form.plot_id ? Number(form.plot_id) : null,
      price: Number(form.price),
      stock_quantity: Number(form.stock_quantity || 0),
    };

    try {
      if (editingId) await api.put(`/api/products/${editingId}`, payload);
      else await api.post('/api/products', payload);
      toast.success('บันทึกสินค้าแล้ว');
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const del = async (id) => {
    if (!confirm('ลบสินค้านี้?')) return;
    await api.delete(`/api/products/${id}`);
    toast.success('ลบสินค้าแล้ว');
    load();
  };

  return (
    <div className="space-y-6">
      <section className="surface overflow-hidden rounded-2xl p-5 md:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[.16em] text-[#9a6721]">
              <ShoppingBag className="h-4 w-4" />
              farm store inventory
            </div>
            <h1 className="mt-4 text-3xl md:text-5xl font-black text-[#173f2a]">สินค้าเก็บเกี่ยวพร้อมขาย</h1>
            <p className="mt-3 max-w-2xl text-sm md:text-base text-slate-600">
              จัดการสินค้า ราคา รูปภาพ และสต็อกสำหรับหน้า LIFF ให้ดูเหมือนหน้าร้านจริง ไม่ใช่แค่ตารางหลังบ้าน
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Metric label="พร้อมขาย" value={stats.available} />
            <Metric label="สต็อก" value={stats.stock.toFixed(1)} />
            <Metric label="มูลค่า" value={`฿${stats.value.toLocaleString()}`} />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-96">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
          <input
            className="input !pl-10 text-xs md:text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ค้นหาสินค้า หมวด แปลง หรือสถานะ..."
          />
        </div>
        <button className="btn" onClick={openNew}>
          <Plus className="h-4 w-4" /> เพิ่มสินค้า
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 && (
          <div className="premium-panel col-span-full rounded-2xl p-10 text-center text-slate-500">
            ยังไม่มีสินค้าในเงื่อนไขนี้
          </div>
        )}

        {filtered.map(product => (
          <article key={product.id} className="premium-panel overflow-hidden rounded-2xl bg-white">
            <div className="relative aspect-[4/3] bg-gradient-to-br from-emerald-50 to-amber-50">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="rounded-2xl bg-white/75 p-5 text-emerald-700 shadow-sm">
                    <Image className="h-12 w-12" />
                  </div>
                </div>
              )}
              <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${statusStyle[product.status] || statusStyle.unavailable}`}>
                {statusText[product.status] || product.status}
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[#173f2a]">{product.name}</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{product.category || 'ไม่ระบุหมวด'} · {product.plot_name || 'ไม่ผูกแปลง'}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-[#b5812d]">฿{Number(product.price || 0).toLocaleString()}</div>
                  <div className="text-xs text-slate-500">/{product.unit}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <PackageCheck className="h-4 w-4" /> คงเหลือ
                  </div>
                  <div className="mt-1 text-lg font-black text-emerald-950">{Number(product.stock_quantity || 0).toFixed(1)} {product.unit}</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                    <Leaf className="h-4 w-4" /> แหล่งที่มา
                  </div>
                  <div className="mt-1 truncate text-sm font-bold text-amber-950">{product.plot_name || 'คลังสินค้า'}</div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => openEdit(product)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">
                  <Pencil className="h-4 w-4" /> แก้ไข
                </button>
                <button onClick={() => del(product.id)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {open && (
        <ProductDialog
          form={form}
          setForm={setForm}
          plots={plots}
          editing={!!editingId}
          onClose={() => setOpen(false)}
          onSave={save}
        />
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-black text-[#173f2a]">{value}</div>
    </div>
  );
}

function ProductDialog({ form, setForm, plots, editing, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[#173f2a]">{editing ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
            <p className="text-sm text-slate-500">ข้อมูลนี้จะแสดงต่อในหน้าสั่งซื้อ LIFF</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="ชื่อสินค้า" required>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น กรีนโอ๊ค" />
          </Field>
          <Field label="แปลงต้นทาง">
            <select className="input" value={form.plot_id} onChange={e => setForm({ ...form, plot_id: e.target.value })}>
              <option value="">ไม่ผูกแปลง</option>
              {plots.map(plot => <option key={plot.id} value={plot.id}>{plot.name} ({plot.crop_name})</option>)}
            </select>
          </Field>
          <Field label="หมวดสินค้า">
            <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option>ผักสลัด</option>
              <option>ผักสวนครัว</option>
              <option>สมุนไพร</option>
              <option>อื่นๆ</option>
            </select>
          </Field>
          <Field label="สถานะ">
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="available">พร้อมขาย</option>
              <option value="unavailable">พักขาย</option>
              <option value="out_of_stock">หมดสต็อก</option>
            </select>
          </Field>
          <Field label="ราคา" required>
            <input className="input" type="number" step="any" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="ราคา (บาท)" />
          </Field>
          <Field label="หน่วย">
            <select className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
              <option>กก.</option>
              <option>ห่อ</option>
              <option>แพ็ก</option>
            </select>
          </Field>
          <Field label="จำนวนคงเหลือ">
            <input className="input" type="number" step="any" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} placeholder="จำนวนสินค้า" />
          </Field>
          <Field label="URL รูปภาพ">
            <input className="input" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
          </Field>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn btn-outline" onClick={onClose}>ยกเลิก</button>
          <button className="btn" onClick={onSave}>บันทึกสินค้า</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="label">{label}{required && ' *'}</span>
      {children}
    </label>
  );
}
