import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { toast } from 'sonner';
import { Sprout } from 'lucide-react';

export default function Login() {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', display_name: '', farm_name: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) nav('/'); }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form);
      toast.success('สำเร็จ');
      nav('/');
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center gap-2 rounded-3xl bg-white px-5 py-4 shadow-md">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-3xl">FarmGAP</div>
              <div className="text-sm text-gray-500">ระบบจัดการฟาร์มแบบ Responsive</div>
            </div>
          </div>
        </div>

        <div className="card shadow-lg">
          <div className="flex flex-col sm:flex-row mb-4 overflow-hidden rounded-3xl border border-gray-200">
            <button onClick={() => setMode('login')} className={`flex-1 py-3 text-sm font-semibold transition ${mode === 'login' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-slate-50'}`}>
              เข้าสู่ระบบ
            </button>
            <button onClick={() => setMode('register')} className={`flex-1 py-3 text-sm font-semibold transition ${mode === 'register' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-slate-50'}`}>
              สมัคร
            </button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (<>
              <div><label className="label">ชื่อ</label><input className="input" value={form.display_name} placeholder="ชื่อผู้ใช้" onChange={e => setForm({ ...form, display_name: e.target.value })} /></div>
              <div><label className="label">ชื่อฟาร์ม</label><input className="input" value={form.farm_name} placeholder="ชื่อฟาร์ม" onChange={e => setForm({ ...form, farm_name: e.target.value })} /></div>
            </>)}
            <div><label className="label">อีเมล</label><input className="input" type="email" required placeholder="example@mail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" /></div>
            <div><label className="label">รหัสผ่าน</label><input className="input" type="password" required placeholder="รหัสผ่าน" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="current-password" /></div>
            <button className="btn w-full justify-center" disabled={loading}>{loading ? 'กำลังบันทึก...' : (mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก')}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
