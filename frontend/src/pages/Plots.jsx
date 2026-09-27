import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
  Layers,
  Plus,
  Sprout,
  Droplets,
  Clock,
  X,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Sparkles,
  Package,
  Leaf,
  ShoppingBag,
  Trash2,
  Edit3,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';

const getDaysPlanted = (dateStr) => {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const getBatchProgressInfo = (batch, plot) => {
  const isHarvestReady = (plot && plot.status === 'harvest_ready') || (batch && batch.status === 'harvest_ready');
  const isHarvested = (plot && plot.status === 'harvested') || (batch && batch.status === 'harvested');
  const startDate = batch?.start_date || plot?.planting_date;
  const expectedDate = batch?.expected_harvest_date || plot?.expected_harvest_date;
  const growthDays = Number(batch?.growth_days || 30);

  const daysPlanted = startDate ? getDaysPlanted(startDate) : 0;

  if (isHarvested) {
    return {
      percent: 100,
      daysPlanted,
      growthDays,
      daysLeft: 0,
      statusLabel: 'เก็บเกี่ยวแล้ว',
      color: 'slate',
    };
  }

  if (isHarvestReady || (expectedDate && new Date(expectedDate) <= new Date())) {
    return {
      percent: 100,
      daysPlanted,
      growthDays,
      daysLeft: 0,
      statusLabel: 'พร้อมเก็บเกี่ยว',
      color: 'amber',
    };
  }

  const percent = Math.min(100, Math.max(0, Math.round((daysPlanted / growthDays) * 100)));
  const daysLeft = Math.max(0, growthDays - daysPlanted);

  return {
    percent,
    daysPlanted,
    growthDays,
    daysLeft,
    statusLabel: daysLeft === 0 ? 'ครบกำหนด' : `เหลืออีก ~${daysLeft} วัน`,
    color: 'emerald',
  };
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

  // Form State for Starting a Batch
  const [form, setForm] = useState({
    plot_id: '',
    crop_id: '',
    initial_count: '',
    planting_unit: 'ต้น',
    start_date: new Date().toISOString().split('T')[0],
    soil_prep_date: new Date().toISOString().split('T')[0],
    seed_prep_date: '',
    auto_water: true,
    water_schedule: 'เช้า-เย็น (น้ำสะอาดมาตรฐาน GAP)',
    notes: '',
    soil_recipe: ''
  });

  // State for Adding a New Plot
  const [showAddPlotModal, setShowAddPlotModal] = useState(false);
  const [addPlotForm, setAddPlotForm] = useState({
    name: '',
    plot_number: '',
    dimension: 'แคร่ 2 x 6 เมตร',
    area_sqm: 12,
    soil_recipe: 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
    soil_prep_date: new Date().toISOString().split('T')[0],
    water_source: 'น้ำประปา/บ่อพักน้ำมาตรฐาน GAP',
    water_source_type: 'tap',
    notes: ''
  });
  const [creatingPlot, setCreatingPlot] = useState(false);
  const [deletingPlotId, setDeletingPlotId] = useState(null);

  // State for Editing an Active Batch
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [editForm, setEditForm] = useState({
    crop_id: '',
    initial_count: '',
    planting_unit: 'ต้น',
    start_date: '',
    soil_prep_date: '',
    seed_prep_date: '',
    soil_recipe: '',
    auto_water: true,
    notes: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [cancellingBatchId, setCancellingBatchId] = useState(null);

  // State for Editing Plot Soil Recipe Directly (ก่อนลงปลูก / แปลงว่าง)
  const [showSoilModal, setShowSoilModal] = useState(false);
  const [soilForm, setSoilForm] = useState({
    plot_id: null,
    plot_name: '',
    soil_recipe: '',
    soil_prep_date: new Date().toISOString().split('T')[0]
  });
  const [savingSoil, setSavingSoil] = useState(false);

  // State for Pre-recording Seed Prep / Germination (ก่อนลงปลูก / แช่เมล็ด / เพาะกล้าล่วงหน้า)
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [seedForm, setSeedForm] = useState({
    plot_id: null,
    plot_name: '',
    seed_crop_id: '',
    seed_prep_date: new Date().toISOString().split('T')[0],
    seed_notes: ''
  });
  const [savingSeed, setSavingSeed] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plotsRes, cropsRes, batchesRes] = await Promise.all([
        api.get('/api/plots'),
        api.get('/api/crops'),
        api.get('/api/batches')
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
        setForm(prev => ({
          ...prev,
          crop_id: prev.crop_id || fetchedCrops[0].id
        }));
      }

      // Check query param e.g. /plots?plot_id=1&start=true
      const paramPlotId = searchParams.get('plot_id');
      const startFlag = searchParams.get('start');
      if (paramPlotId && startFlag === 'true') {
        const found = sortedPlots.find(p => p.id === Number(paramPlotId));
        setForm(prev => ({
          ...prev,
          plot_id: Number(paramPlotId),
          crop_id: found?.seed_crop_id || prev.crop_id || (fetchedCrops[0]?.id || ''),
          soil_recipe: found?.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
          soil_prep_date: found?.soil_prep_date
            ? new Date(found.soil_prep_date).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          seed_prep_date: found?.seed_prep_date
            ? new Date(found.seed_prep_date).toISOString().split('T')[0]
            : '',
          notes: found?.seed_notes || prev.notes || ''
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

  const handleTogglePlotAuto = async (plotId) => {
    try {
      const res = await api.post('/api/water/plot-auto-toggle', { plot_id: plotId });
      toast.success(res.data.message);
      setPlots(prev => prev.map(p => p.id === plotId ? { ...p, auto_water_enabled: res.data.auto_water_enabled } : p));
    } catch (err) {
      toast.error('ไม่สามารถเปลี่ยนสถานะรดน้ำอัตโนมัติของแปลงนี้ได้');
    }
  };

  const openModalWithPlot = (plotId) => {
    const found = plots.find(p => p.id === plotId);
    setForm(prev => ({
      ...prev,
      plot_id: plotId,
      crop_id: found?.seed_crop_id || prev.crop_id || (crops[0]?.id || ''),
      initial_count: '',
      planting_unit: 'ต้น',
      start_date: new Date().toISOString().split('T')[0],
      soil_prep_date: found?.soil_prep_date
        ? new Date(found.soil_prep_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      seed_prep_date: found?.seed_prep_date
        ? new Date(found.seed_prep_date).toISOString().split('T')[0]
        : '',
      notes: found?.seed_notes || '',
      soil_recipe: found?.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)'
    }));
    setShowNewModal(true);
  };

  const handleOpenAddPlotModal = () => {
    const maxNum = plots.length > 0 ? Math.max(...plots.map(p => Number(p.plot_number || p.id) || 0)) : 0;
    const nextNum = maxNum + 1;
    setAddPlotForm({
      name: `แปลง/แคร่ที่ ${nextNum}`,
      plot_number: nextNum,
      dimension: 'แคร่ 2 x 6 เมตร',
      area_sqm: 12,
      soil_recipe: 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
      water_source: 'น้ำประปา/บ่อพักน้ำมาตรฐาน GAP',
      water_source_type: 'tap',
      notes: ''
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
      targetBatch = batches.find(b => b.plot_id === plot.id && (b.status === 'growing' || b.status === 'harvest_ready'));
    }
    if (!targetBatch) {
      return toast.error('ไม่พบข้อมูลรอบการปลูกของแปลงนี้');
    }
    setEditingBatch({
      ...targetBatch,
      plot_name: plot?.name || targetBatch.plot_name
    });
    setEditForm({
      crop_id: targetBatch.crop_id || (crops[0]?.id || ''),
      initial_count: targetBatch.initial_count !== null && targetBatch.initial_count !== undefined ? targetBatch.initial_count : '',
      planting_unit: targetBatch.planting_unit || 'ต้น',
      start_date: targetBatch.start_date
        ? new Date(targetBatch.start_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      soil_prep_date: targetBatch.soil_prep_date
        ? new Date(targetBatch.soil_prep_date).toISOString().split('T')[0]
        : (plot?.soil_prep_date ? new Date(plot.soil_prep_date).toISOString().split('T')[0] : ''),
      seed_prep_date: targetBatch.seed_prep_date
        ? new Date(targetBatch.seed_prep_date).toISOString().split('T')[0]
        : '',
      soil_recipe: targetBatch.soil_recipe || plot?.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
      auto_water: Boolean(targetBatch.auto_water),
      notes: targetBatch.notes || ''
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
      targetBatch = batches.find(b => b.plot_id === plot.id && (b.status === 'growing' || b.status === 'harvest_ready'));
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
      setCancellingBatchId(targetBatch ? targetBatch.id : (plot ? plot.id : true));
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
    setSoilForm({
      plot_id: plot.id,
      plot_name: plot.name,
      soil_recipe: plot.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
      soil_prep_date: plot.soil_prep_date
        ? new Date(plot.soil_prep_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
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
        soil_prep_date: soilForm.soil_prep_date || null
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

  const handleOpenSeedModal = (plot) => {
    setSeedForm({
      plot_id: plot.id,
      plot_name: plot.name,
      seed_crop_id: plot.seed_crop_id || (crops[0]?.id || ''),
      seed_prep_date: plot.seed_prep_date
        ? new Date(plot.seed_prep_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      seed_notes: plot.seed_notes || ''
    });
    setShowSeedModal(true);
  };

  const handleSaveSeed = async (e) => {
    e.preventDefault();
    if (!seedForm.plot_id) return;
    try {
      setSavingSeed(true);
      await api.put(`/api/plots/${seedForm.plot_id}`, {
        seed_prep_date: seedForm.seed_prep_date || null,
        seed_crop_id: seedForm.seed_crop_id ? Number(seedForm.seed_crop_id) : null,
        seed_notes: seedForm.seed_notes || null
      });
      toast.success(`บันทึกการเพาะ/แช่เมล็ดของ "${seedForm.plot_name}" เรียบร้อยแล้ว!`);
      setShowSeedModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to update seed prep:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกการเพาะเมล็ด');
    } finally {
      setSavingSeed(false);
    }
  };

  const handleClearSeed = async () => {
    if (!seedForm.plot_id) return;
    if (!window.confirm(`ต้องการล้างข้อมูลการเพาะเมล็ดของ "${seedForm.plot_name}" หรือไม่?`)) return;
    try {
      setSavingSeed(true);
      await api.put(`/api/plots/${seedForm.plot_id}`, {
        seed_prep_date: null,
        seed_crop_id: null,
        seed_notes: null
      });
      toast.success(`ล้างข้อมูลการเพาะเมล็ดของ "${seedForm.plot_name}" เรียบร้อยแล้ว`);
      setShowSeedModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to clear seed prep:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการล้างข้อมูล');
    } finally {
      setSavingSeed(false);
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
              const emptyPlot = plots.find(p => p.status === 'empty' || !p.crop_name || p.crop_name === '-');
              if (emptyPlot) {
                setForm(prev => ({
                  ...prev,
                  plot_id: emptyPlot.id,
                  soil_recipe: emptyPlot.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)'
                }));
              }
              setShowNewModal(true);
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
        <div className="text-center py-16 text-slate-400 text-sm">กำลังโหลดข้อมูลแปลงปลูก 6 แคร่...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plots.map((p) => {
            const isGrowing = p.status === 'growing' && p.crop_name && p.crop_name !== '-';
            const isHarvestReady = p.status === 'harvest_ready';
            const isEmpty = !isGrowing && !isHarvestReady;

            // Find current active batch if exists
            const currentBatch = batches.find(b => b.plot_id === p.id && (b.status === 'growing' || b.status === 'harvest_ready'));
            const progressInfo = (isGrowing || isHarvestReady) ? getBatchProgressInfo(currentBatch, p) : null;
            const daysPlanted = progressInfo?.daysPlanted ?? 0;
            // อนุญาตให้แก้ไขหรือยกเลิกได้เฉพาะช่วง 2 วันแรกของการเริ่มปลูก และยังไม่พร้อมเก็บเกี่ยว เพื่อป้องกันเจ้าของกดผิด
            const isEarlyStage = !isHarvestReady && isGrowing && daysPlanted <= 2;

            return (
              <div
                key={p.id}
                className={`bg-white rounded-3xl border-2 p-5 shadow-xs flex flex-col justify-between transition-all ${
                  isHarvestReady
                    ? 'border-amber-300 ring-2 ring-amber-200/50'
                    : isGrowing
                    ? 'border-emerald-200 hover:border-emerald-400'
                    : 'border-slate-200/90 bg-slate-50/40'
                }`}
              >
                <div>
                  {/* Card Header: Plot Number & Status Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-[#173f2a] text-emerald-200 font-bold text-xs flex items-center justify-center shadow-xs">
                        #{p.plot_number || p.id}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">{p.name}</h3>
                        <p className="text-[11px] text-slate-500 font-medium">{p.dimension || 'แคร่ 2 x 6 เมตร'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                          isHarvestReady
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : isGrowing
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : (p.seed_prep_date || p.seed_crop_id)
                            ? 'bg-teal-100 text-teal-900 border-teal-300'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {isHarvestReady
                          ? '🔔 พร้อมเก็บเกี่ยว'
                          : isGrowing
                          ? '🌱 กำลังปลูก'
                          : (p.seed_prep_date || p.seed_crop_id)
                          ? '🌱 กำลังเพาะเมล็ด'
                          : 'ว่าง / พร้อมปลูก'}
                      </span>

                      {isEmpty && (
                        <button
                          type="button"
                          onClick={() => handleDeletePlot(p)}
                          disabled={deletingPlotId === p.id}
                          title={`ลบ ${p.name}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Soil Mix Recipe Box (GAP ข้อ 2) */}
                  <div className="mt-3 bg-amber-50/90 rounded-2xl p-3 border border-amber-200/80 text-xs text-amber-950">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[11px] text-amber-900 flex items-center gap-1 flex-wrap">
                        <span>สูตรดิน (GAP ข้อ 2)</span>
                        {(currentBatch?.soil_prep_date || p.soil_prep_date) && (
                          <span className="font-medium text-amber-800 text-[10px]">
                            • เตรียมเมื่อ {format(new Date(currentBatch?.soil_prep_date || p.soil_prep_date), 'dd/MM/yyyy')}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenSoilModal(p)}
                        className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100/90 hover:bg-amber-200 px-2 py-0.5 rounded-lg border border-amber-300 transition cursor-pointer active:scale-95 shrink-0"
                        title="ปรับปรุงสูตรดิน / บันทึกการเตรียมแคร่"
                      >
                        <Edit3 className="w-3 h-3 text-amber-700" />
                        <span>ปรับสูตรดิน</span>
                      </button>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-900 font-medium whitespace-pre-line line-clamp-3 hover:line-clamp-none">
                      {currentBatch?.soil_recipe || p.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)'}
                    </p>
                  </div>

                  {/* Crop Info in Plot */}
                  {isGrowing || isHarvestReady ? (
                    <div
                      className={`mt-3 rounded-2xl p-3.5 border ${
                        isHarvestReady
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-emerald-50/60 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-900">รอบปลูกปัจจุบัน:</span>
                        <span className="text-[11px] font-mono font-bold text-emerald-800 bg-white/70 px-2 py-0.5 rounded-md border border-emerald-200/60 shadow-2xs">
                          {currentBatch?.batch_code || `BATCH-P${p.plot_number || p.id}`}
                        </span>
                      </div>
                      <p className="text-base font-black text-slate-900 mt-1">{p.crop_name}</p>
                      <div className="mt-2 text-xs text-slate-600 font-medium space-y-1">
                        <div className="flex justify-between items-center">
                          <span>เริ่มปลูก:</span>
                          <span className="font-semibold text-slate-800">
                            {p.planting_date ? format(new Date(p.planting_date), 'dd/MM/yyyy') : '-'}
                            {progressInfo?.daysPlanted !== undefined && (
                              <span className="text-slate-500 font-normal ml-1">
                                (ปลูกแล้ว {progressInfo.daysPlanted} วัน)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>คาดการณ์เก็บเกี่ยว:</span>
                          <span className="font-semibold text-emerald-800">
                            {p.expected_harvest_date ? format(new Date(p.expected_harvest_date), 'dd/MM/yyyy') : '-'}
                          </span>
                        </div>
                        {currentBatch?.notes && (
                          <div className="flex justify-between items-start pt-1.5 text-[11px] border-t border-emerald-100/80">
                            <div className="shrink-0 text-slate-500 font-medium flex items-center gap-1">
                              <span>เมล็ด/ต้นน้ำ:</span>
                              {currentBatch.seed_prep_date && (
                                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/80 px-1 py-0.2 rounded border border-emerald-300">
                                  {format(new Date(currentBatch.seed_prep_date), 'dd/MM/yy')}
                                </span>
                              )}
                            </div>
                            <span className="font-semibold text-emerald-900 text-right pl-2 line-clamp-2 hover:line-clamp-none">
                              {currentBatch.notes}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Plant Counts & Survival Rate (ยอดคงเหลือ & อัตรารอด) */}
                      {(() => {
                        const init = currentBatch?.initial_count ?? p.initial_count;
                        if (init === null || init === undefined || Number(init) <= 0) return null;
                        const remaining = currentBatch?.remaining_count ?? p.remaining_count ?? init;
                        const damaged = currentBatch?.total_damaged_count ?? p.total_damaged_count ?? 0;
                        const harvested = currentBatch?.total_harvested_count ?? p.total_harvested_count ?? 0;
                        const unit = currentBatch?.planting_unit || p.planting_unit || 'ต้น';
                        const aliveAndHarvested = Math.max(0, Number(init) - Number(damaged));
                        const survivalRate = Math.max(0, Math.min(100, Math.round((aliveAndHarvested / Number(init)) * 1000) / 10));

                        return (
                          <div className="mt-3 pt-2.5 border-t border-emerald-200/70 bg-white/70 -mx-1 px-3 py-2 rounded-xl border shadow-2xs">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-bold text-slate-700 flex items-center gap-1">
                                <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                                <span>ยอดคงเหลือในแปลง</span>
                              </span>
                              <span className={`font-black px-2 py-0.5 rounded-md text-[10px] ${
                                survivalRate >= 95 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                survivalRate >= 80 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}>
                                {survivalRate >= 95 ? '💚' : '⚠️'} รอด {survivalRate}%
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="text-sm font-black text-slate-900">
                                {Number(remaining).toLocaleString()}{' '}
                                <span className="text-[11px] font-normal text-slate-500">
                                  / {Number(init).toLocaleString()} {unit}
                                </span>
                              </span>
                              <div className="flex items-center gap-1 text-[10px]">
                                {damaged > 0 && (
                                  <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                    ⚠️ เสีย {Number(damaged).toLocaleString()}
                                  </span>
                                )}
                                {harvested > 0 && (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    🧺 เก็บ {Number(harvested).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Progress Bar (ความคืบหน้ารอบปลูก) */}
                      {progressInfo && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/70">
                          <div className="flex items-center justify-between text-[11px] mb-1.5">
                            <span className="font-bold text-slate-700 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-emerald-700" />
                              <span>ความคืบหน้ารอบปลูก</span>
                            </span>
                            <span className={`font-black ${isHarvestReady ? 'text-amber-800' : 'text-emerald-800'}`}>
                              {progressInfo.percent}% {isHarvestReady ? '🔔 พร้อมเก็บเกี่ยว' : `(${progressInfo.statusLabel})`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden p-0.5 shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isHarvestReady
                                  ? 'bg-linear-to-r from-amber-400 to-amber-500 animate-pulse shadow-xs'
                                  : 'bg-linear-to-r from-emerald-500 to-teal-500 shadow-xs'
                              }`}
                              style={{ width: `${progressInfo.percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 bg-linear-to-b from-slate-50/90 to-emerald-50/30 rounded-2xl p-3 border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                          <span>เตรียมแปลงก่อนปลูก (GAP)</span>
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            (p.seed_prep_date || p.seed_crop_id)
                              ? 'bg-teal-100 text-teal-900 border-teal-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {(p.seed_prep_date || p.seed_crop_id) ? '🌱 เพาะกล้าแล้ว' : 'แปลงว่าง'}
                        </span>
                      </div>

                      {/* 2 Action Buttons Side-by-Side: เตรียมดิน & เพาะเมล็ด */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenSoilModal(p)}
                          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs"
                          title="บันทึกสูตรดิน / เตรียมแคร่ (GAP ข้อ 2)"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span className="truncate">
                            {p.soil_prep_date ? '✓ เตรียมดินแล้ว' : 'เตรียมดิน'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenSeedModal(p)}
                          className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs border ${
                            (p.seed_prep_date || p.seed_crop_id)
                              ? 'bg-teal-100 hover:bg-teal-200 text-teal-950 border-teal-300'
                              : 'bg-teal-50 hover:bg-teal-100 text-teal-900 border-teal-300'
                          }`}
                          title="บันทึกการแช่เมล็ด / เพาะกล้าล่วงหน้า (GAP ข้อ 3)"
                        >
                          <Sprout className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                          <span className="truncate">
                            {(p.seed_prep_date || p.seed_crop_id) ? '✓ เพาะเมล็ดแล้ว' : 'เพาะ/แช่เมล็ด'}
                          </span>
                        </button>
                      </div>

                      {/* Summary Box when seed is pre-recorded */}
                      {(p.seed_prep_date || p.seed_crop_id || p.seed_notes) ? (
                        <div className="bg-white rounded-xl p-2.5 border border-teal-200/80 space-y-1 text-xs shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-teal-950 text-xs">
                                🌱 {p.seed_crop_name || 'ผักเป้าหมาย'}
                              </span>
                              {p.seed_prep_date && (
                                <span className="text-[10px] text-teal-800 font-semibold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                  {format(new Date(p.seed_prep_date), 'dd/MM/yyyy')}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenSeedModal(p)}
                              className="text-[10.5px] font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer shrink-0"
                            >
                              แก้ไข
                            </button>
                          </div>
                          {p.seed_notes && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                              {p.seed_notes}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="py-2.5 px-3 text-center border border-dashed border-slate-300/80 rounded-xl bg-white/70">
                          <p className="text-xs font-bold text-slate-700">แปลงว่าง พร้อมลงรอบปลูกใหม่</p>
                          <p className="text-[10.5px] text-slate-400 mt-0.5">
                            กดปุ่มด้านล่างเพื่อเริ่มลงปลูกผักในแปลงนี้ได้ทันที
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePlotAuto(p.id)}
                    title={p.auto_water_enabled !== 0 ? 'คลิกเพื่องดรดน้ำอัตโนมัติ (เช่น เตรียมตัด/เว้นน้ำ)' : 'คลิกเพื่อเปิดโหมดรดน้ำอัตโนมัติ'}
                    className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition active:scale-95 cursor-pointer border ${
                      p.auto_water_enabled !== 0
                        ? 'bg-blue-50/90 hover:bg-blue-100 text-blue-700 border-blue-200 shadow-2xs'
                        : 'bg-amber-100/90 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-2xs'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${p.auto_water_enabled !== 0 ? 'bg-blue-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span>{p.auto_water_enabled !== 0 ? 'รดน้ำออโต้' : 'เว้นน้ำ'}</span>
                  </button>

                  {isEmpty ? (
                    <button
                      onClick={() => openModalWithPlot(p.id)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition active:scale-95 whitespace-nowrap min-h-9"
                    >
                      <Plus className="w-4 h-4" />
                      <span>ลงปลูกผักในแปลงนี้</span>
                    </button>
                  ) : isHarvestReady ? (
                    <button
                      onClick={() => navigate(`/harvest?plot_id=${p.id}&smart=true`)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-sm hover:shadow transition cursor-pointer active:scale-95 border border-amber-300 whitespace-nowrap min-h-9"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-950" />
                      <span>🧺 เก็บเกี่ยวเข้าคลัง</span>
                    </button>
                  ) : isEarlyStage ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditBatch(currentBatch, p)}
                        className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-bold border border-slate-200 transition cursor-pointer active:scale-95 whitespace-nowrap min-h-9"
                        title="แก้ไขข้อมูลรอบการปลูกนี้"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>แก้ไข</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCancelBatch(currentBatch, p)}
                        disabled={cancellingBatchId === (currentBatch?.id || p.id)}
                        className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-bold border border-slate-200 transition cursor-pointer active:scale-95 whitespace-nowrap disabled:opacity-50 min-h-9"
                        title="ยกเลิกรอบปลูกและรีเซ็ตแปลงกลับเป็นว่าง"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                        <span>ยกเลิก</span>
                      </button>
                    </div>
                  ) : isGrowing ? (
                    <button
                      onClick={() => navigate(`/harvest?plot_id=${p.id}&smart=true`)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow transition cursor-pointer active:scale-95 whitespace-nowrap min-h-9"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>เก็บเกี่ยวเข้าคลัง</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium">ดูแลตามรอบปกติ</span>
                  )}
                </div>
              </div>
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
              สร้างแคร่ที่ {plots.length > 0 ? Math.max(...plots.map(p => Number(p.plot_number || p.id) || 0)) + 1 : 1} รองรับการขยายฟาร์มตามมาตรฐาน GAP
            </p>
          </button>
        </div>
      )}

      {/* Batches Table (ประวัติรอบการปลูกทั้งหมด & GAP Tracing) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Sprout className="w-5 h-5 text-emerald-600" />
          ประวัติรอบการปลูกทั้งหมด (Planting History & GAP Tracing)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">รหัสรอบ (Batch)</th>
                <th className="py-3 px-4 font-semibold">ชนิดผัก</th>
                <th className="py-3 px-4 font-semibold">แปลงปลูก</th>
                <th className="py-3 px-4 font-semibold">วันที่เริ่มปลูก</th>
                <th className="py-3 px-4 font-semibold">วันเก็บเกี่ยว</th>
                <th className="py-3 px-4 font-semibold min-w-32.5">ความคืบหน้า</th>
                <th className="py-3 px-4 font-semibold">สถานะ</th>
                <th className="py-3 px-4 font-semibold">ระบบรดน้ำ</th>
                <th className="py-3 px-4 font-semibold text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    ยังไม่มีประวัติรอบการปลูก
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const bProg = getBatchProgressInfo(b);
                  const bIsEarlyStage = b.status === 'growing' && (bProg?.daysPlanted ?? 0) <= 2;
                  return (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.batch_code}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-emerald-800 block">{b.crop_name}</span>
                      {b.initial_count ? (
                        <span className="text-[11px] text-slate-500 font-medium block">
                          เหลือ {Number(b.remaining_count ?? b.initial_count).toLocaleString()}/{Number(b.initial_count).toLocaleString()} {b.planting_unit || 'ต้น'}
                          {b.total_damaged_count > 0 && <span className="text-rose-600 font-bold ml-1">(เสีย {b.total_damaged_count})</span>}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{b.plot_name}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {b.start_date ? format(new Date(b.start_date), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {b.actual_harvest_date
                        ? `${format(new Date(b.actual_harvest_date), 'dd/MM/yyyy')} (เก็บแล้ว)`
                        : b.expected_harvest_date
                        ? format(new Date(b.expected_harvest_date), 'dd/MM/yyyy')
                        : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {b.status === 'harvested' ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span>100%</span>
                            <span className="text-[10px] text-slate-400">เก็บเกี่ยวแล้ว</span>
                          </div>
                          <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-slate-400 h-full rounded-full w-full" />
                          </div>
                        </div>
                      ) : b.status === 'harvest_ready' ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-black text-amber-800">
                            <span>100%</span>
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-1 rounded font-bold">พร้อมตัด</span>
                          </div>
                          <div className="w-24 bg-amber-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full w-full animate-pulse" />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-emerald-800">{bProg.percent}%</span>
                            <span className="text-[10px] text-slate-500">{bProg.daysPlanted}/{bProg.growthDays} วัน</span>
                          </div>
                          <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all"
                              style={{ width: `${bProg.percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] ${
                          b.status === 'growing'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'harvest_ready'
                            ? 'bg-amber-100 text-amber-800'
                            : b.status === 'harvested'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {b.status === 'growing'
                          ? '🌱 กำลังปลูก'
                          : b.status === 'harvest_ready'
                          ? '🔔 พร้อมเก็บเกี่ยว'
                          : b.status === 'harvested'
                          ? '✓ เก็บเกี่ยวแล้ว'
                          : b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Droplets className="w-3.5 h-3.5 text-blue-500" />
                        {b.auto_water ? 'รดน้ำอัตโนมัติ' : 'แมนนวล'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(b.status === 'growing' || b.status === 'harvest_ready') ? (
                        <div className="flex items-center justify-end gap-1.5">
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
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap ${
                              b.status === 'harvest_ready'
                                ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-black'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>เก็บเกี่ยว</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">บันทึกเรียบร้อย</span>
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

      {/* Modal เริ่มรอบการปลูกใหม่ */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl max-w-xl md:max-w-2xl lg:max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 md:px-6 md:py-4 border-b border-slate-100 shrink-0 bg-white">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">เริ่มรอบการปลูกใหม่</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  บันทึกลงสมุด GAP ข้อ 4 (การจัดการคุณภาพการผลิต)
                </p>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleStartPlanting} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">เลือกแปลงปลูก (จาก {plots.length} แปลง)</label>
                    <select
                      required
                      value={form.plot_id}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const found = plots.find(p => p.id === Number(selectedId));
                        setForm(prev => ({
                          ...prev,
                          plot_id: selectedId,
                          soil_recipe: found?.soil_recipe || prev.soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)',
                          soil_prep_date: found?.soil_prep_date
                            ? new Date(found.soil_prep_date).toISOString().split('T')[0]
                            : (prev.soil_prep_date || new Date().toISOString().split('T')[0])
                        }));
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    >
                      <option value="">-- เลือกแปลง --</option>
                      {plots.map((p) => {
                        const isBusy = p.status === 'growing' || p.status === 'harvest_ready';
                        return (
                          <option key={p.id} value={p.id} disabled={isBusy}>
                            {p.name} ({p.dimension || 'แคร่ 2 x 6 เมตร'}) {isBusy ? `— กำลังปลูก (${p.crop_name})` : '— ว่าง'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">เลือกชนิดผัก</label>
                    <select
                      required
                      value={form.crop_id}
                      onChange={(e) => setForm({ ...form, crop_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    >
                      <option value="">-- เลือกชนิดผัก --</option>
                      {crops.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.category}) — โตเต็มวัย {c.growth_days} วัน
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* จำนวนต้นที่ลงปลูก */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      จำนวนที่ลงปลูก (ทางเลือก)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="เช่น 200"
                      value={form.initial_count}
                      onChange={(e) => setForm({ ...form, initial_count: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      * เช่น 200 ต้น/หลุม (ตัดยอดความเสียหายอัตโนมัติ)
                    </span>
                  </div>

                  {/* หน่วยนับ */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">หน่วยนับ</label>
                    <select
                      value={form.planting_unit}
                      onChange={(e) => setForm({ ...form, planting_unit: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    >
                      <option value="ต้น">ต้น</option>
                      <option value="หลุม">หลุม</option>
                      <option value="กรัม">กรัม</option>
                      <option value="ขีด">ขีด</option>
                    </select>
                  </div>

                  {/* วันที่เริ่มปลูก */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">วันที่เริ่มปลูก</label>
                    <input
                      type="date"
                      required
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    />
                  </div>

                  {/* ระบบรดน้ำประจำวัน */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">ระบบรดน้ำประจำวัน</label>
                    <div className="h-10.5 px-3.5 flex items-center rounded-xl bg-slate-50 border border-slate-200">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={form.auto_water}
                          onChange={(e) => setForm({ ...form, auto_water: e.target.checked })}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span>เปิดบันทึกรดน้ำอัตโนมัติ</span>
                      </label>
                    </div>
                  </div>

                  {/* สูตรดินสำหรับรอบการปลูกนี้ */}
                  <div className="md:col-span-2 bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/70 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="block text-xs font-bold text-amber-950 items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>สูตรดิน & วันที่เตรียมแคร่ (GAP ข้อ 2)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, soil_recipe: 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)' }))}
                        className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer self-start sm:self-auto"
                      >
                        + ใช้สูตรมาตรฐานฟาร์ม (กากยาง 8 กระบะ)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1 items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-600" />
                          <span>วันที่ผสมดิน</span>
                        </label>
                        <input
                          type="date"
                          value={form.soil_prep_date}
                          onChange={(e) => setForm({ ...form, soil_prep_date: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-slate-900 font-bold focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          รายละเอียดสูตรดิน
                        </label>
                        <textarea
                          rows={2}
                          value={form.soil_recipe}
                          onChange={(e) => setForm({ ...form, soil_recipe: e.target.value })}
                          placeholder="เช่น ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)"
                          className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ที่มาเมล็ดพันธุ์ & บันทึกต้นน้ำ (การแช่/เพาะเมล็ด) */}
                  <div className="md:col-span-2 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/70 space-y-3">
                    <label className="block text-xs font-bold text-emerald-950 items-center gap-1.5">
                      <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ที่มาเมล็ดพันธุ์ & บันทึกต้นน้ำ (การแช่/เพาะเมล็ด - ทางเลือก)</span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1 items-center gap-1">
                          <Calendar className="w-3 h-3 text-emerald-600" />
                          <span>วันที่เริ่มแช่/เพาะเมล็ด</span>
                        </label>
                        <input
                          type="date"
                          value={form.seed_prep_date}
                          onChange={(e) => setForm({ ...form, seed_prep_date: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-xs"
                        />
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          * เว้นว่างได้หากไม่ได้แช่
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          วิธีแช่/เพาะกล้า/ที่มาเมล็ด
                        </label>
                        <textarea
                          rows={2}
                          placeholder="เช่น แช่เมล็ดผักบุ้ง 3 ขีดในน้ำอุ่น 3 ชม. บ่มผ้า 1 คืนก่อนหว่าน, หรือเพาะกล่องทิชชู 7 วัน"
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-xs leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* Quick presets for seed notes */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-emerald-200/50">
                      <span className="text-[10.5px] text-slate-500 font-bold">ตัวอย่างคลิกใส่:</span>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          notes: 'แช่เมล็ดในน้ำอุ่น 3 ชั่วโมง เทน้ำออกแล้วบ่มผ้าหมาด 1 คืนก่อนหว่าน',
                          seed_prep_date: prev.seed_prep_date || new Date().toISOString().split('T')[0]
                        }))}
                        className="text-[10.5px] px-2 py-0.5 rounded-md bg-white hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 font-medium border border-emerald-200 cursor-pointer active:scale-95"
                      >
                        แช่น้ำอุ่น 3 ชม. บ่มผ้า 1 คืน (ผักบุ้ง)
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          notes: 'เพาะเมล็ดในกล่องทิชชู 7 วัน ก่อนย้ายลงถาดหลุม',
                          seed_prep_date: prev.seed_prep_date || new Date().toISOString().split('T')[0]
                        }))}
                        className="text-[10.5px] px-2 py-0.5 rounded-md bg-white hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 font-medium border border-emerald-200 cursor-pointer active:scale-95"
                      >
                        เพาะกล่องทิชชู 7 วัน (ผักสลัด)
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          notes: 'เพาะกล้าในถาดหลุม 15 วัน ก่อนย้ายลงแคร่ปลูก',
                          seed_prep_date: prev.seed_prep_date || new Date().toISOString().split('T')[0]
                        }))}
                        className="text-[10.5px] px-2 py-0.5 rounded-md bg-white hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 font-medium border border-emerald-200 cursor-pointer active:scale-95"
                      >
                        เพาะถาดหลุม 15 วัน
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          notes: 'หว่านเมล็ดลงแคร่ปลูกโดยตรง ไม่ต้องแช่น้ำ',
                          seed_prep_date: ''
                        }))}
                        className="text-[10.5px] px-2 py-0.5 rounded-md bg-white hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 font-medium border border-emerald-200 cursor-pointer active:scale-95"
                      >
                        หว่านลงแปลงโดยตรง
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Footer Buttons */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2.5 sm:py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {submitting ? 'กำลังบันทึก...' : '✓ เริ่มรอบการปลูก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal เพิ่มแปลง/แคร่ใหม่ */}
      {showAddPlotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl max-w-xl md:max-w-2xl lg:max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 md:px-6 md:py-4 border-b border-slate-100 shrink-0 bg-white">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">เพิ่มแปลง / แคร่ปลูกใหม่</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  ขยายพื้นที่ปลูกและกำหนดคุณลักษณะตามมาตรฐาน GAP
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPlotModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreatePlot} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">หมายเลขแคร่</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={addPlotForm.plot_number}
                      onChange={(e) => setAddPlotForm({ ...addPlotForm, plot_number: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">ชื่อแปลง / แคร่</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น แปลง/แคร่ที่ 7"
                      value={addPlotForm.name}
                      onChange={(e) => setAddPlotForm({ ...addPlotForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">ขนาดแคร่</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น แคร่ 2 x 6 เมตร"
                      value={addPlotForm.dimension}
                      onChange={(e) => setAddPlotForm({ ...addPlotForm, dimension: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">พื้นที่ (ตร.ม.)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={addPlotForm.area_sqm}
                      onChange={(e) => setAddPlotForm({ ...addPlotForm, area_sqm: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      แหล่งน้ำที่ใช้ (GAP ข้อ 3)
                    </label>
                    <input
                      type="text"
                      value={addPlotForm.water_source}
                      onChange={(e) => setAddPlotForm({ ...addPlotForm, water_source: e.target.value })}
                      placeholder="เช่น น้ำประปา/บ่อพักน้ำมาตรฐาน GAP"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">หมายเหตุเพิ่มเติม</label>
                    <input
                      type="text"
                      placeholder="เช่น ติดตั้งระบบหัวสปริงเกลอร์ใหม่"
                      value={addPlotForm.notes}
                      onChange={(e) => setAddPlotForm({ ...addPlotForm, notes: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      สูตรดินเริ่มต้น (GAP ข้อ 2)
                    </label>
                    <textarea
                      rows={2}
                      value={addPlotForm.soil_recipe}
                      onChange={(e) => setAddPlotForm({ ...addPlotForm, soil_recipe: e.target.value })}
                      placeholder="เช่น ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-xs leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Fixed Footer Buttons */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddPlotModal(false)}
                  className="flex-1 py-2.5 sm:py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={creatingPlot}
                  className="flex-1 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {creatingPlot ? 'กำลังสร้าง...' : '✓ บันทึกแปลงใหม่'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal แก้ไขข้อมูลรอบการปลูก */}
      {showEditBatchModal && editingBatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl max-w-xl md:max-w-2xl lg:max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 md:px-6 md:py-4 border-b border-slate-100 shrink-0 bg-white">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-emerald-600" />
                  แก้ไขข้อมูลรอบการปลูก
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {editingBatch.plot_name} • รหัสรอบ: <span className="font-mono font-bold text-emerald-700">{editingBatch.batch_code}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditBatchModal(false);
                  setEditingBatch(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveEditBatch} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">ชนิดผักที่ปลูก</label>
                    <select
                      required
                      value={editForm.crop_id}
                      onChange={(e) => setEditForm({ ...editForm, crop_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    >
                      {crops.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.category}) — โตเต็มวัย {c.growth_days} วัน
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      * คำนวณวันคาดการณ์เก็บเกี่ยวใหม่อัตโนมัติ
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">วันที่เริ่มปลูก</label>
                    <input
                      type="date"
                      required
                      value={editForm.start_date}
                      onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      จำนวนที่ลงปลูก (ต้น/หลุม)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="เช่น 200"
                      value={editForm.initial_count}
                      onChange={(e) => setEditForm({ ...editForm, initial_count: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      * ยอดคงเหลือจะคำนวณจากยอดนี้หักความเสียหายสะสม
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">หน่วยนับ</label>
                    <select
                      value={editForm.planting_unit}
                      onChange={(e) => setEditForm({ ...editForm, planting_unit: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm"
                    >
                      <option value="ต้น">ต้น</option>
                      <option value="หลุม">หลุม</option>
                      <option value="กรัม">กรัม</option>
                      <option value="ขีด">ขีด</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">ระบบรดน้ำประจำวัน</label>
                    <div className="h-10.5 px-3.5 flex items-center rounded-xl bg-slate-50 border border-slate-200">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={editForm.auto_water}
                          onChange={(e) => setEditForm({ ...editForm, auto_water: e.target.checked })}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span>เปิดบันทึกรดน้ำอัตโนมัติ</span>
                      </label>
                    </div>
                  </div>

                  {/* สูตรดินสำหรับรอบการปลูกนี้ */}
                  <div className="md:col-span-2 bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/70 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="block text-xs font-bold text-amber-950 items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>สูตรดิน & วันที่เตรียมแคร่ (GAP ข้อ 2)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditForm(prev => ({ ...prev, soil_recipe: 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)' }))}
                        className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer self-start sm:self-auto"
                      >
                        + ใช้สูตรมาตรฐานฟาร์ม (กากยาง 8 กระบะ)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1 items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-600" />
                          <span>วันที่ผสมดิน</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.soil_prep_date}
                          onChange={(e) => setEditForm({ ...editForm, soil_prep_date: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-slate-900 font-bold focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          รายละเอียดสูตรดิน
                        </label>
                        <textarea
                          rows={2}
                          value={editForm.soil_recipe}
                          onChange={(e) => setEditForm({ ...editForm, soil_recipe: e.target.value })}
                          placeholder="เช่น ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)"
                          className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ที่มาเมล็ดพันธุ์ & บันทึกต้นน้ำ (การแช่/เพาะเมล็ด) */}
                  <div className="md:col-span-2 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/70 space-y-3">
                    <label className="block text-xs font-bold text-emerald-950 items-center gap-1.5">
                      <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ที่มาเมล็ดพันธุ์ & บันทึกต้นน้ำ (การแช่/เพาะเมล็ด - ทางเลือก)</span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1 items-center gap-1">
                          <Calendar className="w-3 h-3 text-emerald-600" />
                          <span>วันที่เริ่มแช่/เพาะเมล็ด</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.seed_prep_date}
                          onChange={(e) => setEditForm({ ...editForm, seed_prep_date: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-xs"
                        />
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          * เว้นว่างได้หากไม่ได้แช่
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          วิธีแช่/เพาะกล้า/ที่มาเมล็ด
                        </label>
                        <textarea
                          rows={2}
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="เช่น แช่เมล็ดผักบุ้ง 3 ขีดในน้ำอุ่น 3 ชม. บ่มผ้า 1 คืนก่อนหว่าน, หรือเพาะกล่องทิชชู 7 วัน"
                          className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-xs leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* Quick presets for seed notes */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-emerald-200/50">
                      <span className="text-[10.5px] text-slate-500 font-bold">ตัวอย่างคลิกใส่:</span>
                      <button
                        type="button"
                        onClick={() => setEditForm(prev => ({
                          ...prev,
                          notes: 'แช่เมล็ดในน้ำอุ่น 3 ชั่วโมง เทน้ำออกแล้วบ่มผ้าหมาด 1 คืนก่อนหว่าน',
                          seed_prep_date: prev.seed_prep_date || new Date().toISOString().split('T')[0]
                        }))}
                        className="text-[10.5px] px-2 py-0.5 rounded-md bg-white hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 font-medium border border-emerald-200 cursor-pointer active:scale-95"
                      >
                        แช่น้ำอุ่น 3 ชม. บ่มผ้า 1 คืน (ผักบุ้ง)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditForm(prev => ({
                          ...prev,
                          notes: 'เพาะเมล็ดในกล่องทิชชู 7 วัน ก่อนย้ายลงถาดหลุม',
                          seed_prep_date: prev.seed_prep_date || new Date().toISOString().split('T')[0]
                        }))}
                        className="text-[10.5px] px-2 py-0.5 rounded-md bg-white hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 font-medium border border-emerald-200 cursor-pointer active:scale-95"
                      >
                        เพาะกล่องทิชชู 7 วัน (ผักสลัด)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditForm(prev => ({
                          ...prev,
                          notes: 'เพาะกล้าในถาดหลุม 15 วัน ก่อนย้ายลงแคร่ปลูก',
                          seed_prep_date: prev.seed_prep_date || new Date().toISOString().split('T')[0]
                        }))}
                        className="text-[10.5px] px-2 py-0.5 rounded-md bg-white hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 font-medium border border-emerald-200 cursor-pointer active:scale-95"
                      >
                        เพาะถาดหลุม 15 วัน
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Footer Buttons */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditBatchModal(false);
                    setEditingBatch(null);
                  }}
                  className="flex-1 py-2.5 sm:py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {savingEdit ? 'กำลังบันทึก...' : '💾 บันทึกการเปลี่ยนแปลง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ปรับปรุงสูตรดิน / บันทึกการเตรียมแคร่ */}
      {showSoilModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-600" />
                  ปรับปรุงสูตรดิน / การเตรียมแคร่
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {soilForm.plot_name} • มาตรฐาน GAP ข้อ 2 (การจัดการดินและวัสดุปลูก)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSoilModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveSoil} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>วันที่ผสมดิน / เตรียมแคร่</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={soilForm.soil_prep_date}
                    onChange={(e) => setSoilForm({ ...soilForm, soil_prep_date: e.target.value })}
                    className="w-full sm:w-64 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-sm"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    * ระบุวันที่เริ่มผสมดินเตรียมแปลงล่วงหน้า (เช่น วันที่ 01/02/2569)
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      รายละเอียดสูตรดิน / การผสมดินในแปลงนี้
                    </label>
                  </div>
                  <textarea
                    rows={4}
                    required
                    value={soilForm.soil_recipe}
                    onChange={(e) => setSoilForm({ ...soilForm, soil_recipe: e.target.value })}
                    placeholder="เช่น ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none text-xs sm:text-sm leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    💡 สามารถบันทึกการเตรียมดินล่วงหน้าได้ตลอดเวลา (เช่น ผสมดินกี่กระบะปูน ใส่กากยาง ขี้ไก่ วันที่ผสม) เมื่อเริ่มรอบปลูกระบบจะดึงสูตรนี้ไปใช้อัตโนมัติ
                  </p>
                </div>

                {/* สูตรแนะนำ / Quick Presets */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 space-y-2">
                  <span className="text-[11px] font-bold text-amber-900 block">
                    ⚡ เลือกสูตรมาตรฐานที่ใช้บ่อย (คลิกเพื่อแทนที่):
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSoilForm({ ...soilForm, soil_recipe: 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบต่อกระบะ)' })}
                      className="text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left"
                    >
                      🌱 สูตรมาตรฐานฟาร์ม (กากยาง 8 กระบะ)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoilForm({ ...soilForm, soil_recipe: 'หน้าดินร่วน 4 ส่วน + แกลบดำ 2 ส่วน + ปุ๋ยหมักมูลวัว 2 ส่วน หมัก 14 วันก่อนลงแปลง' })}
                      className="text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left"
                    >
                      🍂 สูตรดินหมักอินทรีย์ + แกลบดำ
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoilForm({ ...soilForm, soil_recipe: 'พักแปลงตากดิน 7 วัน โรยปูนขาวโดโลไมท์ปรับสภาพกรดด่าง ก่อนเติมปุ๋ยคอกหมัก' })}
                      className="text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left"
                    >
                      ☀️ ตากดิน + โดโลไมท์ปรับค่า pH
                    </button>
                  </div>
                </div>
              </div>

              {/* Fixed Footer Buttons */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSoilModal(false)}
                  className="flex-1 py-2.5 sm:py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={savingSoil}
                  className="flex-1 py-2.5 sm:py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {savingSoil ? 'กำลังบันทึก...' : '💾 บันทึกสูตรดินแปลงนี้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal บันทึกการเพาะเมล็ด / แช่เมล็ด / บ่มต้นกล้าล่วงหน้า (GAP ข้อ 3) */}
      {showSeedModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                  <Sprout className="w-5 h-5 text-teal-600" />
                  เพาะเมล็ด / แช่กล้าล่วงหน้า
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {seedForm.plot_name} • มาตรฐาน GAP ข้อ 3 (การจัดการเมล็ดพันธุ์และต้นกล้า)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSeedModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveSeed} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
                {/* ชนิดผักที่จะปลูก */}
                <div>
                  <label className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Sprout className="w-4 h-4 text-teal-600" />
                    <span>ชนิดผักที่ต้องการเพาะเมล็ด / ปลูก</span>
                  </label>
                  <select
                    value={seedForm.seed_crop_id}
                    onChange={(e) => setSeedForm({ ...seedForm, seed_crop_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm cursor-pointer"
                  >
                    <option value="">-- ไม่ระบุ / เลือกภายหลัง --</option>
                    {crops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.category || 'ผักใบ'} • รอบปลูก {c.growth_days || 30} วัน)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    * เมื่อกดเริ่มปลูกลงแปลง ระบบจะดึงชนิดผักนี้ไปเป็นค่าเริ่มต้นให้อัตโนมัติ
                  </p>
                </div>

                {/* วันที่เริ่มแช่เมล็ด / เพาะกล้า */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    <span>วันที่เริ่มแช่เมล็ด / เพาะกล้า</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={seedForm.seed_prep_date}
                    onChange={(e) => setSeedForm({ ...seedForm, seed_prep_date: e.target.value })}
                    className="w-full sm:w-64 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-sm"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    * ระบุวันที่เริ่มแช่น้ำอุ่น เพาะกล่อง หรือลงถาดเพาะกล้า (เช่น 05/02/2569)
                  </p>
                </div>

                {/* รายละเอียดการเพาะ / บันทึกเมล็ดพันธุ์ */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      รายละเอียดการแช่เมล็ด / การเพาะกล้า
                    </label>
                  </div>
                  <textarea
                    rows={4}
                    value={seedForm.seed_notes}
                    onChange={(e) => setSeedForm({ ...seedForm, seed_notes: e.target.value })}
                    placeholder="เช่น แช่เมล็ดผักบุ้ง 3 ขีด ในน้ำอุ่น 3 ชั่วโมง แล้วเทน้ำออก บ่มในผ้าหมาด 1 คืนก่อนนำมาหยอดลงแปลง"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none text-xs sm:text-sm leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    💡 เกษตรกรสามารถจดบันทึกปริมาณเมล็ด อุณหภูมิน้ำ หรือระยะเวลาบ่มผ้าไว้ก่อน เมื่อลงแปลงข้อมูลนี้จะถูกเก็บเป็นประวัติรอบปลูก GAP อัตโนมัติ
                  </p>
                </div>

                {/* เทมเพลตแนะนำ / Quick Presets */}
                <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-3.5 space-y-2">
                  <span className="text-[11px] font-bold text-teal-900 block">
                    ⚡ เลือกวิธีเพาะยอดนิยม (คลิกเพื่อแทนที่ข้อความ):
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSeedForm({ ...seedForm, seed_notes: 'แช่เมล็ดในน้ำอุ่น 3 ชั่วโมง เทน้ำออก ห่อผ้าหมาดบ่มไว้ 1 คืนก่อนหยอดลงแปลง' })}
                      className="text-[11px] font-semibold bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left"
                    >
                      🌱 ผักบุ้ง / เมล็ดเปลือกหนา: แช่น้ำอุ่น 3 ชม. + บ่มผ้าหมาด 1 คืน
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeedForm({ ...seedForm, seed_notes: 'เพาะในกล่องทิชชูชื้นแช่ตู้เย็น 24 ชม. แล้วย้ายลงถาดหลุมขุยมะพร้าว 14 วันก่อนลงแปลง' })}
                      className="text-[11px] font-semibold bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left"
                    >
                      🥗 ผักสลัด / กรีนโอ๊ค: เพาะกล่องทิชชู + ถาดหลุม 14 วัน
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeedForm({ ...seedForm, seed_notes: 'เพาะลงถาดหลุม 104 หลุม ใช้วัสดุเพาะพีทมอส รอต้นกล้าอายุ 15-20 วัน มีใบจริง 3-4 ใบก่อนย้ายปลูก' })}
                      className="text-[11px] font-semibold bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left"
                    >
                      🥦 คะน้า / เคล / กะหล่ำ: ถาดหลุมพีทมอส 15-20 วัน
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeedForm({ ...seedForm, seed_notes: 'แช่น้ำสะอาด 4 ชั่วโมง หว่านลงกระบะเพาะกล้า รดน้ำชุ่มเช้า-เย็น รอ 7 วัน' })}
                      className="text-[11px] font-semibold bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left"
                    >
                      🥬 กวางตุ้ง / ผักกาด: แช่น้ำ 4 ชม. + กระบะเพาะ 7 วัน
                    </button>
                  </div>
                </div>
              </div>

              {/* Fixed Footer Buttons */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2.5 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={handleClearSeed}
                  disabled={savingSeed}
                  className="px-3.5 py-2.5 sm:py-3 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold text-xs sm:text-sm cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
                  title="ล้างข้อมูลการเพาะเมล็ดออกจากแปลงนี้"
                >
                  ล้างข้อมูล
                </button>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowSeedModal(false)}
                    className="px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={savingSeed}
                    className="px-5 py-2.5 sm:py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs sm:text-sm shadow-md shadow-teal-600/20 disabled:opacity-50 cursor-pointer transition-colors active:scale-95"
                  >
                    {savingSeed ? 'กำลังบันทึก...' : '💾 บันทึกการเพาะเมล็ด'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
