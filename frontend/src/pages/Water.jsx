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
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
            {/* Header row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                    <Droplets className="w-5 h-5 text-emerald-600" />
                  </span>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                      ⚡ กิจวัตรการให้น้ำประจำวัน (เช้า - เย็น)
                    </h2>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      บันทึกการรดน้ำ 2 เวลาตามจริงของฟาร์มผักปลอดภัย กดบันทึกแยก <strong className="text-amber-800">รอบเช้า</strong> และ <strong className="text-indigo-800">รอบเย็น</strong> ได้ในคลิกเดียว
                    </p>
                  </div>
                </div>
              </div>

              {/* Session Selector & Quick Action Button & Preset Settings Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Session Tabs (เช้า vs เย็น) */}
                <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200/90 flex items-center gap-1 shadow-inner shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedSession('เช้า')}
                    className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
                      selectedSession === 'เช้า'
                        ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    <Sun className={`w-4 h-4 shrink-0 ${selectedSession === 'เช้า' ? 'text-amber-950' : 'text-amber-600'}`} />
                    <span className="whitespace-nowrap">รอบเช้า</span>
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                      selectedSession === 'เช้า'
                        ? 'bg-amber-500/30 text-amber-950'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}>
                      {morningCount}/{activePlots.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSession('เย็น')}
                    className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
                      selectedSession === 'เย็น'
                        ? 'bg-indigo-600 text-white shadow-sm font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    <Moon className={`w-4 h-4 shrink-0 ${selectedSession === 'เย็น' ? 'text-white' : 'text-indigo-500'}`} />
                    <span className="whitespace-nowrap">รอบเย็น</span>
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                      selectedSession === 'เย็น'
                        ? 'bg-indigo-700/50 text-white'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}>
                      {eveningCount}/{activePlots.length}
                    </span>
                  </button>
                </div>

                {/* Quick Action Button: Water All */}
                <button
                  onClick={handleQuickAll}
                  disabled={loadingAction || isCurrentSessionCompleted || activePlots.length === 0}
                  className={`inline-flex items-center justify-center gap-2 font-bold px-5 py-2.5 rounded-2xl text-xs sm:text-sm shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap ${
                    isCurrentSessionCompleted
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-not-allowed'
                      : selectedSession === 'เช้า'
                      ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-black shadow-amber-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-indigo-200'
                  }`}
                >
                  {isCurrentSessionCompleted ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>รดน้ำรอบ{selectedSession}ครบทุกแปลงแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>⚡ รดน้ำรอบ{selectedSession}ทุกแปลง ({activePlots.length - wateredCount} แปลง)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Status Progress Bar Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-slate-700 font-medium">
                    สถานะรอบ{selectedSession}:{' '}
                    <strong className="text-slate-950 font-black text-sm">
                      รดแล้ว {wateredCount} จาก {activePlots.length} แปลง
                    </strong>
                  </span>

                  <div className="flex items-center gap-3 text-[11px] font-bold">
                    <span className="flex items-center gap-1 bg-amber-50 text-amber-900 px-2 py-0.5 rounded-lg border border-amber-200/80">
                      <Sun className="w-3.5 h-3.5 text-amber-600" /> เช้า: <strong>{morningCount}/{activePlots.length}</strong>
                    </span>
                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded-lg border border-indigo-200/80">
                      <Moon className="w-3.5 h-3.5 text-indigo-600" /> เย็น: <strong>{eveningCount}/{activePlots.length}</strong>
                    </span>
                  </div>
                </div>

                <span className="text-xs font-mono text-emerald-800 font-black bg-emerald-100/70 px-2.5 py-0.5 rounded-lg">
                  {activePlots.length > 0 ? Math.round((wateredCount / activePlots.length) * 100) : 0}% ของรอบ{selectedSession}
                </span>
              </div>

              {/* Progress line */}
              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    selectedSession === 'เช้า'
                      ? 'bg-amber-400'
                      : 'bg-indigo-500'
                  }`}
                  style={{
                    width: `${activePlots.length > 0 ? (wateredCount / activePlots.length) * 100 : 0}%`,
                  }}
                />
              </div>

              {/* Individual Active Plots 1-Click Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                {activePlots.map(p => {
                  const isWatered = currentSet.has(p.id);
                  const isMorningDone = morningSet.has(p.id);
                  const isEveningDone = eveningSet.has(p.id);

                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl p-3.5 border transition-all flex items-center justify-between gap-2 shadow-2xs ${
                        isWatered
                          ? 'bg-emerald-50/80 border-emerald-200/90 text-emerald-950'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-black text-slate-900 text-xs truncate flex items-center gap-1.5">
                          <span className="truncate">{p.name}</span>
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300/80 shrink-0 font-black">
                            #{getCropCycleId(p)}
                          </span>
                        </div>

                        <div className="text-[11px] font-bold text-slate-700 truncate flex items-center gap-1.5">
                          <span className="text-emerald-800 font-semibold">{p.crop_name}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-900 font-black">{p.default_water_liters || 50}L</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] font-medium">
                          <span className={`px-1.5 py-0.5 rounded-md border ${
                            isMorningDone
                              ? 'bg-amber-100 text-amber-950 border-amber-300 font-black'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            เช้า {isMorningDone ? '✓' : '—'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-md border ${
                            isEveningDone
                              ? 'bg-indigo-100 text-indigo-950 border-indigo-300 font-black'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            เย็น {isEveningDone ? '✓' : '—'}
                          </span>
                        </div>
                      </div>

                      {isWatered ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-1.5 rounded-xl border border-emerald-300 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> รดแล้ว
                        </span>
                      ) : (
                        <button
                          onClick={() => handleQuickLog(p.id)}
                          disabled={loadingAction}
                          className={`inline-flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-xl shadow-xs transition shrink-0 cursor-pointer active:scale-95 ${
                            selectedSession === 'เช้า'
                              ? 'bg-amber-400 hover:bg-amber-500 text-slate-950'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 fill-current" />
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
