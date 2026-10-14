import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import { toast } from 'sonner';
import {
  Droplets,
  CheckCircle2,
  Zap,
  AlertCircle,
  Sun,
  Moon,
  Settings,
  Calendar as CalendarIcon,
  List,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { getCropCycleId } from '../lib/cropCycle.js';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import WaterCalendarView from '../components/water/WaterCalendarView';
import WaterTableView from '../components/water/WaterTableView';
import DayDetailModal from '../components/water/DayDetailModal';
import WaterSettingsModal from '../components/water/WaterSettingsModal';
import DeleteDailyLogModal from '../components/water/DeleteDailyLogModal';
import ManualWaterModal from '../components/water/ManualWaterModal';

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
          <WaterCalendarView
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            calendarDays={calendarDays}
            logMapByDate={logMapByDate}
            onSelectDate={(dateStr) => setSelectedCalendarDate(dateStr)}
          />
        )}

                {/* TAB 2: AUDIT TRAIL TABLE (DAILY MASTER TABLE vs LOG MANAGER) */}
        {activeTab === 'table' && (
          <WaterTableView
            filteredDailyLogs={filteredDailyLogs}
            searchDaily={searchDaily}
            setSearchDaily={setSearchDaily}
            onOpenManualModal={() => {
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
            onSelectDate={(dateStr) => setSelectedCalendarDate(dateStr)}
            onOpenDeleteModal={(dateStr) => setDeleteConfirmDate(dateStr)}
          />
        )}
      </div>

      {/* MODAL 1: DAY DETAIL VIEW */}
      <DayDetailModal
        selectedCalendarDate={selectedCalendarDate}
        onClose={() => setSelectedCalendarDate(null)}
        dailyMapByDate={dailyMapByDate}
        logMapByDate={logMapByDate}
      />

      {/* MODAL 2: SETTINGS (AUTO ROUTINE & SCHEDULE) */}
      <WaterSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settingsForm={settingsForm}
        setSettingsForm={setSettingsForm}
        onSave={handleSaveSettings}
      />

      {/* MODAL 3: CONFIRM DELETE DAILY LOGS */}
      <DeleteDailyLogModal
        deleteConfirmDate={deleteConfirmDate}
        onClose={() => setDeleteConfirmDate(null)}
        onConfirmDelete={handleDeleteDaily}
      />

      {/* MODAL 4: MANUAL DAILY WATERING ENTRY */}
      <ManualWaterModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        manualForm={manualForm}
        setManualForm={setManualForm}
        onSave={handleSaveManual}
      />
    </div>
  );
}
