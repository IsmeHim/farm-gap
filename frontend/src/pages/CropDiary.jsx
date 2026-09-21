import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  BookOpen,
  Plus,
  Calendar,
  Sparkles,
  Layers,
  FileText,
  Printer,
  Trash2,
  Pencil,
  Shovel,
  Droplets,
  Sprout,
  Leaf,
  Clock,
  User,
  Package,
  Info,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Image as ImageIcon,
  FileSpreadsheet
} from 'lucide-react';

const STAGE_CONFIG = {
  soil_prep: {
    label: 'เตรียมดิน / แคร่',
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    badge: 'bg-amber-500',
    icon: Shovel,
    desc: 'ผสมดิน, ใส่กากยาง, ปุ๋ยคอก, ปรับปรุงโครงสร้างดิน'
  },
  seed_nursery: {
    label: 'แช่เมล็ด / เพาะกล้า',
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    badge: 'bg-purple-500',
    icon: Sprout,
    desc: 'แช่น้ำอุ่น, บ่มทิชชู, หยอดถาดหลุม 200 หลุม, พีทมอส'
  },
  planting: {
    label: 'ย้ายปลูก / หว่าน',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    badge: 'bg-emerald-500',
    icon: Sprout,
    desc: 'ย้ายต้นกล้าลงแคร่ หรือหว่านเมล็ดลงแปลง'
  },
  maintenance: {
    label: 'ดูแล / ให้น้ำ',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    badge: 'bg-blue-500',
    icon: Droplets,
    desc: 'รดน้ำเช้า-เที่ยง-เย็น, พรวนดิน, ถอนวัชพืช'
  },
  fertilizing: {
    label: 'บำรุง / น้ำหมัก',
    color: 'bg-teal-100 text-teal-800 border-teal-300',
    badge: 'bg-teal-500',
    icon: Droplets,
    desc: 'น้ำหมักสับปะรด, จุลินทรีย์สังเคราะห์แสง (PSB), ปุ๋ยขี้ไก่'
  },
  harvest: {
    label: 'เก็บเกี่ยว / บรรจุ',
    color: 'bg-green-100 text-green-800 border-green-300',
    badge: 'bg-green-600',
    icon: Leaf,
    desc: 'ถอนผลผลิต, ล้างทำความสะอาด, บรรจุถุงส่งจำหน่าย'
  }
};

