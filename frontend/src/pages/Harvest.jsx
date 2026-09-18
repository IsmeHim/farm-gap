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
  Pencil,
  Trash2,
  Users,
  Bot,
  MessageSquare,
  Eye,
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

  // Targeted Push Notification Modal state
  const [pushModalItem, setPushModalItem] = useState(null);
  const [pushPlot, setPushPlot] = useState(null);
  const [pushMatchedProduct, setPushMatchedProduct] = useState(null);
  const [clustersList, setClustersList] = useState([]);
  const [pushForm, setPushForm] = useState({
    target_type: 'auto',
    cluster_id: '',
    custom_title: '',
    custom_message: '',
    custom_image_url: '',
    cta_label: '🛒 กดสั่งซื้อผักสดทันที',
    cta_url: '',
  });
  const [audienceList, setAudienceList] = useState([]);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [sendingPush, setSendingPush] = useState(false);

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
      toast.error('กรุณาเลือกแปลงที่เก็บผลผลิต');
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      toast.error('กรุณาระบุจำนวนที่เก็บผลผลิตให้ถูกต้อง');
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
      toast.success(res.data.message || 'บันทึกการเก็บผลผลิตสำเร็จ!');
      setReloadKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกเก็บผลผลิต');
    } finally {
      setSubmitting(false);
    }
  };

  // Targeted LINE Push Modal Handlers
  const loadAudiencePreview = async (targetType, clusterId, cropName) => {
    setLoadingAudience(true);
    try {
      const res = await api.get('/api/ai/push-preview', {
        params: {
          target_type: targetType,
          cluster_id: clusterId,
          crop_name: cropName || '',
        },
      });
      setAudienceList(res.data?.customers || []);
    } catch (err) {
      console.error('Failed to load audience preview:', err);
    } finally {
      setLoadingAudience(false);
    }
  };

  const openPushModal = async (harvestItem) => {
    setPushModalItem(harvestItem);
    try {
      const [plotsRes, clustersRes, prodsRes] = await Promise.all([
        plots.length > 0 ? { data: plots } : api.get('/api/plots'),
        clustersList.length > 0 ? { data: clustersList } : api.get('/api/ai/clusters').catch(() => ({ data: { clusters: [] } })),
        products.length > 0 ? { data: products } : api.get('/api/products').catch(() => ({ data: [] })),
      ]);

      const currentPlot = (plotsRes.data || []).find(p => p.id === harvestItem.plot_id);
      setPushPlot(currentPlot);

      const clusters = clustersRes.data?.clusters || clustersRes.data || [];
      setClustersList(clusters);

      const currentProducts = prodsRes.data || [];
      if (products.length === 0) setProducts(currentProducts);

      const cropName = currentPlot?.crop_name || 'ผักสดคุณภาพ GAP';
      const defaultTitle = `🥦 ${cropName} สดๆ เพิ่งเก็บเกี่ยววันนี้!`;
      const defaultMsg = `สวัสดีครับคุณ {name} ทางฟาร์ม FarmGAP พึ่งเก็บเกี่ยว ${cropName} ${harvestItem.quantity ? `จำนวน ${harvestItem.quantity} ${harvestItem.unit || 'กก.'}` : ''} จากแปลง ${currentPlot?.name || 'เพาะปลูก'} สดใหม่ ปลอดภัยมาตรฐาน GAP พร้อมส่งตรงถึงมือคุณแล้วครับ!`;

      // 1. จับคู่หาสินค้าจาก plot_id เป็นลำดับแรก (แม่นยำ 100%)
      let matchedProd = currentProducts.find(p => p.plot_id && Number(p.plot_id) === Number(harvestItem.plot_id));

      // 2. หากยังไม่พบ ให้ค้นหาด้วยคีย์เวิร์ดชื่อผัก
      if (!matchedProd) {
        const cleanName = cropName
          .replace(/\([^)]*\)/g, '')
          .replace(/ปลอดสาร|สด|gap|อินทรีย์|ซูเปอร์ฟู้ด|พรีเมียม/gi, '')
          .trim()
          .toLowerCase();
        const cropLower = cropName.toLowerCase();

        matchedProd = currentProducts.find(p => {
          const pName = (p.name || '').toLowerCase();
          return pName.includes(cropLower) || (cleanName && pName.includes(cleanName));
        });
      }

      setPushMatchedProduct(matchedProd || null);
      const defaultImage = matchedProd?.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop';

      const initialClusterId = clusters[0]?.id || '';
      setPushForm({
        target_type: 'auto',
        cluster_id: initialClusterId,
        custom_title: defaultTitle,
        custom_message: defaultMsg,
        custom_image_url: defaultImage,
        cta_label: '🛒 กดสั่งซื้อผักสดทันที',
        cta_url: '',
      });

      loadAudiencePreview('auto', initialClusterId, cropName);
    } catch (e) {
      console.error('Failed to prepare push modal:', e);
      toast.error('ไม่สามารถเตรียมข้อมูลแจ้งเตือนได้');
    }
  };

  const handleTargetTypeChange = (type) => {
    const nextForm = { ...pushForm, target_type: type };
    setPushForm(nextForm);
    loadAudiencePreview(type, nextForm.cluster_id, pushPlot?.crop_name);
  };

  const handleClusterChange = (cId) => {
    const nextForm = { ...pushForm, cluster_id: cId };
    setPushForm(nextForm);
    loadAudiencePreview('cluster', cId, pushPlot?.crop_name);
  };

  const applyPresetTemplate = (presetKey) => {
    const cropName = pushPlot?.crop_name || 'ผักสด';
    if (presetKey === 'fresh') {
      setPushForm(prev => ({
        ...prev,
        custom_title: `🥦 ${cropName} สดๆ เพิ่งตัดจากแปลงวันนี้!`,
        custom_message: `สวัสดีครับคุณ {name} ทางฟาร์มพึ่งตัด ${cropName} สดๆ จากแปลงเพาะปลูก ${pushPlot?.name || ''} มาตรฐาน GAP 100% สด กรอบ ปลอดภัย ไร้สารเคมีตกค้าง พร้อมส่งตรงถึงบ้านคุณครับ!`,
        cta_label: '🛒 สั่งซื้อผักสดทันที',
      }));
    } else if (presetKey === 'b2b') {
      setPushForm(prev => ({
        ...prev,
        custom_title: `📦 ${cropName} เกรดยกลัง ราคาส่งพิเศษสำหรับร้านค้า!`,
        custom_message: `สวัสดีครับคุณ {name} วันนี้ฟาร์มมี ${cropName} ล็อตใหม่คัดเกรดพิเศษ ${pushModalItem?.quantity ? `มีจำนวน ${pushModalItem.quantity} ${pushModalItem.unit || 'กก.'}` : ''} เหมาะสำหรับร้านอาหารและลูกค้ายกลัง ราคาส่งมิตรภาพ สนใจรับกี่ลังแจ้งได้เลยครับ`,
        cta_label: '📦 ดูราคาส่งและสั่งจอง',
      }));
    } else if (presetKey === 'promo') {
      setPushForm(prev => ({
        ...prev,
        custom_title: `⚡ นาทีทอง! ${cropName} สดใหม่ ลดพิเศษวันนี้เท่านั้น`,
        custom_message: `สวัสดีครับคุณ {name} พิเศษสำหรับลูกค้าคนสำคัญ! ${cropName} เพิ่งเก็บเกี่ยวสดๆ วันนี้ จัดโปรโมชั่นลดพิเศษ จำนวนจำกัดเพียง ${pushModalItem?.quantity || 'ไม่กี่'} ${pushModalItem?.unit || 'กก.'} เท่านั้น ช้อปเลยก่อนหมด!`,
        cta_label: '⚡ ช้อปโปรโมชั่นทันที',
      }));
    }
  };

  const handleConfirmPush = async (e) => {
    e.preventDefault();
    if (!pushModalItem) return;
    setSendingPush(true);
    try {
      const cropName = pushPlot?.crop_name || 'ผักสลัดสด';
      const res = await api.post('/api/ai/notify-harvest', {
        harvest_id: pushModalItem.id,
        crop_name: cropName,
        quantity: pushModalItem.quantity,
        unit: pushModalItem.unit || 'kg',
        plot_name: pushPlot?.name || 'แปลงเกษตร',
        target_type: pushForm.target_type,
        cluster_id: pushForm.cluster_id,
        custom_title: pushForm.custom_title,
        custom_message: pushForm.custom_message,
        custom_image_url: pushForm.custom_image_url,
        cta_label: pushForm.cta_label,
        cta_url: pushForm.cta_url,
      });

      const targets = res.data.target_customers?.map(c => `${c.name} (${c.cluster})`).join(', ');
      toast.success(`📢 ยิงแจ้งเตือนผัก ${cropName} สำเร็จ! (${res.data.notified_count} ท่าน)`, {
        description: targets ? `ส่งถึง: ${targets}` : 'ยิงแจ้งเตือนถึงลูกค้าเรียบร้อยแล้ว',
        duration: 5000,
      });
      setPushModalItem(null);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'ไม่สามารถส่งแจ้งเตือน LINE ได้');
    } finally {
      setSendingPush(false);
    }
  };

  return (
    <>
      <LogManager
        title="เก็บผลผลิต (GAP #5)"
        endpoint="harvest"
        plotsLookup
        reloadTrigger={reloadKey}
        renderHeaderExtra={() => (
          <button
            onClick={() => openSmartHarvest()}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 text-xs font-black px-3.5 py-2.5 rounded-xl transition shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-slate-950 fill-current shrink-0" />
            <span className="hidden md:inline">เก็บผลผลิตอัจฉริยะ (ลงสต็อกอัตโนมัติ)</span>
            <span className="md:hidden">เก็บผลผลิตอัจฉริยะ</span>
          </button>
        )}
        renderCard={({ item: r, openEdit, del, plotName }) => {
          const pName = plotName(r.plot_id);
          const batchMatch = pName.match(/\[(#BATCH-[^\]]+)\]/);
          const batchCode = batchMatch ? batchMatch[1] : null;
          const cleanPlotTitle = batchMatch ? pName.replace(batchMatch[0], '').trim() : pName;
          const isHygieneGood = String(r.harvest_hygiene || '').includes('สะอาด') || String(r.harvest_hygiene || '').includes('ปลอดภัย') || String(r.harvest_hygiene || '').includes('ผ่าน');

          return (
            <div className="surface rounded-3xl p-4 sm:p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5">
              <div className="space-y-3">
                {/* Header: Plot Name, Batch, Date, Badges */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-black text-sm sm:text-base text-[#173f2a] truncate">
                        {cleanPlotTitle}
                      </h3>
                      {batchCode && (
                        <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                          {batchCode}
                        </span>
                      )}
                    </div>

                    {r.harvest_date && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{format(new Date(r.harvest_date), 'dd/MM/yyyy')}</span>
                      </div>
                    )}
                  </div>

                  {/* Badges: Quality Grade & Hygiene */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {r.quality_grade && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300/80 px-2.5 py-0.5 rounded-lg font-black text-xs shadow-2xs">
                        เกรด {r.quality_grade}
                      </span>
                    )}
                    {r.harvest_hygiene && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                        isHygieneGood
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {isHygieneGood && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                        {r.harvest_hygiene}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hero Stat Box: Harvest Quantity & Lot Code */}
                <div className="bg-gradient-to-br from-emerald-50/80 to-green-50/50 border border-emerald-200/70 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      ปริมาณผลผลิตที่เก็บได้
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl sm:text-2xl font-black text-emerald-950 font-mono">
                        {Number(r.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs font-bold text-emerald-700">
                        {r.unit || 'กก.'}
                      </span>
                    </div>
                  </div>

                  {r.lot_code && (
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        LOT CODE (GAP)
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-800 bg-white/90 px-2 py-1 rounded-lg border border-slate-200/80 inline-block mt-0.5 shadow-2xs">
                        {r.lot_code}
                      </span>
                    </div>
                  )}
                </div>

                {/* Detail Info Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                  <div className="space-y-0.5 bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">ผู้ปฏิบัติงาน:</span>
                    <span className="font-semibold text-slate-700 truncate block">
                      {r.worker_name ? `👤 ${r.worker_name}` : '—'}
                    </span>
                  </div>

                  <div className="space-y-0.5 bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">รายได้ (THB):</span>
                    <span className="font-semibold text-slate-700 truncate block">
                      {r.revenue ? `฿${Number(r.revenue).toLocaleString()}` : '—'}
                    </span>
                  </div>

                  {r.postharvest_handling && (
                    <div className="col-span-2 space-y-0.5 bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">การจัดการหลังเก็บผลผลิต:</span>
                      <span className="font-medium text-slate-700 block text-[11px] line-clamp-2">
                        📦 {r.postharvest_handling}
                      </span>
                    </div>
                  )}

                  {r.notes && (
                    <div className="col-span-2 space-y-0.5 bg-amber-50/50 rounded-xl p-2.5 border border-amber-100 text-[11px] text-amber-900">
                      <span className="text-[10px] uppercase font-bold text-amber-700 block">หมายเหตุ:</span>
                      <span className="line-clamp-2">{r.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: 2x2 Grid (Guaranteed NO Overflow on ANY screen size!) */}
              <div className="pt-3 border-t border-slate-100 space-y-2 mt-auto">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openPushModal(r)}
                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold py-2.5 px-2 rounded-xl text-xs shadow-xs transition cursor-pointer"
                    title="ตั้งค่าและยิง LINE Push แจ้งเตือนลูกค้า"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">📢 ยิง LINE Push</span>
                  </button>

                  {r.lot_code ? (
                    <button
                      type="button"
                      onClick={() => setQrModalItem(r)}
                      className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold py-2.5 px-2 rounded-xl text-xs border border-slate-200 transition cursor-pointer"
                      title="ดู QR Code สำหรับตรวจสอบย้อนกลับมาตรฐาน GAP"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate">QR ย้อนกลับ</span>
                    </button>
                  ) : (
                    <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-medium py-2.5">
                      ไม่มี Lot QR
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="inline-flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 active:scale-98 text-blue-700 font-bold py-2.5 px-2 rounded-xl text-xs border border-blue-200 transition cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 shrink-0" />
                    <span>แก้ไข</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => del(r.id)}
                    className="inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-700 font-bold py-2.5 px-2 rounded-xl text-xs border border-rose-200 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>ลบ</span>
                  </button>
                </div>
              </div>
            </div>
          );
        }}
        renderRowAction={(item) => (
          <div className="inline-flex items-center gap-1.5 flex-nowrap">
            <button
              type="button"
              onClick={() => openPushModal(item)}
              className="inline-flex items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-100 active:scale-98 text-emerald-800 font-bold py-1.5 px-2.5 rounded-xl text-xs border border-emerald-200 transition cursor-pointer whitespace-nowrap"
              title="ตั้งค่าและยิง LINE Push แจ้งเตือนลูกค้า"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span>📢 ยิง LINE Push</span>
            </button>

            {item.lot_code && (
              <button
                type="button"
                onClick={() => setQrModalItem(item)}
                className="inline-flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold py-1.5 px-2.5 rounded-xl text-xs border border-slate-200 transition cursor-pointer whitespace-nowrap"
                title="ดู QR Code สำหรับตรวจสอบย้อนกลับมาตรฐาน GAP"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>QR ย้อนกลับ</span>
              </button>
            )}
          </div>
        )}
        fields={[
          { key: 'harvest_date', label: 'วันที่เก็บผลผลิต', type: 'date', placeholder: 'เลือกวันที่เก็บ', required: true },
          { key: 'plot_id', label: 'แปลง', placeholder: '-- เลือกแปลง --', required: true },
          { key: 'quantity', label: 'จำนวน', type: 'number', placeholder: 'เช่น 100', required: true },
          { key: 'unit', label: 'หน่วย', placeholder: 'เช่น kg', default: 'kg' },
          { key: 'quality_grade', label: 'เกรด', type: 'select', options: ['A', 'B', 'C'], placeholder: '-- เลือกเกรด --' },
          { key: 'lot_code', label: 'Lot Code (สำหรับ QR)', placeholder: 'Lot Code สำหรับ QR' },
          { key: 'revenue', label: 'รายได้ (THB)', type: 'number', placeholder: 'เช่น 5000' },
          { key: 'harvest_hygiene', label: 'สุขอนามัยการเก็บผลผลิต', type: 'select', options: ['สะอาด', 'ปนเปื้อน', 'รอตรวจสอบ'], placeholder: '-- เลือกสถานะ --' },
          { key: 'postharvest_handling', label: 'การจัดการหลังเก็บผลผลิต', placeholder: 'เช่น ล้าง/คัดเกรด/บรรจุ' },
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
                    บันทึกเก็บผลผลิตอัจฉริยะ (Smart Harvest)
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
                    บันทึกการเก็บผลผลิตและอัปเดตสต็อกเรียบร้อย!
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
                    เลือกแปลงที่ต้องการเก็บผลผลิต <span className="text-rose-500">*</span>
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
                    {submitting ? 'กำลังบันทึกและลงสต็อก...' : '✓ ยืนยันเก็บผลผลิตและลงสต็อก'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Smart Targeted Push Notification */}
      {pushModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-start bg-emerald-50/50">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold mb-1">
                  <Bot className="w-3.5 h-3.5 text-emerald-700" />
                  <span>AI Smart Marketing Broadcast</span>
                </div>
                <h3 className="font-black text-base sm:text-lg text-[#173f2a]">
                  ยิงแจ้งเตือน LINE อัจฉริยะ (Targeted Push)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ผลผลิต: <strong className="text-emerald-900">{pushPlot?.crop_name || 'ผักสด'}</strong> | แปลง: {pushPlot?.name || '-'} | จำนวน: {pushModalItem.quantity} {pushModalItem.unit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPushModalItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white/80 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* 1. Audience Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-700" />
                  <span>1. เลือกกลุ่มเป้าหมายผู้รับ (Audience)</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTargetTypeChange('auto')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      pushForm.target_type === 'auto'
                        ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-950 flex items-center gap-1">
                        🎯 AI ตรงตามผัก
                      </span>
                      {pushForm.target_type === 'auto' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      ส่งหาเฉพาะคนที่ชอบหรือเคยสั่งผักชนิดนี้
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTargetTypeChange('cluster')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      pushForm.target_type === 'cluster'
                        ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-950 flex items-center gap-1">
                        🏷️ เจาะจงกลุ่ม AI
                      </span>
                      {pushForm.target_type === 'cluster' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      เลือกส่งตาม Cluster ที่ K-Means จัดไว้
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTargetTypeChange('all')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      pushForm.target_type === 'all'
                        ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-950 flex items-center gap-1">
                        👥 ลูกค้าทุกคน
                      </span>
                      {pushForm.target_type === 'all' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      บรอดแคสต์หาลูกค้าทุกคนที่มี LINE
                    </p>
                  </button>
                </div>

                {/* Sub-selector for Cluster */}
                {pushForm.target_type === 'cluster' && (
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5 animate-in fade-in duration-150">
                    <label className="text-[11px] font-bold text-slate-600">เลือกกลุ่มลูกค้าที่ต้องการส่ง:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      {clustersList.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleClusterChange(c.id)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition text-left cursor-pointer ${
                            Number(pushForm.cluster_id) === Number(c.id)
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="truncate">{c.cluster_name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Audience Recipient Preview Box */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span>🎯 รายชื่อผู้ที่จะได้รับแจ้งเตือน</span>
                      <span className="bg-emerald-100 text-emerald-900 px-2 py-0.2 rounded-full text-[11px] font-black">
                        {loadingAudience ? 'กำลังตรวจสอบ...' : `${audienceList.length} ท่าน`}
                      </span>
                    </span>
                  </div>

                  {loadingAudience ? (
                    <div className="text-[11px] text-slate-400 py-1 flex items-center gap-1.5">
                      <div className="animate-spin text-xs">🌱</div> กำลังคำนวณรายชื่อกลุ่มเป้าหมาย...
                    </div>
                  ) : audienceList.length === 0 ? (
                    <div className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>ไม่พบลูกค้าที่ตรงตามเงื่อนไขนี้ (แนะนำให้เลือกกลุ่ม AI อื่น หรือเลือกส่งลูกค้าทุกคน)</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {audienceList.map(c => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 text-[11px] font-medium shadow-2xs"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>{c.name}</span>
                          <span className="text-[9px] text-slate-400">({c.cluster_name})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Message Customization & Templates */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-700" />
                    <span>2. ปรับแต่งข้อความแจ้งเตือน (Custom Message)</span>
                  </label>

                  {/* Preset Buttons */}
                  <div className="inline-flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-bold">เทมเพลตด่วน:</span>
                    <button
                      type="button"
                      onClick={() => applyPresetTemplate('fresh')}
                      className="text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
                    >
                      🥦 ผักสดใหม่
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetTemplate('b2b')}
                      className="text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
                    >
                      📦 ราคาส่ง B2B
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetTemplate('promo')}
                      className="text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
                    >
                      ⚡ โปรโมชั่นด่วน
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">หัวข้อการ์ด (Title)</label>
                    <input
                      type="text"
                      value={pushForm.custom_title}
                      onChange={e => setPushForm(f => ({ ...f, custom_title: e.target.value }))}
                      placeholder="เช่น 🥦 ผักสลัดกรีนโอ๊ค สดๆ เพิ่งเก็บเกี่ยววันนี้!"
                      className="input text-xs w-full rounded-xl"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-slate-600">เนื้อหาข้อความ (Body Message)</label>
                      <span className="text-[10px] text-emerald-700 font-medium">ใส่ {'{name}'} เพื่อเรียกชื่อลูกค้าแต่ละคนอัตโนมัติ</span>
                    </div>
                    <textarea
                      rows={3}
                      value={pushForm.custom_message}
                      onChange={e => setPushForm(f => ({ ...f, custom_message: e.target.value }))}
                      placeholder="รายละเอียดข้อความที่ต้องการแจ้งเตือนลูกค้า..."
                      className="input text-xs w-full rounded-xl leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-600">ลิงก์รูปภาพประกอบ (Image URL)</label>
                        {pushMatchedProduct?.image_url && (
                          <button
                            type="button"
                            onClick={() => setPushForm(f => ({ ...f, custom_image_url: pushMatchedProduct.image_url }))}
                            className="text-[10px] text-emerald-800 hover:text-emerald-900 font-bold inline-flex items-center gap-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition"
                            title="คลิกเพื่อดึงรูปจากสินค้านี้"
                          >
                            <span>🖼️ ดึงรูปจากสินค้า</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={pushForm.custom_image_url}
                        onChange={e => setPushForm(f => ({ ...f, custom_image_url: e.target.value }))}
                        placeholder="https://..."
                        className="input text-xs w-full rounded-xl"
                      />
                      {pushMatchedProduct && (
                        <p className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1 font-medium truncate">
                          <span>✨ ดึงจากสินค้า:</span>
                          <span className="font-bold">{pushMatchedProduct.name}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">ข้อความบนปุ่มกด (CTA Button)</label>
                      <input
                        type="text"
                        value={pushForm.cta_label}
                        onChange={e => setPushForm(f => ({ ...f, cta_label: e.target.value }))}
                        placeholder="เช่น 🛒 กดสั่งซื้อผักสดทันที"
                        className="input text-xs w-full rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Live Phone Flex Preview */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-700" />
                  <span>3. ตัวอย่างข้อความที่จะแสดงใน LINE ลูกค้า (Live Preview)</span>
                </label>

                <div className="bg-[#74889e]/20 p-3 sm:p-4 rounded-2xl flex justify-center">
                  {/* LINE Bubble Mockup */}
                  <div className="max-w-xs w-full bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden text-slate-800">
                    {/* Hero Image */}
                    <div className="h-36 bg-slate-100 relative overflow-hidden">
                      <img
                        src={pushForm.custom_image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop'}
                        alt="Preview Hero"
                        className="w-full h-full object-cover"
                        onError={e => {
                          e.target.src = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop';
                        }}
                      />
                      <span className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                        FarmGAP Standard
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-3.5 space-y-2">
                      <h4 className="font-black text-sm text-emerald-800 line-clamp-2 leading-tight">
                        {pushForm.custom_title || `🥦 ${pushPlot?.crop_name || 'ผักสด'} เพิ่งเก็บเกี่ยววันนี้!`}
                      </h4>
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {(pushForm.custom_message || '').replace(/{name}/g, audienceList[0]?.name || 'ลูกค้าคนพิเศษ')}
                      </p>
                    </div>

                    {/* Button */}
                    <div className="p-3 pt-0">
                      <div className="w-full py-2 bg-emerald-700 text-white font-bold text-center text-xs rounded-xl shadow-xs">
                        {pushForm.cta_label || '🛒 กดสั่งซื้อผักสดทันที'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setPushModalItem(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={handleConfirmPush}
                disabled={sendingPush || audienceList.length === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-4 h-4 text-emerald-200" />
                <span>
                  {sendingPush
                    ? 'กำลังยิง LINE Push...'
                    : audienceList.length === 0
                    ? 'ไม่มีผู้รับในกลุ่มนี้'
                    : `🚀 ยืนยันยิง LINE Push (${audienceList.length} ท่าน)`}
                </span>
              </button>
            </div>
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
