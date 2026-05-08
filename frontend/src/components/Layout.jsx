import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Sprout, LayoutDashboard, Map, Droplets, FlaskConical, Bug, Leaf, Package, Users, Wallet, FileText, LogOut, Menu, X } from 'lucide-react';

const items = [
  { to: '/', icon: LayoutDashboard, label: 'แดชบอร์ด', end: true },
  { to: '/plots', icon: Map, label: 'แปลงปลูก' },
  { to: '/water', icon: Droplets, label: 'น้ำ' },
  { to: '/chemicals', icon: FlaskConical, label: 'ปุ๋ย/สารเคมี' },
  { to: '/pests', icon: Bug, label: 'ศัตรูพืช' },
  { to: '/harvest', icon: Leaf, label: 'เก็บเกี่ยว' },
  { to: '/storage', icon: Package, label: 'ขนส่ง/เก็บ' },
  { to: '/workers', icon: Users, label: 'คนงาน' },
  { to: '/costs', icon: Wallet, label: 'ต้นทุน' },
  { to: '/report', icon: FileText, label: 'รายงาน GAP' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold">FarmGAP</div>
            <div className="text-xs text-gray-500 truncate w-32">{user?.farm_name || user?.email}</div>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="rounded-lg border border-gray-200 p-2 text-primary shadow-sm hover:bg-gray-100">
          <Menu className="w-5 h-5" />
        </button>
      </header>

      <div className="flex flex-1">
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-white border-r border-gray-200 p-4 flex flex-col transition duration-200 ease-out md:static md:translate-x-0 md:w-64 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <Sprout className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold">FarmGAP</div>
                <div className="text-xs text-gray-500">{user?.farm_name || user?.email}</div>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1">
            {items.map(it => (
              <NavLink key={it.to} to={it.to} end={it.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition ${isActive ? 'bg-primary text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}>
                <it.icon className="w-5 h-5" />
                <span>{it.label}</span>
              </NavLink>
            ))}
          </nav>

          <button onClick={() => { logout(); nav('/login'); }} className="mt-4 flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium text-gray-700 hover:bg-gray-100">
            <LogOut className="w-4 h-4" /> ออกจากระบบ
          </button>
        </aside>

        {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
