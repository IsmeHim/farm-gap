import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import LogManager from '../components/LogManager.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import { toast } from 'sonner';
import {
  Droplets,
  CheckCircle2,
  Zap,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Sun,
  Moon,
  CloudRain,
  Settings,
  Calendar as CalendarIcon,
  List,
  FileText,
  ShieldCheck,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  Leaf,
  Info,
  Plus,
  Trash2,
  Eye,
  Search,
  Filter,
} from 'lucide-react';
import { getCropCycleId } from '../lib/cropCycle.js';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { th } from 'date-fns/locale';

export default function Water() {
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'table'
  const [selectedSession, setSelectedSession] = useState('เช้า'); // 'เช้า' | 'เย็น'
  const [todayStatus, setTodayStatus] = useState({
    morningPlotIds: [],
    eveningPlotIds: [],
    wateredPlotIds: [],
    logs: [],
    climate_condition: 'normal',
    isExpired: false,
    daysRemaining: null,
  });
  const [settings, setSettings] = useState({
    auto_routine_enabled: true,
    auto_mode_type: 'until_harvest',
    auto_until_date: '',
    morning_time: '07:00',
    evening_time: '16:30',
    climate_condition: 'normal',
    water_source: 'น้ำสะอาดมาตรฐาน GAP',
  });
  const [plots, setPlots] = useState([]);
  const [cycleSummaries, setCycleSummaries] = useState([]);
  const [calendarLogs, setCalendarLogs] = useState([]);
  const [loadingAction, setLoadingAction] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const { user } = useAuth();
  const [dailyLogs, setDailyLogs] = useState([]);
  const [tableSubTab, setTableSubTab] = useState('daily'); // 'daily' | 'detailed'
  const [searchDaily, setSearchDaily] = useState('');
  const [deleteConfirmDate, setDeleteConfirmDate] = useState(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    log_date: format(new Date(), 'yyyy-MM-dd'),
    sessions: ['เช้า', 'เย็น'],
    plot_ids: [],
    water_source: 'น้ำสะอาดมาตรฐาน GAP',
    climate_condition: 'normal',
    notes: '',
    worker_name: '',
  });

  // Settings Modal & Day Detail Modal
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState(settings);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Default to afternoon/evening session if current time >= 13:00
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 13) {
      setSelectedSession('เย็น');
    } else {
      setSelectedSession('เช้า');
    }
  }, []);

  // Fetch all water status, cycle summaries, and calendar logs
  const fetchAllData = useCallback(async () => {
    try {
      const [stRes, plRes, setRes, sumRes, calRes, dailyRes] = await Promise.all([
        api.get('/api/water/today-status'),
        api.get('/api/plots'),
        api.get('/api/water/settings'),
        api.get('/api/water/cycle-summary'),
        api.get('/api/water/calendar-logs'),
        api.get('/api/water/daily-table'),
      ]);
      setTodayStatus(stRes.data);
      setPlots(plRes.data);
      if (setRes.data) {
        setSettings(setRes.data);
        setSettingsForm({
          ...setRes.data,
          auto_until_date: setRes.data.auto_until_date ? String(setRes.data.auto_until_date).split('T')[0] : '',
        });
      }
      setCycleSummaries(sumRes.data || []);
      setCalendarLogs(calRes.data || []);
      setDailyLogs(dailyRes.data || []);
    } catch (e) {
      console.warn('Failed to load water data:', e.message);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData, reloadKey]);

  // Active and growing plots
  const activePlots = plots.filter(p => p.status === 'active' || p.status === 'growing' || p.status === 'harvest_ready');
  const enabledPlots = activePlots.filter(p => p.auto_water_enabled !== 0);
  const pausedPlots = activePlots.filter(p => p.auto_water_enabled === 0);

  const morningSet = new Set(todayStatus.morningPlotIds || []);
  const eveningSet = new Set(todayStatus.eveningPlotIds || []);

  const currentSet = selectedSession === 'เย็น' ? eveningSet : morningSet;
  const wateredCount = activePlots.filter(p => currentSet.has(p.id)).length;
  const enabledWateredCount = enabledPlots.filter(p => currentSet.has(p.id)).length;
  const isCurrentSessionCompleted = enabledPlots.length > 0
    ? enabledWateredCount === enabledPlots.length
    : activePlots.length > 0 && wateredCount === activePlots.length;

  const morningCount = activePlots.filter(p => morningSet.has(p.id)).length;
  const eveningCount = activePlots.filter(p => eveningSet.has(p.id)).length;

  // 1-Click Toggle Plot Auto-Watering
  const handleTogglePlotAuto = async (plotId) => {
    try {
      const res = await api.post('/api/water/plot-auto-toggle', { plot_id: plotId });
      toast.success(res.data.message);
      setReloadKey(k => k + 1);
    } catch (err) {
      toast.error('ไม่สามารถเปลี่ยนสถานะรดน้ำอัตโนมัติของแปลงนี้ได้');
    }
  };

  // 1-Click Climate Quick Toggle
  const handleClimateToggle = async (newCondition) => {
    try {
      await api.post('/api/water/climate-toggle', { climate_condition: newCondition });
      toast.success(
        newCondition === 'rainy_humidity'
          ? '🌧️ สภาพอากาศ: ฝนตก/ความชื้นสูง (ระบบจะปรับบันทึกเป็นการรดควบคุมความชื้น GAP)'
          : '☀️ สภาพอากาศ: แดดจัดปกติ (รดน้ำรอบมาตรฐานสมบูรณ์ 100%)'
      );
      setReloadKey(k => k + 1);
    } catch (err) {
      toast.error('ไม่สามารถเปลี่ยนสภาพอากาศได้');
    }
  };

  // 1-Click Toggle Auto-Routine Mode
  const handleToggleAuto = async () => {
    setLoadingAction(true);
    try {
      const newEnabled = !settings.auto_routine_enabled;
      const res = await api.post('/api/water/toggle-auto', { enabled: newEnabled });
      if (res.data.settings) {
        setSettings(res.data.settings);
        setSettingsForm({
          ...res.data.settings,
          auto_until_date: res.data.settings.auto_until_date ? String(res.data.settings.auto_until_date).split('T')[0] : '',
        });
      }
      toast.success(
        newEnabled
          ? '🟢 เปิดโหมดรดน้ำอัตโนมัติแล้ว! ระบบจะบันทึกน้ำสะอาด GAP ให้อัตโนมัติตามรอบเวลา'
          : '⚪ ปิดโหมดรดน้ำอัตโนมัติแล้ว (เปลี่ยนเป็นโหมดควบคุมด้วยตนเอง)'
      );
      setReloadKey(k => k + 1);
    } catch (err) {
      toast.error('ไม่สามารถเปลี่ยนสถานะโหมดอัตโนมัติได้');
    } finally {
      setLoadingAction(false);
    }
  };

  const openSettingsModal = () => {
    setSettingsForm({
      ...settings,
      auto_until_date: settings.auto_until_date ? String(settings.auto_until_date).split('T')[0] : '',
    });
    setSettingsModalOpen(true);
  };

  // 1-Click รดน้ำแปลงเดียวสำหรับรอบที่เลือก
  const handleQuickLog = async (plotId) => {
    setLoadingAction(true);
    try {
      const res = await api.post('/api/water/quick-log', {
        plot_id: plotId,
        session: selectedSession,
      });
      toast.success(res.data.message || `บันทึกการรดน้ำรอบ${selectedSession}เรียบร้อย`);
      setReloadKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกรดน้ำ');
    } finally {
      setLoadingAction(false);
    }
  };

  // 1-Click รดน้ำทุกแปลงที่กำลังปลูกในรอบที่เลือก
  const handleQuickAll = async () => {
    setLoadingAction(true);
    try {
      const res = await api.post('/api/water/quick-all', {
        session: selectedSession,
      });
      if (res.data.already_watered) {
        toast.info(res.data.message);
      } else {
        toast.success(res.data.message || `บันทึกรดน้ำรอบ${selectedSession}ให้ ${res.data.count} แปลงเรียบร้อย!`);
      }
      setReloadKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกรดน้ำทุกแปลง');
    } finally {
      setLoadingAction(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await api.put('/api/water/settings', settingsForm);
      toast.success('บันทึกการตั้งค่าตารางเวลากิจวัตรสำเร็จ!');
      setSettingsModalOpen(false);
      setReloadKey(k => k + 1);
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
    }
  };

  // Calendar calculations
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const logMapByDate = useMemo(() => {
    const map = {};
    calendarLogs.forEach(c => {
      const dStr = typeof c.date === 'string' ? c.date.split('T')[0] : format(new Date(c.date), 'yyyy-MM-dd');
      map[dStr] = c;
    });
    return map;
  }, [calendarLogs]);

  const dailyMapByDate = useMemo(() => {
    const map = {};
    dailyLogs.forEach(d => {
      map[d.date] = d;
    });
    return map;
  }, [dailyLogs]);

  const filteredDailyLogs = useMemo(() => {
    return dailyLogs.filter(row => {
      const q = searchDaily.toLowerCase().trim();
      if (!q) return true;
      return (
        row.date?.toLowerCase().includes(q) ||
        row.workers?.toLowerCase().includes(q) ||
        row.water_source?.toLowerCase().includes(q)
      );
    });
  }, [dailyLogs, searchDaily]);

  const handleDeleteDaily = async (date) => {
    try {
      await api.delete(`/api/water/by-date/${date}`);
      toast.success(`ลบบันทึกการให้น้ำของวันที่ ${date} สำเร็จ`);
      setDeleteConfirmDate(null);
      setReloadKey(k => k + 1);
    } catch (err) {
      toast.error('ไม่สามารถลบบันทึกได้');
    }
  };

  const handleSaveManual = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/water/daily-record', manualForm);
      toast.success(res.data.message || 'บันทึกสำเร็จ');
      setManualModalOpen(false);
      setReloadKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP PROTECTED CULTIVATION BANNER */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-slate-200/90 shadow-xs space-y-3.5 sm:space-y-4 md:space-y-5">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                <Droplets className="w-5 h-5 text-emerald-600" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight">
                    💧 กิจวัตรการให้น้ำอัจฉริยะ (GAP #1)
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100/90 text-emerald-900 border border-emerald-300/80">
                    <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-700 shrink-0" />
                    <span>แคร่ยกพื้นโรงเรือนหลังคาใส</span>
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 font-medium mt-0.5">
                  ระบบให้น้ำแปลงมีหลังคาพลาสติกใส ควบคุมน้ำสะอาด GAP 100% บันทึกอัตโนมัติ ไม่ต้องคีย์ซ้ำ
                </p>
              </div>
            </div>
          </div>

          {/* Print Audit Sheet Button */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/report"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>พิมพ์รายงาน GAP</span>
            </Link>
          </div>
        </div>

        {/* 🌟 SMART AUTO-WATERING HERO CONTROLLER */}
        <div
          className={`rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 border transition-all ${
            settings.auto_routine_enabled && !todayStatus.isExpired
              ? 'bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border-emerald-300/80 shadow-xs'
              : todayStatus.isExpired
              ? 'bg-amber-50/90 border-amber-300 shadow-xs'
              : 'bg-slate-50/90 border-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5 sm:gap-3.5">
              <div
                className={`p-2 sm:p-2.5 rounded-xl shrink-0 transition-transform ${
                  settings.auto_routine_enabled && !todayStatus.isExpired
                    ? 'bg-emerald-600 text-white shadow-emerald-200 shadow-sm'
                    : todayStatus.isExpired
                    ? 'bg-amber-500 text-white shadow-amber-200 shadow-sm'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              </div>

              <div className="space-y-0.5 sm:space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight">
                    โหมดรดน้ำอัตโนมัติ (Smart Auto GAP)
                  </h2>
                  {settings.auto_routine_enabled && !todayStatus.isExpired && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>เปิดใช้งานอยู่</span>
                    </span>
                  )}
                  {settings.auto_routine_enabled && todayStatus.isExpired && (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>ครบกำหนดแล้ว (พักโหมด)</span>
                    </span>
                  )}
                  {!settings.auto_routine_enabled && (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      ปิดอยู่ (ควบคุมเอง)
                    </span>
                  )}
                </div>

                <div className="text-[11px] sm:text-xs text-slate-600 font-medium">
                  {settings.auto_routine_enabled && !todayStatus.isExpired ? (
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {settings.auto_mode_type === 'custom_date' && settings.auto_until_date ? (
                        <>
                          <span>📅 รดอัตโนมัติถึง:</span>
                          <strong className="text-emerald-950 font-black font-mono bg-emerald-100/70 px-1.5 py-0.2 rounded border border-emerald-200">
                            {format(new Date(settings.auto_until_date), 'dd/MM/yyyy')}
                          </strong>
                          {todayStatus.daysRemaining !== null && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-200/80 text-emerald-950 font-black text-[10px] sm:text-[11px]">
                              เหลือ {todayStatus.daysRemaining} วัน
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-900 font-bold">
                          🌱 ทำงานอัตโนมัติจนถึงวันเก็บเกี่ยว ({activePlots.length} แปลง)
                        </span>
                      )}
                      <span className="text-slate-400 hidden sm:inline">•</span>
                      <span className="text-slate-700">
                        เช้า {settings.morning_time} น. | เย็น {settings.evening_time} น.
                      </span>
                    </div>
                  ) : todayStatus.isExpired ? (
                    <div className="text-amber-800">
                      ครบกำหนดวันที่ระบุไว้แล้ว ({settings.auto_until_date}) ระบบพักการลงบันทึกอัตโนมัติชั่วคราว
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      💡 เมื่อเปิดโหมดนี้ ระบบจะลงบันทึกน้ำสะอาด GAP เช้า-เย็นให้อัตโนมัติทุกวัน ไม่ต้องเข้ามากดปุ่มทุกวัน
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-end sm:justify-start gap-2.5 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={openSettingsModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer"
                title="ตั้งเวลาเช้า-เย็น และกำหนดวันสิ้นสุดโหมดอัตโนมัติ"
              >
                <Settings className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>ตั้งเวลากิจวัตร</span>
              </button>

              {/* Proportional Toggle Switch */}
              <button
                type="button"
                disabled={loadingAction}
                onClick={handleToggleAuto}
                title={settings.auto_routine_enabled ? 'คลิกเพื่อปิดโหมดอัตโนมัติ' : 'คลิกเพื่อเปิดโหมดอัตโนมัติ'}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${
                  settings.auto_routine_enabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.auto_routine_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Climate Condition Quick Toggle (Normal vs Rainy/High Humidity) */}
        <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700">สภาพอากาศโรงเรือน:</span>
            <div className="inline-flex rounded-xl p-0.5 sm:p-1 bg-white border border-slate-200 shadow-inner">
              <button
                type="button"
                onClick={() => handleClimateToggle('normal')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  todayStatus.climate_condition === 'normal'
                    ? 'bg-amber-100 text-amber-950 font-black shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>☀️ แดดจัดปกติ</span>
              </button>
              <button
                type="button"
                onClick={() => handleClimateToggle('rainy_humidity')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  todayStatus.climate_condition === 'rainy_humidity'
                    ? 'bg-sky-500 text-white font-black shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <CloudRain className="w-3.5 h-3.5 shrink-0" />
                <span>🌧️ ฝนตก / ชื้นสูง</span>
              </button>
            </div>
          </div>

          <div className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {todayStatus.climate_condition === 'rainy_humidity'
                ? 'ฝนตก/ชื้นสูง: ดินระเหยช้า ระบบปรับเป็นการให้น้ำคุมความชื้นเพื่อป้องกันโรครา'
                : 'แดดจัดปกติ: ระบบบันทึกการให้น้ำรอบมาตรฐาน GAP 100%'}
            </span>
          </div>
        </div>

        {/* Routine Schedule Indicator & 1-Click Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          {/* Session Switcher Tabs */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/90 shadow-inner w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedSession('เช้า')}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedSession === 'เช้า'
                  ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-950 shrink-0" />
              <span>รอบเช้า ({settings.morning_time} น.)</span>
              <span className="text-[10px] sm:text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-amber-500/30 text-amber-950 font-bold">
                {morningCount}/{activePlots.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSession('เย็น')}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedSession === 'เย็น'
                  ? 'bg-indigo-600 text-white shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
              <span>รอบเย็น ({settings.evening_time} น.)</span>
              <span className="text-[10px] sm:text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-indigo-700/50 text-white font-bold">
                {eveningCount}/{activePlots.length}
              </span>
            </button>
          </div>

          {/* Quick All Button - Proportional & Responsive */}
          <button
            onClick={handleQuickAll}
            disabled={loadingAction || isCurrentSessionCompleted || enabledPlots.length === 0}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 font-black px-4 py-2 sm:px-4.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm shadow-xs transition active:scale-95 cursor-pointer ${
              isCurrentSessionCompleted
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-not-allowed'
                : selectedSession === 'เช้า'
                ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-200/50'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200/50'
            }`}
          >
            {isCurrentSessionCompleted ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  รดรอบ{selectedSession}ครบทุกแปลงแล้ว
                  {pausedPlots.length > 0 && ` (เว้น ${pausedPlots.length} แปลง)`}
                </span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current shrink-0" />
                <span>
                  ⚡ รด{selectedSession}ทุกแคร่ ({enabledPlots.filter(p => !currentSet.has(p.id)).length} แปลง)
                  {pausedPlots.length > 0 && (
                    <span className="text-[10px] font-normal opacity-85 ml-1">
                      (เว้น {pausedPlots.length} แปลง)
                    </span>
                  )}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Raised Bed Quick Cards - 2 Columns on Mobile, 3 on Tablet/iPad, 6 on Desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 pt-1">
          {activePlots.map(p => {
            const isWatered = currentSet.has(p.id);
            const isMorningDone = morningSet.has(p.id);
            const isEveningDone = eveningSet.has(p.id);
            const isAutoDisabled = p.auto_water_enabled === 0;

            return (
              <div
                key={p.id}
                className={`rounded-2xl p-2.5 sm:p-3 border transition-all flex flex-col justify-between gap-2 shadow-2xs ${
                  isAutoDisabled
                    ? 'bg-amber-50/40 border-amber-300 text-slate-900 ring-1 ring-amber-300/40'
                    : isWatered
                    ? 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950'
                    : 'bg-white hover:bg-slate-50/80 border-slate-200 text-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-black text-slate-900 text-xs sm:text-sm truncate">{p.name}</span>
                    <span className="font-mono text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-bold shrink-0">
                      #{p.plot_number || p.id}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-800 truncate">{p.crop_name || 'ผักทั่วไป'}</div>
                  <div className="text-[10px] text-slate-400 truncate">{p.water_source || 'น้ำสะอาด GAP'}</div>

                  {/* Clean, Full-Width Auto-Watering Toggle Pill */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePlotAuto(p.id);
                    }}
                    title={isAutoDisabled ? 'คลิกเพื่อเปิดโหมดรดน้ำอัตโนมัติ' : 'คลิกเพื่องดรดน้ำอัตโนมัติ (เช่น เตรียมตัด/เว้นน้ำ)'}
                    className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition active:scale-95 cursor-pointer border ${
                      isAutoDisabled
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-2xs'
                        : 'bg-blue-50/90 hover:bg-blue-100 text-blue-700 border-blue-200 shadow-2xs'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAutoDisabled ? 'bg-amber-500' : 'bg-blue-500 animate-pulse'}`} />
                    <span className="whitespace-nowrap">{isAutoDisabled ? '⏸️ เว้นน้ำ (งดรด)' : '💧 รดน้ำออโต้'}</span>
                  </button>
                </div>

                <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
                    <span className={`px-1 sm:px-1.5 py-0.5 rounded border ${isMorningDone ? 'bg-amber-100 text-amber-950 border-amber-300 font-bold' : 'bg-slate-50 text-slate-400'}`}>
                      เช้า {isMorningDone ? '✓' : '—'}
                    </span>
                    <span className={`px-1 sm:px-1.5 py-0.5 rounded border ${isEveningDone ? 'bg-indigo-100 text-indigo-950 border-indigo-300 font-bold' : 'bg-slate-50 text-slate-400'}`}>
                      เย็น {isEveningDone ? '✓' : '—'}
                    </span>
                  </div>

                  {isWatered ? (
                    <div className="text-[10px] font-bold text-center text-emerald-700 bg-emerald-100/80 py-1 rounded-xl">
                      ✓ รด{selectedSession}แล้ว
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleQuickLog(p.id)}
                      disabled={loadingAction}
                      className={`w-full text-center py-1 rounded-xl text-[10px] sm:text-xs font-black transition cursor-pointer active:scale-95 ${
                        selectedSession === 'เช้า' ? 'bg-amber-400 hover:bg-amber-500 text-slate-950' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      ⚡ รด{selectedSession}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CROP CYCLE WATER CONSISTENCY SUMMARY CARDS */}
      {cycleSummaries.length > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-slate-200/90 shadow-xs space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-blue-50 text-blue-700 shrink-0">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              </span>
              <h2 className="text-xs sm:text-sm md:text-base font-black text-slate-900">
                📊 สถิติความสม่ำเสมอของการให้น้ำรอบปลูก (Consistency Rate)
              </h2>
            </div>
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
              เกณฑ์ GAP ข้อ 1: ให้น้ำสะอาดสม่ำเสมอตลอดอายุ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
            {cycleSummaries.map(s => (
              <div key={s.plot_id} className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                      <span>{s.plot_name}</span>
                      <span className="font-normal text-slate-500">({s.crop_name})</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      อายุ {s.days_planted} วัน / ประมาณการ {s.estimated_days} วัน
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-800 font-mono">
                      {s.consistency_pct}%
                    </span>
                    <div className="text-[9px] font-bold text-slate-500 uppercase">ความสม่ำเสมอ</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 sm:h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${s.consistency_pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-600 pt-0.5 font-medium">
                  <span>เช้า: <strong>{s.morning_count}</strong> | เย็น: <strong>{s.evening_count}</strong></span>
                  <span className="text-sky-700 font-bold">ฝน/คุมชื้น: {s.rainy_count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. VIEW SWITCHER TABS (CALENDAR HEATMAP VS GAP TABLE) */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>ปฏิทินกิจวัตร<span className="hidden sm:inline">รายเดือน</span></span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <List className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>ตารางประวัติ GAP<span className="hidden sm:inline"> (Audit Trail)</span></span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> รดครบ 2 รอบ</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> รดคุมชื้น (ฝนตก)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> รดรอบเดียว</span>
          </div>
        </div>

        {/* TAB 1: CALENDAR HEATMAP VIEW */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-slate-200/90 shadow-xs space-y-3 sm:space-y-4">
            {/* Month Header Controller */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-sm sm:text-base md:text-lg">
                  {format(currentMonth, 'MMMM yyyy', { locale: th })}
                </h3>
                <span className="hidden sm:inline text-xs text-slate-500 font-medium">(คลิกวันที่เพื่อดูบันทึก)</span>
              </div>

              <div className="flex items-center gap-1 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                  className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                  title="เดือนก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  เดือนปัจจุบัน
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                  className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                  title="เดือนถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              {/* Day Name Headers */}
              <div className="grid grid-cols-7 bg-slate-100/90 border-b border-slate-200 text-center text-[10px] sm:text-xs font-black text-slate-700 py-1.5 sm:py-2.5">
                <div><span className="sm:hidden">จ.</span><span className="hidden sm:inline">จันทร์</span></div>
                <div><span className="sm:hidden">อ.</span><span className="hidden sm:inline">อังคาร</span></div>
                <div><span className="sm:hidden">พ.</span><span className="hidden sm:inline">พุธ</span></div>
                <div><span className="sm:hidden">พฤ.</span><span className="hidden sm:inline">พฤหัสบดี</span></div>
                <div><span className="sm:hidden">ศ.</span><span className="hidden sm:inline">ศุกร์</span></div>
                <div><span className="sm:hidden">ส.</span><span className="hidden sm:inline">เสาร์</span></div>
                <div><span className="sm:hidden">อา.</span><span className="hidden sm:inline">อาทิตย์</span></div>
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-50/40">
                {calendarDays.map(day => {
                  const dStr = format(day, 'yyyy-MM-dd');
                  const logData = logMapByDate[dStr];
                  const inCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  let statusBadge = null;
                  if (logData) {
                    const isBoth = logData.morning_logs > 0 && logData.evening_logs > 0;
                    const isRainy = logData.climate_condition === 'rainy_humidity';

                    if (isBoth) {
                      statusBadge = isRainy ? (
                        <div className="text-[9px] sm:text-[10px] font-bold bg-sky-100 text-sky-900 px-1 py-0.5 rounded border border-sky-300 truncate flex items-center gap-1">
                          <CloudRain className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-700 shrink-0" />
                          <span className="truncate">
                            <span className="sm:hidden">คุมชื้น</span>
                            <span className="hidden sm:inline">รดคุมชื้น ({logData.plot_count})</span>
                          </span>
                        </div>
                      ) : (
                        <div className="text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded border border-emerald-300 truncate flex items-center gap-1">
                          <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-700 shrink-0" />
                          <span className="truncate">
                            <span className="sm:hidden">2 รอบ</span>
                            <span className="hidden sm:inline">รดครบ 2 รอบ ({logData.plot_count})</span>
                          </span>
                        </div>
                      );
                    } else {
                      statusBadge = (
                        <div className="text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-900 px-1 py-0.5 rounded border border-amber-300 truncate text-center">
                          <span className="sm:hidden">{logData.morning_logs > 0 ? 'เช้า' : 'เย็น'}</span>
                          <span className="hidden sm:inline">{logData.morning_logs > 0 ? 'รอบเช้า' : 'รอบเย็น'} ({logData.plot_count})</span>
                        </div>
                      );
                    }
                  }

                  return (
                    <div
                      key={dStr}
                      onClick={() => logData && setSelectedCalendarDate(dStr)}
                      className={`min-h-[54px] sm:min-h-[72px] md:min-h-[85px] p-1 sm:p-2 flex flex-col justify-between transition ${
                        inCurrentMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-300'
                      } ${isToday ? 'ring-2 ring-emerald-500/80 ring-inset bg-emerald-50/20' : ''} ${
                        logData ? 'cursor-pointer hover:bg-slate-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] sm:text-xs font-mono font-bold ${isToday ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[10px] sm:text-xs' : ''}`}>
                          {format(day, 'd')}
                        </span>
                        {isToday && <span className="text-[8px] sm:text-[9px] font-black text-emerald-700 uppercase">วันนี้</span>}
                      </div>

                      <div className="mt-0.5 sm:mt-1 space-y-1">
                        {statusBadge}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AUDIT TRAIL TABLE (DAILY MASTER TABLE vs LOG MANAGER) */}
        {activeTab === 'table' && (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-slate-200/90 shadow-xs space-y-4">
            {/* Header Controller */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-slate-900 text-sm sm:text-base md:text-lg flex items-center gap-2">
                    <List className="w-5 h-5 text-emerald-700" />
                    ตารางประวัติบันทึกการให้น้ำมาตรฐาน GAP
                  </h3>
                  <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    1 วัน = 1 แถว รวมทุกแปลง
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  บันทึกกิจวัตรประจำวันของฟาร์ม กะทัดรัด สะอาดตา ลดความซ้ำซ้อน และผ่านเกณฑ์ตรวจประเมิน GAP 100%
                </p>
              </div>

              {/* Sub-tab view toggle & Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setTableSubTab('daily')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      tableSubTab === 'daily'
                        ? 'bg-white text-slate-950 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    📋 บันทึกรายวันรวมทุกแปลง
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableSubTab('detailed')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      tableSubTab === 'detailed'
                        ? 'bg-white text-slate-950 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    🔍 ดูละเอียดแยกรายแปลง
                  </button>
                </div>

                {tableSubTab === 'daily' && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualForm({
                        log_date: format(new Date(), 'yyyy-MM-dd'),
                        sessions: ['เช้า', 'เย็น'],
                        plot_ids: [],
                        water_source: settings.water_source || 'น้ำสะอาดมาตรฐาน GAP',
                        climate_condition: settings.climate_condition || 'normal',
                        notes: '',
                        worker_name: user?.display_name || 'เจ้าของฟาร์ม',
                      });
                      setManualModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>บันทึกย้อนหลัง</span>
                  </button>
                )}
              </div>
            </div>

            {/* If Daily View: */}
            {tableSubTab === 'daily' && (
              <div className="space-y-3">
                {/* Search Bar & Summary Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ค้นหาวันที่, ผู้ปฏิบัติ..."
                      value={searchDaily}
                      onChange={e => setSearchDaily(e.target.value)}
                      className="input pl-8 py-1.5 text-xs w-full rounded-xl bg-slate-50 border-slate-200"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium self-end sm:self-center">
                    <span>ทั้งหมด <strong className="text-slate-900">{filteredDailyLogs.length}</strong> วัน</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">
                      ลดแถวซ้ำซ้อน ~{Math.max(0, filteredDailyLogs.reduce((s, r) => s + (r.total_logs - 1), 0))} แถว
                    </span>
                  </div>
                </div>

                {/* Table Container */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3">วันที่</th>
                        <th className="py-2.5 px-3">☀️ รอบเช้า</th>
                        <th className="py-2.5 px-3">🌙 รอบเย็น</th>
                        <th className="py-2.5 px-3">แปลงที่รด</th>
                        <th className="py-2.5 px-3">สภาพอากาศ</th>
                        <th className="py-2.5 px-3">แหล่งน้ำ (GAP)</th>
                        <th className="py-2.5 px-3">ผู้ปฏิบัติ</th>
                        <th className="py-2.5 px-3 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDailyLogs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            ไม่พบบันทึกการให้น้ำ
                          </td>
                        </tr>
                      ) : (
                        filteredDailyLogs.map(row => {
                          const isToday = isSameDay(new Date(row.date), new Date());
                          return (
                            <tr
                              key={row.date}
                              className={`hover:bg-slate-50/80 transition ${
                                isToday ? 'bg-emerald-50/30' : ''
                              }`}
                            >
                              {/* วันที่ */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <div className="font-black text-slate-900 text-xs">
                                      {format(new Date(row.date), 'd MMM yyyy', { locale: th })}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium">
                                      วัน{format(new Date(row.date), 'EEEE', { locale: th })}
                                    </div>
                                  </div>
                                  {isToday && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      วันนี้
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* รอบเช้า */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                {row.morning_count > 0 ? (
                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                                    row.is_morning_completed
                                      ? 'bg-amber-100/70 text-amber-950 border-amber-300'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}>
                                    <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>
                                      {row.is_morning_completed 
                                        ? (row.paused_plots?.length > 0 ? `รดครบ (เว้น ${row.paused_plots.length} แปลง)` : 'รดครบทุกแปลง')
                                        : `รด ${row.morning_count}/${row.enabled_active_count || row.total_active_count}`}
                                    </span>
                                    {row.is_morning_completed && <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-medium text-[11px] px-2 py-0.5 rounded-md bg-slate-100/60 border border-slate-200/50">
                                    — ยังไม่รด
                                  </span>
                                )}
                              </td>

                              {/* รอบเย็น */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                {row.evening_count > 0 ? (
                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                                    row.is_evening_completed
                                      ? 'bg-indigo-100/70 text-indigo-950 border-indigo-300'
                                      : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                  }`}>
                                    <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>
                                      {row.is_evening_completed 
                                        ? (row.paused_plots?.length > 0 ? `รดครบ (เว้น ${row.paused_plots.length} แปลง)` : 'รดครบทุกแปลง')
                                        : `รด ${row.evening_count}/${row.enabled_active_count || row.total_active_count}`}
                                    </span>
                                    {row.is_evening_completed && <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-medium text-[11px] px-2 py-0.5 rounded-md bg-slate-100/60 border border-slate-200/50">
                                    — ยังไม่รด
                                  </span>
                                )}
                              </td>

                              {/* แปลงที่รด */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded-lg border border-slate-200 text-xs">
                                    <Layers className="w-3 h-3 text-slate-500" />
                                    <span>{row.plots_watered_count} แปลง</span>
                                  </span>
                                  {row.paused_plots?.length > 0 && (
                                    <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300" title={row.paused_plots.map(p => p.name).join(', ')}>
                                      เว้น {row.paused_plots.length}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* สภาพอากาศ */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                {row.climate_condition === 'rainy_humidity' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                                    <CloudRain className="w-3 h-3 text-sky-600 shrink-0" />
                                    <span>ฝนตก (คุมชื้น)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                    <Sun className="w-3 h-3 text-amber-500 shrink-0" />
                                    <span>แดดจัดปกติ</span>
                                  </span>
                                )}
                              </td>

                              {/* แหล่งน้ำ GAP */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1 font-bold text-emerald-800 text-xs">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="truncate max-w-[140px]">{row.water_source}</span>
                                </div>
                              </td>

                              {/* ผู้ปฏิบัติ */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                                  <span>{row.workers}</span>
                                  {row.is_auto && (
                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1 py-0.2 rounded border border-blue-200 font-bold">
                                      🤖 อัตโนมัติ
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* จัดการ */}
                              <td className="py-3 px-3 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCalendarDate(row.date)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                                    title="ดูรายละเอียดแปลงย่อย"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmDate(row.date)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                    title="ลบบันทึกของวันนี้"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* If Detailed View (Fallback to LogManager): */}
            {tableSubTab === 'detailed' && (
              <LogManager
                title="ตารางบันทึกละเอียดแยกรายแปลง (Detail Logs)"
                endpoint="water"
                plotsLookup
                reloadTrigger={reloadKey}
                fields={[
                  { key: 'log_date', label: 'วันที่', type: 'date', required: true },
                  {
                    key: 'session',
                    label: 'รอบให้น้ำ',
                    type: 'select',
                    options: ['เช้า', 'เย็น', 'บ่าย'],
                    default: 'เช้า',
                  },
                  { key: 'plot_id', label: 'แปลง/แคร่', placeholder: '-- เลือกแปลง --', required: true },
                  { key: 'water_source', label: 'แหล่งน้ำ', placeholder: 'เช่น น้ำสะอาดมาตรฐาน GAP' },
                  {
                    key: 'climate_condition',
                    label: 'สภาพอากาศ',
                    type: 'select',
                    options: ['normal', 'rainy_humidity'],
                    default: 'normal',
                  },
                  { key: 'water_quality', label: 'คุณภาพน้ำ', placeholder: 'ผ่าน / ปลอดภัย' },
                  { key: 'contamination_check', label: 'น้ำสะอาด GAP', type: 'bool' },
                  { key: 'worker_name', label: 'ผู้ปฏิบัติ', placeholder: 'ชื่อผู้ปฏิบัติ' },
                  { key: 'notes', label: 'หมายเหตุ', type: 'textarea', hideInTable: true },
                ]}
              />
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: DAY DETAIL VIEW */}
      {selectedCalendarDate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-sm sm:max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                  <CalendarIcon className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-sm sm:text-base">
                    รายละเอียดการให้น้ำประจำวัน
                  </h3>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {format(new Date(selectedCalendarDate), 'd MMMM yyyy', { locale: th })}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCalendarDate(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(dailyMapByDate[selectedCalendarDate] || logMapByDate[selectedCalendarDate]) ? (
              <div className="space-y-3 text-xs">
                {(() => {
                  const dayData = dailyMapByDate[selectedCalendarDate];
                  const calData = logMapByDate[selectedCalendarDate];
                  const weather = dayData?.climate_condition || calData?.climate_condition;
                  const plotCount = dayData?.plots_watered_count || calData?.plot_count || 0;
                  const morningCount = dayData?.morning_count || calData?.morning_logs || 0;
                  const eveningCount = dayData?.evening_count || calData?.evening_logs || 0;
                  const totalLogs = dayData?.total_logs || calData?.total_logs || 0;
                  const workers = dayData?.workers || 'เจ้าของฟาร์ม';
                  const waterSource = dayData?.water_source || 'น้ำสะอาดมาตรฐาน GAP';

                  return (
                    <>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">สภาพอากาศ:</span>
                          <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                            weather === 'rainy_humidity'
                              ? 'bg-sky-100 text-sky-900 border border-sky-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {weather === 'rainy_humidity' ? '🌧️ ฝนตก/ชื้นสูง (รดคุมชื้น)' : '☀️ แดดจัดปกติ'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">จำนวนแปลงที่รดน้ำ:</span>
                          <span className="font-black text-slate-900">{plotCount} แปลง</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">รอบเช้า:</span>
                          <span className="font-bold text-amber-700">{morningCount} แปลง</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">รอบเย็น:</span>
                          <span className="font-bold text-indigo-700">{eveningCount} แปลง</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">ผู้ปฏิบัติงาน:</span>
                          <span className="font-bold text-slate-800">{workers}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200/80 pt-1.5 font-black text-slate-900">
                          <span>บันทึกรวมทั้งหมด:</span>
                          <span className="text-emerald-700">{totalLogs} รายการ</span>
                        </div>
                      </div>

                      {/* รายละเอียดแปลงรอบเช้า */}
                      {dayData?.morning_plots?.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5 text-amber-800">
                            <Sun className="w-3.5 h-3.5 text-amber-600" />
                            <span>แปลงที่รดรอบเช้า ({dayData.morning_plots.length} แปลง):</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-amber-50/40 rounded-xl border border-amber-100">
                            {dayData.morning_plots.map(p => (
                              <span key={p.plot_id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-amber-950 font-bold text-[10px] shadow-2xs">
                                <span>{p.plot_name}</span>
                                {p.crop_name && <span className="font-normal text-amber-700 font-mono">({p.crop_name})</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* รายละเอียดแปลงรอบเย็น */}
                      {dayData?.evening_plots?.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5 text-indigo-800">
                            <Moon className="w-3.5 h-3.5 text-indigo-600" />
                            <span>แปลงที่รดรอบเย็น ({dayData.evening_plots.length} แปลง):</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-indigo-50/40 rounded-xl border border-indigo-100">
                            {dayData.evening_plots.map(p => (
                              <span key={p.plot_id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-indigo-200 text-indigo-950 font-bold text-[10px] shadow-2xs">
                                <span>{p.plot_name}</span>
                                {p.crop_name && <span className="font-normal text-indigo-700 font-mono">({p.crop_name})</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{waterSource} ตรวจสอบผ่านเกณฑ์ความปลอดภัยทุกแปลง</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                ไม่มีประวัติการให้น้ำในวันนี้
              </div>
            )}

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCalendarDate(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition cursor-pointer text-xs"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SETTINGS (AUTO ROUTINE & SCHEDULE) */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 sm:space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                  <Settings className="w-4 h-4" />
                </span>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  ตั้งค่าตารางเวลากิจวัตรอัจฉริยะ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3.5 sm:space-y-4 text-xs">
              {/* Auto Routine Toggle */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900">เปิดระบบบันทึกกิจวัตรอัตโนมัติ</div>
                  <div className="text-[11px] text-slate-600">
                    ระบบจะบันทึกน้ำสะอาด GAP ให้แปลงที่กำลังปลูกอัตโนมัติ เจ้าของไม่ต้องเข้ามากดปุ่มทุกวัน
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.auto_routine_enabled}
                  onChange={e => setSettingsForm(f => ({ ...f, auto_routine_enabled: e.target.checked }))}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
                />
              </div>

              {/* Mode Duration Selection (Until Harvest vs Custom Date) */}
              {settingsForm.auto_routine_enabled && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                  <label className="font-bold text-slate-900 block text-xs">
                    ระยะเวลาที่ต้องการให้รดน้ำอัตโนมัติ:
                  </label>

                  <div className="space-y-1.5">
                    <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer border border-transparent hover:border-slate-200">
                      <input
                        type="radio"
                        name="auto_mode_type"
                        value="until_harvest"
                        checked={settingsForm.auto_mode_type === 'until_harvest'}
                        onChange={() => setSettingsForm(f => ({ ...f, auto_mode_type: 'until_harvest' }))}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                      />
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>🌱 รดต่อเนื่องจนถึงวันเก็บเกี่ยว</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">แนะนำ</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          รดน้ำทุกวันให้ทุกแปลงที่กำลังปลูก จนกระทั่งตัดผลผลิตขายตามรอบ GAP
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer border border-transparent hover:border-slate-200">
                      <input
                        type="radio"
                        name="auto_mode_type"
                        value="custom_date"
                        checked={settingsForm.auto_mode_type === 'custom_date'}
                        onChange={() => setSettingsForm(f => ({ ...f, auto_mode_type: 'custom_date' }))}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                      />
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800">
                          📅 กำหนดวันสิ้นสุดเอง
                        </div>
                        <div className="text-[11px] text-slate-500">
                          กำหนดวันที่ต้องการให้ระบบหยุดรดน้ำอัตโนมัติ
                        </div>
                      </div>
                    </label>
                  </div>

                  {settingsForm.auto_mode_type === 'custom_date' && (
                    <div className="pt-2 pl-6 border-t border-slate-200/80 space-y-1.5 animate-in fade-in duration-150">
                      <label className="font-bold text-slate-800 flex items-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>เปิดใช้งานถึงวันที่:</span>
                      </label>
                      <input
                        type="date"
                        required={settingsForm.auto_mode_type === 'custom_date'}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        value={settingsForm.auto_until_date || ''}
                        onChange={e => setSettingsForm(f => ({ ...f, auto_until_date: e.target.value }))}
                        className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        เมื่อพ้นวันที่นี้ ระบบจะหยุดลงบันทึกอัตโนมัติเพื่อรอคำสั่งรอบใหม่
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Times */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" /> เวลารอบเช้า
                  </label>
                  <input
                    type="time"
                    required
                    value={settingsForm.morning_time}
                    onChange={e => setSettingsForm(f => ({ ...f, morning_time: e.target.value }))}
                    className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> เวลารอบเย็น
                  </label>
                  <input
                    type="time"
                    required
                    value={settingsForm.evening_time}
                    onChange={e => setSettingsForm(f => ({ ...f, evening_time: e.target.value }))}
                    className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white font-mono"
                  />
                </div>
              </div>

              {/* Default Water Source */}
              <div className="space-y-1">
                <label className="font-bold text-slate-800">แหล่งน้ำสะอาดมาตรฐาน GAP</label>
                <input
                  type="text"
                  required
                  value={settingsForm.water_source}
                  onChange={e => setSettingsForm(f => ({ ...f, water_source: e.target.value }))}
                  className="input text-xs w-full py-1.5 px-3 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow cursor-pointer text-xs"
                >
                  บันทึกการตั้งค่า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM DELETE DAILY LOGS */}
      {deleteConfirmDate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-rose-600 font-black text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>ยืนยันการลบบันทึกการให้น้ำ</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              คุณต้องการลบบันทึกการให้น้ำประจำวันที่{' '}
              <strong className="text-slate-900 font-bold">
                {format(new Date(deleteConfirmDate), 'd MMMM yyyy', { locale: th })}
              </strong>{' '}
              (ทุกแปลงในวันนี้) ใช่หรือไม่? ข้อมูลจะถูกลบออกจากฐานข้อมูล
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmDate(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDaily(deleteConfirmDate)}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: MANUAL DAILY WATERING ENTRY */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                  <Plus className="w-4 h-4" />
                </span>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  บันทึกการให้น้ำย้อนหลัง (1 วัน ทุกแปลง)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManual} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">วันที่บันทึก:</label>
                <input
                  type="date"
                  required
                  value={manualForm.log_date}
                  onChange={e => setManualForm({ ...manualForm, log_date: e.target.value })}
                  className="input w-full py-1.5 px-3 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">รอบการให้น้ำ:</label>
                <div className="flex items-center gap-4 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={manualForm.sessions.includes('เช้า')}
                      onChange={e => {
                        const s = new Set(manualForm.sessions);
                        e.target.checked ? s.add('เช้า') : s.delete('เช้า');
                        setManualForm({ ...manualForm, sessions: Array.from(s) });
                      }}
                      className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4"
                    />
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5 text-amber-600" /> รอบเช้า
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={manualForm.sessions.includes('เย็น')}
                      onChange={e => {
                        const s = new Set(manualForm.sessions);
                        e.target.checked ? s.add('เย็น') : s.delete('เย็น');
                        setManualForm({ ...manualForm, sessions: Array.from(s) });
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <Moon className="w-3.5 h-3.5 text-indigo-600" /> รอบเย็น
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">สภาพอากาศ:</label>
                <select
                  value={manualForm.climate_condition}
                  onChange={e => setManualForm({ ...manualForm, climate_condition: e.target.value })}
                  className="input w-full py-1.5 px-3 rounded-xl border border-slate-200 font-bold"
                >
                  <option value="normal">☀️ แดดจัดปกติ (รดน้ำเต็มอัตรา GAP)</option>
                  <option value="rainy_humidity">🌧️ ฝนตก/ความชื้นสูง (รดควบคุมความชื้น)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">แหล่งน้ำสะอาด GAP:</label>
                <input
                  type="text"
                  required
                  value={manualForm.water_source}
                  onChange={e => setManualForm({ ...manualForm, water_source: e.target.value })}
                  className="input w-full py-1.5 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ผู้ปฏิบัติงาน:</label>
                <input
                  type="text"
                  value={manualForm.worker_name}
                  onChange={e => setManualForm({ ...manualForm, worker_name: e.target.value })}
                  placeholder="ชื่อผู้ปฏิบัติ เช่น เจ้าของฟาร์ม"
                  className="input w-full py-1.5 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">หมายเหตุ (ถ้ามี):</label>
                <textarea
                  rows={2}
                  value={manualForm.notes}
                  onChange={e => setManualForm({ ...manualForm, notes: e.target.value })}
                  placeholder="เช่น รดบำรุงต้นอ่อนผักสลัด"
                  className="input w-full py-1.5 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={manualForm.sessions.length === 0}
                  className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
