import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Leaf, Plus, Clock, Tag, Package, Search, Pencil, Trash2, X, Sprout } from 'lucide-react';

export default function Crops() {
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingCrop, setEditingCrop] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const initialForm = {
    name: '',
    scientific_name: '',
    category: 'ผักสลัด',
    growth_days: 42,
    nursery_days: 14,
    harvest_unit: 'กก.',
    default_bag_size: 'ถุงใสขนาด 9x18 นิ้ว (4 ขีด)',
    default_price: 35.00,
    notes: ''
  };
  const [form, setForm] = useState(initialForm);

  const fetchCrops = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/crops');
      setCrops(res.data || []);
    } catch (err) {
      console.error('Failed to load crops:', err);
      toast.error('ไม่สามารถโหลดข้อมูลคลังชนิดผักได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrops();
  }, []);

  const handleOpenAdd = () => {
    setEditingCrop(null);
    setForm(initialForm);
    setShowModal(true);
  };

  const handleOpenEdit = (crop) => {
    setEditingCrop(crop);
    setForm({
      name: crop.name || '',
      scientific_name: crop.scientific_name || '',
      category: crop.category || 'ผักสลัด',
      growth_days: crop.growth_days || 30,
      nursery_days: crop.nursery_days || 0,
      harvest_unit: crop.harvest_unit || 'กก.',
      default_bag_size: crop.default_bag_size || 'ถุงใส 4 ขีด (9x18)',
      default_price: crop.default_price || 20.00,
      notes: crop.notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      return toast.error('กรุณาระบุชื่อชนิดผัก');
    }

    try {
      setSubmitting(true);
      if (editingCrop) {
        await api.put(`/api/crops/${editingCrop.id}`, form);
        toast.success(`แก้ไขข้อมูล ${form.name} เรียบร้อยแล้ว`);
      } else {
        await api.post('/api/crops', form);
        toast.success(`เพิ่ม ${form.name} เข้าสู่คลังชนิดผักเรียบร้อยแล้ว`);
      }
      setShowModal(false);
      fetchCrops();
    } catch (err) {
      console.error('Submit crop error:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (crop) => {
    if (!window.confirm(`ต้องการลบชนิดผัก "${crop.name}" ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/api/crops/${crop.id}`);
      toast.success(`ลบ ${crop.name} เรียบร้อยแล้ว`);
      fetchCrops();
    } catch (err) {
      console.error('Delete crop error:', err);
      toast.error('ไม่สามารถลบชนิดผักได้');
    }
  };

  const categories = ['all', ...new Set(crops.map(c => c.category).filter(Boolean))];

  const filteredCrops = crops.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.scientific_name && c.scientific_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.category && c.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchCategory = selectedCategory === 'all' || c.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-xs font-bold text-emerald-800">
            <Sprout className="w-3.5 h-3.5 text-emerald-600" />
            Crops Library & Growth Cycle
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5">
            คลังชนิดผัก (Crops Library)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            กำหนดอายุวันเติบโต รูปแบบบรรจุภัณฑ์ถุง 4 ขีด และราคาขายเริ่มต้นตามมาตรฐานฟาร์มจริง
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ เพิ่มชนิดผักใหม่</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 bg-white p-2.5 rounded-2xl border-2 border-slate-200 shadow-2xs flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 ml-2 shrink-0" />
          <input
            type="text"
            placeholder="ค้นหาชื่อผัก หรือชื่อวิทยาศาสตร์ เช่น ผักบุ้งจีน, กวางตุ้ง, กรีนโอ๊ค..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm font-semibold text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat === 'all' ? 'ผักทั้งหมด' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Crops */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">กำลังโหลดข้อมูลคลังผัก...</div>
      ) : filteredCrops.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-2xs">
          <Leaf className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">ไม่พบชนิดผักที่ค้นหา</h3>
          <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่มเพิ่มชนิดผักใหม่</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCrops.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-3xl border-2 border-slate-200/90 p-5 shadow-xs hover:border-emerald-500 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {c.category}
                  </span>
                  <span className="text-sm font-black text-emerald-700">
                    ฿{Number(c.default_price || 0).toFixed(2)} /ถุง
                  </span>
                </div>

                <h3 className="font-black text-lg text-slate-900 mt-2.5">{c.name}</h3>
                {c.scientific_name && (
                  <p className="text-xs italic text-slate-500 font-medium">{c.scientific_name}</p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">อายุเก็บเกี่ยว</span>
                    <span className="font-black text-slate-900 text-sm">{c.growth_days} วัน</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">อนุบาลต้นกล้า</span>
                    <span className="font-black text-slate-900 text-sm">
                      {c.nursery_days > 0 ? `${c.nursery_days} วัน` : 'หว่านลงแปลง'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-[11px] truncate">{c.default_bag_size || 'ถุงใส 4 ขีด'}</span>
                  </div>
                  {c.notes && (
                    <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                      💡 {c.notes}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(c)}
                  className="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                  title="แก้ไข"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="ลบ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal เพิ่ม / แก้ไขชนิดผัก */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingCrop ? `แก้ไขข้อมูล: ${editingCrop.name}` : 'เพิ่มชนิดผักใหม่'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">บันทึกข้อมูลเข้าคลังเพื่อใช้ในรอบการเพาะปลูกและการเก็บเกี่ยว</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ชื่อชนิดผัก *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ผักบุ้งจีน, กรีนโอ๊ค"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">หมวดหมู่</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                  >
                    <option value="ผักสลัด">ผักสลัด</option>
                    <option value="ผักกินใบ">ผักกินใบ</option>
                    <option value="ผักเพื่อสุขภาพ">ผักเพื่อสุขภาพ</option>
                    <option value="สมุนไพร">สมุนไพร</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ชื่อทางวิทยาศาสตร์ (ถ้ามี)</label>
                <input
                  type="text"
                  placeholder="เช่น Lactuca sativa"
                  value={form.scientific_name}
                  onChange={(e) => setForm({ ...form, scientific_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">อายุเก็บเกี่ยว (วัน) *</label>
                  <input
                    type="number"
                    required
                    min={5}
                    max={180}
                    value={form.growth_days}
                    onChange={(e) => setForm({ ...form, growth_days: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">วันอนุบาลต้นกล้า (วัน)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={form.nursery_days}
                    onChange={(e) => setForm({ ...form, nursery_days: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ขนาดบรรจุภัณฑ์มาตรฐาน</label>
                  <input
                    type="text"
                    placeholder="เช่น ถุงใส 4 ขีด (9x18)"
                    value={form.default_bag_size}
                    onChange={(e) => setForm({ ...form, default_bag_size: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ราคาขายเริ่มต้น (บาท/ถุง)</label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    value={form.default_price}
                    onChange={(e) => setForm({ ...form, default_price: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">วิธีเพาะ/เทคนิคการปลูก (Notes)</label>
                <textarea
                  rows={2}
                  placeholder="เช่น แช่น้ำอุ่น 3 ชม. เทน้ำออก ผสมดิน 8 กระบะปูน = 1 แคร่ (2x6 ม.) หว่านเมล็ด 3 ขีด"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'กำลังบันทึก...' : editingCrop ? 'บันทึกการแก้ไข' : '✓ เพิ่มชนิดผัก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
