import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
  Building,
  User,
  Mail,
  Lock,
  ShieldCheck,
  Save,
  Sparkles,
  CheckCircle2,
  Leaf,
  CreditCard,
  Bell,
  Smartphone,
  Send,
  Globe,
  Key,
  Eye,
  EyeOff,
  Layers,
  RefreshCw,
  Bot,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

export const GEMINI_FALLBACK_ORDER = [
  "gemini-3.5-flash-lite", // ตัวหลัก: ฟรีวันละ 500 ครั้ง เร็ว ฉลาดพอดีกับงานร้านค้า/ฟาร์ม
  "gemini-3.1-flash-lite", // สำรอง 1: ฟรีอีก 500 ครั้ง/วัน (รวมเป็น 1,000 ครั้ง/วัน)
  "gemini-3.6-flash",      // สำรอง 2: ตัวท็อป (กรณี Lite ใช้งานไม่ได้)
  "gemini-2.5-flash",      // สำรอง 3: รวดเร็ว แม่นยำ รองรับงานร้านค้าและฟาร์ม
  "gemini-2.5-flash-lite", // สำรอง 4: ประหยัดโควต้า ตอบไวมาก
  "gemini-2.0-flash",      // สำรอง 5: เสถียรสูง
];

export const GEMINI_MODEL_OPTIONS = [
  {
    id: "gemini-3.5-flash-lite",
    name: "gemini-3.5-flash-lite",
    desc: "ฟรีวันละ 500 ครั้ง เร็ว ฉลาดพอดีกับงานร้านค้า/ฟาร์ม",
    badge: "ตัวหลัก (แนะนำ)",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "gemini-3.1-flash-lite",
    desc: "ฟรีอีก 500 ครั้ง/วัน (รวมเป็น 1,000 ครั้ง/วัน)",
    badge: "สำรอง 1",
  },
  {
    id: "gemini-3.6-flash",
    name: "gemini-3.6-flash",
    desc: "ตัวท็อป (กรณี Lite ใช้งานไม่ได้)",
    badge: "สำรอง 2",
  },
  {
    id: "gemini-2.5-flash",
    name: "gemini-2.5-flash",
    desc: "รวดเร็ว แม่นยำ รองรับงานร้านค้าและฟาร์ม",
    badge: "สำรอง 3",
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "gemini-2.5-flash-lite",
    desc: "ประหยัดโควต้า ตอบไวมาก",
    badge: "สำรอง 4",
  },
  {
    id: "gemini-2.0-flash",
    name: "gemini-2.0-flash",
    desc: "เสถียรสูง รองรับงานพื้นฐานครบถ้วน",
    badge: "สำรอง 5",
  },
];

function buildModelTryList(primaryModel, autoFallback = true) {
  const startModel = primaryModel || GEMINI_FALLBACK_ORDER[0];
  if (!autoFallback) {
    return [startModel];
  }
  const remaining = GEMINI_FALLBACK_ORDER.filter((m) => m !== startModel);
  return [startModel, ...remaining];
}

const BANK_OPTIONS = [
  'ธนาคารกสิกรไทย (KBANK)',
  'ธนาคารไทยพาณิชย์ (SCB)',
  'ธนาคารกรุงเทพ (BBL)',
  'ธนาคารกรุงไทย (KTB)',
  'ธนาคารทหารไทยธนชาต (TTB)',
  'ธนาคารกรุงศรีอยุธยา (BAY)',
  'ธนาคารออมสิน (GSB)',
  'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)',
  'พร้อมเพย์ (PromptPay)',
  'อื่นๆ',
];

