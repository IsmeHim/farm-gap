import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import {
  BadgeCheck,
  Bug,
  Droplets,
  ExternalLink,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Leaf,
  LogOut,
  Map,
  Menu,
  MessageCircle,
  Package,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  Sprout,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';

const menuGroups = [
  {
    group: null,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'แดชบอร์ดภาพรวม', end: true },
    ]
  },
  {
    group: '1. การเพาะปลูก',
    items: [
      { to: '/plots', icon: Map, label: 'แปลงปลูก & รอบการผลิต' },
      { to: '/crops', icon: Sprout, label: 'คลังชนิดผัก' },
    ]
  },
  {
    group: '2. การดูแลแปลงประจำวัน',
    items: [
      { to: '/water', icon: Droplets, label: 'ระบบน้ำ & บันทึกรดน้ำ' },
      { to: '/chemicals', icon: FlaskConical, label: 'ปุ๋ย & สารบำรุง' },
      { to: '/pests', icon: Bug, label: 'ศัตรูพืช & โรคพืช' },
    ]
  },
  {
    group: '3. ผลผลิต & การขาย',
    items: [
      { to: '/harvest', icon: Leaf, label: 'เก็บเกี่ยวผลผลิต' },
      { to: '/storage', icon: Package, label: 'พักผลผลิต & ห้องเย็น' },
      { to: '/products', icon: ShoppingBag, label: 'คลังสินค้าหน้าร้าน' },
      { to: '/orders', icon: ReceiptText, label: 'คำสั่งซื้อจาก LINE' },
    ]
  },
  {
    group: '4. การเงิน & มาตรฐาน GAP',
    items: [
      { to: '/costs', icon: Wallet, label: 'บันทึกต้นทุนฟาร์ม' },
      { to: '/sales-report', icon: TrendingUp, label: 'รายงานยอดขาย' },
      { to: '/report', icon: FileText, label: 'สมุดบันทึก GAP' },
      { to: '/profile', icon: UserCog, label: 'ตั้งค่าฟาร์ม & บัญชี' },
    ]
  },
];

function BrandMark({ compact = false }) {
  return (
    <div className={`relative ${compact ? 'h-10 w-10' : 'h-12 w-12'} rounded-2xl bg-[#173f2a] flex items-center justify-center shadow-xl shadow-emerald-900/15`}>
      <ShoppingBag className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} text-[#f4d27a]`} />
      <Leaf className="absolute -right-1 -top-1 h-4 w-4 fill-emerald-300 text-emerald-300" />
      <BadgeCheck className="absolute -bottom-1 -right-1 h-4 w-4 fill-[#173f2a] text-emerald-200" />
    </div>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-transparent print:h-auto print:overflow-visible print:block">
      {/* Mobile/Tablet Header - Hidden on Desktop (lg:) and in Print */}
      <header className="lg:hidden print:hidden bg-white/90 backdrop-blur border-b border-emerald-100 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <BrandMark compact />
          <div>
            <div className="font-black tracking-wide text-[#173f2a]">FarmGAP Goods</div>
            <div className="text-xs text-emerald-700 truncate w-40">{user?.farm_name || user?.email}</div>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="rounded-lg border border-emerald-100 p-2 text-primary shadow-sm hover:bg-emerald-50">
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Main Layout Body */}
      <div className="flex flex-1 h-full overflow-hidden print:h-auto print:overflow-visible print:block">
        {/* Sticky/Fixed Sidebar - Drawer on Mobile/Tablet (<lg), Static on Desktop (lg+) */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-[#fdfef9]/95 backdrop-blur-xl border-r border-emerald-100 p-4 flex flex-col shrink-0 h-full overflow-y-auto transition duration-200 ease-out lg:static lg:translate-x-0 print:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="surface relative rounded-2xl p-4 mb-4 shrink-0">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#b5812d]">premium produce</div>
                <div className="text-lg font-black leading-tight text-[#173f2a]">FarmGAP Goods</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              <Sparkles className="h-4 w-4 text-[#b5812d]" />
              <span className="truncate">{user?.farm_name || user?.email}</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="absolute right-3 top-3 lg:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-3 overflow-y-auto pr-1">
            {menuGroups.map((grp, gIdx) => (
              <div key={gIdx} className="space-y-1">
                {grp.group && (
                  <div className="px-3 pt-2 pb-0.5 text-[10.5px] font-black uppercase tracking-wider text-emerald-900/60 flex items-center gap-1.5">
                    <span>{grp.group}</span>
                  </div>
                )}
                {grp.items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-[#173f2a] text-white shadow-md shadow-emerald-900/15'
                          : 'text-slate-700 hover:bg-emerald-50 hover:text-[#173f2a]'
                      }`
                    }
                  >
                    <it.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{it.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* LINE OA LIFF Hub */}
          <div className="mt-3 pt-3 border-t border-emerald-100 shrink-0">
            <div className="px-3 mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              <span className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-green-600" /> LINE OA & หน้าร้าน</span>
              <span className="bg-green-100 text-green-700 text-[9px] px-1.5 py-0.5 rounded font-bold">LIFF</span>
            </div>
            <div className="space-y-1">
              <a
                href="/liff/order"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-green-50 hover:text-green-800 transition group"
              >
                <span className="flex items-center gap-2">🛒 หน้าร้านสั่งซื้อผัก</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-green-600" />
              </a>
              <a
                href="/liff/history"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-green-50 hover:text-green-800 transition group"
              >
                <span className="flex items-center gap-2">📦 ติดตามออเดอร์ลูกค้า</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-green-600" />
              </a>
            </div>
          </div>

          <button onClick={() => { logout(); nav('/login'); }} className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 shrink-0">
            <LogOut className="w-4 h-4" /> ออกจากระบบ
          </button>
        </aside>

        {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden print:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Scrollable Main Content Area - Responsive Tablet/Desktop Padding */}
        <main className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 print:p-0 print:overflow-visible print:h-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
