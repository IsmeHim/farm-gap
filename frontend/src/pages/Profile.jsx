import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Building, User, Mail, Lock, ShieldCheck, Save, Sparkles, CheckCircle2, Leaf, QrCode, CreditCard, Wallet, ExternalLink, Image as ImageIcon, Bell, Smartphone, Send, Globe, Download, Check, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { generatePromptPayQR } from '../lib/promptpay';

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

export default function Profile() {
  const { user, updateProfile } = useAuth();

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
  });
  const [loading, setLoading] = useState(false);
  const [testingLine, setTestingLine] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [userData, setUserData] = useState(null);
  const [testAmount, setTestAmount] = useState('150');
  const [testQrDataUrl, setTestQrDataUrl] = useState(null);
  const [generatingTestQr, setGeneratingTestQr] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

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

  // Generate real-time Dynamic EMVCo QR Code for testing locked amount
  useEffect(() => {
    const rawNumber = (form.promptpayNumber || '').replace(/[^0-9]/g, '');
    if (!rawNumber || (rawNumber.length !== 10 && rawNumber.length !== 13)) {
      setTestQrDataUrl(null);
      return;
    }
    let active = true;
    setGeneratingTestQr(true);
    const amt = parseFloat(testAmount);
    generatePromptPayQR(rawNumber, !isNaN(amt) && amt > 0 ? amt : undefined, { width: 280, margin: 1 })
      .then(url => {
        if (active) setTestQrDataUrl(url);
      })
      .catch(err => {
        console.error('Failed to generate test PromptPay QR:', err);
      })
      .finally(() => {
        if (active) setGeneratingTestQr(false);
      });
    return () => { active = false; };
  }, [form.promptpayNumber, testAmount]);

  const handleDownloadTestQr = () => {
    if (!testQrDataUrl) return;
    const a = document.createElement('a');
    a.href = testQrDataUrl;
    const amtStr = parseFloat(testAmount) > 0 ? `-${parseFloat(testAmount).toFixed(0)}THB` : '';
    a.download = `PromptPay-Test${amtStr}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('ดาวน์โหลดรูปภาพ QR Code พร้อมเพย์เรียบร้อยแล้ว!');
  };

  const handleCopyTestText = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`คัดลอก ${label} แล้ว`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGeneratePromptPayQr = () => {
    const rawNumber = (form.promptpayNumber || '').replace(/[^0-9]/g, '');
    if (!rawNumber || (rawNumber.length !== 10 && rawNumber.length !== 13)) {
      toast.error('กรุณากรอกเบอร์พร้อมเพย์ 10 หลัก หรือเลขบัตรประชาชน 13 หลักให้ถูกต้องก่อน');
      return;
    }
    const autoQrUrl = `https://promptpay.io/${rawNumber}.png`;
    setForm(prev => ({ ...prev, promptpayQrUrl: autoQrUrl }));
    toast.success('สร้างลิงก์ QR Code พร้อมเพย์อัตโนมัติสำเร็จ!');
  };

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

  const handleUseCurrentOrigin = () => {
    const currentOrigin = window.location.origin;
    setForm(prev => ({ ...prev, frontendUrl: currentOrigin }));
    toast.info(`นำโดเมนหน้าเว็บปัจจุบัน (${currentOrigin}) มาใส่เรียบร้อยแล้ว อย่าลืมกดบันทึกการตั้งค่าครับ`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password && form.password.length < 6) {
      toast.error('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      toast.error('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
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
      };
      if (form.password) {
        payload.password = form.password;
      }

      const res = await api.put('/api/auth/profile', payload);
      updateProfile(res.data.user, res.data.token);
      setUserData(res.data.user);
      setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
      toast.success('บันทึกการตั้งค่าข้อมูลฟาร์มและระบบแจ้งเตือนสำเร็จ!');
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#173f2a] flex items-center gap-2">
          <Building className="w-7 h-7 text-emerald-700" />
          ตั้งค่าฟาร์มและข้อมูลผู้ใช้งาน
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          กำหนดชื่อฟาร์ม บัญชีธนาคารรับเงิน สำหรับออกเอกสารมาตรฐาน GAP และระบบสั่งซื้อผักทาง LINE
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Farm GAP Info Card */}
        <div className="space-y-6">
          <div className="surface rounded-3xl p-6 bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-800 to-green-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/20">
                <Leaf className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  GAP CERTIFIED FARM
                </span>
                <h3 className="font-bold text-slate-800 text-sm truncate mt-1">
                  {userData?.farm_name || 'ยังไม่ได้ระบุชื่อฟาร์ม'}
                </h3>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">เจ้าของฟาร์ม:</span>
                <span className="font-semibold text-slate-700">{userData?.display_name || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">ชื่อผู้ใช้ (Username):</span>
                <span className="font-semibold font-mono text-emerald-700">{userData?.username || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">อีเมลล็อกอิน:</span>
                <span className="font-semibold text-slate-700">{userData?.email || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">ระดับสิทธิ์:</span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold text-[10px]">
                  {userData?.role === 'owner' ? 'เจ้าของฟาร์ม (Owner)' : 'ผู้ดูแลแปลง (Worker)'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">วันที่ลงทะเบียน:</span>
                <span className="text-slate-500">
                  {userData?.created_at ? format(new Date(userData.created_at), 'dd/MM/yyyy') : '-'}
                </span>
              </div>
            </div>

            {/* Bank Summary Badge */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                บัญชีรับเงินปัจจุบัน:
              </div>
              {userData?.bank_account_no || userData?.promptpay_number ? (
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70 text-[11px] space-y-0.5 text-slate-700">
                  <div className="font-semibold text-emerald-800">{userData.bank_name || 'ธนาคารทั่วไป'}</div>
                  <div>เลขบัญชี: <span className="font-mono font-medium">{userData.bank_account_no || '-'}</span></div>
                  {userData.promptpay_number && (
                    <div>พร้อมเพย์: <span className="font-mono font-medium">{userData.promptpay_number}</span></div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-amber-600 bg-amber-50 rounded-xl p-2.5 border border-amber-100">
                  ยังไม่ได้ตั้งค่าบัญชีรับเงิน (จะใช้บัญชีเริ่มต้นของระบบ)
                </div>
              )}
            </div>

            {/* LINE Admin Notification Badge */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Bell className="w-3.5 h-3.5 text-emerald-700" />
                แจ้งเตือนออเดอร์เข้า LINE:
              </div>
              {userData?.line_user_id ? (
                <div className="bg-emerald-50 text-emerald-900 rounded-xl p-2.5 border border-emerald-200 text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    เชื่อมต่อ LINE สำเร็จ
                  </div>
                  <div className="text-[10px] text-emerald-700 font-mono truncate">
                    {userData.line_user_id}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
                  ยังไม่ได้ผูก LINE (พิมพ์ <span className="font-mono font-bold text-emerald-700">myid</span> ในแชท LINE OA)
                </div>
              )}
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                สถานะความปลอดภัยฟาร์ม
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                ชื่อฟาร์มและข้อมูลบัญชีธนาคารนี้จะแสดงบน <strong>ใบแจ้งหนี้ใน LINE บอท</strong> และหน้า <strong>LINE LIFF สำหรับลูกค้า</strong> โดยอัตโนมัติ
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Settings Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="surface rounded-3xl p-6 sm:p-8 bg-white border border-slate-200/80 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              แก้ไขข้อมูลฟาร์มและโปรไฟล์
            </h2>

            {/* Farm Name */}
            <div className="space-y-1.5">
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
              <p className="text-[11px] text-slate-400">ชื่อนี้จะแสดงบนหัวเอกสารรายงาน GAP และหน้าร้านค้า LINE LIFF</p>
            </div>

            {/* Owner Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-700" />
                ชื่อ-นามสกุล เจ้าของฟาร์ม / ผู้ขอรับรอง GAP <span className="text-rose-500">*</span>
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
                placeholder="เช่น admin, boss (ภาษาอังกฤษ/ตัวเลข)"
                className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 font-mono"
              />
              <p className="text-[11px] text-slate-400">
                สามารถใช้ชื่อผู้ใช้นี้คู่กับรหัสผ่านเพื่อเข้าสู่ระบบแทนอีเมลได้
              </p>
            </div>

            {/* Farm Contact Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-700" />
                เบอร์โทรศัพท์ติดต่อฟาร์ม (สำหรับลูกค้าโทรสอบถาม / ขอเงินคืน)
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="เช่น 099-068-4331 หรือ 0812345678"
                className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
              />
              <p className="text-[11px] text-slate-400">
                เบอร์นี้จะถูกนำไปใช้ใน LINE Chatbot เพื่อให้ลูกค้าโทรติดต่อโดยตรง หรือใช้เมื่อลูกค้าสอบถามขั้นตอนขอเงินคืน
              </p>
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

            {/* Bank & Payment Information Section */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-700" />
                  ช่องทางการโอนเงินและชำระค่าสินค้า (Payment Settings)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ข้อมูลนี้จะแสดงในบิลแจ้งหนี้ที่ LINE บอทส่งให้ลูกค้า และหน้าร้านค้าออนไลน์ (LIFF)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {/* Account Holder Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">ชื่อเจ้าของบัญชี</label>
                  <input
                    type="text"
                    value={form.bankAccountName}
                    onChange={e => setForm(prev => ({ ...prev, bankAccountName: e.target.value }))}
                    placeholder="เช่น นายสมชาย ใจดี หรือ ฟาร์มผักกรีน"
                    className="input text-xs w-full py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {/* PromptPay Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">เบอร์พร้อมเพย์ (PromptPay)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.promptpayNumber}
                      onChange={e => setForm(prev => ({ ...prev, promptpayNumber: e.target.value }))}
                      placeholder="เช่น 0812345678 หรือ เลขบัตร ปชช."
                      className="input text-xs flex-1 py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={handleGeneratePromptPayQr}
                      title="สร้าง QR Code อัตโนมัติจากเบอร์พร้อมเพย์"
                      className="px-3 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 text-[11px] font-bold rounded-xl whitespace-nowrap transition"
                    >
                      ⚡ สร้าง QR
                    </button>
                  </div>
                </div>
              </div>

              {/* QR Code URL & Preview */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>URL รูปภาพ QR Code ชำระเงิน (Direct Image Link)</span>
                  {form.promptpayQrUrl && (
                    <a
                      href={form.promptpayQrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-normal"
                    >
                      เปิดดูรูปเต็ม <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.promptpayQrUrl}
                    onChange={e => setForm(prev => ({ ...prev, promptpayQrUrl: e.target.value }))}
                    placeholder="https://... (เช่น https://promptpay.io/0812345678.png)"
                    className="input text-xs flex-1 py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 font-mono text-[11px]"
                  />
                  {form.promptpayQrUrl && (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, promptpayQrUrl: '' }))}
                      className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[11px] font-semibold rounded-xl"
                    >
                      ลบรูป
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  * ต้องเป็น URL ที่ขึ้นต้นด้วย <code>https://</code> เพื่อให้ LINE Flex Message สามารถแสดงผล QR Code ในแชทได้ถูกต้อง
                </p>

                {/* QR Code Preview */}
                {form.promptpayQrUrl && (
                  <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl inline-flex items-center gap-4">
                    <img
                      src={form.promptpayQrUrl}
                      alt="Payment QR Preview"
                      className="w-24 h-24 object-contain bg-white rounded-xl border border-slate-200 shadow-xs"
                      onError={e => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-slate-800 flex items-center gap-1">
                        <QrCode className="w-4 h-4 text-emerald-700" />
                        ตัวอย่าง QR Code สำหรับสแกนจ่าย
                      </div>
                      <p className="text-[11px] text-slate-500">
                        รูปนี้จะปรากฏในใบแจ้งหนี้ให้ลูกค้าสแกนจ่ายได้ทันที
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Dynamic PromptPay QR Tester & Live Preview */}
              <div className="mt-4 p-4 sm:p-5 bg-gradient-to-br from-emerald-50/70 via-white to-blue-50/50 rounded-2xl border-2 border-emerald-200/80 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
                  <div>
                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>ระบบ QR Code พร้อมเพย์ ล็อกยอดเงินอัตโนมัติ (EMVCo Dynamic QR)</span>
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">ใหม่</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ระบบสร้าง QR Code มาตรฐาน Thai QR Payment โดยใส่ Tag 54 กำหนดยอดเงินที่ต้องชำระลงไปในตัว QR ทันที เมื่อลูกค้าสแกน แอปธนาคารจะล็อกยอดเงินอัตโนมัติ ป้องกันลูกค้ากรอกตัวเลขผิด 100%
                    </p>
                  </div>
                </div>

                {form.promptpayNumber ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* Test Amount Controls */}
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-700 block">
                        ทดลองระบุยอดเงินเพื่อทดสอบสแกน (บาท):
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">฿</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={testAmount}
                          onChange={e => setTestAmount(e.target.value)}
                          placeholder="เช่น 150"
                          className="input text-sm font-bold pl-8 pr-4 py-2.5 w-full rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                      {/* Quick Amount Buttons */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[11px] text-slate-400 self-center mr-1">ยอดทดสอบ:</span>
                        {['50', '100', '150', '250', '500'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setTestAmount(val)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                              testAmount === val
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                            }`}
                          >
                            ฿{val}
                          </button>
                        ))}
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-1 bg-white/80 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>เบอร์รับเงิน: <span className="font-mono">{form.promptpayNumber}</span></span>
                        </div>
                        <p className="text-slate-500 leading-relaxed">
                          หยิบมือถือเปิดแอปธนาคาร (เช่น K PLUS, SCB EASY, Krungthai NEXT) ลองสแกน QR รูปด้านข้างนี้ จะพบว่ายอดเงินจะขึ้น <strong className="text-emerald-700">฿{parseFloat(testAmount) > 0 ? parseFloat(testAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}</strong> ล็อกไว้ให้อัตโนมัติทันที
                        </p>
                      </div>
                    </div>

                    {/* QR Card Preview */}
                    <div className="flex flex-col items-center justify-center p-3">
                      {testQrDataUrl ? (
                        <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-100 shadow-md flex flex-col items-center w-full max-w-[240px]">
                          {/* Thai QR Payment header banner */}
                          <div className="w-full bg-[#003B71] text-white py-1 px-2 rounded-t-lg text-center mb-2">
                            <div className="text-[9px] font-black tracking-wider uppercase">THAI QR PAYMENT</div>
                            <div className="text-[8px] opacity-80">พร้อมเพย์</div>
                          </div>

                          <img
                            src={testQrDataUrl}
                            alt="Test PromptPay QR"
                            className="w-40 h-40 object-contain rounded-lg"
                          />

                          {parseFloat(testAmount) > 0 ? (
                            <div className="mt-2 text-center w-full">
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                                <Lock className="w-3 h-3" /> ล็อกยอด ฿{parseFloat(testAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ) : (
                            <div className="mt-2 text-[11px] text-slate-400">QR ไม่ระบุยอด (ผู้โอนกรอกเอง)</div>
                          )}

                          <button
                            type="button"
                            onClick={handleDownloadTestQr}
                            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs py-1.5 px-3 rounded-xl border border-emerald-200 transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600" />
                            <span>ดาวน์โหลดรูป QR</span>
                          </button>
                        </div>
                      ) : (
                        <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
                          <QrCode className="w-8 h-8 opacity-40 mb-1" />
                          <span>{generatingTestQr ? 'กำลังสร้าง QR Code...' : 'กรุณาระบุเบอร์พร้อมเพย์ 10 หลัก'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50/70 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>กรอกเบอร์พร้อมเพย์ด้านบน แล้วกดบันทึก ระบบจะเริ่มสร้าง QR ล็อกยอดให้อัตโนมัติทุกออเดอร์ในทันที</span>
                  </div>
                )}
              </div>
            </div>

            {/* LINE Admin Notification Section */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-700" />
                  การแจ้งเตือนคำสั่งซื้อเข้า LINE เจ้าของฟาร์ม (LINE Admin Notification)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  เมื่อมีลูกค้าสั่งซื้อผักสดใหม่ หรือมีการแนบสลิปโอนเงิน ระบบจะส่งการ์ดแจ้งเตือน Flex Message เข้า LINE ส่วนตัวของคุณทันที
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                      LINE User ID ของเจ้าของฟาร์ม (User ID ขึ้นต้นด้วยตัว U ความยาว 33 หลัก)
                    </span>
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
                <div className="bg-white border border-emerald-100 rounded-xl p-3.5 text-xs space-y-2">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    วิธีดู LINE User ID ของคุณแบบง่ายๆ ใน 5 วินาที:
                  </div>
                  <ol className="list-decimal list-inside text-[11px] text-slate-600 space-y-1 pl-1 leading-relaxed">
                    <li>เปิดห้องแชท LINE Official Account ของฟาร์ม</li>
                    <li>พิมพ์คำว่า <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">myid</span> หรือ <span className="font-bold text-emerald-700">แอดมิน</span> แล้วกดส่งในแชท</li>
                    <li>LINE บอทจะตอบกลับเป็นรหัส <strong>LINE User ID (ขึ้นต้นด้วย U...)</strong> ให้ทันที</li>
                    <li>แตะค้างเพื่อคัดลอกรหัสดังกล่าว แล้วนำมาวางในช่องด้านบนนี้ จากนั้นกดปุ่ม <strong>"บันทึกการตั้งค่า"</strong></li>
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
                        title="ใช้ที่อยู่เว็บไซต์ปัจจุบันในเบราว์เซอร์นี้"
                      >
                        ⚡ ใช้โดเมนปัจจุบัน
                      </button>
                      {form.frontendUrl && (
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, frontendUrl: '' }))}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-medium hover:underline cursor-pointer"
                          title="ล้างค่าเพื่อให้กลับไปใช้ค่าเริ่มต้นจากเซิร์ฟเวอร์ (.env)"
                        >
                          ล้างค่า
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={form.frontendUrl}
                      onChange={e => setForm(prev => ({ ...prev, frontendUrl: e.target.value }))}
                      placeholder="เช่น https://xxxx-xx-xx.ngrok-free.app หรือ https://farmgap.com (เว้นว่าง = ค่าเริ่มต้น)"
                      className="input text-xs flex-1 py-2.5 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 font-mono text-[11px] bg-white"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-1 leading-relaxed">
                    <p>
                      • <strong>ใช้แก้ปัญหาลิงก์เปิดไม่ได้ในมือถือ:</strong> ปลายทางของปุ่ม <span className="font-semibold text-slate-700">"🖨️ พิมพ์ใบปะหน้า"</span> และ <span className="font-semibold text-slate-700">"📦 เปิดดูรายการออเดอร์"</span> ใน LINE จะใช้ลิงก์นี้
                    </p>
                    <p>
                      • <strong>โหมดทดสอบ (ngrok):</strong> วาง URL ของ ngrok เช่น <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">https://xxxx.ngrok-free.app</code> แล้วกดบันทึก เมื่อกดปุ่มจากในมือถือจะเข้าเว็บได้ทันที
                    </p>
                    <p>
                      • <strong>โหมดใช้งานจริง (Production):</strong> เมื่อนำขึ้นโฮสติ้งจริง สามารถใส่โดเมนจริงของคุณ หรือล้างช่องนี้ให้ว่างไว้ ระบบจะอ่านค่าจากตัวแปร <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">FRONTEND_URL</code> ในไฟล์ <code className="bg-slate-100 px-1 py-0.5 rounded">.env</code> ให้อัตโนมัติ
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Password Section */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-600" />
                  เปลี่ยนรหัสผ่านใหม่ (หากไม่ต้องการเปลี่ยนให้เว้นว่างไว้)
                </h3>
              </div>

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

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-6 py-3 rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer"
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
