import { useState, useEffect } from 'react';
import LogManager from '../components/LogManager.jsx';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
  Send,
  Sparkles,
  PackageCheck,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  X,
  Store,
  Layers,
  Calendar,
  Printer,
  ExternalLink,
  Tag,
} from 'lucide-react';
import { format } from 'date-fns';
import { getCropCycleId } from '../lib/cropCycle.js';

export default function Harvest() {
  const [sendingId, setSendingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Smart Harvest Modal state
  const [smartModalOpen, setSmartModalOpen] = useState(false);
  const [plots, setPlots] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingPlots, setLoadingPlots] = useState(false);

  const [form, setForm] = useState({
    plot_id: '',
    harvest_date: format(new Date(), 'yyyy-MM-dd'),
    quantity: '',
    unit: 'kg',
    quality_grade: 'A',
    worker_name: '',
    notes: '',
    // Stock sync fields
    sync_to_stock: true,
    price: '',
    image_url: '',
    is_available: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null); // holds { harvest, product, lot_code, phi_warning }
  const [qrModalItem, setQrModalItem] = useState(null);

  // Load active plots and products for Smart Harvest
  const loadPrerequisites = async () => {
    setLoadingPlots(true);
    try {
      const [plRes, prRes] = await Promise.all([
        api.get('/api/plots'),
        api.get('/api/products').catch(() => ({ data: [] })),
      ]);
      setPlots(plRes.data);
      setProducts(prRes.data);
    } catch (e) {
      console.warn('Failed to load plots/products:', e.message);
    } finally {
      setLoadingPlots(false);
    }
  };

  const openSmartHarvest = async (defaultPlotId = null) => {
    await loadPrerequisites();
    setForm({
      plot_id: defaultPlotId || '',
      harvest_date: format(new Date(), 'yyyy-MM-dd'),
      quantity: '',
      unit: 'kg',
      quality_grade: 'A',
      worker_name: '',
      notes: '',
      sync_to_stock: true,
      price: '',
      image_url: '',
      is_available: true,
    });
    setSuccessResult(null);
    setSmartModalOpen(true);
  };

  // Selected plot object
  const selectedPlot = plots.find(p => p.id === Number(form.plot_id));

  // Auto-detect existing product matching selected plot or crop name
  const matchedProduct = selectedPlot
    ? products.find(
        pr =>
          (pr.plot_id && Number(pr.plot_id) === Number(selectedPlot.id)) ||
          pr.name.toLowerCase().includes(selectedPlot.crop_name.toLowerCase()) ||
          selectedPlot.crop_name.toLowerCase().includes(pr.name.toLowerCase())
      )
    : null;

  // Pre-fill price from matched product if not set
  useEffect(() => {
    if (matchedProduct && !form.price) {
      setForm(prev => ({ ...prev, price: matchedProduct.price }));
    }
  }, [matchedProduct]);

  const handleSmartSubmit = async (e) => {
    e.preventDefault();
    if (!form.plot_id) {
      toast.error('กรุณาเลือกแปลงที่เก็บเกี่ยว');
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      toast.error('กรุณาระบุจำนวนที่เก็บเกี่ยวให้ถูกต้อง');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        plot_id: Number(form.plot_id),
        harvest_date: form.harvest_date,
        quantity: Number(form.quantity),
        unit: form.unit,
        quality_grade: form.quality_grade,
        worker_name: form.worker_name,
        notes: form.notes,
        sync_to_stock: form.sync_to_stock,
        price: form.price ? Number(form.price) : undefined,
        image_url: form.image_url || undefined,
        is_available: form.is_available,
        product_id: matchedProduct ? matchedProduct.id : undefined,
      };

      const res = await api.post('/api/harvest/smart-record', payload);
      setSuccessResult(res.data);
      toast.success(res.data.message || 'บันทึกการเก็บเกี่ยวสำเร็จ!');
      setReloadKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกเก็บเกี่ยว');
    } finally {
      setSubmitting(false);
    }
  };

  // Personalized LINE Push
  const handlePersonalizedPush = async (harvestItem) => {
    setSendingId(harvestItem.id);
    try {
      const plotsRes = await api.get('/api/plots');
      const plot = plotsRes.data.find(p => p.id === harvestItem.plot_id);
      const cropName = plot?.crop_name || 'ผักสลัดสด';

      const res = await api.post('/api/ai/notify-harvest', {
        harvest_id: harvestItem.id,
        crop_name: cropName,
        quantity: harvestItem.quantity,
        unit: harvestItem.unit || 'kg',
        plot_name: plot?.name || 'แปลงเกษตร',
      });

      const targets = res.data.target_customers?.map(c => `${c.name} (${c.cluster})`).join(', ');
      toast.success(`📢 ยิงแจ้งเตือนผัก ${cropName} สำเร็จ! (${res.data.notified_count} ท่าน)`, {
        description: targets ? `ส่งถึง: ${targets}` : 'ยิงแจ้งเตือนถึงลูกค้าเรียบร้อยแล้ว',
        duration: 5000,
      });
    } catch (err) {
      toast.error('ไม่สามารถส่งแจ้งเตือน LINE ได้');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <>
      <LogManager
        title="เก็บเกี่ยว (GAP #5)"
        endpoint="harvest"
        plotsLookup
        reloadTrigger={reloadKey}
        renderHeaderExtra={() => (
          <button
            onClick={() => openSmartHarvest()}
            className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-900 text-xs font-black px-4 py-2.5 rounded-xl transition shadow-md cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-slate-900 fill-current" />
            <span>🧺 บันทึกเก็บเกี่ยวอัจฉริยะ (ลงสต็อกอัตโนมัติ)</span>
          </button>
        )}
        renderRowAction={(item) => (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handlePersonalizedPush(item)}
              disabled={sendingId === item.id}
              className="inline-flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 font-bold px-2.5 py-1.5 rounded-xl text-xs border border-green-200 transition disabled:opacity-50 cursor-pointer"
              title="ยิง LINE Push Notification หาเฉพาะลูกค้าที่ชอบผักชนิดนี้"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingId === item.id ? 'กำลังส่ง...' : '📢 ยิง LINE Push'}</span>
            </button>

            {item.lot_code && (
              <button
                type="button"
                onClick={() => setQrModalItem(item)}
                className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-xl text-xs border border-slate-200 transition cursor-pointer"
                title="ดู QR Code สำหรับตรวจสอบย้อนกลับมาตรฐาน GAP"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                <span>QR ย้อนกลับ</span>
              </button>
            )}
          </div>
        )}
        fields={[
          { key: 'harvest_date', label: 'วันที่เก็บ', type: 'date', placeholder: 'เลือกวันที่เก็บ', required: true },
          { key: 'plot_id', label: 'แปลง', placeholder: '-- เลือกแปลง --', required: true },
          { key: 'quantity', label: 'จำนวน', type: 'number', placeholder: 'เช่น 100', required: true },
          { key: 'unit', label: 'หน่วย', placeholder: 'เช่น kg', default: 'kg' },
          { key: 'quality_grade', label: 'เกรด', type: 'select', options: ['A', 'B', 'C'], placeholder: '-- เลือกเกรด --' },
          { key: 'lot_code', label: 'Lot Code (สำหรับ QR)', placeholder: 'Lot Code สำหรับ QR' },
          { key: 'revenue', label: 'รายได้ (THB)', type: 'number', placeholder: 'เช่น 5000' },
          { key: 'harvest_hygiene', label: 'สุขอนามัยการเก็บเกี่ยว', type: 'select', options: ['สะอาด', 'ปนเปื้อน', 'รอตรวจสอบ'], placeholder: '-- เลือกสถานะ --' },
          { key: 'postharvest_handling', label: 'การจัดการหลังเก็บเกี่ยว', placeholder: 'เช่น ล้าง/บรรจุ' },
          { key: 'worker_name', label: 'ผู้ปฏิบัติ', placeholder: 'ชื่อผู้ปฏิบัติ' },
          { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
        ]}
      />

      {/* Modal: Smart Harvest & Auto Stock Sync */}
      {smartModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-amber-100 text-amber-900">
                    <Sparkles className="w-5 h-5 text-amber-700 fill-current" />
                  </span>
                  <h3 className="font-black text-slate-800 text-base sm:text-lg">
                    บันทึกเก็บเกี่ยวอัจฉริยะ (Smart Harvest)
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  ระบบจะบันทึกมาตรฐาน GAP ปรับสถานะแปลง และโยกผลผลิตเข้าสต็อกขายหน้าร้าน LINE ให้อัตโนมัติ
                </p>
              </div>
              <button
                onClick={() => setSmartModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If Already Submitted and Success Result is available */}
            {successResult ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900 text-base">
                    บันทึกการเก็บเกี่ยวและอัปเดตสต็อกเรียบร้อย!
                  </h4>
                  <p className="text-xs text-emerald-700">
                    {successResult.message}
                  </p>
                </div>

                {/* Lot Code & QR Traceability Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                      `${window.location.origin}/trace/${successResult.lot_code}`
                    )}`}
                    alt="Trace QR Code"
                    className="w-24 h-24 bg-white p-1 rounded-xl border border-slate-200 shadow-xs shrink-0"
                  />
                  <div className="space-y-1 text-xs">
                    <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">GAP Lot Code</div>
                    <div className="font-mono font-bold text-sm text-slate-800">{successResult.lot_code}</div>
                    <p className="text-[11px] text-slate-500">
                      สแกนเพื่อเปิดดูประวัติแปลง การใช้น้ำ และความปลอดภัยมาตรฐาน GAP
                    </p>
                    <div className="pt-1 flex gap-2 justify-center sm:justify-start">
                      <a
                        href={`/trace/${successResult.lot_code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                      >
                        เปิดหน้าตรวจสอบย้อนกลับ <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Synced Product Summary */}
                {successResult.product && (
                  <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3.5 text-xs text-blue-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-blue-700" />
                      <span>
                        สต็อกหน้าร้าน <strong>{successResult.product.name}</strong>: ปัจจุบันมี{' '}
                        <strong>{successResult.product.stock_quantity} กก.</strong> (เพิ่มขึ้น +{successResult.product.added_stock} กก.)
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setSmartModalOpen(false);
                      setSuccessResult(null);
                    }}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition shadow cursor-pointer"
                  >
                    เรียบร้อย (ปิดหน้าต่าง)
                  </button>
                </div>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSmartSubmit} className="space-y-4">
                {/* 1. Select Plot */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-700" />
                    เลือกแปลงที่ต้องการเก็บเกี่ยว <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={form.plot_id}
                    onChange={e => setForm(prev => ({ ...prev, plot_id: e.target.value }))}
                    className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                  >
                    <option value="">-- เลือกแปลงปลูก --</option>
                    {plots.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.crop_name} [#{getCropCycleId(p)}] {p.status === 'active' ? '(กำลังปลูก)' : `(${p.status})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Plot Quick Info */}
                {selectedPlot && (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-xs text-emerald-900 flex items-center justify-between">
                    <div>
                      <div>พืช: <strong>{selectedPlot.crop_name}</strong></div>
                      <div className="text-[11px] text-emerald-700">
                        วันปลูก: {selectedPlot.planting_date ? format(new Date(selectedPlot.planting_date), 'dd/MM/yyyy') : '-'}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                      #{getCropCycleId(selectedPlot)} (รอบที่ {selectedPlot.cycle_number || 1})
                    </span>
                  </div>
                )}

                {/* Harvest Details: Date & Quantity */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> วันที่เก็บ
                    </label>
                    <input
                      type="date"
                      required
                      value={form.harvest_date}
                      onChange={e => setForm(prev => ({ ...prev, harvest_date: e.target.value }))}
                      className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      จำนวนที่เก็บได้ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="เช่น 30"
                      value={form.quantity}
                      onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                      className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 font-bold text-emerald-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">หน่วย</label>
                    <input
                      type="text"
                      value={form.unit}
                      onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                      className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">เกรดคุณภาพ</label>
                    <select
                      value={form.quality_grade}
                      onChange={e => setForm(prev => ({ ...prev, quality_grade: e.target.value }))}
                      className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="A">เกรด A (พรีเมียม สวยงาม)</option>
                      <option value="B">เกรด B (มาตรฐาน)</option>
                      <option value="C">เกรด C (คละ/แปรรูป)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">ผู้ปฏิบัติงาน</label>
                    <input
                      type="text"
                      placeholder="ชื่อผู้ตัด/คัดเกรด"
                      value={form.worker_name}
                      onChange={e => setForm(prev => ({ ...prev, worker_name: e.target.value }))}
                      className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                {/* 3. Auto Stock Sync Section */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.sync_to_stock}
                        onChange={e => setForm(prev => ({ ...prev, sync_to_stock: e.target.checked }))}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      <span>📦 นำผลผลิตเข้าสต็อกหน้าร้าน LINE อัตโนมัติ</span>
                    </label>
                  </div>

                  {form.sync_to_stock && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      {matchedProduct ? (
                        /* Case 1: Product Exists */
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            พบสินค้าในคลัง: "{matchedProduct.name}"
                          </div>
                          <p className="text-[11px] text-slate-600">
                            สต็อกเดิม: <strong>{matchedProduct.stock_quantity} {matchedProduct.unit || 'กก.'}</strong> ➔ บวกเพิ่ม{' '}
                            <strong>{form.quantity || 0} {form.unit}</strong> = รวมเป็น{' '}
                            <strong>{(Number(matchedProduct.stock_quantity) || 0) + (Number(form.quantity) || 0)} {form.unit}</strong>
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-600">ราคาขายหน้าร้าน (บาท/{form.unit})</label>
                              <input
                                type="number"
                                step="0.5"
                                value={form.price}
                                onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                                placeholder={`เดิม ${matchedProduct.price} บาท`}
                                className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-600">สถานะสินค้า</label>
                              <select
                                value={form.is_available ? 'yes' : 'no'}
                                onChange={e => setForm(prev => ({ ...prev, is_available: e.target.value === 'yes' }))}
                                className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white"
                              >
                                <option value="yes">เปิดขายทันที (Available)</option>
                                <option value="no">เก็บเข้าคลังไว้ก่อน (ยังไม่เปิดขาย)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Case 2: New Product Detected */
                        <div className="space-y-3">
                          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                            ✨ ตรวจพบว่าเป็นผักรายการใหม่! กรุณาระบุราคาเพื่อเปิดขายหน้าร้าน
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-700">
                                ราคาขายหน้าร้าน (บาท/{form.unit}) <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="number"
                                required={form.sync_to_stock}
                                step="0.5"
                                placeholder="เช่น 50"
                                value={form.price}
                                onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                                className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-bold"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-700">การแสดงผล</label>
                              <select
                                value={form.is_available ? 'yes' : 'no'}
                                onChange={e => setForm(prev => ({ ...prev, is_available: e.target.value === 'yes' }))}
                                className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 bg-white"
                              >
                                <option value="yes">เปิดขายหน้าร้านทันที</option>
                                <option value="no">เก็บเป็นสต็อกไว้ก่อน (ยังไม่เปิดขาย)</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700">
                              ลิงก์รูปภาพผักสด (เว้นว่างไว้ได้ ระบบจะใช้รูปมาตรฐานผักสดให้)
                            </label>
                            <input
                              type="url"
                              placeholder="https://... (สามารถมาอัปโหลดรูปสวยๆ ในหน้าสินค้าทีหลังได้)"
                              value={form.image_url}
                              onChange={e => setForm(prev => ({ ...prev, image_url: e.target.value }))}
                              className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-mono text-[11px]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Buttons */}
                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSmartModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-700 to-green-700 hover:from-emerald-800 hover:to-green-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-4 h-4" />
                    {submitting ? 'กำลังบันทึกและลงสต็อก...' : '✓ ยืนยันเก็บเกี่ยวและลงสต็อก'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: View Traceability QR Code */}
      {qrModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-700" />
                QR Code ตรวจสอบย้อนกลับ GAP
              </h3>
              <button
                onClick={() => setQrModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl flex flex-col items-center gap-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  `${window.location.origin}/trace/${qrModalItem.lot_code}`
                )}`}
                alt="Lot QR"
                className="w-40 h-40 bg-white p-2 rounded-xl border border-slate-200 shadow-sm"
              />
              <div className="space-y-0.5">
                <div className="text-[11px] text-slate-400 uppercase font-bold">Lot Code</div>
                <div className="font-mono font-bold text-xs text-slate-800">{qrModalItem.lot_code}</div>
                <div className="text-[11px] text-slate-500">
                  ปริมาณ: {qrModalItem.quantity} {qrModalItem.unit} (เกรด {qrModalItem.quality_grade || '-'})
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-center pt-1">
              <a
                href={`/trace/${qrModalItem.lot_code}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition inline-flex items-center justify-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>เปิดดูหน้าสแกน</span>
              </a>
              <button
                onClick={() => window.print()}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>พิมพ์</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
