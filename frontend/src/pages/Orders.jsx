import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Truck, 
  XCircle, 
  Eye, 
  Search, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  RefreshCw,
  Receipt,
  Check,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Package,
  TrendingUp,
  X
} from 'lucide-react';
import { format } from 'date-fns';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [slipModalImage, setSlipModalImage] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  // Smart Dispatch Modal state
  const [dispatchModalOrder, setDispatchModalOrder] = useState(null);
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    log_date: format(new Date(), 'yyyy-MM-dd'),
    transport_time: format(new Date(), 'HH:mm'),
    storage_location: 'ห้องเย็นฟาร์ม Temp 4°C',
    shipped_to: '',
    buyer: '',
    vehicle: 'รถกระบะห้องเย็นฟาร์ม ทะเบียน 2ฒข-4512',
    vehicle_clean_status: true,
    storage_conditions: 'คุมความเย็น 4°C ตลอดการเดินทาง',
    delivery_condition: 'ดี',
    worker_name: 'ผู้ดูแลฟาร์ม',
    notes: '',
    sync_to_storage: true,
  });

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/orders');
      setOrders(res.data);
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถโหลดรายการคำสั่งซื้อได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      setUpdatingId(orderId);
      await api.patch(`/api/orders/${orderId}/status`, { status: newStatus });
      toast.success(`อัปเดตสถานะออเดอร์เป็น "${getStatusText(newStatus)}" สำเร็จ`);
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    } finally {
      setUpdatingId(null);
    }
  };

  // Open Smart Dispatch Modal
  const openDispatchModal = async (order) => {
    let fullOrder = order;
    if (!order.items || !order.customer_address) {
      try {
        const res = await api.get(`/api/orders/${order.id}`);
        fullOrder = { ...order, ...res.data };
      } catch (e) {
        console.error(e);
      }
    }

    const items = fullOrder.items || [];
    const itemsSummary = items && items.length > 0
      ? items.map(i => `${i.product_name} x ${i.quantity} ${i.unit}`).join(', ')
      : '';

    const realAddress = fullOrder.delivery_type === 'pickup'
      ? '🏡 รับเองที่ฟาร์ม'
      : (fullOrder.customer_address || fullOrder.address || '—');

    setDispatchModalOrder(fullOrder);
    setDispatchForm({
      log_date: format(new Date(), 'yyyy-MM-dd'),
      transport_time: format(new Date(), 'HH:mm'),
      storage_location: 'ห้องเย็นฟาร์ม Temp 4°C',
      shipped_to: realAddress,
      buyer: fullOrder.customer_name || 'ลูกค้าทั่วไป',
      vehicle: 'รถส่วนตัว',
      vehicle_clean_status: true,
      storage_conditions: 'คุมความเย็น 4°C ตลอดการเดินทาง',
      delivery_condition: 'ดี',
      worker_name: 'ผู้ดูแลฟาร์ม',
      notes: itemsSummary ? `จัดส่งออเดอร์ #${fullOrder.order_code} [${itemsSummary}]` : `จัดส่งออเดอร์ #${fullOrder.order_code}`,
      sync_to_storage: true,
    });
  };

  // Submit Smart Dispatch
  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!dispatchModalOrder) return;
    setDispatchSubmitting(true);
    try {
      const res = await api.post(`/api/orders/${dispatchModalOrder.id}/dispatch`, dispatchForm);
      toast.success(res.data.message || 'บันทึกการจัดส่งและลงบันทึก ขนส่ง/เก็บรักษา (GAP #6) สำเร็จ!');

      setOrders(prev => prev.map(o => o.id === dispatchModalOrder.id ? { ...o, status: 'shipping' } : o));
      if (selectedOrder && selectedOrder.id === dispatchModalOrder.id) {
        setSelectedOrder(prev => ({ ...prev, status: 'shipping' }));
      }
      setDispatchModalOrder(null);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกจัดส่ง');
    } finally {
      setDispatchSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold"><Clock className="w-3 h-3" /> รอตรวจสลิป</span>;
      case 'paid':
        return <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-bold"><CheckCircle2 className="w-3 h-3" /> ชำระแล้ว / เตรียมของ</span>;
      case 'shipping':
        return <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full text-xs font-bold"><Truck className="w-3 h-3" /> กำลังจัดส่ง</span>;
      case 'completed':
        return <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full text-xs font-bold"><CheckCircle2 className="w-3 h-3" /> จัดส่งสำเร็จ</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-bold"><XCircle className="w-3 h-3" /> ยกเลิกแล้ว</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'รอตรวจสลิป';
      case 'paid': return 'ชำระแล้ว (เตรียมของ)';
      case 'shipping': return 'กำลังจัดส่ง';
      case 'completed': return 'จัดส่งสำเร็จ';
      case 'cancelled': return 'ยกเลิกออเดอร์';
      default: return status;
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchTab = activeTab === 'all' || o.status === activeTab;
    const matchSearch = search === '' || 
      o.order_code?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_phone?.includes(search);
    return matchTab && matchSearch;
  });

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const shippingCount = orders.filter(o => o.status === 'shipping').length;
  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const viewOrderDetails = async (order) => {
    try {
      const res = await api.get(`/api/orders/${order.id}`);
      setSelectedOrder(res.data);
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถโหลดรายละเอียดออเดอร์ได้');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#173f2a] flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 text-[#2e7d32]" />
            รายการคำสั่งซื้อจาก LINE OA
          </h1>
          <p className="text-xs text-slate-500 mt-1">จัดการออเดอร์ผักสด ตรวจสอบสลิปโอนเงิน และจัดส่งอัจฉริยะเชื่อม GAP #6</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/sales-report"
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
            title="ดูรายงานรายได้ ยอดขาย และส่งออก CSV"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>รายงานรายได้ & Export</span>
          </Link>
          <button
            onClick={fetchOrders}
            className="inline-flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold px-3.5 py-2 rounded-xl border border-emerald-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรชข้อมูล
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="surface rounded-2xl p-4 border border-emerald-100/60 bg-white shadow-xs">
          <div className="text-[11px] text-slate-500 font-semibold mb-1">คำสั่งซื้อทั้งหมด</div>
          <div className="text-xl sm:text-2xl font-black text-[#173f2a]">{orders.length} <span className="text-xs font-normal text-slate-400">รายการ</span></div>
        </div>
        <div className="surface rounded-2xl p-4 border border-amber-200/60 bg-amber-50/40 shadow-xs">
          <div className="text-[11px] text-amber-700 font-semibold mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> รอตรวจสลิป</div>
          <div className="text-xl sm:text-2xl font-black text-amber-800">{pendingCount} <span className="text-xs font-normal text-amber-600">ออเดอร์</span></div>
        </div>
        <div className="surface rounded-2xl p-4 border border-purple-200/60 bg-purple-50/40 shadow-xs">
          <div className="text-[11px] text-purple-700 font-semibold mb-1 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> กำลังจัดส่ง</div>
          <div className="text-xl sm:text-2xl font-black text-purple-800">{shippingCount} <span className="text-xs font-normal text-purple-600">ออเดอร์</span></div>
        </div>
        <div className="surface rounded-2xl p-4 border border-emerald-200/60 bg-emerald-50/40 shadow-xs">
          <div className="text-[11px] text-emerald-700 font-semibold mb-1">ยอดขายรวมจาก LINE</div>
          <div className="text-xl sm:text-2xl font-black text-[#173f2a]">฿{totalRevenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="surface rounded-2xl p-4 bg-white border border-slate-200/80 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5 text-xs font-bold">
            {[
              { key: 'all', label: 'ทั้งหมด', count: orders.length },
              { key: 'pending', label: 'รอตรวจสลิป', count: pendingCount },
              { key: 'paid', label: 'ชำระแล้ว', count: orders.filter(o => o.status === 'paid').length },
              { key: 'shipping', label: 'กำลังส่ง', count: shippingCount },
              { key: 'completed', label: 'สำเร็จ', count: orders.filter(o => o.status === 'completed').length },
              { key: 'cancelled', label: 'ยกเลิก', count: orders.filter(o => o.status === 'cancelled').length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${activeTab === tab.key ? 'bg-[#173f2a] text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
            <input
              type="text"
              placeholder="ค้นหาเลขออเดอร์ / ชื่อลูกค้า..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input !pl-9.5 !pr-3 text-xs w-full !py-2 rounded-xl border border-slate-200"
            />
          </div>
        </div>

        {/* MOBILE VIEW: Mobile Order Cards (block md:hidden) */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="animate-spin text-2xl mb-1">🌱</div>
              <span className="text-xs">กำลังโหลดคำสั่งซื้อ...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-bold">ไม่พบรายการคำสั่งซื้อ</div>
          ) : (
            filteredOrders.map(o => (
              <div key={o.id} className="surface rounded-2xl p-4 bg-white border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="font-mono font-bold text-sm text-[#173f2a]">{o.order_code}</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">{o.customer_name}</div>
                    <div className="text-[11px] text-slate-400">{o.customer_phone || '-'}</div>
                  </div>
                  <div>
                    {getStatusBadge(o.status)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">การจัดส่ง:</span>
                    <div className="font-semibold text-slate-700 mt-0.5">
                      {o.delivery_type === 'delivery' ? '🚚 ส่งตามที่อยู่' : '🏡 รับเองที่ฟาร์ม'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">นัดหมาย:</span>
                    <div className="font-semibold text-emerald-800 mt-0.5">
                      {o.delivery_date || '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">ยอดชำระสุทธิ:</span>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      ฿{Number(o.total_amount).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">สลิปโอนเงิน:</span>
                    <div className="mt-0.5">
                      {o.slip_image_url ? (
                        <button
                          onClick={() => setSlipModalImage(o.slip_image_url)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 cursor-pointer"
                        >
                          <Receipt className="w-3 h-3" /> ดูสลิป
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">ยังไม่แนบ</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile Card Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => viewOrderDetails(o)}
                    className="flex-1 inline-flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 px-3 rounded-xl transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> รายละเอียด
                  </button>

                  {o.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, 'paid')}
                      disabled={updatingId === o.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> อนุมัติสลิป
                    </button>
                  )}
                  {o.status === 'paid' && (
                    <button
                      onClick={() => openDispatchModal(o)}
                      disabled={updatingId === o.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow-xs cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" /> ส่งของ
                    </button>
                  )}
                  {o.status === 'shipping' && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, 'completed')}
                      disabled={updatingId === o.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> สำเร็จ
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* DESKTOP VIEW: Sleek Table (hidden md:block) */}
        <div className="hidden md:block table-responsive">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-bold text-slate-600">รหัสออเดอร์</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">ลูกค้า</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">วันที่สั่ง/นัดหมาย</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">การจัดส่ง</th>
                <th className="text-right px-4 py-3 font-bold text-slate-600">ยอดเงิน</th>
                <th className="text-center px-4 py-3 font-bold text-slate-600">สลิปโอนเงิน</th>
                <th className="text-center px-4 py-3 font-bold text-slate-600">สถานะ</th>
                <th className="text-right px-4 py-3 font-bold text-slate-600">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">กำลังโหลดคำสั่งซื้อ...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">ไม่พบรายการคำสั่งซื้อ</td></tr>
              ) : (
                filteredOrders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-bold text-[#173f2a]">
                      <button 
                        onClick={() => viewOrderDetails(o)}
                        className="text-left hover:underline text-emerald-800 font-mono cursor-pointer"
                      >
                        {o.order_code}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{o.customer_name}</div>
                      <div className="text-[11px] text-slate-400">{o.customer_phone || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>สั่งเมื่อ: {o.created_at ? format(new Date(o.created_at), 'dd/MM/yy HH:mm') : '-'}</div>
                      <div className="text-[11px] text-emerald-700 font-semibold">นัดรับ: {o.delivery_date || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${o.delivery_type === 'delivery' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {o.delivery_type === 'delivery' ? '🚚 ส่งตามที่อยู่' : '🏡 รับเองที่ฟาร์ม'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-800">
                      ฿{Number(o.total_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {o.slip_image_url ? (
                        <button
                          onClick={() => setSlipModalImage(o.slip_image_url)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 cursor-pointer"
                        >
                          <Receipt className="w-3 h-3" /> ดูสลิป
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">ยังไม่แนบ</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(o.status)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => viewOrderDetails(o)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="ดูรายละเอียดออเดอร์"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {/* Quick action buttons */}
                        {o.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateStatus(o.id, 'paid')}
                            disabled={updatingId === o.id}
                            className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer"
                          >
                            อนุมัติสลิป
                          </button>
                        )}
                        {o.status === 'paid' && (
                          <button
                            onClick={() => openDispatchModal(o)}
                            disabled={updatingId === o.id}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                          >
                            <Truck className="w-3 h-3" />
                            <span>ส่งของ</span>
                          </button>
                        )}
                        {o.status === 'shipping' && (
                          <button
                            onClick={() => handleUpdateStatus(o.id, 'completed')}
                            disabled={updatingId === o.id}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer"
                          >
                            สำเร็จ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <span>ใบสั่งซื้อ #{selectedOrder.order_code}</span>
                  {getStatusBadge(selectedOrder.status)}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  สั่งซื้อเมื่อ: {selectedOrder.created_at ? format(new Date(selectedOrder.created_at), 'dd/MM/yyyy HH:mm น.') : '-'}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {/* Customer info */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-1.5">
              <div className="font-bold text-slate-700 flex items-center gap-1.5"><User className="w-4 h-4 text-emerald-700" /> ข้อมูลผู้สั่งซื้อ</div>
              <div className="text-slate-800 font-semibold">{selectedOrder.customer_name}</div>
              <div className="text-slate-600 flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedOrder.customer_phone || '-'}</div>
              <div className="text-slate-600 flex items-start gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" /> {selectedOrder.customer_address || 'รับเองที่ฟาร์ม'}</div>
              <div className="text-slate-600 flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> วันที่นัดหมาย: {selectedOrder.delivery_date || '-'}</div>
              {selectedOrder.notes && <div className="text-slate-500 italic mt-1">หมายเหตุจากลูกค้า: "{selectedOrder.notes}"</div>}
            </div>

            {/* Items list */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">รายการสินค้า ({selectedOrder.items?.length || 0} รายการ):</div>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                {selectedOrder.items?.map((it, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.product_name} className="w-8 h-8 rounded-lg object-cover border" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px]">GAP</div>
                      )}
                      <div>
                        <div className="font-bold text-slate-800">{it.product_name}</div>
                        <div className="text-[11px] text-slate-400">฿{Number(it.unit_price).toLocaleString()} / {it.unit}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-700">x {it.quantity}</div>
                      <div className="text-xs font-black text-emerald-800">฿{Number(it.subtotal).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t flex justify-between items-center text-sm font-black text-slate-900">
                <span>ยอดชำระทั้งหมด:</span>
                <span className="text-[#173f2a] text-base">฿{Number(selectedOrder.total_amount).toLocaleString()}</span>
              </div>
            </div>

            {/* Payment slip preview */}
            {selectedOrder.slip_image_url && (
              <div className="space-y-1.5 pt-2 border-t">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-blue-600" /> หลักฐานการชำระเงิน (สลิปโอนเงิน)</div>
                <div className="p-2 bg-slate-50 rounded-xl border flex flex-col items-center">
                  <img 
                    src={selectedOrder.slip_image_url} 
                    alt="สลิปโอนเงิน" 
                    className="max-h-40 rounded-lg object-contain cursor-pointer hover:opacity-90"
                    onClick={() => setSlipModalImage(selectedOrder.slip_image_url)}
                  />
                  <div className="text-[10px] text-center text-slate-400 mt-1">คลิกที่รูปเพื่อขยายเต็มจอ</div>
                </div>
              </div>
            )}

            {/* Status Update Controls */}
            <div className="border-t pt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">เปลี่ยนสถานะออเดอร์:</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'paid')}
                  className="btn bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 cursor-pointer"
                >
                  ✅ อนุมัติสลิป (ชำระแล้ว)
                </button>
                <button
                  onClick={() => openDispatchModal(selectedOrder)}
                  className="btn bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 cursor-pointer flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>กำลังจัดส่ง (GAP #6)</span>
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'completed')}
                  className="btn bg-emerald-700 hover:bg-emerald-800 text-white text-xs py-1.5 cursor-pointer"
                >
                  🎉 จัดส่งสำเร็จ
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                  className="btn btn-outline text-rose-600 hover:bg-rose-50 text-xs py-1.5 cursor-pointer"
                >
                  ❌ ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slip Fullscreen Preview Modal */}
      {slipModalImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60 p-4" onClick={() => setSlipModalImage(null)}>
          <div className="relative max-w-md w-full bg-white rounded-2xl p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800">รูปภาพสลิปโอนเงิน</h3>
              <button onClick={() => setSlipModalImage(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-xl border border-slate-100 flex items-center justify-center bg-slate-900">
              <img src={slipModalImage} alt="สลิปโอนเงินขยายใหญ่" className="max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Smart Dispatch & GAP #6 Storage Log Sync */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto" onClick={() => setDispatchModalOrder(null)}>
          <div 
            className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-lg">
                  🚚
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    จัดส่งสินค้าอัจฉริยะ (Smart Dispatch)
                  </h3>
                  <p className="text-xs text-slate-500">
                    อ้างอิงออเดอร์ <strong className="font-mono text-purple-900">#{dispatchModalOrder.order_code}</strong> • {dispatchModalOrder.customer_name}
                  </p>
                </div>
              </div>
              <button onClick={() => setDispatchModalOrder(null)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Smart Sync Info Banner */}
            <div className="p-3 bg-purple-50/70 border border-purple-200/70 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-purple-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <span>ระบบดึงข้อมูลจากคำสั่งซื้อและเตรียมบันทึก GAP #6 ให้อัตโนมัติ:</span>
              </div>
              <p className="text-[11px] text-purple-800 pl-5 leading-relaxed">
                เมื่อยืนยัน ระบบจะเปลี่ยนสถานะออเดอร์เป็น <strong>กำลังจัดส่ง</strong> และนำข้อมูลด้านล่างไปลงบันทึกในสมุด <strong>"ขนส่ง/เก็บรักษา (GAP #6)"</strong> ให้ทันทีในคลิกเดียว
              </p>
            </div>

            {/* Dispatch Form */}
            <form onSubmit={handleDispatchSubmit} className="space-y-3.5 text-xs">
              {/* Row 1: Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    วันที่จัดส่ง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dispatchForm.log_date}
                    onChange={e => setDispatchForm(f => ({ ...f, log_date: e.target.value }))}
                    className="input text-xs w-full rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    เวลาขนส่ง
                  </label>
                  <input
                    type="time"
                    value={dispatchForm.transport_time}
                    onChange={e => setDispatchForm(f => ({ ...f, transport_time: e.target.value }))}
                    className="input text-xs w-full rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Buyer & Destination */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    ผู้ซื้อ (ลูกค้า) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.buyer}
                    onChange={e => setDispatchForm(f => ({ ...f, buyer: e.target.value }))}
                    className="input text-xs w-full rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    ส่งไปที่ (สถานที่ส่งมอบ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.shipped_to}
                    onChange={e => setDispatchForm(f => ({ ...f, shipped_to: e.target.value }))}
                    className="input text-xs w-full rounded-xl"
                  />
                </div>
              </div>

              {/* Row 3: Storage Location & Vehicle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    สถานที่เก็บก่อนส่ง
                  </label>
                  <select
                    value={dispatchForm.storage_location}
                    onChange={e => setDispatchForm(f => ({ ...f, storage_location: e.target.value }))}
                    className="input text-xs w-full rounded-xl font-medium"
                  >
                    <option value="ห้องเย็นฟาร์ม Temp 4°C">ห้องเย็นฟาร์ม Temp 4°C</option>
                    <option value="ลานพักผลผลิตชั่วคราว สะอาด มีหลังคา">ลานพักผลผลิตชั่วคราว สะอาด มีหลังคา</option>
                    <option value="คลังบรรจุและกระจายสินค้าฟาร์ม">คลังบรรจุและกระจายสินค้าฟาร์ม</option>
                    <option value="อุณหภูมิห้อง ถ่ายเทอากาศดี">อุณหภูมิห้อง ถ่ายเทอากาศดี</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    ยานพาหนะขนส่ง
                  </label>
                  <select
                    value={dispatchForm.vehicle}
                    onChange={e => setDispatchForm(f => ({ ...f, vehicle: e.target.value }))}
                    className="input text-xs w-full rounded-xl font-medium"
                  >
                    <option value="รถส่วนตัว">รถส่วนตัว</option>
                    <option value="รถจักรยานยนต์ส่วนตัว">รถจักรยานยนต์ส่วนตัว</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Clean vehicle check & storage conditions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    การตรวจความสะอาดรถ (GAP #6)
                  </label>
                  <label className="flex items-center gap-2 p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dispatchForm.vehicle_clean_status}
                      onChange={e => setDispatchForm(f => ({ ...f, vehicle_clean_status: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-emerald-900">
                      รถสะอาด ผ่านการตรวจสุขอนามัย
                    </span>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">สภาพการเก็บรักษา</label>
                  <input
                    type="text"
                    value={dispatchForm.storage_conditions}
                    onChange={e => setDispatchForm(f => ({ ...f, storage_conditions: e.target.value }))}
                    className="input text-xs w-full rounded-xl"
                  />
                </div>
              </div>

              {/* Row 5: Delivery condition & Worker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">สภาพผลผลิตตอนขนส่ง</label>
                  <select
                    value={dispatchForm.delivery_condition}
                    onChange={e => setDispatchForm(f => ({ ...f, delivery_condition: e.target.value }))}
                    className="input text-xs w-full rounded-xl font-medium"
                  >
                    <option value="ดี">ดี (สดสมบูรณ์ 100%)</option>
                    <option value="เสียหายเล็กน้อย">เสียหายเล็กน้อย</option>
                    <option value="เสียหายมาก">เสียหายมาก</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">ผู้ปฏิบัติ (ผู้จัดส่ง)</label>
                  <input
                    type="text"
                    value={dispatchForm.worker_name}
                    onChange={e => setDispatchForm(f => ({ ...f, worker_name: e.target.value }))}
                    className="input text-xs w-full rounded-xl"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">หมายเหตุ</label>
                <textarea
                  rows={2}
                  value={dispatchForm.notes}
                  onChange={e => setDispatchForm(f => ({ ...f, notes: e.target.value }))}
                  className="input text-xs w-full rounded-xl"
                />
              </div>

              {/* Auto Sync Toggle */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dispatchForm.sync_to_storage}
                    onChange={e => setDispatchForm(f => ({ ...f, sync_to_storage: e.target.checked }))}
                    className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                  />
                  <span>บันทึกลงสมุด ขนส่ง/เก็บรักษา (GAP #6) อัตโนมัติ</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDispatchModalOrder(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={dispatchSubmitting}
                  className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Truck className="w-4 h-4" />
                  <span>{dispatchSubmitting ? 'กำลังบันทึกจัดส่ง...' : '🚀 ยืนยันการจัดส่ง & ลงสมุด GAP #6'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
