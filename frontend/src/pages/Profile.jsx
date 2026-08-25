import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Building, User, Mail, Lock, ShieldCheck, Save, Sparkles, CheckCircle2, Leaf, QrCode } from 'lucide-react';
import { format } from 'date-fns';

export default function Profile() {
  const { user, updateProfile } = useAuth();

  const [form, setForm] = useState({
    displayName: '',
    farmName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/auth/me');
        setUserData(res.data);
        setForm({
          displayName: res.data.display_name || '',
          farmName: res.data.farm_name || '',
          email: res.data.email || '',
          password: '',
          confirmPassword: '',
        });
      } catch (e) {
        if (user) {
          setForm(prev => ({
            ...prev,
            displayName: user.display_name || '',
            farmName: user.farm_name || '',
            email: user.email || '',
          }));
        }
      } finally {
        setFetching(false);
      }
    })();
  }, [user]);

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
        farm_name: form.farmName,
      };
      if (form.password) {
        payload.password = form.password;
      }

      const res = await api.put('/api/auth/profile', payload);
      updateProfile(res.data.user, res.data.token);
      setUserData(res.data.user);
      setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
      toast.success('บันทึกการตั้งค่าโปรไฟล์และชื่อฟาร์มสำเร็จ!');
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
          กำหนดชื่อฟาร์ม ข้อมูลเจ้าของแปลง เพื่อนำไปใช้ออกเอกสารมาตรฐาน GAP รายงานประจำปี และระบบสั่งซื้อออนไลน์
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

            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                สถานะความปลอดภัยฟาร์ม
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                ชื่อฟาร์มและชื่อเจ้าของแปลงนี้จะแสดงในหัวเอกสาร <strong>แบบบันทึกมาตรฐาน GAP</strong> และรายงานการตรวจรับรองประจำปีโดยอัตโนมัติ
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
                className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-6 py-3 rounded-xl transition shadow-md disabled:opacity-50"
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