const SETTINGS_TABS = [
  {
    id: 'farm',
    label: 'ข้อมูลฟาร์ม & บัญชีรับเงิน',
    shortLabel: 'ข้อมูลฟาร์ม',
    icon: Building,
    desc: 'ชื่อฟาร์ม GAP เบอร์ติดต่อ และบัญชีธนาคาร',
  },
  {
    id: 'ai',
    label: 'ตั้งค่า AI (Gemini)',
    shortLabel: 'ตั้งค่า AI',
    icon: Bot,
    badge: 'AI-First',
    desc: 'API Key, เลือกโมเดลหลัก 6 ตัว และระบบ Auto Fallback',
  },
  {
    id: 'line',
    label: 'เชื่อมต่อ LINE & โดเมน',
    shortLabel: 'LINE & โดเมน',
    icon: Bell,
    desc: 'แจ้งเตือนออเดอร์เข้า LINE เจ้าของฟาร์ม และลิงก์เว็บไซต์',
  },
  {
    id: 'security',
    label: 'รหัสผ่าน & บัญชีผู้ใช้',
    shortLabel: 'รหัสผ่าน',
    icon: Lock,
    desc: 'ตั้งค่าชื่อผู้ใช้ (Username) และเปลี่ยนรหัสผ่านใหม่',
  },
];

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('farm');

  const [form, setForm] = useState({
    displayName: '',
    username: '',
    farmName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    bankName: '',
    bankAccountNo: '',
    bankAccountName: '',
    promptpayNumber: '',
    promptpayQrUrl: '',
    lineUserId: '',
    frontendUrl: '',
    geminiApiKey: '',
    geminiModel: 'gemini-3.5-flash-lite',
    geminiAutoFallback: true,
    geminiEnabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [testingLine, setTestingLine] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState(null);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/auth/me');
        setUserData(res.data);
        setForm({
          displayName: res.data.display_name || '',
          username: res.data.username || '',
          farmName: res.data.farm_name || '',
          phone: res.data.phone || res.data.promptpay_number || '',
          email: res.data.email || '',
          password: '',
          confirmPassword: '',
          bankName: res.data.bank_name || '',
          bankAccountNo: res.data.bank_account_no || '',
          bankAccountName: res.data.bank_account_name || '',
          promptpayNumber: res.data.promptpay_number || '',
          promptpayQrUrl: res.data.promptpay_qr_url || '',
          lineUserId: res.data.line_user_id || '',
          frontendUrl: res.data.frontend_url || '',
          geminiApiKey: res.data.gemini_api_key || '',
          geminiModel: res.data.gemini_model || 'gemini-3.5-flash-lite',
          geminiAutoFallback: res.data.gemini_auto_fallback !== undefined && res.data.gemini_auto_fallback !== null ? Boolean(res.data.gemini_auto_fallback) : true,
          geminiEnabled: res.data.gemini_enabled !== undefined && res.data.gemini_enabled !== null ? Boolean(res.data.gemini_enabled) : true,
        });
      } catch (err) {
        console.error(err);
        if (user) {
          setForm(prev => ({
            ...prev,
            displayName: user.display_name || '',
            username: user.username || '',
            farmName: user.farm_name || '',
            email: user.email || '',
            bankName: user.bank_name || '',
            bankAccountNo: user.bank_account_no || '',
            bankAccountName: user.bank_account_name || '',
            promptpayNumber: user.promptpay_number || '',
            promptpayQrUrl: user.promptpay_qr_url || '',
            lineUserId: user.line_user_id || '',
            frontendUrl: user.frontend_url || '',
          }));
        }
      } finally {
        setFetching(false);
      }
    })();
  }, [user]);

  const handleTestLineNotification = async () => {
    if (!form.lineUserId || !form.lineUserId.trim()) {
      toast.error('กรุณาระบุ LINE User ID ก่อนทดสอบส่งข้อความ');
      return;
    }
    if (!form.lineUserId.trim().startsWith('U')) {
      toast.error('LINE User ID ไม่ถูกต้อง (รหัสต้องขึ้นต้นด้วยตัว U และมีความยาว 33 ตัวอักษร)');
      return;
    }
    setTestingLine(true);
    try {
      const res = await api.post('/api/auth/test-line-notification', {
        line_user_id: form.lineUserId.trim(),
      });
      toast.success(res.data?.message || 'ส่งข้อความแจ้งเตือนทดสอบเข้า LINE เรียบร้อยแล้ว!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการทดสอบส่งข้อความเข้า LINE');
    } finally {
      setTestingLine(false);
    }
  };

  const handleTestGeminiConnection = async () => {
    if (!form.geminiApiKey || !form.geminiApiKey.trim()) {
      toast.error('กรุณากรอก Gemini API Key ก่อนทดสอบ');
      return;
    }
    setTestingGemini(true);
    setGeminiTestResult(null);
    try {
      const res = await api.post('/api/auth/test-gemini', {
        gemini_api_key: form.geminiApiKey.trim(),
        gemini_model: form.geminiModel,
        gemini_auto_fallback: form.geminiAutoFallback,
      });
      setGeminiTestResult(res.data);
      if (res.data?.success) {
        toast.success(`เชื่อมต่อ Gemini AI สำเร็จ! ตอบกลับด้วยโมเดล ${res.data.usedModel}`);
      } else {
        toast.error('เชื่อมต่อไม่สำเร็จ: ' + (res.data?.error || 'กรุณาตรวจสอบ API Key'));
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'ไม่สามารถเชื่อมต่อได้';
      setGeminiTestResult({ success: false, error: errMsg });
      toast.error('เชื่อมต่อไม่สำเร็จ: ' + errMsg);
    } finally {
      setTestingGemini(false);
    }
  };

  const handleUseCurrentOrigin = () => {
    const currentOrigin = window.location.origin;
    setForm(prev => ({ ...prev, frontendUrl: currentOrigin }));
    toast.info(`นำโดเมนหน้าเว็บปัจจุบัน (${currentOrigin}) มาใส่เรียบร้อยแล้ว อย่าลืมกดบันทึกการตั้งค่าครับ`);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (form.password && form.password.length < 6) {
      toast.error('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      setActiveTab('security');
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      toast.error('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      setActiveTab('security');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        display_name: form.displayName,
        username: form.username,
        farm_name: form.farmName,
        phone: form.phone,
        bank_name: form.bankName,
        bank_account_no: form.bankAccountNo,
        bank_account_name: form.bankAccountName,
        promptpay_number: form.promptpayNumber,
        promptpay_qr_url: form.promptpayQrUrl,
        line_user_id: form.lineUserId.trim(),
        frontend_url: form.frontendUrl.trim(),
        gemini_api_key: form.geminiApiKey.trim(),
        gemini_model: form.geminiModel,
        gemini_auto_fallback: form.geminiAutoFallback,
        gemini_enabled: form.geminiEnabled,
      };
      if (form.password) {
        payload.password = form.password;
      }

      const res = await api.put('/api/auth/profile', payload);
      updateProfile(res.data.user, res.data.token);
      setUserData(res.data.user);
      setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
      toast.success('บันทึกการตั้งค่าฟาร์มและระบบ AI สำเร็จ!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="animate-spin text-3xl">🌱</div>
        <p className="text-sm text-slate-500 font-medium">กำลังโหลดข้อมูลโปรไฟล์...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Top Header + Quick Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#173f2a] flex items-center gap-2">
            <Building className="w-7 h-7 text-emerald-700" />
            ตั้งค่าฟาร์มและระบบอัจฉริยะ
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            จัดการข้อมูลฟาร์ม GAP บัญชีรับเงิน การแจ้งเตือน LINE และสมองกล Gemini AI แยกตามหมวดหมู่
          </p>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          {loading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}
        </button>
      </div>

      {/* Category Navigation Tabs */}
      <div className="bg-white/90 backdrop-blur border border-slate-200/80 rounded-2xl p-1.5 shadow-2xs grid grid-cols-2 lg:grid-cols-4 gap-1.5">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold truncate">{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                        isActive
                          ? 'bg-amber-300 text-emerald-950'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <p
                  className={`text-[10px] truncate ${
                    isActive ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {tab.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Farm GAP Info & Interactive Quick Status Card */}
        <div className="lg:col-span-4 space-y-4">
          <div className="surface rounded-3xl p-5 bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-800 to-green-600 flex items-center justify-center text-white shadow-md shadow-emerald-900/20 shrink-0">
                <Leaf className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  GAP CERTIFIED FARM
                </span>
                <h3 className="font-bold text-slate-800 text-sm truncate mt-1">
                  {form.farmName || userData?.farm_name || 'ยังไม่ได้ระบุชื่อฟาร์ม'}
                </h3>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">เจ้าของฟาร์ม:</span>
                <span className="font-semibold text-slate-700">{form.displayName || userData?.display_name || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">ชื่อผู้ใช้ (Username):</span>
                <span className="font-semibold font-mono text-emerald-700">{form.username || userData?.username || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">อีเมลล็อกอิน:</span>
                <span className="font-semibold text-slate-700">{form.email || userData?.email || '-'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">วันที่ลงทะเบียน:</span>
                <span className="text-slate-500">
                  {userData?.created_at ? format(new Date(userData.created_at), 'dd/MM/yyyy') : '-'}
                </span>
              </div>
            </div>

            {/* Interactive Quick Jump Cards */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                สถานะระบบ (คลิกเพื่อตั้งค่าด่วน)
              </div>

              {/* Quick Jump: Gemini AI */}
              <button
                type="button"
                onClick={() => setActiveTab('ai')}
                className={`w-full text-left rounded-2xl p-3 border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  activeTab === 'ai'
                    ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                    : 'bg-slate-50/80 hover:bg-emerald-50/50 border-slate-200/80'
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Bot className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>สมองกล Gemini AI</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                        form.geminiEnabled
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {form.geminiEnabled ? 'เปิดใช้งาน' : 'ปิด'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-700 truncate">
                    รุ่นหลัก: {form.geminiModel}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {/* Quick Jump: Bank Account */}
              <button
                type="button"
                onClick={() => setActiveTab('farm')}
                className={`w-full text-left rounded-2xl p-3 border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  activeTab === 'farm'
                    ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                    : 'bg-slate-50/80 hover:bg-emerald-50/50 border-slate-200/80'
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>บัญชีรับเงิน</span>
                  </div>
                  {form.bankAccountNo || form.promptpayNumber ? (
                    <div className="text-[11px] text-slate-600 truncate">
                      {form.bankName || 'พร้อมเพย์'} • {form.bankAccountNo || form.promptpayNumber}
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-600">ยังไม่ได้ระบุเลขบัญชี</div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {/* Quick Jump: LINE Notification */}
              <button
                type="button"
                onClick={() => setActiveTab('line')}
                className={`w-full text-left rounded-2xl p-3 border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  activeTab === 'line'
                    ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                    : 'bg-slate-50/80 hover:bg-emerald-50/50 border-slate-200/80'
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Bell className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>แจ้งเตือน LINE OA</span>
                    {form.lineUserId && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">
                    {form.lineUserId ? form.lineUserId : 'ยังไม่ได้ผูก LINE User ID'}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Settings Content */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSubmit} className="surface rounded-3xl p-6 sm:p-7 bg-white border border-slate-200/80 shadow-xs space-y-6">
            {/* ==================== TAB 1: FARM & PAYMENT ==================== */}
            {activeTab === 'farm' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <Building className="w-4 h-4 text-emerald-700" />
                      ข้อมูลฟาร์มและช่องทางชำระเงิน
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ข้อมูลนี้ใช้แสดงบนหัวเอกสารรายงาน GAP, ใบปะหน้าพัสดุ และบิลแจ้งหนี้ใน LINE
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Farm Name */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-emerald-700" />
                      ชื่อฟาร์ม / สวนเกษตร (Farm Name) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.farmName}
                      onChange={e => setForm(prev => ({ ...prev, farmName: e.target.value }))}
                      placeholder="เช่น ฟาร์มผักไฮโดรโปนิกส์ กรีนการ์เดน GAP"
                      className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  {/* Owner Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-emerald-700" />
                      ชื่อ-นามสกุล เจ้าของฟาร์ม / ผู้บันทึก GAP <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.displayName}
                      onChange={e => setForm(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="เช่น นายสมชาย ใจดี"
                      className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  {/* Farm Contact Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-emerald-700" />
                      เบอร์โทรศัพท์ติดต่อฟาร์ม
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="เช่น 099-068-4331"
                      className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Bank & Payment Information Section */}
                <div className="border-t border-slate-100 pt-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-700" />
                      บัญชีธนาคารและพร้อมเพย์รับเงินค่าผัก (Payment Settings)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      แสดงในบิลแจ้งหนี้ที่ LINE บอทส่งให้ลูกค้า และหน้าร้านค้าออนไลน์ (LIFF)
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70">
                    {/* Bank Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">ธนาคาร (Bank Name)</label>
                      <select
                        value={form.bankName}
                        onChange={e => setForm(prev => ({ ...prev, bankName: e.target.value }))}
                        className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                      >
                        <option value="">-- เลือกธนาคาร --</option>
                        {BANK_OPTIONS.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* Bank Account No */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">เลขที่บัญชีธนาคาร</label>
                      <input
                        type="text"
                        value={form.bankAccountNo}
                        onChange={e => setForm(prev => ({ ...prev, bankAccountNo: e.target.value }))}
                        placeholder="เช่น 123-4-56789-0"
                        className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                      />
                    </div>

                    {/* Account Holder Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">ชื่อเจ้าของบัญชี</label>
                      <input
                        type="text"
                        value={form.bankAccountName}
                        onChange={e => setForm(prev => ({ ...prev, bankAccountName: e.target.value }))}
                        placeholder="เช่น นายสมชาย ใจดี"
                        className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                      />
                    </div>

                    {/* PromptPay Number */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">เบอร์พร้อมเพย์ (PromptPay)</label>
                      <input
                        type="text"
                        value={form.promptpayNumber}
                        onChange={e => setForm(prev => ({ ...prev, promptpayNumber: e.target.value }))}
                        placeholder="เช่น 0812345678 หรือ เลขบัตร ปชช."
                        className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 2: GEMINI AI SETTINGS ==================== */}
            {activeTab === 'ai' && (
              <div className="space-y-5">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <Bot className="w-5 h-5 text-emerald-700" />
                      ตั้งค่า Google Gemini API สำหรับ LINE AI Chatbot
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      สมองกลหลัก (AI-First) สำหรับตอบคำถามลูกค้า รับออเดอร์ และช่วยเจ้าของฟาร์มค้นหา/จัดการออเดอร์ค้างใน LINE
                    </p>
                  </div>
                </div>

                {/* Enable Gemini Switch */}
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      เปิดใช้งาน Gemini AI เป็นสมองหลักใน LINE Chatbot
                    </span>
                    <span className="text-[11px] text-slate-600">
                      วิเคราะห์คำถามธรรมชาติ ตอบข้อมูลออเดอร์ สต็อก แปลงปลูก และส่งการ์ดจัดการออเดอร์ให้เจ้าของฟาร์มอัตโนมัติ
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(form.geminiEnabled)}
                      onChange={(e) => setForm(prev => ({ ...prev, geminiEnabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                  </label>
                </div>

                {/* Gemini API Key Input + Test Button */}
                <div className="space-y-1.5 bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Gemini API Key
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <Key className="w-4 h-4" />
                      </span>
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={form.geminiApiKey}
                        onChange={(e) => setForm(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                        placeholder="AQ.Ab8... หรือ AIzaSy..."
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-10 text-xs font-mono font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestGeminiConnection}
                      disabled={testingGemini || !form.geminiApiKey}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition shadow-2xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingGemini ? 'animate-spin' : ''}`} />
                      {testingGemini ? 'กำลังทดสอบ...' : '⚡ ทดสอบเชื่อมต่อ AI'}
                    </button>
                  </div>

                  {/* Test Result Banner right under API Key for instant feedback */}
                  {geminiTestResult && (
                    <div
                      className={`mt-3 p-3.5 rounded-xl border text-xs space-y-1 ${
                        geminiTestResult.success
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between flex-wrap gap-1">
                        <span>
                          {geminiTestResult.success
                            ? `✅ เชื่อมต่อสำเร็จ! (ตอบกลับโดยโมเดล: ${geminiTestResult.usedModel})`
                            : '❌ ทดสอบการเชื่อมต่อไม่สำเร็จ'}
                        </span>
                        {geminiTestResult.fallbackUsed && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                            สลับใช้โมเดลสำรองอัตโนมัติ
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] opacity-90 break-words">
                        {geminiTestResult.success ? geminiTestResult.response : geminiTestResult.error}
                      </p>
                    </div>
                  )}
                </div>

                {/* Gemini Model Selector (2-Column Compact Grid) */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    เลือกโมเดล Gemini หลัก (Primary AI Model)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {GEMINI_MODEL_OPTIONS.map((m) => {
                      const isSelected = form.geminiModel === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => setForm(prev => ({ ...prev, geminiModel: m.id }))}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-2 ${
                            isSelected
                              ? 'bg-emerald-50/90 border-emerald-600 ring-1 ring-emerald-600 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black font-mono text-slate-900">
                                {m.name}
                              </span>
                              <span
                                className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                  m.id === 'gemini-3.5-flash-lite'
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {m.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug">
                              {m.desc}
                            </p>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected
                                ? 'border-emerald-700 bg-emerald-700 text-white'
                                : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Auto Fallback Mode Toggle */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="pr-2">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-black text-slate-800">
                          โหมด Auto Fallback (สลับโมเดลสำรองอัตโนมัติ)
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        หากโมเดลหลักโควตาเต็มหรือขัดข้อง ระบบจะไล่สลับไปใช้โมเดลสำรอง 1–5 อัตโนมัติทันทีโดยไม่สะดุด
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={form.geminiAutoFallback !== false}
                        onChange={(e) => setForm(prev => ({ ...prev, geminiAutoFallback: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                    </label>
                  </div>

                  {/* Visual Fallback Sequence */}
                  <div className="pt-2.5 border-t border-slate-200/80">
                    <p className="text-[10px] font-bold text-slate-600 mb-1.5">
                      {form.geminiAutoFallback !== false
                        ? '🔄 ลำดับการสลับโมเดลอัตโนมัติ (Fallback Chain):'
                        : '🔒 ปิด Auto Fallback (ใช้เฉพาะโมเดลที่เลือกเท่านั้น):'}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      {buildModelTryList(form.geminiModel, form.geminiAutoFallback !== false).map((modName, idx, arr) => (
                        <span key={modName} className="inline-flex items-center gap-1">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-lg font-bold ${
                              idx === 0
                                ? 'bg-emerald-700 text-white'
                                : 'bg-white text-slate-700 border border-slate-200'
                            }`}
                          >
                            {idx + 1}. {modName}
                          </span>
                          {idx < arr.length - 1 && (
                            <span className="text-[10px] text-slate-400">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 3: LINE & DOMAIN ==================== */}
            {activeTab === 'line' && (
              <div className="space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-700" />
                    การแจ้งเตือน LINE เจ้าของฟาร์ม & โดเมนเว็บไซต์
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ผูก LINE User ID เพื่อรับการ์ดแจ้งเตือนออเดอร์ใหม่ และตั้งค่าลิงก์สำหรับเปิดหน้าเว็บจากในมือถือ
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                      LINE User ID ของเจ้าของฟาร์ม (ขึ้นต้นด้วยตัว U ความยาว 33 หลัก)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={form.lineUserId}
                        onChange={e => setForm(prev => ({ ...prev, lineUserId: e.target.value }))}
                        placeholder="เช่น U1234567890abcdef1234567890abcdef"
                        className="input text-xs flex-1 py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 font-mono text-[11px] bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleTestLineNotification}
                        disabled={testingLine || !form.lineUserId}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {testingLine ? 'กำลังส่งทดสอบ...' : '🧪 ทดสอบส่งข้อความเข้า LINE'}
                      </button>
                    </div>
                  </div>

                  {/* Guide on how to get LINE User ID */}
                  <div className="bg-white border border-emerald-100 rounded-xl p-3.5 text-xs space-y-1.5">
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      วิธีดู LINE User ID ของคุณแบบง่ายๆ ใน 5 วินาที:
                    </div>
                    <ol className="list-decimal list-inside text-[11px] text-slate-600 space-y-1 pl-1 leading-relaxed">
                      <li>เปิดห้องแชท LINE Official Account ของฟาร์ม</li>
                      <li>พิมพ์คำว่า <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">myid</span> หรือ <span className="font-bold text-emerald-700">แอดมิน</span> แล้วกดส่งในแชท</li>
                      <li>คัดลอกรหัส <strong>LINE User ID (ขึ้นต้นด้วย U...)</strong> มาวางในช่องด้านบน แล้วกดบันทึก</li>
                    </ol>
                  </div>

                  {/* Website / ngrok Domain URL for LINE notifications */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-200/80">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-600" />
                        โดเมน / URL เว็บไซต์สำหรับเปิดจาก LINE (Website Base URL)
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleUseCurrentOrigin}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
                        >
                          ⚡ ใช้โดเมนปัจจุบัน
                        </button>
                        {form.frontendUrl && (
                          <button
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, frontendUrl: '' }))}
                            className="text-[11px] text-rose-600 hover:text-rose-800 font-medium hover:underline cursor-pointer"
                          >
                            ล้างค่า
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="url"
                      value={form.frontendUrl}
                      onChange={e => setForm(prev => ({ ...prev, frontendUrl: e.target.value }))}
                      placeholder="เช่น https://xxxx.ngrok-free.dev หรือ https://farmgap.com (เว้นว่าง = ค่าเริ่มต้น)"
                      className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 font-mono text-[11px] bg-white"
                    />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      ใช้กำหนดลิงก์ปุ่ม <strong>"🖨️ พิมพ์ใบปะหน้า"</strong> และ <strong>"📦 เปิดดูรายการออเดอร์"</strong> ใน LINE เพื่อให้กดเปิดจากมือถือได้ทันที
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 4: SECURITY & ACCOUNT ==================== */}
            {activeTab === 'security' && (
              <div className="space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-600" />
                    บัญชีผู้ใช้งานและรหัสผ่าน (Account & Security)
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ตั้งค่าชื่อผู้ใช้ (Username) สำหรับเข้าสู่ระบบ และเปลี่ยนรหัสผ่านใหม่
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Username */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-emerald-700" />
                      ชื่อผู้ใช้ (Username สำหรับเข้าสู่ระบบ)
                    </label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={e => setForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '') }))}
                      placeholder="เช่น admin, boss"
                      className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 font-mono"
                    />
                  </div>

                  {/* Email (Readonly) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-slate-400" />
                      อีเมลเข้าสู่ระบบ (Email)
                    </label>
                    <input
                      type="email"
                      disabled
                      value={form.email}
                      className="input text-xs w-full py-2.5 px-3.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5 space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-600" />
                    เปลี่ยนรหัสผ่านใหม่ (หากไม่ต้องการเปลี่ยนให้เว้นว่างไว้)
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">รหัสผ่านใหม่</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="ขั้นต่ำ 6 ตัวอักษร"
                        className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">ยืนยันรหัสผ่านใหม่</label>
                      <input
                        type="password"
                        value={form.confirmPassword}
                        onChange={e => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                        className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                สามารถสลับแท็บไปมาได้โดยข้อมูลที่พิมพ์ไว้จะไม่หาย กดปุ่มบันทึกเพื่อเซฟทุกหมวดหมู่พร้อมกัน
              </span>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-6 py-3 rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Save className="w-4 h-4" />
                {loading ? 'กำลังบันทึกข้อมูล...' : 'บันทึกการตั้งค่า'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
