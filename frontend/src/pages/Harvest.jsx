import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import LogManager from '../components/LogManager.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
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
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sendingId, setSendingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Smart Harvest Modal state
  const [smartModalOpen, setSmartModalOpen] = useState(false);
  const [plots, setPlots] = useState([]);
  const [products, setProducts] = useState([]);
  const [crops, setCrops] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loadingPlots, setLoadingPlots] = useState(false);

  const [form, setForm] = useState({
    plot_id: '',
    harvest_date: format(new Date(), 'yyyy-MM-dd'),
    total_weight_kg: 30,
    weight_per_unit_kg: 0.40,
    package_type: 'ถุงใสขนาด 9x18 นิ้ว (4 ขีด)',
    quality_grade: 'A',
    worker_name: user?.display_name || 'เจ้าของฟาร์ม',
    notes: 'ตัดแต่งราก คัดแยกใบเหลือง ล้างด้วยน้ำสะอาด บรรจุถุงเจาะรูระบายอากาศ',
    sale_channel: 'ขายปลีกหน้าฟาร์ม + ตลาดนัดชุมชน + LINE Shop',
    sync_to_stock: true,
    price: 20,
    image_url: '',
    is_available: false,
    is_partial: false,
    harvested_plants_count: '',
    destination: 'cold_storage',
  });

  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null); // holds { harvest, product, lot_code, phi_warning, summary }
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

  // Stock Allocation Modal state
  const [stockModalItem, setStockModalItem] = useState(null);
  const [stockForm, setStockForm] = useState({
    quantity_to_stock: 1,
    product_id: '',
    product_name: '',
    price: 20,
    is_available: true,
  });
  const [submittingStock, setSubmittingStock] = useState(false);

  const openStockModal = async (item) => {
    try {
      const data = await loadPrerequisites();
      const currentPlots = data.plots || plots;
      const currentProducts = data.products || products;
      
      const plot = currentPlots.find(p => p.id === Number(item.plot_id));
      const batch = (data.batches || []).find(b => b.id === Number(item.batch_id));
      const crop = (data.crops || []).find(c => c.id === Number(batch?.crop_id));
      const cropName = crop?.name || batch?.crop_name || plot?.crop_name || 'ผักสด';

      const totalPacks = item.total_packs > 0 
        ? Number(item.total_packs) 
        : Math.max(1, Math.floor(Number(item.quantity || 0) / 0.4));
      const stocked = Number(item.stocked_quantity || 0);
      const remaining = Math.max(1, totalPacks - stocked);

      // ค้นหาสินค้าที่ชื่อตรงกับชนิดผักโดยตรง (ไม่ใช้ plot_id เพราะแปลงหมุนเวียนชนิดผักได้)
      let matchedProd = null;
      if (item.product_id) {
        matchedProd = currentProducts.find(p => p.id === Number(item.product_id));
      }
      if (!matchedProd && cropName) {
        matchedProd = currentProducts.find(p => 
          p.name?.toLowerCase().includes(cropName.toLowerCase()) || 
          cropName.toLowerCase().includes(p.name?.toLowerCase())
        );
      }

      const defaultProdName = matchedProd ? matchedProd.name : `${cropName} สด GAP (4 ขีด)`;
      const defaultPrice = matchedProd ? Number(matchedProd.price) : (crop?.default_price ? Number(crop.default_price) : 20);

      setStockForm({
        quantity_to_stock: remaining,
        product_id: matchedProd ? String(matchedProd.id) : '',
        product_name: defaultProdName,
        price: defaultPrice,
        is_available: true,
      });

      setStockModalItem({
        ...item,
        plot_name: plot?.name || `แปลงที่ ${item.plot_id}`,
        crop_name: cropName,
        matched_product: matchedProd,
        calculated_total_packs: totalPacks,
        calculated_stocked: stocked,
        calculated_remaining: remaining,
      });
    } catch (e) {
      console.error('Failed to open stock modal:', e);
      toast.error('ไม่สามารถเปิดหน้าต่างลงสต็อกได้');
    }
  };

  const handleSubmitStock = async (e) => {
    e.preventDefault();
    if (!stockModalItem) return;
    
    const qty = parseInt(stockForm.quantity_to_stock, 10);
    const maxQty = stockModalItem.calculated_remaining || 1;
    if (isNaN(qty) || qty <= 0) {
      toast.error('กรุณาระบุจำนวนที่ต้องการลงสต็อกให้มากกว่า 0');
      return;
    }
    if (qty > maxQty) {
      toast.error(`จำนวนที่ลงสต็อก (${qty}) เกินกว่าคงเหลือที่รอลงสต็อก (${maxQty} ถุง)`);
      return;
    }

    try {
      setSubmittingStock(true);
      const res = await api.post(`/api/harvest/${stockModalItem.id}/stock`, {
        quantity_to_stock: qty,
        product_id: stockForm.product_id || null,
        product_name: stockForm.product_name,
        price: stockForm.price,
        is_available: stockForm.is_available,
      });

      toast.success(res.data.message || 'นำผักลงสต็อกสินค้าเรียบร้อย!');
      setStockModalItem(null);
      setReloadKey(prev => prev + 1);
      // Reload products
      api.get('/api/products').then(r => setProducts(r.data || [])).catch(() => {});
    } catch (err) {
      console.error('Submit stock error:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการลงสต็อก');
    } finally {
      setSubmittingStock(false);
    }
  };

  // Load active plots and products for Smart Harvest
  const loadPrerequisites = async () => {
    setLoadingPlots(true);
    try {
      const [plRes, prRes, crRes, baRes] = await Promise.all([
        api.get('/api/plots'),
        api.get('/api/products').catch(() => ({ data: [] })),
        api.get('/api/crops').catch(() => ({ data: [] })),
        api.get('/api/batches').catch(() => ({ data: [] })),
      ]);
      setPlots(plRes.data || []);
      setProducts(prRes.data || []);
      setCrops(crRes.data || []);
      setBatches(baRes.data || []);
      return { 
        plots: plRes.data || [], 
        products: prRes.data || [], 
        crops: crRes.data || [], 
        batches: baRes.data || [] 
      };
    } catch (e) {
      console.warn('Failed to load plots/products:', e.message);
      return { plots: [], products: [], crops: [], batches: [] };
    } finally {
      setLoadingPlots(false);
    }
  };

  const openSmartHarvest = async (defaultPlotId = null) => {
    const data = await loadPrerequisites();
    const targetPlot = (data.plots || []).find(p => p.id === Number(defaultPlotId));
    let initialPackage = 'ถุงใสขนาด 9x18 นิ้ว (4 ขีด)';
    let initialPrice = 20;

    if (targetPlot && targetPlot.crop_name) {
      const foundCrop = (data.crops || []).find(c => 
        targetPlot.crop_name.toLowerCase().includes(c.name.toLowerCase()) || 
        c.name.toLowerCase().includes(targetPlot.crop_name.toLowerCase())
      );
      if (foundCrop) {
        initialPackage = foundCrop.default_bag_size || initialPackage;
        initialPrice = foundCrop.default_price ? Number(foundCrop.default_price) : initialPrice;
      }
    }

    const activeBatch = (data.batches || []).find(b => b.plot_id === Number(defaultPlotId) && (b.status === 'growing' || b.status === 'harvest_ready'));
    const currentRemaining = activeBatch?.remaining_count ?? activeBatch?.initial_count ?? targetPlot?.remaining_count ?? '';

    setForm({
      plot_id: defaultPlotId ? String(defaultPlotId) : '',
      harvest_date: format(new Date(), 'yyyy-MM-dd'),
      total_weight_kg: 30,
      weight_per_unit_kg: 0.40,
      package_type: initialPackage,
      quality_grade: 'A',
      worker_name: user?.display_name || 'เจ้าของฟาร์ม',
      notes: 'ตัดแต่งราก คัดแยกใบเหลือง ล้างด้วยน้ำสะอาด บรรจุถุงเจาะรูระบายอากาศ',
      sale_channel: 'ขายปลีกหน้าฟาร์ม + ตลาดนัดชุมชน + LINE Shop',
      sync_to_stock: true,
      price: initialPrice,
      image_url: '',
      is_available: false,
      is_partial: false,
      harvested_plants_count: currentRemaining !== '' ? String(currentRemaining) : '',
      destination: 'cold_storage',
    });
    setSuccessResult(null);
    setSmartModalOpen(true);
  };

  useEffect(() => {
    const plotIdParam = searchParams.get('plot_id');
    const smartParam = searchParams.get('smart');
    if (plotIdParam && smartParam === 'true') {
      openSmartHarvest(plotIdParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user?.display_name) {
      setForm(prev => ({
        ...prev,
        worker_name: (prev.worker_name === 'เจ้าของฟาร์ม' || !prev.worker_name || prev.worker_name === 'สมคิด (เจ้าของสวน)') ? user.display_name : prev.worker_name
      }));
    }
  }, [user]);

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

  // Update packaging and price when user selects a different plot
  useEffect(() => {
    if (selectedPlot && selectedPlot.crop_name && selectedPlot.crop_name !== '-') {
      const foundCrop = crops.find(c => 
        selectedPlot.crop_name.toLowerCase().includes(c.name.toLowerCase()) || 
        c.name.toLowerCase().includes(selectedPlot.crop_name.toLowerCase())
      );
      if (foundCrop) {
        setForm(prev => ({
          ...prev,
          package_type: foundCrop.default_bag_size || prev.package_type,
          price: foundCrop.default_price ? Number(foundCrop.default_price) : (matchedProduct?.price || prev.price)
        }));
      }
    }
  }, [form.plot_id, selectedPlot, crops]);

  const handleSmartSubmit = async (e) => {
    e.preventDefault();
    if (!form.plot_id) {
      toast.error('กรุณาเลือกแปลงที่เก็บผลผลิต');
      return;
    }
    const weightVal = Number(form.total_weight_kg);
    if (!weightVal || weightVal <= 0) {
      toast.error('กรุณาระบุน้ำหนักรวมที่เก็บผลผลิตให้ถูกต้อง');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        plot_id: Number(form.plot_id),
        harvest_date: form.harvest_date,
        total_weight_kg: weightVal,
        quantity: weightVal,
        unit: 'กก.',
        weight_per_unit_kg: Number(form.weight_per_unit_kg) || 0.4,
        package_type: form.package_type,
        price_per_unit: Number(form.price) || 20,
        price: Number(form.price) || 20,
        sale_channel: form.sale_channel,
        quality_grade: form.quality_grade,
        worker_name: form.worker_name,
        notes: form.notes,
        sync_to_stock: form.sync_to_stock,
        image_url: form.image_url || undefined,
        is_available: form.is_available,
        product_id: matchedProduct ? matchedProduct.id : undefined,
        is_partial: Boolean(form.is_partial),
        harvested_plants_count: Number(form.harvested_plants_count) || 0,
        destination: form.destination || 'cold_storage',
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

                  {/* Stock Status Badge for Mobile Card */}
                  <div className="col-span-2 pt-1">
                    {(() => {
                      const total = r.total_packs > 0 ? Number(r.total_packs) : Math.max(1, Math.floor(Number(r.quantity || 0) / 0.4));
                      const stocked = Number(r.stocked_quantity || 0);
                      const remaining = Math.max(0, total - stocked);
                      const isFully = r.stock_status === 'fully_stocked' || stocked >= total;

                      if (isFully) {
                        return (
                          <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                            <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>ลงสต็อกหน้าร้านครบแล้ว</span>
                            </span>
                            <span className="font-mono font-black text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                              {stocked}/{total} ถุง
                            </span>
                          </div>
                        );
                      }
                      if (stocked > 0) {
                        return (
                          <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                            <span className="font-bold text-blue-800 flex items-center gap-1.5">
                              <PackageCheck className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>ลงสต็อกแล้ว {stocked}/{total} ถุง</span>
                            </span>
                            <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200">
                              เหลือรอลง {remaining}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                          <span className="font-bold text-amber-900 flex items-center gap-1.5">
                            <span>❄️</span>
                            <span>ยังไม่ลงสต็อก (ในห้องเย็น)</span>
                          </span>
                          <span className="font-mono font-bold text-amber-800 bg-white px-2 py-0.5 rounded-lg border border-amber-200">
                            {total} ถุง
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Action Buttons: 2x2 Grid + Stock Button */}
              <div className="pt-3 border-t border-slate-100 space-y-2 mt-auto">
                {/* Primary Stock Button */}
                {(() => {
                  const total = r.total_packs > 0 ? Number(r.total_packs) : Math.max(1, Math.floor(Number(r.quantity || 0) / 0.4));
                  const stocked = Number(r.stocked_quantity || 0);
                  const remaining = Math.max(0, total - stocked);
                  const isFully = r.stock_status === 'fully_stocked' || stocked >= total;

                  if (isFully) {
                    return (
                      <button
                        type="button"
                        disabled
                        className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/90 font-bold py-2 rounded-xl text-xs opacity-75 cursor-not-allowed"
                        title="ผลผลิตล็อตนี้ลงสต็อกขายครบทั้งหมดแล้ว (ป้องกันสต็อกเกิน)"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>✓ ลงสต็อกครบทั้งหมดแล้ว</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => openStockModal(r)}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 active:scale-98 text-white font-black py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
                      title={`นำผักล็อตนี้ลงสต็อกขายหน้าร้าน (เหลือรอลง ${remaining} ถุง)`}
                    >
                      <PackageCheck className="w-4 h-4 shrink-0" />
                      <span>📦 ลงสต็อกสินค้าหน้าร้าน (เหลือ {remaining} ถุง)</span>
                    </button>
                  );
                })()}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openPushModal(r)}
                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-98 text-emerald-800 font-bold py-2 px-2 rounded-xl text-xs border border-emerald-200 transition cursor-pointer"
                    title="ตั้งค่าและยิง LINE Push แจ้งเตือนลูกค้า"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">📢 ยิง LINE Push</span>
                  </button>

                  {r.lot_code ? (
                    <button
                      type="button"
                      onClick={() => setQrModalItem(r)}
                      className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold py-2 px-2 rounded-xl text-xs border border-slate-200 transition cursor-pointer"
                      title="ดู QR Code สำหรับตรวจสอบย้อนกลับมาตรฐาน GAP"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate">QR ย้อนกลับ</span>
                    </button>
                  ) : (
                    <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-medium py-2">
                      ไม่มี Lot QR
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="inline-flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 active:scale-98 text-blue-700 font-bold py-2 px-2 rounded-xl text-xs border border-blue-200 transition cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 shrink-0" />
                    <span>แก้ไข</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => del(r.id)}
                    className="inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-700 font-bold py-2 px-2 rounded-xl text-xs border border-rose-200 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>ลบ</span>
                  </button>
                </div>
              </div>
            </div>
          );
        }}
        renderRowAction={(item) => {
          const total = item.total_packs > 0 ? Number(item.total_packs) : Math.max(1, Math.floor(Number(item.quantity || 0) / 0.4));
          const stocked = Number(item.stocked_quantity || 0);
          const remaining = Math.max(0, total - stocked);
          const isFully = item.stock_status === 'fully_stocked' || stocked >= total;

          return (
            <div className="inline-flex items-center gap-1.5 flex-nowrap">
              {isFully ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/90 font-bold py-1.5 px-2.5 rounded-xl text-xs cursor-not-allowed whitespace-nowrap opacity-75"
                  title="ผลผลิตล็อตนี้ลงสต็อกขายครบทั้งหมดแล้ว (ป้องกันสต็อกเกิน)"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>✓ ลงสต็อกครบแล้ว</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openStockModal(item)}
                  className="inline-flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-1.5 px-3 rounded-xl text-xs shadow-xs transition cursor-pointer whitespace-nowrap"
                  title={`กดเพื่อนำผักล็อตนี้ลงสต็อกขายหน้าร้าน (เหลือรอลง ${remaining} ถุง)`}
                >
                  <PackageCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>📦 ลงสต็อกสินค้า</span>
                </button>
              )}

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
          );
        }}
        fields={[
          {
            key: 'harvest_date',
            label: 'วันที่เก็บผลผลิต',
            type: 'date',
            placeholder: 'เลือกวันที่เก็บ',
            required: true,
            render: (val) => (
              <span className="font-mono font-bold text-slate-800 whitespace-nowrap text-xs">
                {val ? format(new Date(val), 'dd/MM/yyyy') : '—'}
              </span>
            ),
          },
          {
            key: 'plot_id',
            label: 'แปลง / แคร่',
            placeholder: '-- เลือกแปลง --',
            required: true,
          },
          {
            key: 'quantity',
            label: 'จำนวน',
            type: 'number',
            placeholder: 'เช่น 100',
            required: true,
            render: (val) => (
              <span className="font-mono font-black text-slate-900 text-sm whitespace-nowrap">
                {Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
              </span>
            ),
          },
          {
            key: 'unit',
            label: 'หน่วย',
            placeholder: 'เช่น kg',
            default: 'kg',
            render: (val) => (
              <span className="font-bold text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/80 whitespace-nowrap text-[11px]">
                {val || 'กก.'}
              </span>
            ),
          },
          {
            key: 'stock_status',
            label: 'สต็อกสินค้า (LINE Shop)',
            render: (val, r) => {
              const total = r.total_packs > 0 ? Number(r.total_packs) : Math.max(1, Math.floor(Number(r.quantity || 0) / 0.4));
              const stocked = Number(r.stocked_quantity || 0);
              const remaining = Math.max(0, total - stocked);
              const isFully = r.stock_status === 'fully_stocked' || stocked >= total;

              if (isFully) {
                return (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-xl font-bold text-xs whitespace-nowrap shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>✓ ลงสต็อกครบ ({stocked}/{total} ถุง)</span>
                  </span>
                );
              }
              if (stocked > 0) {
                return (
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-300 px-2.5 py-1 rounded-xl font-bold text-xs whitespace-nowrap shadow-2xs">
                    <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>📦 ลงแล้ว {stocked}/{total} (รออีก {remaining})</span>
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl font-bold text-xs whitespace-nowrap shadow-2xs">
                  <span>❄️</span>
                  <span>รอลงสต็อก ({total} ถุง)</span>
                </span>
              );
            },
          },
          {
            key: 'quality_grade',
            label: 'เกรด',
            type: 'select',
            options: ['A', 'B', 'C'],
            placeholder: '-- เลือกเกรด --',
          },
          {
            key: 'lot_code',
            label: 'Lot Code (สำหรับ QR)',
            placeholder: 'Lot Code สำหรับ QR',
            render: (val) => (
              <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 whitespace-nowrap shadow-2xs">
                {val || '—'}
              </span>
            ),
          },
          {
            key: 'revenue',
            label: 'รายได้ (THB)',
            type: 'number',
            placeholder: 'เช่น 5000',
            render: (val) => (
              <span className="font-mono font-black text-amber-700 text-sm whitespace-nowrap">
                {val !== null && val !== undefined && val !== ''
                  ? `฿${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—'}
              </span>
            ),
          },
          {
            key: 'harvest_hygiene',
            label: 'สุขอนามัยการเก็บผลผลิต',
            type: 'select',
            options: ['สะอาด', 'ปนเปื้อน', 'รอตรวจสอบ'],
            placeholder: '-- เลือกสถานะ --',
          },
          {
            key: 'postharvest_handling',
            label: 'การจัดการหลังเก็บผลผลิต',
            placeholder: 'เช่น ล้าง/คัดเกรด/บรรจุ',
            render: (val) => (
              <span className="block min-w-[170px] max-w-[260px] text-xs font-medium text-slate-700 truncate" title={val || ''}>
                {val || '—'}
              </span>
            ),
          },
          {
            key: 'worker_name',
            label: 'ผู้ปฏิบัติ',
            placeholder: 'ชื่อผู้ปฏิบัติ',
            render: (val) => (
              <span className="font-semibold text-slate-800 whitespace-nowrap text-xs">
                {val ? `👤 ${val}` : '—'}
              </span>
            ),
          },
          {
            key: 'notes',
            label: 'หมายเหตุ',
            type: 'textarea',
            placeholder: 'หมายเหตุเพิ่มเติม',
            hideInTable: true,
          },
        ]}
      />

      {/* Modal: Smart Harvest & Auto Stock Sync */}
      {smartModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header (Pinned Top) */}
            <div className="px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-100 flex items-start justify-between shrink-0 bg-white">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-amber-100 text-amber-900 shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-700 fill-current" />
                  </span>
                  <h3 className="font-black text-slate-800 text-base sm:text-lg leading-tight">
                    บันทึกเก็บผลผลิตอัจฉริยะ (Smart Harvest)
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  ระบบจะบันทึกมาตรฐาน GAP ปรับสถานะแปลง และโยกผลผลิตเข้าสต็อกขายหน้าร้าน LINE ให้อัตโนมัติ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSmartModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If Already Submitted and Success Result is available */}
            {successResult ? (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
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

                  {/* Destination & Mode Summary */}
                  {successResult.destination === 'cold_storage' ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 text-xs text-blue-900 flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>
                        ❄️ ผลผลิตถูกนำเข้าพักใน <strong>ตู้เย็น / ห้องเย็นพักผักฟาร์ม</strong> เรียบร้อย (บันทึกเข้าระบบ GAP คลังเก็บรักษาผลผลิต)
                      </span>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-900 flex items-center gap-2">
                      <Store className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        🛒 ผลผลิตพร้อมจำหน่ายหน้าร้าน LINE Shop ทันที
                      </span>
                    </div>
                  )}

                  {successResult.is_partial && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 flex items-center gap-2">
                      <span className="text-base">🌱</span>
                      <span>
                        <strong>ทยอยเก็บเกี่ยวบางส่วน:</strong> แปลงและรอบปลูกยังคงสถานะ <strong>กำลังปลูก</strong> ต่อ เพื่อรอตัดต้นที่เหลือ
                      </span>
                    </div>
                  )}

                  {/* Synced Product Summary */}
                  {successResult.product && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-emerald-600" />
                        <span>
                          สต็อกสินค้า <strong>{successResult.product.name}</strong>: ปัจจุบันมี{' '}
                          <strong>{successResult.product.stock_quantity} ถุง</strong> (เพิ่มขึ้น +{successResult.product.added_stock} ถุง)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
                  <button
                    type="button"
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
              <form onSubmit={handleSmartSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
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
                {selectedPlot && (() => {
                  const currentBatch = batches.find(b => b.plot_id === selectedPlot.id && (b.status === 'growing' || b.status === 'harvest_ready'));
                  const remaining = currentBatch?.remaining_count ?? currentBatch?.initial_count ?? selectedPlot.remaining_count;
                  const initial = currentBatch?.initial_count ?? selectedPlot.initial_count;
                  const unit = currentBatch?.planting_unit || selectedPlot.planting_unit || 'ต้น';

                  return (
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-xs text-emerald-900 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div>พืช: <strong>{selectedPlot.crop_name}</strong></div>
                          <div className="text-[11px] text-emerald-700">
                            วันปลูก: {selectedPlot.planting_date ? format(new Date(selectedPlot.planting_date), 'dd/MM/yyyy') : '-'}
                            {initial && (
                              <span className="ml-2 font-bold text-slate-800">
                                (คงเหลือ {Number(remaining).toLocaleString()}/{Number(initial).toLocaleString()} {unit})
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                          #{getCropCycleId(selectedPlot)} (รอบที่ {selectedPlot.cycle_number || 1})
                        </span>
                      </div>

                      {/* Progress Indicator */}
                      <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ความคืบหน้ารอบปลูก:</span>
                        </span>
                        <span className="font-black text-amber-900 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                          100% ครบกำหนดพร้อมเก็บเกี่ยว
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* โหมดการเก็บเกี่ยว: ทยอยเก็บเกี่ยว VS ปิดรอบแปลง */}
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <label className="text-xs font-bold text-slate-800 block">รูปแบบการเก็บเกี่ยว</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, is_partial: false }))}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                        !form.is_partial
                          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 font-bold'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <span>🧹 เก็บเกี่ยวหมดแปลง (ปิดรอบ)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 font-normal">
                        ตัดหมดแปลง ปิดรอบการปลูก และรีเซ็ตแปลงเป็น "ว่าง"
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const currentBatch = batches.find(b => b.plot_id === Number(form.plot_id) && (b.status === 'growing' || b.status === 'harvest_ready'));
                        const currentRemaining = currentBatch?.remaining_count ?? currentBatch?.initial_count ?? selectedPlot?.remaining_count ?? '';
                        setForm(prev => ({
                          ...prev,
                          is_partial: true,
                          harvested_plants_count: prev.harvested_plants_count || (currentRemaining ? String(currentRemaining) : '')
                        }));
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                        form.is_partial
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/40 text-emerald-950 font-bold'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <span>🌱 ทยอยเก็บเกี่ยวบางส่วน</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 font-normal">
                        ตัดเฉพาะต้นที่พร้อม แปลงยังคงสถานะ "กำลังปลูก" ต่อ
                      </p>
                    </button>
                  </div>

                  {form.is_partial && (
                    <div className="pt-2 border-t border-slate-200/80">
                      <label className="text-[11px] font-bold text-emerald-900 block mb-1">
                        จำนวนต้นที่ตัดในรอบนี้ (ต้น)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="เช่น 50"
                        value={form.harvested_plants_count}
                        onChange={e => setForm(prev => ({ ...prev, harvested_plants_count: e.target.value }))}
                        className="input text-xs w-full py-2 px-3 rounded-xl border border-emerald-300 bg-white font-bold text-emerald-900 focus:border-emerald-600"
                      />
                      <span className="text-[10px] text-emerald-700 block mt-1">
                        * ระบบจะตัดยอดออกจากแปลงให้อัตโนมัติ แปลงจะยังคงเหลือต้นที่เหลือไว้ให้ดูแลต่อ
                      </span>
                    </div>
                  )}
                </div>

                {/* ปลายทางผลผลิตหลังเก็บเกี่ยว (Storage vs Direct LINE Shop) */}
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <label className="text-xs font-bold text-slate-800 block">ปลายทางของผลผลิตหลังตัด (GAP ข้อ 5-6)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, destination: 'cold_storage', is_available: false }))}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                        form.destination === 'cold_storage'
                          ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300/40 text-blue-950 font-bold'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <span>❄️ เข้าห้องเย็น / ตู้เย็นพักผัก</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 font-normal">
                        บันทึกเข้าคลังพักผัก (storage_logs) 4-8°C รอคัดเกรด/แพ็กถุง
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, destination: 'direct_stock', is_available: true }))}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                        form.destination === 'direct_stock'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/40 text-emerald-950 font-bold'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <span>🛒 วางขายหน้าร้าน (LINE Shop) ทันที</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 font-normal">
                        เพิ่มสต็อกและเปิดขายใน LINE ให้ลูกค้าสั่งซื้อได้ทันที
                      </p>
                    </button>
                  </div>
                </div>

                {/* Harvest Details: Total Weight & Packaging */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> วันที่เก็บเกี่ยว
                    </label>
                    <input
                      type="date"
                      required
                      value={form.harvest_date}
                      onChange={e => setForm(prev => ({ ...prev, harvest_date: e.target.value }))}
                      className="input text-xs w-full py-2.5 px-3 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-900">
                      น้ำหนักรวมที่เก็บได้ (กก.) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      placeholder="เช่น 30"
                      value={form.total_weight_kg}
                      onChange={e => setForm(prev => ({ ...prev, total_weight_kg: e.target.value }))}
                      className="input text-xs w-full py-2.5 px-3 rounded-xl border-2 border-slate-300 focus:outline-none focus:border-emerald-600 font-bold text-slate-950 bg-white"
                    />
                    <span className="text-[11px] text-slate-500">ผลผลิตเฉลี่ย 30 กก. ต่อ 1 แคร่</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-900">
                      น้ำหนักต่อถุง (กก.) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      required
                      value={form.weight_per_unit_kg}
                      onChange={e => setForm(prev => ({ ...prev, weight_per_unit_kg: e.target.value }))}
                      className="input text-xs w-full py-2.5 px-3 rounded-xl border-2 border-slate-300 focus:outline-none focus:border-emerald-600 font-bold text-slate-950 bg-white"
                    />
                    <span className="text-[11px] text-slate-500">0.40 = 4 ขีด (มาตรฐานบรรจุฟาร์ม)</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-900">ขนาดบรรจุภัณฑ์</label>
                    <input
                      type="text"
                      value={form.package_type}
                      onChange={e => setForm(prev => ({ ...prev, package_type: e.target.value }))}
                      className="input text-xs w-full py-2.5 px-3 rounded-xl border-2 border-slate-300 focus:outline-none focus:border-emerald-600 font-semibold text-slate-950 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-900">
                      ราคาขายต่อถุง (บาท) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={form.price}
                      onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                      className="input text-base w-full py-2 px-3 rounded-xl border-2 border-emerald-500 font-black text-emerald-800 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-900">เกรดคุณภาพ</label>
                    <select
                      value={form.quality_grade}
                      onChange={e => setForm(prev => ({ ...prev, quality_grade: e.target.value }))}
                      className="input text-xs w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white font-medium"
                    >
                      <option value="A">เกรด A (พรีเมียม สด กรอบ)</option>
                      <option value="B">เกรด B (มาตรฐาน)</option>
                      <option value="C">เกรด C (คละ/แปรรูป)</option>
                    </select>
                  </div>
                </div>

                {/* Auto Calculated Summary Preview (ตรงตาม FarmXNext) */}
                <div className="bg-emerald-50/80 rounded-2xl p-4 border-2 border-emerald-200 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-xs font-bold text-emerald-900">คำนวณจำนวนถุงอัตโนมัติ:</span>
                    <p className="text-2xl font-black text-emerald-950 mt-0.5">
                      {Math.max(1, Math.floor(Number(form.total_weight_kg || 0) / (Number(form.weight_per_unit_kg) || 0.4)))}{' '}
                      <span className="text-xs font-medium text-emerald-800">ถุง</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-900">มูลค่ารวมคาดการณ์:</span>
                    <p className="text-2xl font-black text-emerald-950 mt-0.5">
                      ฿{(
                        Math.max(1, Math.floor(Number(form.total_weight_kg || 0) / (Number(form.weight_per_unit_kg) || 0.4))) *
                        Number(form.price || 0)
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-900">ช่องทางการจำหน่าย</label>
                    <input
                      type="text"
                      value={form.sale_channel}
                      onChange={e => setForm(prev => ({ ...prev, sale_channel: e.target.value }))}
                      className="input text-xs w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-900">ผู้ปฏิบัติงาน</label>
                    <input
                      type="text"
                      placeholder="ชื่อผู้ตัด/คัดเกรด"
                      value={form.worker_name}
                      onChange={e => setForm(prev => ({ ...prev, worker_name: e.target.value }))}
                      className="input text-xs w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900">
                    บันทึกขั้นตอนหลังเก็บเกี่ยว (GAP ข้อ 5-6)
                  </label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium"
                  />
                </div>

                {/* 3. Auto Stock Sync Section */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.sync_to_stock}
                      onChange={e => setForm(prev => ({ ...prev, sync_to_stock: e.target.checked }))}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span>📦 นำผลผลิตเข้าสต็อกหน้าร้าน LINE อัตโนมัติ (เพิ่ม {Math.max(1, Math.floor(Number(form.total_weight_kg || 0) / (Number(form.weight_per_unit_kg) || 0.4)))} ถุง)</span>
                  </label>

                  {form.sync_to_stock && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      {matchedProduct ? (
                        /* Case 1: Product Exists */
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            พบสินค้าในคลัง: "{matchedProduct.name}"
                          </div>
                          {(() => {
                            const calculatedBags = Math.max(1, Math.floor(Number(form.total_weight_kg || 0) / (Number(form.weight_per_unit_kg) || 0.4)));
                            const oldStock = Number(matchedProduct.stock_quantity) || 0;
                            return (
                              <p className="text-[11px] text-slate-600">
                                สต็อกเดิม: <strong>{oldStock} ถุง</strong> ➔ บวกเพิ่ม{' '}
                                <strong className="text-emerald-700">+{calculatedBags} ถุง</strong> ({form.package_type}) = สต็อกใหม่รวมเป็น{' '}
                                <strong className="text-slate-900">{oldStock + calculatedBags} ถุง</strong>
                              </p>
                            );
                          })()}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-600">ราคาขายต่อถุง (บาท)</label>
                              <input
                                type="number"
                                step="1"
                                value={form.price}
                                onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                                placeholder={`เดิม ${matchedProduct.price} บาท`}
                                className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white font-bold"
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
                            ✨ ตรวจพบว่าเป็นผักรายการใหม่! ระบบจะสร้างสินค้าถุงละ 4 ขีด และเปิดขายหน้าร้านให้อัตโนมัติ
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-700">
                                ราคาขายต่อถุง (บาท) <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="number"
                                required={form.sync_to_stock}
                                step="1"
                                placeholder="เช่น 20"
                                value={form.price}
                                onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                                className="input text-xs w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-bold text-emerald-800"
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
              </div>

                {/* Pinned Footer Action Bar */}
                <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-100 bg-slate-50/95 backdrop-blur-xs flex items-center justify-between gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSmartModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>{submitting ? 'กำลังบันทึกและลงสต็อก...' : '✓ ยืนยันเก็บผลผลิตและลงสต็อก'}</span>
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
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-5">
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
            <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/80 shrink-0">
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

      {/* Modal: ลงสต็อกสินค้าหน้าร้าน LINE Shop (Stock Allocation Modal) */}
      {stockModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl max-w-xl md:max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800 shrink-0">
                  <PackageCheck className="w-5 h-5 text-emerald-700" />
                </span>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    นำผลผลิตลงสต็อกสินค้า (LINE Shop)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {stockModalItem.plot_name} • {stockModalItem.crop_name} • ล็อต <span className="font-mono font-bold text-emerald-700">{stockModalItem.lot_code || '—'}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockModalItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmitStock} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                
                {/* 3 Metric Cards: Total, Stocked, Remaining */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">ผลผลิตทั้งหมด</span>
                    <span className="text-lg font-black text-slate-800 font-mono">
                      {stockModalItem.calculated_total_packs}
                    </span>
                    <span className="text-[10px] text-slate-400 block">ถุง (4 ขีด)</span>
                  </div>

                  <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-3 text-center">
                    <span className="text-[10px] font-bold text-blue-600 uppercase block">ลงสต็อกไปแล้ว</span>
                    <span className="text-lg font-black text-blue-700 font-mono">
                      {stockModalItem.calculated_stocked}
                    </span>
                    <span className="text-[10px] text-blue-500 block">ถุง</span>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 text-center shadow-xs">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">รอลงสต็อกได้อีก</span>
                    <span className="text-xl font-black text-emerald-800 font-mono">
                      {stockModalItem.calculated_remaining}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold block">ถุง</span>
                  </div>
                </div>

                {/* จำนวนที่ต้องการลงสต็อก */}
                <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800">
                      จำนวนที่ต้องการลงสต็อกในรอบนี้ (ถุง) <span className="text-rose-600">*</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      สูงสุดไม่เกิน <span className="font-bold font-mono text-emerald-700">{stockModalItem.calculated_remaining}</span> ถุง
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      required
                      min="1"
                      max={stockModalItem.calculated_remaining}
                      value={stockForm.quantity_to_stock}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val)) {
                          setStockForm({ ...stockForm, quantity_to_stock: '' });
                        } else {
                          const clamped = Math.max(1, Math.min(val, stockModalItem.calculated_remaining));
                          setStockForm({ ...stockForm, quantity_to_stock: clamped });
                        }
                      }}
                      className="w-32 px-3.5 py-2.5 rounded-xl border-2 border-emerald-500 bg-white text-slate-900 font-black text-lg focus:ring-2 focus:ring-emerald-500 outline-none text-center"
                    />
                    <div className="text-xs text-slate-600 font-medium">
                      ถุง (คิดเป็นผักสดประมาณ {(Number(stockForm.quantity_to_stock || 0) * 0.4).toFixed(1)} กก.)
                    </div>
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setStockForm({ ...stockForm, quantity_to_stock: stockModalItem.calculated_remaining })}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      ✓ ลงทั้งหมด ({stockModalItem.calculated_remaining} ถุง)
                    </button>
                    {stockModalItem.calculated_remaining > 1 && (
                      <button
                        type="button"
                        onClick={() => setStockForm({ ...stockForm, quantity_to_stock: Math.ceil(stockModalItem.calculated_remaining / 2) })}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition active:scale-95 cursor-pointer"
                      >
                        ครึ่งหนึ่ง ({Math.ceil(stockModalItem.calculated_remaining / 2)} ถุง)
                      </button>
                    )}
                    {stockModalItem.calculated_remaining >= 10 && (
                      <button
                        type="button"
                        onClick={() => setStockForm({ ...stockForm, quantity_to_stock: 10 })}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition active:scale-95 cursor-pointer"
                      >
                        10 ถุง
                      </button>
                    )}
                    {stockModalItem.calculated_remaining >= 20 && (
                      <button
                        type="button"
                        onClick={() => setStockForm({ ...stockForm, quantity_to_stock: 20 })}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition active:scale-95 cursor-pointer"
                      >
                        20 ถุง
                      </button>
                    )}
                  </div>
                </div>

                {/* ข้อมูลสินค้าหน้าร้าน (ระบบจับคู่ให้อัตโนมัติ 100% ตามชนิดผัก ไม่ต้องเลือกเอง) */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-emerald-600" />
                      <span>สินค้าหน้าร้านที่จะลงสต็อก (จับคู่ตรงชนิดผักให้อัตโนมัติ)</span>
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                      {stockModalItem.matched_product ? '✓ ผูกกับสินค้าเดิมในร้าน' : '✨ เตรียมสร้างสินค้าใหม่อัตโนมัติ'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    {stockModalItem.matched_product?.image_url ? (
                      <img
                        src={stockModalItem.matched_product.image_url}
                        alt={stockForm.product_name}
                        className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl shrink-0">
                        🥬
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="font-black text-slate-900 text-sm truncate">
                        {stockForm.product_name}
                      </h4>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                        <span>สต็อกปัจจุบันในร้าน: <strong className="font-mono text-slate-800">{Number(stockModalItem.matched_product?.stock_quantity || 0)} ถุง</strong></span>
                        <span>→</span>
                        <span className="text-emerald-700 font-bold">
                          หลังลงสต็อก: <strong className="font-mono text-emerald-800">{Number(stockModalItem.matched_product?.stock_quantity || 0) + Number(stockForm.quantity_to_stock || 0)} ถุง</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ราคาขาย & สวิตช์สถานะพร้อมจำหน่าย */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">ราคาขาย (บาท / ถุง)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={stockForm.price}
                      onChange={(e) => setStockForm({ ...stockForm, price: e.target.value })}
                      placeholder="เช่น 20"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-black focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    />
                  </div>

                  <div className="flex items-end">
                    <div className="h-[44px] w-full px-3.5 flex items-center rounded-xl bg-slate-50 border border-slate-200">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={stockForm.is_available}
                          onChange={(e) => setStockForm({ ...stockForm, is_available: e.target.checked })}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span>เปิดสถานะ "พร้อมจำหน่ายทันที" บน LINE Shop</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* ข้อความสรุป */}
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>สรุปการลงสต็อก:</span>
                  </div>
                  <div>
                    เมื่อกดยืนยัน ระบบจะบวกสต็อก <span className="font-bold text-emerald-800">{stockForm.quantity_to_stock || 0} ถุง</span> เข้าสินค้าหน้าร้าน และปรับสถานะของล็อตนี้เป็น{' '}
                    <span className="font-bold text-emerald-800">
                      {Number(stockForm.quantity_to_stock || 0) >= stockModalItem.calculated_remaining ? '✓ ลงสต็อกครบแล้ว (100%)' : `ลงสต็อกบางส่วน (คงเหลืออีก ${stockModalItem.calculated_remaining - Number(stockForm.quantity_to_stock || 0)} ถุง)`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fixed Footer Buttons */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setStockModalItem(null)}
                  className="flex-1 py-2.5 sm:py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submittingStock}
                  className="flex-1 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>
                    {submittingStock ? 'กำลังบันทึกสต็อก...' : `✓ ยืนยันการลงสต็อก (${stockForm.quantity_to_stock || 0} ถุง)`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