const PRESETS = [
  {
    id: 'seed_soak',
    name: '🌰 1. แช่เมล็ด / บ่มทิชชู',
    subtitle: 'แช่น้ำอุ่น 3 ชม. + บ่ม 7 วัน',
    stage: 'seed_nursery',
    title: 'แช่เมล็ดพันธุ์ในน้ำอุ่น & บ่มงอกด้วยทิชชู',
    materials_used: 'เมล็ดพันธุ์ 3 ขีด, กระดาษทิชชู, กล่องบ่มปิดสนิท, น้ำอุ่น',
    details: 'แช่เมล็ดผัก 3 ขีดในน้ำอุ่นอุณหภูมิประมาณ 40-50°C นาน 3 ชั่วโมง แล้วเทน้ำออกให้พอหมาดๆ นำมาวางกระจายบนกระดาษทิชชูชื้นในกล่องปิดสนิท บ่มทิ้งไว้ 7 วันจนเมล็ดเริ่มแตกตุ่มรากสีขาว',
    water_frequency: 'พ่นละอองน้ำรักษาความชื้นทุก 2-3 วัน',
    notes: 'อัตราการงอกสูง แข็งแรงก่อนหยอดลงถาดหลุม'
  },
  {
    id: 'seed_tray',
    name: '🌱 2. ถาดหลุม 200 หลุม',
    subtitle: 'พีทมอส + อนุบาล 14-15 วัน',
    stage: 'seed_nursery',
    title: 'หยอดเมล็ดลงถาดเพาะ 200 หลุม + พีทมอส',
    materials_used: 'ถาดหลุม 200 หลุม, พีทมอสคุณภาพสูง, มีดปลายแหลมสำหรับจิ้มหลุม',
    details: 'ใส่พีทมอสลงถาดหลุม 200 หลุม ใช้มีดจิ้มเปิดหลุมเล็กน้อย นำเมล็ดที่ผ่านการบ่มจนรากงอกยอดหยอดลงหลุมละ 1-2 เมล็ด รดน้ำเช้า-เที่ยง-เย็น อนุบาลต้นกล้าเป็นเวลา 14-15 วันในโรงเรือนพรางแสง',
    water_frequency: 'รดน้ำเช้า - เที่ยง - เย็น ทุกวัน',
    notes: 'ต้นกล้าโตสม่ำเสมอ แข็งแรงพร้อมย้ายลงแคร่'
  },
  {
    id: 'soil_bed',
    name: '🪴 3. ผสมดินเตรียมแคร่',
    subtitle: 'กากยาง 2 + ขี้ไก่ 0.5 (8 กระบะ)',
    stage: 'soil_prep',
    title: 'ผสมดินในกระบะปูน เตรียมแคร่ปลูก 2x6 เมตร',
    materials_used: 'กากยางพัฒนาที่ดิน 2 กระสอบ, ปุ๋ยขี้ไก่ 0.5 กระสอบ ต่อกระบะปูน (รวม 8 กระบะ/แคร่)',
    details: 'ผสมดินในกระบะปูน: กากยางที่พัฒนาที่ดินนำมาให้ ผสมกากยาง 2 กระสอบ + ขี้ไก่ 1/2 กระสอบ ต่อ 1 กระบะปูน ผสมดิน 8 กระบะปูนได้ 1 แคร่ (แคร่ขนาด 2 x 6 เมตร) คลุกเคล้าให้เข้ากันและเกลี่ยลงแปลง',
    water_frequency: 'รดน้ำให้ชุ่มชื้นก่อนลงปลูก',
    notes: 'บันทึกตามมาตรฐาน GAP การเตรียมแปลงปลูกไร้สารปนเปื้อน'
  },
  {
    id: 'transplant',
    name: '🚜 4. ย้ายปลูกลงแคร่',
    subtitle: 'ย้ายต้นกล้าอายุ 14 วัน',
    stage: 'planting',
    title: 'ย้ายต้นกล้าลงแคร่ปลูก / แปลงปลูก',
    materials_used: 'ต้นกล้าอายุ 14 วัน, บัวรดน้ำ, สแลนพรางแสง',
    details: 'ย้ายต้นกล้าที่อนุบาลครบ 14 วันจากถาดหลุมลงแคร่ปลูกขนาด 2x6 เมตร ระยะห่างเหมาะสม รดน้ำตามทันทีให้ดินกระชับรอบราก คลุมสแลนพรางแสงแดดจัดใน 2-3 วันแรก',
    water_frequency: 'รดน้ำเช้าและเย็น',
    notes: 'ต้นกล้าปรับตัวได้ดี ไม่เฉา'
  },
  {
    id: 'bio_extract',
    name: '💧 5. บำรุงน้ำหมัก & PSB',
    subtitle: 'สับปะรด + จุลินทรีย์สังเคราะห์แสง',
    stage: 'fertilizing',
    title: 'รดน้ำหมักสับปะรดสลับกับจุลินทรีย์สังเคราะห์แสง (PSB)',
    materials_used: 'น้ำหมักชีวภาพสับปะรด, จุลินทรีย์สังเคราะห์แสง (PSB), น้ำสะอาด',
    details: 'รดน้ำหมักชีวภาพสับปะรดสลับกับจุลินทรีย์สังเคราะห์แสง (PSB) อัตราส่วน 50cc ต่อน้ำ 20 ลิตร รดบำรุงทางดินและพ่นทางใบทุก 3 วัน ช่วยเร่งรากและใบเขียวสด ปลอดสารพิษ 100%',
    water_frequency: '',
    notes: 'GAP มาตรฐานปุ๋ยชีวภาพและการงดเว้นเคมี'
  },
  {
    id: 'organic_fert',
    name: '💩 6. ใส่ปุ๋ยขี้ไก่บำรุง',
    subtitle: '3 ถังปูน โรยรอบทรงพุ่ม',
    stage: 'fertilizing',
    title: 'ใส่ปุ๋ยขี้ไก่แห้งบำรุงแคร่ปลูก',
    materials_used: 'ปุ๋ยขี้ไก่ผ่านการหมัก 3 ถังปูน',
    details: 'โรยปุ๋ยขี้ไก่แห้ง 3 ถังปูนกระจายทั่วแปลง/แคร่ ห่างจากโคนต้นเล็กน้อย พรวนดินเบาๆ แล้วรดน้ำตามทันที',
    water_frequency: '',
    notes: 'เสริมธาตุอาหารไนโตรเจนอินทรีย์'
  },
  {
    id: 'harvest_pack',
    name: '🥬 7. เก็บเกี่ยว & คัดบรรจุ',
    subtitle: 'ล้างสะอาด บรรจุถุง 4 ขีด 20 บ.',
    stage: 'harvest',
    title: 'เก็บเกี่ยวผลผลิต คัดเกรด และบรรจุถุงส่งจำหน่าย',
    materials_used: 'ถุงใสขนาด 7x24 หรือ 9x18 นิ้ว, ตราชั่ง, ตะกร้าเก็บผลผลิต',
    details: 'ถอนเก็บเกี่ยวช่วงเช้าตรู่ ล้างทำความสะอาดรากและใบ ตัดแต่งใบเหลือง คัดเกรดคุณภาพ บรรจุถุงใสถุงละ 4 ขีด (400 กรัม) จำหน่ายถุงละ 20 บาท พร้อมติดสติกเกอร์ QR GAP',
    water_frequency: '',
    notes: 'ปฏิบัติตามมาตรฐานสุขอนามัย GAP หลังการเก็บเกี่ยว'
  }
];

