import { useState, useEffect, useCallback } from 'react';
import LogManager from '../components/LogManager.jsx';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Droplets, CheckCircle2, Zap, Sparkles, AlertCircle, RefreshCw, Tag, Sun, Moon } from 'lucide-react';
import { getCropCycleId } from '../lib/cropCycle.js';

export default function Water() {
  const [selectedSession, setSelectedSession] = useState('เช้า'); // 'เช้า' | 'เย็น'
  const [todayStatus, setTodayStatus] = useState({ morningPlotIds: [], eveningPlotIds: [], wateredPlotIds: [], logs: [] });
  const [plots, setPlots] = useState([]);
  const [loadingAction, setLoadingAction] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Default to afternoon/evening session if current time >= 13:00
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 13) {
      setSelectedSession('เย็น');
    } else {
      setSelectedSession('เช้า');
    }
  }, []);

  const fetchWaterStatus = useCallback(async () => {
    try {
      const [stRes, plRes] = await Promise.all([
        api.get('/api/water/today-status'),
        api.get('/api/plots'),
      ]);
      setTodayStatus(stRes.data);
      setPlots(plRes.data);
    } catch (e) {
      console.warn('Failed to load water status:', e.message);
    }
  }, []);

  useEffect(() => {
    fetchWaterStatus();
  }, [fetchWaterStatus, reloadKey]);

  // Active plots only
  const activePlots = plots.filter(p => p.status === 'active');
  const morningSet = new Set(todayStatus.morningPlotIds || []);
  const eveningSet = new Set(todayStatus.eveningPlotIds || []);

  const currentSet = selectedSession === 'เย็น' ? eveningSet : morningSet;
  const wateredCount = activePlots.filter(p => currentSet.has(p.id)).length;
  const isCurrentSessionCompleted = activePlots.length > 0 && wateredCount === activePlots.length;

  const morningCount = activePlots.filter(p => morningSet.has(p.id)).length;
  const eveningCount = activePlots.filter(p => eveningSet.has(p.id)).length;

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

  return (
    <LogManager
      title="บันทึกการให้น้ำ (GAP #1)"
      endpoint="water"
      plotsLookup
      reloadTrigger={reloadKey}
      renderTopBanner={({ load }) => (
        <div className="surface rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white shadow-xl shadow-emerald-950/15 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-emerald-700/60 border border-emerald-500/30 text-amber-300">
                  <Droplets className="w-5 h-5 text-sky-300" />
                </span>
                <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  ⚡ กิจวัตรการให้น้ำประจำวัน (เช้า - เย็น)
                </h2>
              </div>
              <p className="text-xs text-emerald-100/90 leading-relaxed max-w-xl">
                บันทึกการรดน้ำ 2 เวลาตามจริงของฟาร์มผักปลอดภัย กดบันทึกแยก <strong>รอบเช้า</strong> และ <strong>รอบเย็น</strong> ได้ในคลิกเดียว
              </p>
            </div>

            {/* Session Selector & Quick Action Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Session Tabs (เช้า vs เย็น) */}
              <div className="bg-emerald-950/70 p-1 rounded-2xl border border-emerald-700/60 flex items-center gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setSelectedSession('เช้า')}
                  className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedSession === 'เช้า'
                      ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                      : 'text-emerald-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-800" />
                  <span>รอบเช้า</span>
                  <span className="text-[10px] opacity-80">({morningCount}/{activePlots.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSession('เย็น')}
                  className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedSession === 'เย็น'
                      ? 'bg-indigo-400 text-slate-950 shadow-md font-black'
                      : 'text-emerald-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Moon className="w-4 h-4 text-indigo-900" />
                  <span>รอบเย็น</span>
                  <span className="text-[10px] opacity-80">({eveningCount}/{activePlots.length})</span>
                </button>
              </div>

              {/* Quick Action Button: Water All */}
              <button
                onClick={handleQuickAll}
                disabled={loadingAction || isCurrentSessionCompleted || activePlots.length === 0}
                className={`inline-flex items-center justify-center gap-2 font-bold px-5 py-2.5 rounded-2xl text-xs sm:text-sm shadow-lg transition active:scale-95 cursor-pointer whitespace-nowrap ${
                  isCurrentSessionCompleted
                    ? 'bg-emerald-700/50 text-emerald-200 border border-emerald-600/40 cursor-not-allowed'
                    : selectedSession === 'เช้า'
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-900/30 font-black'
                    : 'bg-indigo-400 hover:bg-indigo-300 text-slate-950 shadow-indigo-900/30 font-black'
                }`}
              >
                {isCurrentSessionCompleted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>รดน้ำรอบ{selectedSession}ครบทุกแปลงแล้ว</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current text-slate-900" />
                    <span>⚡ รดน้ำรอบ{selectedSession}ทุกแปลง ({activePlots.length - wateredCount} แปลง)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status Progress Bar */}
          <div className="bg-emerald-950/40 border border-emerald-700/40 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-emerald-200 font-medium">
                  สถานะรอบ{selectedSession}:{' '}
                  <strong className="text-white font-bold">
                    รดแล้ว {wateredCount} จาก {activePlots.length} แปลง
                  </strong>
                </span>

                <div className="flex items-center gap-3 text-[11px] text-emerald-300/90 font-medium">
                  <span className="flex items-center gap-1">
                    <Sun className="w-3 h-3 text-amber-400" /> เช้า: <strong>{morningCount}/{activePlots.length}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Moon className="w-3 h-3 text-indigo-300" /> เย็น: <strong>{eveningCount}/{activePlots.length}</strong>
                  </span>
                </div>
              </div>

              <span className="text-[11px] font-mono text-emerald-300 font-bold">
                {activePlots.length > 0 ? Math.round((wateredCount / activePlots.length) * 100) : 0}% ของรอบ{selectedSession}
              </span>
            </div>

            {/* Progress line */}
            <div className="h-2 w-full bg-emerald-950/80 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  selectedSession === 'เช้า'
                    ? 'bg-gradient-to-r from-teal-400 to-amber-300'
                    : 'bg-gradient-to-r from-teal-400 to-indigo-300'
                }`}
                style={{
                  width: `${activePlots.length > 0 ? (wateredCount / activePlots.length) * 100 : 0}%`,
                }}
              />
            </div>

            {/* Individual Active Plots 1-Click Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2">
              {activePlots.map(p => {
                const isWatered = currentSet.has(p.id);
                const isMorningDone = morningSet.has(p.id);
                const isEveningDone = eveningSet.has(p.id);

                return (
                  <div
                    key={p.id}
                    className={`rounded-xl p-3 border transition flex items-center justify-between gap-2 ${
                      isWatered
                        ? 'bg-emerald-800/40 border-emerald-600/40 text-emerald-100'
                        : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs truncate flex items-center gap-1.5">
                        <span className="truncate">{p.name}</span>
                        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-900 shrink-0 font-extrabold shadow-2xs">
                          #{getCropCycleId(p)}
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-200/80 truncate mt-0.5 flex items-center gap-1.5">
                        <span>{p.crop_name}</span>
                        <span>•</span>
                        <span>{p.default_water_liters || 50}L</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[9px]">
                        <span className={`px-1.5 py-0.2 rounded font-medium ${isMorningDone ? 'bg-amber-400/30 text-amber-300 font-bold' : 'text-slate-400'}`}>
                          เช้า {isMorningDone ? '✓' : '—'}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded font-medium ${isEveningDone ? 'bg-indigo-400/30 text-indigo-300 font-bold' : 'text-slate-400'}`}>
                          เย็น {isEveningDone ? '✓' : '—'}
                        </span>
                      </div>
                    </div>

                    {isWatered ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-900/60 px-2 py-1 rounded-lg border border-emerald-600/50 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> รดแล้ว
                      </span>
                    ) : (
                      <button
                        onClick={() => handleQuickLog(p.id)}
                        disabled={loadingAction}
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow transition shrink-0 cursor-pointer active:scale-95 ${
                          selectedSession === 'เช้า'
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-900'
                            : 'bg-indigo-400 hover:bg-indigo-300 text-slate-900'
                        }`}
                      >
                        <Zap className="w-3 h-3 fill-current text-slate-900" />
                        <span>รด{selectedSession}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      fields={[
        { key: 'log_date', label: 'วันที่', type: 'date', required: true, placeholder: 'เลือกวันที่' },
        { 
          key: 'session', 
          label: 'รอบให้น้ำ', 
          type: 'select', 
          options: ['เช้า', 'เย็น', 'บ่าย'], 
          default: 'เช้า',
          placeholder: '-- เลือกรอบ --' 
        },
        { key: 'plot_id', label: 'แปลง', placeholder: '-- เลือกแปลง --', required: true },
        { key: 'water_source', label: 'แหล่งน้ำ', placeholder: 'เช่น น้ำบาดาล / น้ำประปา' },
        { key: 'water_source_type', label: 'ประเภทน้ำ', placeholder: 'น้ำบาดาล / น้ำประปา / น้ำฝน' },
        { key: 'water_quality', label: 'คุณภาพน้ำ', placeholder: 'เช่น ผ่าน / ไม่ผ่าน' },
        { key: 'contamination_check', label: 'น้ำสะอาด', type: 'bool' },
        { key: 'amount_liters', label: 'ปริมาณ (ลิตร)', type: 'number', placeholder: 'เช่น 50' },
        { key: 'worker_name', label: 'ผู้ปฏิบัติ', placeholder: 'ชื่อผู้ปฏิบัติ' },
        { key: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'หมายเหตุเพิ่มเติม', hideInTable: true },
      ]}
    />
  );
}
