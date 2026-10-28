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
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';

// Utilities
import { getPlotProgressInfo } from '../utils/plotUtils.js';

// Modular Harvest Components
import HarvestCard from '../components/harvest/HarvestCard.jsx';
import SmartHarvestModal from '../components/harvest/SmartHarvestModal.jsx';
import TargetedPushModal from '../components/harvest/TargetedPushModal.jsx';
import StockAllocationModal from '../components/harvest/StockAllocationModal.jsx';
import QrTraceModal from '../components/harvest/QrTraceModal.jsx';

export default function Harvest() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
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
    sync_to_stock: false,
    price: 20,
    image_url: '',
    is_available: false,
    is_partial: false,
    harvested_plants_count: '',
    destination: 'cold_storage',
  });

  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [qrModalItem, setQrModalItem] = useState(null);

  // Targeted Push Notification Modal state
  const [pushModalItem, setPushModalItem] = useState(null);
  const [pushPlot, setPushPlot] = useState(null);
  const [pushCropName, setPushCropName] = useState('');
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

      const plot = currentPlots.find((p) => p.id === Number(item.plot_id));
      const batch = (data.batches || []).find((b) => b.id === Number(item.batch_id));
      const crop = (data.crops || []).find((c) => c.id === Number(batch?.crop_id));
      const cropName = crop?.name || batch?.crop_name || plot?.crop_name || 'ผักสด';

      const totalPacks =
        item.total_packs > 0
          ? Number(item.total_packs)
          : Math.max(1, Math.floor(Number(item.quantity || 0) / 0.4));
      const stocked = Number(item.stocked_quantity || 0);
      const remaining = Math.max(1, totalPacks - stocked);

      // ค้นหาสินค้าที่ชื่อตรงกับชนิดผักโดยตรง (ไม่ใช้ plot_id เพราะแปลงหมุนเวียนชนิดผักได้)
      let matchedProd = null;
      if (item.product_id) {
        matchedProd = currentProducts.find((p) => p.id === Number(item.product_id));
      }
      if (!matchedProd && cropName) {
        matchedProd = currentProducts.find(
          (p) =>
            p.name?.toLowerCase().includes(cropName.toLowerCase()) ||
            cropName.toLowerCase().includes(p.name?.toLowerCase())
        );
      }

      const defaultProdName = matchedProd ? matchedProd.name : `${cropName} สด GAP (4 ขีด)`;
      const defaultPrice = matchedProd
        ? Number(matchedProd.price)
        : crop?.default_price
        ? Number(crop.default_price)
        : 20;

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
      setReloadKey((prev) => prev + 1);
      // Reload products
      api
        .get('/api/products')
        .then((r) => setProducts(r.data || []))
        .catch(() => {});
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
        batches: baRes.data || [],
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
    const allPlots = data.plots || [];
    const allBatches = data.batches || [];

    // Filter harvestable plots (status growing or harvest_ready, and has crop_name)
    const harvestablePlots = allPlots.filter(
      (p) =>
        (p.status === 'growing' || p.status === 'harvest_ready') &&
        p.crop_name &&
        p.crop_name !== '-'
    );

    let chosenPlotId = defaultPlotId;
    if (!chosenPlotId && harvestablePlots.length > 0) {
      // Find a plot that is harvest_ready (100%) first, or pick the first growing plot
      const readyPlot = harvestablePlots.find((p) => {
        const b = allBatches.find(
          (bat) => bat.plot_id === p.id && (bat.status === 'growing' || bat.status === 'harvest_ready')
        );
        const prog = getPlotProgressInfo(p, b);
        return prog.isReady;
      });
      chosenPlotId = readyPlot ? String(readyPlot.id) : String(harvestablePlots[0].id);
    }

    const targetPlot = allPlots.find((p) => p.id === Number(chosenPlotId));
    let initialPackage = 'ถุงใสขนาด 9x18 นิ้ว (4 ขีด)';
    let initialPrice = 20;

    if (targetPlot && targetPlot.crop_name) {
      const foundCrop = (data.crops || []).find(
        (c) =>
          targetPlot.crop_name.toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(targetPlot.crop_name.toLowerCase())
      );
      if (foundCrop) {
        initialPackage = foundCrop.default_bag_size || initialPackage;
        initialPrice = foundCrop.default_price ? Number(foundCrop.default_price) : initialPrice;
      }
    }

    const activeBatch = (data.batches || []).find(
      (b) => b.plot_id === Number(chosenPlotId) && (b.status === 'growing' || b.status === 'harvest_ready')
    );
    const currentRemaining =
      activeBatch?.remaining_count ??
      targetPlot?.remaining_count ??
      '';

    setForm({
      plot_id: chosenPlotId ? String(chosenPlotId) : '',
      harvest_date: format(new Date(), 'yyyy-MM-dd'),
      total_weight_kg: 30,
      weight_per_unit_kg: 0.40,
      package_type: initialPackage,
      quality_grade: 'A',
      worker_name: user?.display_name || 'เจ้าของฟาร์ม',
      notes: 'ตัดแต่งราก คัดแยกใบเหลือง ล้างด้วยน้ำสะอาด บรรจุถุงเจาะรูระบายอากาศ',
      sale_channel: 'ขายปลีกหน้าฟาร์ม + ตลาดนัดชุมชน + LINE Shop',
      sync_to_stock: false,
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
      setForm((prev) => ({
        ...prev,
        worker_name:
          prev.worker_name === 'เจ้าของฟาร์ม' ||
          !prev.worker_name ||
          prev.worker_name === 'สมคิด (เจ้าของสวน)'
            ? user.display_name
            : prev.worker_name,
      }));
    }
  }, [user]);

  // Selected plot object
  const selectedPlot = plots.find((p) => p.id === Number(form.plot_id));

  // Auto-detect existing product matching selected plot's crop name first (then plot_id fallback)
  const matchedProduct = selectedPlot
    ? (() => {
        const crop = (selectedPlot.crop_name || '').trim();
        const cleanCrop = crop
          .replace(/ปลอดสาร|สด|gap|อินทรีย์|ซูเปอร์ฟู้ด|พรีเมียม|\(.*?\)/gi, '')
          .trim()
          .toLowerCase();
        const cropLower = crop.toLowerCase();
        const byName = products.find((pr) => {
          const pName = (pr.name || '').toLowerCase();
          return (
            (cropLower && (pName.includes(cropLower) || cropLower.includes(pName))) ||
            (cleanCrop && pName.includes(cleanCrop))
          );
        });
        if (byName) return byName;
        return products.find((pr) => pr.plot_id && Number(pr.plot_id) === Number(selectedPlot.id));
      })()
    : null;

  // Update packaging and price when user selects a different plot
  useEffect(() => {
    if (selectedPlot && selectedPlot.crop_name && selectedPlot.crop_name !== '-') {
      const foundCrop = crops.find(
        (c) =>
          selectedPlot.crop_name.toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(selectedPlot.crop_name.toLowerCase())
      );
      if (foundCrop) {
        setForm((prev) => ({
          ...prev,
          package_type: foundCrop.default_bag_size || prev.package_type,
          price: foundCrop.default_price
            ? Number(foundCrop.default_price)
            : matchedProduct?.price || prev.price,
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
      setReloadKey((k) => k + 1);
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
        clustersList.length > 0
          ? { data: clustersList }
          : api.get('/api/ai/clusters').catch(() => ({ data: { clusters: [] } })),
        products.length > 0 ? { data: products } : api.get('/api/products').catch(() => ({ data: [] })),
      ]);

      const currentPlot = (plotsRes.data || []).find((p) => p.id === harvestItem.plot_id);
      setPushPlot(currentPlot);

      const clusters = clustersRes.data?.clusters || clustersRes.data || [];
      setClustersList(clusters);

      const currentProducts = prodsRes.data || [];
      if (products.length === 0) setProducts(currentProducts);

      // ดึงชื่อผักจริงของล็อตที่เก็บเกี่ยวนี้
      const rawCropName =
        harvestItem.crop_name ||
        harvestItem.batch_crop_name ||
        harvestItem.product_name ||
        currentPlot?.crop_name ||
        'ผักสดคุณภาพ GAP';
      const cropName = rawCropName && rawCropName !== '-' ? rawCropName : 'ผักสดคุณภาพ GAP';
      const cleanCropDisplay = cropName.replace(/\s*\([^)]*\)/g, '').trim();
      setPushCropName(cleanCropDisplay);

      const plotTitle = currentPlot?.name || harvestItem.plot_name || 'แปลงเพาะปลูก';
      const defaultTitle = `🥦 ${cleanCropDisplay} สดๆ เพิ่งเก็บเกี่ยววันนี้!`;
      const defaultMsg = `สวัสดีครับคุณ {name} ทางฟาร์ม FarmGAP พึ่งเก็บเกี่ยว ${cleanCropDisplay} ${
        harvestItem.quantity ? `จำนวน ${harvestItem.quantity} ${harvestItem.unit || 'กก.'}` : ''
      } จาก${plotTitle} สดใหม่ ปลอดภัยมาตรฐาน GAP พร้อมส่งตรงถึงมือคุณแล้วครับ!`;

      // 1. จับคู่หาสินค้าจาก product_id ของ harvestItem ก่อน (แม่นยำ 100%)
      let matchedProd = null;
      if (harvestItem.product_id) {
        matchedProd = currentProducts.find((p) => Number(p.id) === Number(harvestItem.product_id));
      }
      // 2. หากไม่มี ให้ค้นหาด้วย plot_id
      if (!matchedProd && harvestItem.plot_id) {
        matchedProd = currentProducts.find(
          (p) => p.plot_id && Number(p.plot_id) === Number(harvestItem.plot_id)
        );
      }
      // 3. หากยังไม่พบ ให้ค้นหาด้วยคีย์เวิร์ดชื่อผัก
      if (!matchedProd && cleanCropDisplay && cleanCropDisplay !== 'ผักสดคุณภาพ GAP') {
        const cleanKeyword = cleanCropDisplay
          .replace(/ปลอดสาร|สด|gap|อินทรีย์|ซูเปอร์ฟู้ด|พรีเมียม/gi, '')
          .trim()
          .toLowerCase();
        const cropLower = cleanCropDisplay.toLowerCase();

        matchedProd = currentProducts.find((p) => {
          const pName = (p.name || '').toLowerCase();
          return pName.includes(cropLower) || (cleanKeyword && pName.includes(cleanKeyword));
        });
      }

      setPushMatchedProduct(matchedProd || null);
      const defaultImage =
        matchedProd?.image_url ||
        harvestItem.effective_image_url ||
        harvestItem.crop_image_url ||
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop';

      const initialClusterId = clusters[0]?.id || '';
      setPushForm({
        target_type: 'auto',
        cluster_id: initialClusterId,
        custom_title: defaultTitle,
        custom_message: defaultMsg,
        custom_image_url: defaultImage,
        cta_label: `🛒 กดสั่งซื้อ${cleanCropDisplay}ทันที`,
        cta_url: '',
      });

      loadAudiencePreview('auto', initialClusterId, cleanCropDisplay);
    } catch (e) {
      console.error('Failed to prepare push modal:', e);
      toast.error('ไม่สามารถเตรียมข้อมูลแจ้งเตือนได้');
    }
  };

  const handleTargetTypeChange = (type) => {
    const nextForm = { ...pushForm, target_type: type };
    setPushForm(nextForm);
    loadAudiencePreview(type, nextForm.cluster_id, pushCropName || pushPlot?.crop_name);
  };

  const handleClusterChange = (cId) => {
    const nextForm = { ...pushForm, cluster_id: cId };
    setPushForm(nextForm);
    loadAudiencePreview('cluster', cId, pushCropName || pushPlot?.crop_name);
  };

  const applyPresetTemplate = (presetKey) => {
    const cropName =
      pushCropName ||
      (pushPlot?.crop_name && pushPlot.crop_name !== '-' ? pushPlot.crop_name : 'ผักสด');
    const plotTitle = pushPlot?.name || pushModalItem?.plot_name || 'แปลงเพาะปลูก';
    if (presetKey === 'fresh') {
      setPushForm((prev) => ({
        ...prev,
        custom_title: `🥦 ${cropName} สดๆ เพิ่งตัดจากแปลงวันนี้!`,
        custom_message: `สวัสดีครับคุณ {name} ทางฟาร์มพึ่งตัด ${cropName} สดๆ จาก${plotTitle} มาตรฐาน GAP 100% สด กรอบ ปลอดภัย ไร้สารเคมีตกค้าง พร้อมส่งตรงถึงบ้านคุณครับ!`,
        cta_label: `🛒 สั่งซื้อ${cropName}ทันที`,
      }));
    } else if (presetKey === 'b2b') {
      setPushForm((prev) => ({
        ...prev,
        custom_title: `📦 ${cropName} เกรดยกลัง ราคาส่งพิเศษสำหรับร้านค้า!`,
        custom_message: `สวัสดีครับคุณ {name} วันนี้ฟาร์มมี ${cropName} ล็อตใหม่คัดเกรดพิเศษ ${
          pushModalItem?.quantity ? `มีจำนวน ${pushModalItem.quantity} ${pushModalItem.unit || 'กก.'}` : ''
        } เหมาะสำหรับร้านอาหารและลูกค้ายกลัง ราคาส่งมิตรภาพ สนใจรับกี่ลังแจ้งได้เลยครับ`,
        cta_label: `📦 สั่งจอง${cropName}ราคาส่ง`,
      }));
    } else if (presetKey === 'promo') {
      setPushForm((prev) => ({
        ...prev,
        custom_title: `⚡ นาทีทอง! ${cropName} สดใหม่ ลดพิเศษวันนี้เท่านั้น`,
        custom_message: `สวัสดีครับคุณ {name} พิเศษสำหรับลูกค้าคนสำคัญ! ${cropName} เพิ่งเก็บเกี่ยวสดๆ วันนี้ จัดโปรโมชั่นลดพิเศษ จำนวนจำกัดเพียง ${
          pushModalItem?.quantity || 'ไม่กี่'
        } ${pushModalItem?.unit || 'กก.'} เท่านั้น ช้อปเลยก่อนหมด!`,
        cta_label: `⚡ สั่งซื้อ${cropName}โปรโมชั่น`,
      }));
    }
  };

  const handleConfirmPush = async (e) => {
    e.preventDefault();
    if (!pushModalItem) return;
    setSendingPush(true);
    try {
      const cropName =
        pushCropName ||
        (pushPlot?.crop_name && pushPlot.crop_name !== '-' ? pushPlot.crop_name : 'ผักสลัดสด');
      const plotTitle = pushPlot?.name || pushModalItem?.plot_name || 'แปลงเกษตร';
      const res = await api.post('/api/ai/notify-harvest', {
        harvest_id: pushModalItem.id,
        product_id: pushMatchedProduct?.id || pushModalItem.product_id || null,
        crop_name: cropName,
        quantity: pushModalItem.quantity,
        unit: pushModalItem.unit || 'kg',
        plot_name: plotTitle,
        target_type: pushForm.target_type,
        cluster_id: pushForm.cluster_id,
        custom_title: pushForm.custom_title,
        custom_message: pushForm.custom_message,
        custom_image_url: pushForm.custom_image_url,
        cta_label: pushForm.cta_label,
        cta_url: pushForm.cta_url,
      });

      const targets = res.data.target_customers?.map((c) => `${c.name} (${c.cluster})`).join(', ');
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
        renderCard={({ item: r, openEdit, del, plotName }) => (
          <HarvestCard
            item={r}
            plotName={plotName}
            openEdit={openEdit}
            del={del}
            openStockModal={openStockModal}
            openPushModal={openPushModal}
            setQrModalItem={setQrModalItem}
          />
        )}
        renderRowAction={(item) => {
          const total =
            item.total_packs > 0
              ? Number(item.total_packs)
              : Math.max(1, Math.floor(Number(item.quantity || 0) / 0.4));
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
            key: 'crop_name',
            label: 'ชนิดผัก',
            hideInForm: true,
            render: (val, r) => {
              const crop = val || r.batch_crop_name || r.product_name || 'ผักสด';
              const cleanCrop = crop.replace(/\s*\([^)]*\)/g, '').trim();
              const img = r.effective_image_url || r.product_image_url || r.crop_image_url;
              return (
                <div className="flex items-center gap-2.5 min-w-[150px]">
                  {img ? (
                    <img
                      src={img}
                      alt={cleanCrop}
                      className="w-8 h-8 rounded-lg object-cover border border-emerald-200/80 shadow-2xs shrink-0"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold shrink-0 border border-emerald-200">
                      🥗
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className="font-black text-slate-900 text-xs block truncate" title={crop}>
                      {cleanCrop}
                    </span>
                    {r.crop_category && (
                      <span className="text-[10px] text-emerald-700 font-semibold block">
                        {r.crop_category}
                      </span>
                    )}
                  </div>
                </div>
              );
            },
          },
          {
            key: 'plot_id',
            label: 'แปลง / แคร่',
            placeholder: '-- เลือกแปลง --',
            required: true,
            render: (val, r) => {
              const p = plots.find((plot) => plot.id === val);
              const pName = r.plot_name || (p ? p.name : `แปลงที่ ${val}`);
              const batchCode =
                r.batch_code ||
                (p
                  ? `#BATCH-${(p.name || '').replace(/แปลง|\/|\s|\(.*?\)/g, '').trim()}-R${
                      p.cycle_number || 1
                    }`
                  : null);
              return (
                <div className="min-w-[140px] space-y-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-950 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200/90 whitespace-nowrap shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    <span>{pName}</span>
                  </span>
                  {batchCode && (
                    <div
                      className="text-[10px] font-mono text-slate-400 font-semibold truncate"
                      title={batchCode}
                    >
                      {batchCode}
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: 'quantity',
            label: 'จำนวน',
            type: 'number',
            placeholder: 'เช่น 100',
            required: true,
            render: (val) => (
              <span className="font-mono font-black text-slate-900 text-sm whitespace-nowrap">
                {Number(val || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                })}
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
              const total =
                r.total_packs > 0
                  ? Number(r.total_packs)
                  : Math.max(1, Math.floor(Number(r.quantity || 0) / 0.4));
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
                  ? `฿${Number(val).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
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
              <span
                className="block min-w-[170px] max-w-[260px] text-xs font-medium text-slate-700 truncate"
                title={val || ''}
              >
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

      {/* Modal 1: Smart Harvest & Auto Stock Sync */}
      <SmartHarvestModal
        isOpen={smartModalOpen}
        onClose={() => setSmartModalOpen(false)}
        successResult={successResult}
        setSuccessResult={setSuccessResult}
        onSubmit={handleSmartSubmit}
        form={form}
        setForm={setForm}
        submitting={submitting}
        plots={plots}
        crops={crops}
        batches={batches}
        products={products}
        getPlotProgressInfo={getPlotProgressInfo}
      />

      {/* Modal 2: Targeted LINE Push Notification */}
      <TargetedPushModal
        pushModalItem={pushModalItem}
        onClose={() => setPushModalItem(null)}
        pushCropName={pushCropName}
        pushPlot={pushPlot}
        pushForm={pushForm}
        setPushForm={setPushForm}
        handleTargetTypeChange={handleTargetTypeChange}
        handleClusterChange={handleClusterChange}
        clustersList={clustersList}
        loadingAudience={loadingAudience}
        audienceList={audienceList}
        applyPresetTemplate={applyPresetTemplate}
        pushMatchedProduct={pushMatchedProduct}
        sendingPush={sendingPush}
        onConfirmPush={handleConfirmPush}
      />

      {/* Modal 3: View Traceability QR Code */}
      <QrTraceModal
        item={qrModalItem}
        onClose={() => setQrModalItem(null)}
      />

      {/* Modal 4: Stock Allocation Modal (LINE Shop) */}
      <StockAllocationModal
        stockModalItem={stockModalItem}
        onClose={() => setStockModalItem(null)}
        stockForm={stockForm}
        setStockForm={setStockForm}
        submittingStock={submittingStock}
        onSubmit={handleSubmitStock}
      />
    </>
  );
}