export const getTodayLocalDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateDisplay = (val) => {
  if (!val) return '-';
  if (typeof val === 'string') {
    const clean = val.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  try {
    return format(new Date(val), 'dd/MM/yyyy');
  } catch {
    return String(val);
  }
};

export default function CropDiary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plots, setPlots] = useState([]);
  const [selectedPlotId, setSelectedPlotId] = useState('');
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const getInitialForm = () => ({
    activity_date: getTodayLocalDate(),
    stage: 'soil_prep',
    title: '',
    materials_used: '',
    details: '',
    water_frequency: '',
    operator_name: user?.display_name || 'เจ้าของฟาร์ม',
    image_url: '',
    notes: ''
  });

  const [formData, setFormData] = useState(getInitialForm());

  useEffect(() => {
    loadPlots();
  }, []);

  useEffect(() => {
    if (selectedPlotId) {
      loadCycles(selectedPlotId);
    } else {
      setCycles([]);
      setSelectedCycleId('');
    }
  }, [selectedPlotId]);

  useEffect(() => {
    if (selectedPlotId) {
      loadActivities();
    } else {
      setActivities([]);
    }
  }, [selectedPlotId, selectedCycleId]);

  const loadPlots = async () => {
    try {
      const res = await api.get('/api/plots');
      setPlots(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedPlotId(res.data[0].id.toString());
      }
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถโหลดแปลงปลูกได้');
    }
  };

  const loadCycles = async (plotId) => {
    try {
      const res = await api.get('/api/diary/cycles', { params: { plot_id: plotId } });
      setCycles(res.data || []);
      if (res.data && res.data.length > 0) {
        // Default to the first (latest) cycle
        setSelectedCycleId(res.data[0].id.toString());
      } else {
        setSelectedCycleId('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadActivities = async () => {
    if (!selectedPlotId) return;
    setLoading(true);
    try {
      const params = { plot_id: selectedPlotId };
      if (selectedCycleId) params.cycle_id = selectedCycleId;
      const res = await api.get('/api/diary', { params });
      setActivities(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('โหลดข้อมูลไดอารี่ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const currentPlot = plots.find(p => p.id.toString() === selectedPlotId);
  const currentCycle = cycles.find(c => c.id.toString() === selectedCycleId);

  const applyPreset = (preset) => {
    setFormData({
      ...formData,
      activity_date: getTodayLocalDate(),
      stage: preset.stage,
      title: preset.title,
      materials_used: preset.materials_used,
      details: preset.details,
      water_frequency: preset.water_frequency,
      notes: preset.notes,
      operator_name: formData.operator_name || 'เจ้าของฟาร์ม'
    });
    setEditingId(null);
    setShowModal(true);
  };

  const handleOpenAdd = () => {
    setFormData(getInitialForm());
    setEditingId(null);
    setShowModal(true);
  };

  const handleEdit = (act) => {
    setEditingId(act.id);
    let dateStr = '';
    if (act.activity_date) {
      dateStr = typeof act.activity_date === 'string'
        ? act.activity_date.split('T')[0]
        : format(new Date(act.activity_date), 'yyyy-MM-dd');
    }
    setFormData({
      activity_date: dateStr || getTodayLocalDate(),
      stage: act.stage || 'soil_prep',
      title: act.title || '',
      materials_used: act.materials_used || '',
      details: act.details || '',
      water_frequency: act.water_frequency || '',
      operator_name: act.operator_name || '',
      image_url: act.image_url || '',
      notes: act.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('ยืนยันลบบันทึกนี้หรือไม่?\n(ข้อมูลที่ระบบซิงค์ไปตาราง ปุ๋ย/น้ำ/เก็บเกี่ยว GAP จะถูกลบออกด้วยอัตโนมัติ)')) return;
    try {
      const res = await api.delete(`/api/diary/${id}`);
      toast.success(res.data?.message || 'ลบบันทึกและข้อมูลเชื่อมโยงเรียบร้อยแล้ว');
      loadActivities();
    } catch (err) {
      console.error(err);
      toast.error('ลบไม่สำเร็จ');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.activity_date) {
      toast.error('กรุณาระบุหัวข้อและวันที่');
      return;
    }

    try {
      const payload = {
        plot_id: parseInt(selectedPlotId, 10),
        cycle_id: selectedCycleId ? parseInt(selectedCycleId, 10) : null,
        ...formData
      };

      if (editingId) {
        await api.put(`/api/diary/${editingId}`, payload);
        toast.success('อัปเดตบันทึกเรียบร้อย');
      } else {
        await api.post('/api/diary', payload);
        toast.success('เพิ่มบันทึกไดอารี่สำเร็จ');
      }

      setShowModal(false);
      loadActivities();
    } catch (err) {
      console.error(err);
      toast.error('บันทึกข้อมูลไม่สำเร็จ');
    }
  };

  // Calculate day difference from cycle planting date
  const getDayLabel = (actDate) => {
    const baseDate = currentCycle?.planting_date || currentPlot?.planting_date;
    if (!baseDate || !actDate) return null;
    const d1 = new Date(baseDate);
    const d2 = new Date(actDate);
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'วันที่ 1 (เริ่มปลูก)';
    if (diff > 0) return `วันที่ ${diff + 1} (+${diff} วัน)`;
    return `${diff} วันก่อนปลูก`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 rounded-2xl shadow-md">
        <div>
          <div className="flex items-center gap-2 text-emerald-200 text-sm font-medium mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Farm GAP Standard • Smart Crop Timeline</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight">
            ไดอารี่รอบการปลูก & บันทึกต้นน้ำ (Crop Diary)
          </h1>
          <p className="text-emerald-100 text-sm mt-1 max-w-2xl">
            บันทึกการทำงานจริงตั้งแต่เตรียมดิน แช่เมล็ด บ่มทิชชู เพาะกล้าถาดหลุม ให้น้ำหมัก/PSB จนถึงเก็บเกี่ยว ส่งตรงถึงผู้บริโภคผ่าน QR GAP
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/report')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-semibold transition backdrop-blur-sm"
            title="เปิดดูเล่มรายงาน GAP ประจำปีฉบับทางการรวมทุกหมวด และดาวน์โหลด PDF"
          >
            <FileText className="w-4 h-4 text-[#f4d27a]" />
            <span>ดูเล่มรายงาน GAP รวม (Export PDF)</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#f4d27a] hover:bg-[#eac461] text-[#173f2a] rounded-xl text-sm font-bold shadow-lg shadow-black/10 transition"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มบันทึกใหม่</span>
          </button>
        </div>
      </div>

      {/* Auto-Sync Reassurance Banner */}
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 px-4 flex items-center justify-between text-xs text-emerald-900 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div>
            <span className="font-bold">บันทึกเฉพาะ 5 เหตุการณ์สำคัญ (Zero Duplicate Work):</span>{' '}
            <span className="text-emerald-800">
              ไดอารี่ใช้บันทึกเฉพาะเหตุการณ์สำคัญ (แช่เมล็ด, ถาดหลุม, ผสมดิน, ย้ายกล้า, ให้น้ำหมัก/ปุ๋ย) และจะซิงค์เข้าตารางปุ๋ย GAP #3 และผลผลิตให้อัตโนมัติ — เจ้าของฟาร์มไม่ต้องบันทึกรดน้ำรายวันซ้ำซ้อนในหน้านี้ เพราะหน้า &quot;ระบบน้ำ&quot; บันทึกแยกให้อัตโนมัติอยู่แล้ว
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate('/report')}
          className="hidden sm:inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900 underline whitespace-nowrap ml-4 text-[11px]"
        >
          ตรวจสอบในเล่มรายงาน GAP &rarr;
        </button>
      </div>

      {/* Filter Bar: Plot & Cycle Selection */}
      <div className="surface rounded-2xl p-4 border border-emerald-100 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {/* Plot Selector */}
          <div className="flex items-center gap-2 min-w-[220px]">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">แปลง:</span>
            <select
              value={selectedPlotId}
              onChange={(e) => setSelectedPlotId(e.target.value)}
              className="flex-1 bg-emerald-50/60 border border-emerald-200 text-emerald-950 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.crop_name})
                </option>
              ))}
            </select>
          </div>

          {/* Cycle Selector */}
          <div className="flex items-center gap-2 min-w-[260px]">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">รอบปลูก:</span>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="flex-1 bg-emerald-50/60 border border-emerald-200 text-emerald-950 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">ทั้งหมดในแปลงนี้</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  รอบที่ {c.cycle_number} ({c.cycle_code || `BATCH-R${c.cycle_number}`}) • {c.crop_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Plot/Cycle Badge */}
        {currentPlot && (
          <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 text-xs">
            <div>
              <span className="text-gray-500">พืช:</span>{' '}
              <span className="font-bold text-emerald-900">{currentPlot.crop_name}</span>
            </div>
            <div className="h-4 w-px bg-emerald-200" />
            <div>
              <span className="text-gray-500">วันปลูก:</span>{' '}
              <span className="font-semibold text-emerald-900">
                {formatDateDisplay(currentPlot.planting_date)}
              </span>
            </div>
            {currentCycle && (
              <>
                <div className="h-4 w-px bg-emerald-200" />
                <span className="px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-600 text-white text-[11px]">
                  {currentCycle.cycle_code || `R${currentCycle.cycle_number}`}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick Action Presets (Farmer Notebook Templates) */}
      <div className="surface rounded-2xl p-5 border border-emerald-100 shadow-sm bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-bold text-gray-800">
              บันทึกด่วนตามขั้นตอนจริง (Quick Presets)
            </h2>
            <span className="text-xs bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-full font-medium border border-amber-200">
              กดแล้วกรอกอัตโนมัติ 1-Click
            </span>
          </div>
          <span className="text-xs text-gray-400">อิงตามสมุดจดจริงของเกษตรกร</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 pt-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className="flex flex-col items-start text-left p-3 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition group relative overflow-hidden"
            >
              <div className="font-bold text-xs text-gray-800 group-hover:text-emerald-800">
                {p.name}
              </div>
              <div className="text-[10px] text-gray-500 mt-1 line-clamp-1">
                {p.subtitle}
              </div>
              <div className="mt-2 text-[10px] text-emerald-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>บันทึก</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Section */}
      <div className="surface rounded-2xl p-6 border border-emerald-100 shadow-sm bg-white">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-gray-800">
              ไทม์ไลน์บันทึกการเติบโต ({activities.length} รายการ)
            </h3>
          </div>
          <button
            onClick={loadActivities}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>รีเฟรช</span>
          </button>
        </div>

        {activities.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-gray-800 text-base mb-1">ยังไม่มีบันทึกกิจกรรมสำหรับรอบปลูกนี้</h4>
            <p className="text-gray-500 text-xs max-w-md mx-auto mb-4">
              คลิกเลือก "บันทึกด่วน" ด้านบน หรือกดปุ่ม "เพิ่มบันทึกใหม่" เพื่อเริ่มจดบันทึกตั้งแต่เตรียมดินจนถึงเก็บเกี่ยว
            </p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>เริ่มบันทึกแรก</span>
            </button>
          </div>
        ) : (
          <div className="relative pl-6 md:pl-8 border-l-2 border-emerald-200 space-y-8 ml-3 md:ml-4 my-2">
            {activities.map((act) => {
              const stageInfo = STAGE_CONFIG[act.stage] || STAGE_CONFIG.soil_prep;
              const StageIcon = stageInfo.icon;
              const dayLabel = getDayLabel(act.activity_date);

              return (
                <div key={act.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-[35px] md:-left-[43px] top-1.5 w-8 h-8 md:w-9 md:h-9 rounded-full ${stageInfo.badge} text-white flex items-center justify-center ring-4 ring-white shadow-md`}
                  >
                    <StageIcon className="w-4 h-4 md:w-5 md:h-5" />
                  </div>

                  {/* Activity Card */}
                  <div className="bg-[#fafbf8] border border-emerald-100/80 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-md transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${stageInfo.color}`}>
                          {stageInfo.label}
                        </span>
                        {dayLabel && (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {dayLabel}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {formatDateDisplay(act.activity_date)}
                        </span>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center gap-1 self-end sm:self-auto opacity-80 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleEdit(act)}
                          className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="แก้ไข"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(act.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="text-base font-bold text-gray-900 mb-2">{act.title}</h4>

                    {/* Materials Tag */}
                    {act.materials_used && (
                      <div className="mb-2.5 flex items-start gap-1.5 text-xs bg-amber-50/80 text-amber-900 border border-amber-200/80 px-3 py-1.5 rounded-xl">
                        <Package className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">วัสดุ/สารที่ใช้:</span> {act.materials_used}
                        </div>
                      </div>
                    )}

                    {/* Details */}
                    {act.details && (
                      <p className="text-xs sm:text-sm text-gray-700 leading-relaxed bg-white p-3 rounded-xl border border-gray-100 mb-3 whitespace-pre-line">
                        {act.details}
                      </p>
                    )}

                    {/* Footer Info: Water / Operator / Notes */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                      {act.water_frequency && (
                        <div className="flex items-center gap-1 text-blue-700 font-medium">
                          <Droplets className="w-3.5 h-3.5" />
                          <span>{act.water_frequency}</span>
                        </div>
                      )}
                      {act.operator_name && (
                        <div className="flex items-center gap-1 text-gray-600 font-medium">
                          <User className="w-3.5 h-3.5" />
                          <span>ผู้ปฏิบัติงาน: {act.operator_name}</span>
                        </div>
                      )}
                      {act.notes && (
                        <div className="flex items-center gap-1 text-gray-500 italic">
                          <Info className="w-3.5 h-3.5" />
                          <span>{act.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add/Edit Activity */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-emerald-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingId ? 'แก้ไขบันทึกกิจกรรม' : 'เพิ่มบันทึกไดอารี่รอบปลูก'}
                </h3>
                <p className="text-xs text-gray-500">
                  แปลง: {currentPlot?.name} ({currentPlot?.crop_name})
                  {currentCycle && ` • รอบที่ ${currentCycle.cycle_number}`}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    วันที่ปฏิบัติงาน *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.activity_date}
                    onChange={(e) => setFormData({ ...formData, activity_date: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {/* Stage */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    ขั้นตอน (Stage) *
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {Object.entries(STAGE_CONFIG).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  หัวข้อกิจกรรม *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ผสมดินในกระบะปูน, แช่เมล็ดผักบุ้ง 3 ชั่วโมง"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Materials Used */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  วัสดุ / อุปกรณ์ / ปุ๋ยอินทรีย์ที่ใช้
                </label>
                <input
                  type="text"
                  placeholder="เช่น กากยางพัฒนาที่ดิน 2 กระสอบ, ขี้ไก่ 0.5 กระสอบ, พีทมอส"
                  value={formData.materials_used}
                  onChange={(e) => setFormData({ ...formData, materials_used: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Details */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  รายละเอียดการปฏิบัติงาน
                </label>
                <textarea
                  rows="4"
                  placeholder="ระบุสัดส่วน, วิธีการทำ, หรือการสังเกตผล..."
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Frequency / Water details */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {['maintenance', 'planting', 'seed_nursery'].includes(formData.stage)
                      ? 'การให้น้ำ / ความถี่ (ถ้ามี)'
                      : 'ความถี่การปฏิบัติงาน (ถ้ามี)'}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      ['maintenance', 'planting', 'seed_nursery'].includes(formData.stage)
                        ? 'เช่น รดน้ำเช้า-เที่ยง-เย็น'
                        : 'เช่น ทุก 3 วัน, ให้ครั้งเดียว'
                    }
                    value={formData.water_frequency}
                    onChange={(e) => setFormData({ ...formData, water_frequency: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {/* Operator Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    ผู้ปฏิบัติงาน
                  </label>
                  <input
                    type="text"
                    placeholder={`เช่น ${user?.display_name || 'เจ้าของฟาร์ม'}`}
                    value={formData.operator_name}
                    onChange={(e) => setFormData({ ...formData, operator_name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  หมายเหตุเพิ่มเติม / สอดคล้อง GAP
                </label>
                <input
                  type="text"
                  placeholder="เช่น ปฏิบัติตามมาตรฐาน GAP ไร้สารตกค้าง"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-xs font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  {editingId ? 'บันทึกการเปลี่ยนแปลง' : 'ยืนยันเพิ่มบันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
