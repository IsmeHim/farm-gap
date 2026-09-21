import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Plots from './pages/Plots.jsx';
import Crops from './pages/Crops.jsx';
import CropDiary from './pages/CropDiary.jsx';
import Water from './pages/Water.jsx';
import Chemicals from './pages/Chemicals.jsx';
import Pests from './pages/Pests.jsx';
import Harvest from './pages/Harvest.jsx';
import Products from './pages/Products.jsx';
import Storage from './pages/Storage.jsx';
import Costs from './pages/Costs.jsx';
import Report from './pages/Report.jsx';
import Trace from './pages/Trace.jsx';
import Orders from './pages/Orders.jsx';
import SalesReport from './pages/SalesReport.jsx';
import LiffOrder from './pages/LiffOrder.jsx';
import LiffHistory from './pages/LiffHistory.jsx';
import Profile from './pages/Profile.jsx';
import ShippingLabel from './pages/ShippingLabel.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">กำลังโหลด...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
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
        <Route path="diary" element={<CropDiary />} />
        <Route path="water" element={<Water />} />
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
  );
}
