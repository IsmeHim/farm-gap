import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
  Layers,
  Plus,
  Sprout,
  Droplets,
  CheckCircle2,
  Edit3,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react';
import { format } from 'date-fns';

// Utilities
import {
  formatDateForInput,
  getTodayLocalStr,
  getBatchProgressInfo,
} from '../utils/plotUtils';

// Modular Plot Components
import PlotCard from '../components/plots/PlotCard';
import NewBatchModal from '../components/plots/NewBatchModal';
import AddPlotModal from '../components/plots/AddPlotModal';
import EditBatchModal from '../components/plots/EditBatchModal';
import SoilPrepModal from '../components/plots/SoilPrepModal';
import NurseryActivityModal from '../components/plots/NurseryActivityModal';
import CropTimelineDrawer from '../components/plots/CropTimelineDrawer';

const STAGE_LABELS = {
  seeding: 'เพาะเมล็ด / แช่น้ำอุ่น',
  nursery: 'อนุบาลต้นกล้า / ถาดหลุม',
  transplant: 'ย้ายกล้าลงแปลง',
  maintenance: 'ดูแลรักษา / พ่นชีวภัณฑ์',
  prep: 'เตรียมแปลงปลูก',
};

export default function Plots() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plots, setPlots] = useState([]);
  const [crops, setCrops] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Planting Mode for New Batch Modal: 'direct' (หยอดเมล็ด/ลงแปลงทันที) or 'nursery' (เพาะกล้าก่อน)
  const [plantingMode, setPlantingMode] = useState('direct');

  // Form State for Starting a Batch / Nursery Seeding
  const [form, setForm] = useState({
    plot_id: '',
    crop_id: '',
    start_date: getTodayLocalStr(),
    soil_prep_date: getTodayLocalStr(),
    seed_prep_date: '',
    notes: '',
    operator_name: 'เจ้าของฟาร์ม',
    soil_recipe: '',
  });

  // State for Adding a New Plot
  const [showAddPlotModal, setShowAddPlotModal] = useState(false);
  const [addPlotForm, setAddPlotForm] = useState({
    name: '',
    plot_number: '',
    dimension: 'แคร่ 2 x 6 เมตร',
    area_sqm: 12,
    soil_recipe: 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
    soil_prep_date: getTodayLocalStr(),
    notes: '',
  });
  const [creatingPlot, setCreatingPlot] = useState(false);
  const [deletingPlotId, setDeletingPlotId] = useState(null);

  // State for Editing an Active Batch
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [editForm, setEditForm] = useState({
    crop_id: '',
    start_date: '',
    soil_prep_date: '',
    seed_prep_date: '',
    soil_recipe: '',
    notes: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [cancellingBatchId, setCancellingBatchId] = useState(null);

  // State for Editing Plot Soil Recipe Directly (ก่อนลงปลูก / แปลงว่าง)
  const [showSoilModal, setShowSoilModal] = useState(false);
  const [soilForm, setSoilForm] = useState({
    plot_id: null,
    plot_name: '',
    soil_recipe: '',
    soil_prep_date: getTodayLocalStr(),
  });
  const [savingSoil, setSavingSoil] = useState(false);

  // State for Nursery & Pre-planting Activities (บันทึกกิจกรรมต้นกล้า / เพาะเมล็ด / ย้ายถาด)
  const [showNurseryModal, setShowNurseryModal] = useState(false);
  const [nurseryForm, setNurseryForm] = useState({
    activity_id: null,
    plot_id: null,
    plot_name: '',
    seed_crop_id: '',
    activity_date: getTodayLocalStr(),
    stage: 'seeding',
    title: '',
    details: '',
    materials_used: '',
    operator_name: 'เจ้าของฟาร์ม',
  });
  const [savingNursery, setSavingNursery] = useState(false);

  // State for Crop Timeline Drawer / Modal
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelinePlotId, setTimelinePlotId] = useState(null);
  const [timelineBatchScope, setTimelineBatchScope] = useState('current'); // 'current' | batchId
  const [openedFromTimeline, setOpenedFromTimeline] = useState(false);

  const timelinePlot = plots.find((p) => p.id === timelinePlotId) || null;
  const openTimelineForPlot = (plot) => {
    setTimelinePlotId(plot.id);
    setTimelineBatchScope('current');
    setShowTimelineModal(true);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plotsRes, cropsRes, batchesRes] = await Promise.all([
        api.get('/api/plots'),
        api.get('/api/crops'),
        api.get('/api/batches'),
      ]);

      const rawPlots = plotsRes.data || [];
      // เรียงจากแปลงที่ 1 -> 2 -> 3 -> 4 -> 5 -> 6 (Ascending Order)
      const sortedPlots = [...rawPlots].sort((a, b) => {
        const numA = Number(a.plot_number ?? a.id) || 0;
        const numB = Number(b.plot_number ?? b.id) || 0;
        return numA - numB;
      });

      const fetchedCrops = cropsRes.data || [];
      const fetchedBatches = batchesRes.data || [];

      setPlots(sortedPlots);
      setCrops(fetchedCrops);
      setBatches(fetchedBatches);

      if (fetchedCrops.length > 0) {
        setForm((prev) => ({
          ...prev,
          crop_id: prev.crop_id || fetchedCrops[0].id,
        }));
      }

      // Check query param e.g. /plots?plot_id=1&start=true
      const paramPlotId = searchParams.get('plot_id');
      const startFlag = searchParams.get('start');
      if (paramPlotId && startFlag === 'true') {
        const found = sortedPlots.find((p) => p.id === Number(paramPlotId));
        setForm((prev) => ({
          ...prev,
          plot_id: Number(paramPlotId),
          crop_id: found?.seed_crop_id || prev.crop_id || (fetchedCrops[0]?.id || ''),
          soil_recipe: found?.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
          soil_prep_date: found?.soil_prep_date
            ? formatDateForInput(found.soil_prep_date)
            : getTodayLocalStr(),
          seed_prep_date: found?.seed_prep_date
            ? formatDateForInput(found.seed_prep_date)
            : '',
          notes: found?.seed_notes || prev.notes || '',
        }));
        setShowNewModal(true);
      }
    } catch (err) {
      console.error('Failed to load plots & batches:', err);
      toast.error('ไม่สามารถโหลดข้อมูลแปลงและรอบการผลิตได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModalWithPlot = (plotId, preferredMode) => {
    const found = plots.find((p) => p.id === plotId);
    const chosenCropId = found?.seed_crop_id || (crops[0]?.id || '');
    const chosenCrop = crops.find((c) => String(c.id) === String(chosenCropId));
    const isPending = Boolean(found?.seed_prep_date || found?.seed_crop_id);

    // If preferredMode is explicitly set, use it.
    // If plot has pending seedlings, default to 'direct' (ย้ายกล้าลงแปลง).
    // Otherwise default to 'direct' (farmer can switch to 'nursery' in 1 click).
    const initialMode = preferredMode ? preferredMode : (isPending ? 'direct' : 'direct');
    setPlantingMode(initialMode);

    setForm((prev) => ({
      ...prev,
      plot_id: plotId,
      crop_id: chosenCropId,
      start_date: getTodayLocalStr(),
      soil_prep_date: found?.soil_prep_date
        ? formatDateForInput(found.soil_prep_date)
        : getTodayLocalStr(),
      seed_prep_date: found?.seed_prep_date
        ? formatDateForInput(found.seed_prep_date)
        : '',
      operator_name: 'เจ้าของฟาร์ม',
      notes:
        chosenCrop?.notes ||
        'เพาะเมล็ดในกล่องพลาสติกที่มีฝาปิดมิดชิด วางกระดาษทิชชูในกล่องพลาสติก พ่นน้ำให้ทั่วกระดาษทิชชูหมาดๆ โรยเมล็ดบางๆ ปิดทับด้วยกระดาษทิชชูแล้วพ่นน้ำให้หมาดๆ เสร็จแล้วปิดฝากล่อง',
      soil_recipe:
        found?.soil_recipe ||
        'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
    }));
    setShowNewModal(true);
  };

  const handleOpenAddPlotModal = () => {
    const maxNum = plots.length > 0 ? Math.max(...plots.map((p) => Number(p.plot_number || p.id) || 0)) : 0;
    const nextNum = maxNum + 1;
    setAddPlotForm({
      name: `แปลง/แคร่ที่ ${nextNum}`,
      plot_number: nextNum,
      dimension: 'แคร่ 2 x 6 เมตร',
      area_sqm: 12,
      soil_recipe: 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
      notes: '',
    });
    setShowAddPlotModal(true);
  };

  const handleCreatePlot = async (e) => {
    e.preventDefault();
    try {
      setCreatingPlot(true);
      const res = await api.post('/api/plots', addPlotForm);
      toast.success(`เพิ่ม "${res.data?.name || 'แปลงใหม่'}" สำเร็จ!`);
      setShowAddPlotModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to create plot:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการสร้างแปลงใหม่');
    } finally {
      setCreatingPlot(false);
    }
  };

  const handleDeletePlot = async (plot) => {
    if (plot.status === 'growing' || plot.status === 'harvest_ready') {
      return toast.error(`ไม่สามารถลบ "${plot.name}" ได้ เนื่องจากยังมีผักที่กำลังปลูกอยู่`);
    }
    if (!window.confirm(`ยืนยันการลบ "${plot.name}" ออกจากระบบฟาร์ม?`)) {
      return;
    }
    try {
      setDeletingPlotId(plot.id);
      const res = await api.delete(`/api/plots/${plot.id}`);
      toast.success(res.data?.message || `ลบ ${plot.name} เรียบร้อยแล้ว`);
      fetchData();
    } catch (err) {
      console.error('Failed to delete plot:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการลบแปลง');
    } finally {
      setDeletingPlotId(null);
    }
  };

  const handleOpenEditBatch = (batch, plot) => {
    let targetBatch = batch;
    if (!targetBatch && plot) {
      targetBatch = batches.find(
        (b) => b.plot_id === plot.id && (b.status === 'growing' || b.status === 'harvest_ready')
      );
    }
    if (!targetBatch) {
      return toast.error('ไม่พบข้อมูลรอบการปลูกของแปลงนี้');
    }
    setEditingBatch({
      ...targetBatch,
      plot_name: plot?.name || targetBatch.plot_name,
    });
    setEditForm({
      crop_id: targetBatch.crop_id || (crops[0]?.id || ''),
      start_date: formatDateForInput(targetBatch.start_date) || getTodayLocalStr(),
      soil_prep_date: formatDateForInput(targetBatch.soil_prep_date || plot?.soil_prep_date) || '',
      seed_prep_date: formatDateForInput(targetBatch.seed_prep_date) || '',
      soil_recipe:
        targetBatch.soil_recipe ||
        plot?.soil_recipe ||
        'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
      notes: targetBatch.notes || '',
    });
    setShowEditBatchModal(true);
  };

  const handleSaveEditBatch = async (e) => {
    e.preventDefault();
    if (!editingBatch) return;
    try {
      setSavingEdit(true);
      const res = await api.put(`/api/batches/${editingBatch.id}`, editForm);
      toast.success(res.data?.message || 'บันทึกการแก้ไขรอบปลูกสำเร็จ!');
      setShowEditBatchModal(false);
      setEditingBatch(null);
      fetchData();
    } catch (err) {
      console.error('Failed to update batch:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการแก้ไขรอบการปลูก');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelBatch = async (batch, plot) => {
    let targetBatch = batch;
    if (!targetBatch && plot) {
      targetBatch = batches.find(
        (b) => b.plot_id === plot.id && (b.status === 'growing' || b.status === 'harvest_ready')
      );
    }
    const plotName = plot?.name || targetBatch?.plot_name || 'แปลงนี้';
    const cropName = targetBatch?.crop_name || plot?.crop_name || 'พืชที่ปลูก';

    const confirmed = window.confirm(
      `⚠️ ยืนยันยกเลิกรอบการปลูก "${cropName}" ใน "${plotName}" หรือไม่?\n\n` +
        `• แปลงปลูกจะถูกรีเซ็ตกลับเป็นสถานะ "ว่าง" ทันที\n` +
        `• รอบการปลูกนี้จะถูกลบออกจากระบบ\n` +
        `• คุณสามารถเริ่มลงปลูกชนิดผักที่ถูกต้องใหม่ได้ทันที`
    );
    if (!confirmed) return;

    try {
      setCancellingBatchId(targetBatch ? targetBatch.id : plot ? plot.id : true);
      if (targetBatch) {
        const res = await api.delete(`/api/batches/${targetBatch.id}`);
        toast.success(res.data?.message || `ยกเลิกรอบการปลูกและรีเซ็ต ${plotName} สำเร็จ`);
      } else if (plot) {
        const res = await api.post(`/api/plots/${plot.id}/reset`);
        toast.success(res.data?.message || `รีเซ็ต ${plotName} กลับเป็นแปลงว่างสำเร็จ`);
      }
      fetchData();
    } catch (err) {
      console.error('Failed to cancel batch:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการยกเลิกรอบการปลูก');
    } finally {
      setCancellingBatchId(null);
    }
  };

  const handleOpenSoilModal = (plot) => {
    const currentBatch = batches.find(
      (b) => b.plot_id === plot.id && (b.status === 'growing' || b.status === 'harvest_ready')
    );
    const initialSoilDate = plot.soil_prep_date || currentBatch?.soil_prep_date;
    setSoilForm({
      plot_id: plot.id,
      plot_name: plot.name,
      soil_recipe:
        plot.soil_recipe ||
        currentBatch?.soil_recipe ||
        'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
      soil_prep_date: initialSoilDate
        ? formatDateForInput(initialSoilDate)
        : getTodayLocalStr(),
    });
    setShowSoilModal(true);
  };

  const handleSaveSoil = async (e) => {
    e.preventDefault();
    if (!soilForm.plot_id) return;
    try {
      setSavingSoil(true);
      await api.put(`/api/plots/${soilForm.plot_id}`, {
        soil_recipe: soilForm.soil_recipe,
        soil_prep_date: soilForm.soil_prep_date || null,
      });
      toast.success(`บันทึกสูตรดิน/การเตรียมแคร่ของ "${soilForm.plot_name}" เรียบร้อยแล้ว!`);
      setShowSoilModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to update soil recipe:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกสูตรดิน');
    } finally {
      setSavingSoil(false);
    }
  };

  const handleOpenNurseryModal = (plot, fromTimeline = false) => {
    setOpenedFromTimeline(fromTimeline);
    if (fromTimeline) {
      setShowTimelineModal(false);
    }
    const isGrowing = plot.status === 'growing' || plot.status === 'harvest_ready';
    const defaultCropId =
      plot.seed_crop_id ||
      crops.find((c) => c.name === plot.crop_name)?.id ||
      crops[0]?.id ||
      '';
    const matchedCrop = crops.find((c) => String(c.id) === String(defaultCropId));
    const cropName = matchedCrop
      ? matchedCrop.name
      : plot.crop_name && plot.crop_name !== '-'
      ? plot.crop_name
      : 'ผัก';

    const defaultStage = isGrowing ? 'maintenance' : 'seeding';
    const defaultTitle = isGrowing
      ? `ดูแลแปลง/พ่นชีวภัณฑ์ (${cropName})`
      : `เพาะเมล็ดพันธุ์${cropName}`;
    const defaultDetails = isGrowing
      ? 'ตรวจแปลง ฉีดพ่นน้ำหมักชีวภาพ/สารชีวภัณฑ์ ป้องกันศัตรูพืชตามมาตรฐาน GAP'
      : matchedCrop?.notes ||
        'เพาะเมล็ดในกล่องพลาสติกที่มีฝาปิดมิดชิด วางกระดาษทิชชูในกล่องพลาสติก พ่นน้ำให้ทั่วกระดาษทิชชูหมาดๆ โรยเมล็ดบางๆ ปิดทับด้วยกระดาษทิชชูแล้วพ่นน้ำให้หมาดๆ เสร็จแล้วปิดฝากล่อง';
    setNurseryForm({
      activity_id: null,
      plot_id: plot.id,
      plot_name: plot.name,
      seed_crop_id: defaultCropId,
      activity_date: getTodayLocalStr(),
      stage: defaultStage,
      title: defaultTitle,
      details: defaultDetails,
      materials_used: '',
      operator_name: 'เจ้าของฟาร์ม',
    });
    setShowNurseryModal(true);
  };

  const handleOpenEditNurseryModal = (activity, plot, fromTimeline = false) => {
    setOpenedFromTimeline(fromTimeline);
    if (fromTimeline) {
      setShowTimelineModal(false);
    }
    setNurseryForm({
      activity_id: activity.id,
      plot_id: plot.id,
      plot_name: plot.name,
      seed_crop_id:
        plot.seed_crop_id || crops.find((c) => c.name === plot.crop_name)?.id || '',
      activity_date: activity.activity_date
        ? formatDateForInput(activity.activity_date)
        : getTodayLocalStr(),
      stage: activity.stage || 'seeding',
      title: activity.title || '',
      details: activity.details || '',
      materials_used: '',
      operator_name: activity.operator_name || 'เจ้าของฟาร์ม',
    });
    setShowNurseryModal(true);
  };

  const handleSaveNurseryActivity = async (e) => {
    e.preventDefault();
    if (!nurseryForm.plot_id) return;
    if (!nurseryForm.activity_date) {
      return toast.error('กรุณาระบุวันที่ทำกิจกรรม');
    }

    const cropObj = crops.find((c) => String(c.id) === String(nurseryForm.seed_crop_id));
    const cropName = cropObj ? cropObj.name : (nurseryForm.plot_name || '');
    const finalTitle =
      nurseryForm.title?.trim() ||
      `${STAGE_LABELS[nurseryForm.stage] || 'บันทึกกิจกรรม'}${cropName ? ` (${cropName})` : ''}`;

    try {
      setSavingNursery(true);
      if (nurseryForm.activity_id) {
        // Edit existing activity
        await api.put(`/api/plots/activities/${nurseryForm.activity_id}`, {
          activity_date: nurseryForm.activity_date,
          stage: nurseryForm.stage,
          title: finalTitle,
          details: nurseryForm.details,
          materials_used: null,
          operator_name: nurseryForm.operator_name,
        });
        toast.success(`แก้ไขกิจกรรม "${finalTitle}" เรียบร้อยแล้ว!`);
      } else {
        // Create new activity
        await api.post(`/api/plots/${nurseryForm.plot_id}/activities`, {
          seed_crop_id: nurseryForm.seed_crop_id ? Number(nurseryForm.seed_crop_id) : null,
          activity_date: nurseryForm.activity_date,
          stage: nurseryForm.stage,
          title: finalTitle,
          details: nurseryForm.details,
          materials_used: null,
          operator_name: nurseryForm.operator_name,
        });
        toast.success(`บันทึกกิจกรรม "${finalTitle}" เรียบร้อยแล้ว!`);
      }
      setShowNurseryModal(false);
      await fetchData();
      if (openedFromTimeline) {
        setShowTimelineModal(true);
      }
    } catch (err) {
      console.error('Failed to save nursery activity:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกกิจกรรม');
    } finally {
      setSavingNursery(false);
    }
  };

  const handleDeleteNurseryActivity = async (activityId, activityTitle) => {
    if (!window.confirm(`ต้องการลบกิจกรรม "${activityTitle || 'นี้'}" หรือไม่?`)) return;
    try {
      setSavingNursery(true);
      await api.delete(`/api/plots/activities/${activityId}`);
      toast.success('ลบกิจกรรมเรียบร้อยแล้ว');
      setShowNurseryModal(false);
      await fetchData();
      if (openedFromTimeline) {
        setShowTimelineModal(true);
      }
    } catch (err) {
      console.error('Failed to delete nursery activity:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการลบกิจกรรม');
    } finally {
      setSavingNursery(false);
    }
  };

  const handleStartPlanting = async (e) => {
    e.preventDefault();
    if (!form.plot_id) {
      return toast.error('กรุณาเลือกแปลงปลูก');
    }
    if (!form.crop_id) {
      return toast.error('กรุณาเลือกชนิดผัก');
    }

    // Option A: เพาะกล้าก่อน (เช่น ผักสลัด, มะเขือเทศ)
    if (plantingMode === 'nursery') {
      try {
        setSubmitting(true);
        const matchedCrop = crops.find((c) => String(c.id) === String(form.crop_id));
        const cropName = matchedCrop ? matchedCrop.name : 'ผัก';
        const defaultSeedingDetails =
          matchedCrop?.notes ||
          'เพาะเมล็ดในกล่องพลาสติกที่มีฝาปิดมิดชิด วางกระดาษทิชชูในกล่องพลาสติก พ่นน้ำให้ทั่วกระดาษทิชชูหมาดๆ โรยเมล็ดบางๆ ปิดทับด้วยกระดาษทิชชูแล้วพ่นน้ำให้หมาดๆ เสร็จแล้วปิดฝากล่อง';

        await api.post(`/api/plots/${form.plot_id}/activities`, {
          seed_crop_id: Number(form.crop_id),
          activity_date: form.seed_prep_date || getTodayLocalStr(),
          stage: 'seeding',
          title: `เพาะเมล็ดพันธุ์${cropName}`,
          details: form.notes || defaultSeedingDetails,
          operator_name: form.operator_name || 'เจ้าของฟาร์ม',
        });

        toast.success(
          `บันทึกกิจกรรมเพาะกล้า "${cropName}" เรียบร้อยแล้ว! แปลงเปลี่ยนเป็น "🌱 กำลังเพาะกล้า (รอลงแปลง)"`
        );
        setShowNewModal(false);
        setSearchParams({});
        fetchData();
      } catch (err) {
        console.error('Failed to save nursery activity:', err);
        toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกกิจกรรมเพาะกล้า');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Option B: หยอดเมล็ด / ลงแปลงทันที
    try {
      setSubmitting(true);
      const res = await api.post('/api/batches', form);
      toast.success(res.data?.message || 'เริ่มรอบการปลูกใหม่เรียบร้อยแล้ว!');
      setShowNewModal(false);
      setSearchParams({}); // clear search params
      fetchData();
    } catch (err) {
      console.error('Failed to start planting batch:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเริ่มรอบปลูก');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-xs font-bold text-emerald-800">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            Plots Management & Planting Batches
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5">
            แปลงปลูก ({plots.length} แคร่) & รอบการผลิต (Plots & Batches)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            จัดการแคร่ปลูก 2x6 เมตร สูตรดิน และบันทึกรอบการปลูกผักสลัด กวางตุ้ง ผักบุ้ง ฯลฯ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={handleOpenAddPlotModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>เพิ่มแปลง/แคร่ใหม่</span>
          </button>

          <button
            onClick={() => {
              const emptyPlot = plots.find(
                (p) => p.status === 'empty' || !p.crop_name || p.crop_name === '-'
              );
              if (emptyPlot) {
                openModalWithPlot(emptyPlot.id);
              } else if (plots.length > 0) {
                openModalWithPlot(plots[0].id);
              } else {
                setShowNewModal(true);
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer active:scale-95"
          >
            <Sprout className="w-4 h-4" />
            <span>เริ่มรอบการปลูกใหม่</span>
          </button>
        </div>
      </div>

      {/* 6 Plots Grid (ตรงตาม UI FarmXNext) */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          กำลังโหลดข้อมูลแปลงปลูก 6 แคร่...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plots.map((p) => {
            const currentBatch = batches.find(
              (b) => b.plot_id === p.id && (b.status === 'growing' || b.status === 'harvest_ready')
            );
            return (
              <PlotCard
                key={p.id}
                plot={p}
                currentBatch={currentBatch}
                onDeletePlot={handleDeletePlot}
                deletingPlotId={deletingPlotId}
                onOpenSoilModal={handleOpenSoilModal}
                onOpenTimeline={openTimelineForPlot}
                onOpenNurseryModal={handleOpenNurseryModal}
                onHarvest={(plotId) => navigate(`/harvest?plot_id=${plotId}&smart=true`)}
                onOpenEditBatch={handleOpenEditBatch}
                onCancelBatch={handleCancelBatch}
                cancellingBatchId={cancellingBatchId}
                onOpenModalWithPlot={openModalWithPlot}
              />
            );
          })}

          {/* Card เพิ่มแปลงใหม่แบบ Dashed */}
          <button
            type="button"
            onClick={handleOpenAddPlotModal}
            className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-3xl p-6 flex flex-col items-center justify-center text-center transition group cursor-pointer min-h-60"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-emerald-100 text-slate-500 group-hover:text-emerald-700 flex items-center justify-center transition shadow-xs">
              <Plus className="w-6 h-6" />
            </div>
            <p className="mt-3 font-bold text-slate-800 text-sm group-hover:text-emerald-800">
              เพิ่มแปลง / แคร่ปลูกใหม่
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-50 text-center">
              สร้างแคร่ที่{' '}
              {plots.length > 0
                ? Math.max(...plots.map((p) => Number(p.plot_number || p.id) || 0)) + 1
                : 1}{' '}
              รองรับการขยายฟาร์มตามมาตรฐาน GAP
            </p>
          </button>
        </div>
      )}

      {/* Batches Table (ประวัติรอบการปลูกทั้งหมด & GAP Tracing) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sprout className="w-5 h-5 text-emerald-600" />
            <span>ประวัติรอบการปลูกทั้งหมด (Planting History & GAP Tracing)</span>
          </h2>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            ทั้งหมด {batches.length} รอบปลูก
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-600 border-y border-slate-200">
              <tr>
                <th className="py-3 px-3.5 font-bold whitespace-nowrap">รหัสรอบ (Batch)</th>
                <th className="py-3 px-3.5 font-bold whitespace-nowrap">ชนิดผัก</th>
                <th className="py-3 px-3.5 font-bold whitespace-nowrap">แปลงปลูก</th>
                <th className="py-3 px-3.5 font-bold whitespace-nowrap">วันที่เริ่มปลูก</th>
                <th className="py-3 px-3.5 font-bold whitespace-nowrap">วันเก็บผลผลิต</th>
                <th className="py-3 px-3.5 font-bold whitespace-nowrap min-w-[130px]">ความคืบหน้า</th>
                <th className="py-3 px-3.5 font-bold whitespace-nowrap text-center">สถานะ</th>
                <th className="py-3 px-3.5 font-bold whitespace-nowrap text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    ยังไม่มีประวัติรอบการปลูก
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const isHarvested = b.status === 'harvested';
                  const bProg = getBatchProgressInfo(b);
                  const bIsHarvestReady =
                    !isHarvested &&
                    (b.status === 'harvest_ready' ||
                      (bProg && (bProg.percent >= 100 || bProg.daysLeft === 0)));
                  const bIsEarlyStage =
                    !isHarvested &&
                    !bIsHarvestReady &&
                    b.status === 'growing' &&
                    (bProg?.daysPlanted ?? 0) <= 2;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition">
                      {/* 1. Batch Code */}
                      <td className="py-3.5 px-3.5 align-middle whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100/80 px-2 py-1 rounded-lg border border-slate-200/80 text-[11px]">
                          {b.batch_code}
                        </span>
                      </td>

                      {/* 2. Crop Name & Remaining Count */}
                      <td className="py-3.5 px-3.5 align-middle min-w-[140px]">
                        <span className="font-bold text-emerald-800 block leading-snug">
                          {b.crop_name}
                        </span>
                      </td>

                      {/* 3. Plot Name */}
                      <td className="py-3.5 px-3.5 align-middle text-slate-700 font-medium whitespace-nowrap">
                        {b.plot_name}
                      </td>

                      {/* 4. Start Date */}
                      <td className="py-3.5 px-3.5 align-middle text-slate-600 font-mono whitespace-nowrap">
                        {b.start_date ? format(new Date(b.start_date), 'dd/MM/yyyy') : '-'}
                      </td>

                      {/* 5. Harvest Date */}
                      <td className="py-3.5 px-3.5 align-middle whitespace-nowrap">
                        {b.actual_harvest_date ? (
                          <div className="font-mono text-slate-700 font-semibold">
                            {format(new Date(b.actual_harvest_date), 'dd/MM/yyyy')}
                          </div>
                        ) : b.expected_harvest_date ? (
                          <div>
                            <span className="font-mono text-slate-600">
                              {format(new Date(b.expected_harvest_date), 'dd/MM/yyyy')}
                            </span>
                            <span className="text-[10px] text-slate-400 block">กำหนดเก็บ</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 6. Progress Bar */}
                      <td className="py-3.5 px-3.5 align-middle whitespace-nowrap">
                        {isHarvested ? (
                          <div className="space-y-1 w-28">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                              <span>100%</span>
                              <span className="text-[10px] text-slate-400">ครบกำหนด</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full w-full" />
                            </div>
                          </div>
                        ) : bIsHarvestReady ? (
                          <div className="space-y-1 w-28">
                            <div className="flex items-center justify-between text-[11px] font-black text-amber-800">
                              <span>100%</span>
                              <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                                พร้อมตัด
                              </span>
                            </div>
                            <div className="w-full bg-amber-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-amber-500 h-full rounded-full w-full animate-pulse" />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1 w-28">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-emerald-800">{bProg.percent}%</span>
                              <span className="text-[10px] text-slate-500">
                                {bProg.daysPlanted}/{bProg.growthDays} วัน
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all"
                                style={{ width: `${bProg.percent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 7. Status Badge (Single Line, No Wrapping) */}
                      <td className="py-3.5 px-3.5 align-middle text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] whitespace-nowrap ${
                            isHarvested
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : bIsHarvestReady
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : b.status === 'growing'
                              ? 'bg-sky-50 text-sky-800 border border-sky-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {isHarvested ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>เก็บผลผลิตแล้ว</span>
                            </>
                          ) : bIsHarvestReady ? (
                            <span>🔔 พร้อมเก็บผลผลิต</span>
                          ) : b.status === 'growing' ? (
                            <span>🌱 กำลังปลูก</span>
                          ) : (
                            <span>{b.status}</span>
                          )}
                        </span>
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3.5 px-3.5 align-middle text-right whitespace-nowrap">
                        {!isHarvested &&
                        (b.status === 'growing' ||
                          b.status === 'harvest_ready' ||
                          bIsHarvestReady) ? (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {bIsEarlyStage && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditBatch(b)}
                                  title="แก้ไขข้อมูลรอบปลูก"
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer active:scale-95"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelBatch(b)}
                                  disabled={cancellingBatchId === b.id}
                                  title="ยกเลิกรอบปลูกและรีเซ็ตแปลงเป็นว่าง"
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => navigate(`/harvest?plot_id=${b.plot_id}&smart=true`)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap ${
                                bIsHarvestReady
                                  ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-black border border-amber-300'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                              <span>บันทึกเก็บผลผลิต</span>
                            </button>
                          </div>
                        ) : isHarvested ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/harvest?batch_id=${b.id}`)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                            title="ดูประวัติการเก็บเกี่ยวและสต็อกสินค้าในหน้าผลผลิต"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>ดูผลผลิต</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                            บันทึกเรียบร้อย
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: เริ่มรอบการปลูกใหม่ / เพาะกล้า */}
      <NewBatchModal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setSearchParams({});
        }}
        plantingMode={plantingMode}
        setPlantingMode={setPlantingMode}
        form={form}
        setForm={setForm}
        plots={plots}
        crops={crops}
        submitting={submitting}
        onSubmit={handleStartPlanting}
      />

      {/* Modal 2: เพิ่มแปลง / แคร่ปลูกใหม่ */}
      <AddPlotModal
        isOpen={showAddPlotModal}
        onClose={() => setShowAddPlotModal(false)}
        addPlotForm={addPlotForm}
        setAddPlotForm={setAddPlotForm}
        creatingPlot={creatingPlot}
        onCreate={handleCreatePlot}
      />

      {/* Modal 3: แก้ไขข้อมูลรอบการปลูก */}
      <EditBatchModal
        isOpen={showEditBatchModal}
        onClose={() => {
          setShowEditBatchModal(false);
          setEditingBatch(null);
        }}
        editingBatch={editingBatch}
        editForm={editForm}
        setEditForm={setEditForm}
        crops={crops}
        savingEdit={savingEdit}
        onSave={handleSaveEditBatch}
      />

      {/* Modal 4: ปรับปรุงสูตรดิน / การเตรียมแคร่ */}
      <SoilPrepModal
        isOpen={showSoilModal}
        onClose={() => setShowSoilModal(false)}
        soilForm={soilForm}
        setSoilForm={setSoilForm}
        savingSoil={savingSoil}
        onSave={handleSaveSoil}
      />

      {/* Modal 5: บันทึกกิจกรรมแปลง / ต้นกล้า GAP */}
      <NurseryActivityModal
        isOpen={showNurseryModal}
        onClose={() => {
          setShowNurseryModal(false);
          if (openedFromTimeline) setShowTimelineModal(true);
        }}
        nurseryForm={nurseryForm}
        setNurseryForm={setNurseryForm}
        crops={crops}
        savingNursery={savingNursery}
        onSave={handleSaveNurseryActivity}
        onDelete={handleDeleteNurseryActivity}
      />

      {/* Drawer: ประวัติกิจกรรมแปลง & GAP Timeline */}
      <CropTimelineDrawer
        isOpen={showTimelineModal}
        onClose={() => setShowTimelineModal(false)}
        timelinePlot={timelinePlot}
        timelineBatchScope={timelineBatchScope}
        setTimelineBatchScope={setTimelineBatchScope}
        onOpenAddActivity={(plot) => handleOpenNurseryModal(plot, true)}
        onOpenEditActivity={(act, plot) => handleOpenEditNurseryModal(act, plot, true)}
        onDeleteActivity={handleDeleteNurseryActivity}
      />
    </div>
  );
}
