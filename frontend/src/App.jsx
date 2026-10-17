import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';

const Login = lazy(() => import('./pages/Login.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Plots = lazy(() => import('./pages/Plots.jsx'));
const Crops = lazy(() => import('./pages/Crops.jsx'));
const Chemicals = lazy(() => import('./pages/Chemicals.jsx'));
const Pests = lazy(() => import('./pages/Pests.jsx'));
const Harvest = lazy(() => import('./pages/Harvest.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const Storage = lazy(() => import('./pages/Storage.jsx'));
const Costs = lazy(() => import('./pages/Costs.jsx'));
const Report = lazy(() => import('./pages/Report.jsx'));
const Trace = lazy(() => import('./pages/Trace.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const SalesReport = lazy(() => import('./pages/SalesReport.jsx'));
const LiffOrder = lazy(() => import('./pages/LiffOrder.jsx'));
const LiffHistory = lazy(() => import('./pages/LiffHistory.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const ShippingLabel = lazy(() => import('./pages/ShippingLabel.jsx'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] text-slate-500 font-bold text-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span>กำลังโหลดข้อมูล...</span>
      </div>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">กำลังโหลด...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // หากเป็นผู้ใช้ทั่วไป (role user หรือไม่ได้เป็น owner/worker) ให้เด้งไปหน้าสั่งซื้อผักทันที ป้องกันเข้าถึงข้อมูลหลังบ้าน
  if (user.role !== 'owner' && user.role !== 'worker') {
    return <Navigate to="/liff/order" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/trace/:lot" element={<Trace />} />
        <Route path="/orders/:id/print" element={<ShippingLabel />} />
        <Route path="/liff/order" element={<LiffOrder />} />
        <Route path="/liff/history" element={<LiffHistory />} />
        <Route path="/" element={<Protected><Layout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="plots" element={<Plots />} />
          <Route path="crops" element={<Crops />} />
          <Route path="diary" element={<Navigate to="/plots" replace />} />
          <Route path="chemicals" element={<Chemicals />} />
          <Route path="pests" element={<Pests />} />
          <Route path="harvest" element={<Harvest />} />
          <Route path="products" element={<Products />} />
          <Route path="orders" element={<Orders />} />
          <Route path="sales-report" element={<SalesReport />} />
          <Route path="storage" element={<Storage />} />
          <Route path="costs" element={<Costs />} />
          <Route path="report" element={<Report />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
