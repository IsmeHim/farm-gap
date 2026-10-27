import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import { toast } from 'sonner';
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Truck, 
  XCircle,
  Search, 
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import OrderCard from '../components/orders/OrderCard';
import OrderTableRow from '../components/orders/OrderTableRow';
import OrderDetailModal from '../components/orders/OrderDetailModal';
import OrderSlipModal from '../components/orders/OrderSlipModal';
import SmartDispatchModal from '../components/orders/SmartDispatchModal';
import { format } from 'date-fns';
import { generatePromptPayQR } from '../lib/promptpay';

const formatDeliveryDate = (val) => {
  if (!val) return '-';
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const hasTime = typeof val === 'string' && (val.includes('T') || val.includes(':'));
      if (hasTime) {
        return `${format(d, 'dd/MM/yyyy HH:mm')} น.`;
      }
      return format(d, 'dd/MM/yyyy');
    }
  } catch (e) {}
  return val;
};

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [slipModalImage, setSlipModalImage] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [orderPromptPayQr, setOrderPromptPayQr] = useState(null);
  const [promptPayNumber, setPromptPayNumber] = useState(user?.promptpay_number || '');
  const [copiedField, setCopiedField] = useState(null);

  // Fetch farm profile for promptpay_number and sync default worker_name if not already loaded in user
  useEffect(() => {
    if (user?.promptpay_number) {
      setPromptPayNumber(user.promptpay_number);
    } else {
      api.get('/api/auth/me').then(res => {
        if (res.data?.promptpay_number) {
          setPromptPayNumber(res.data.promptpay_number);
        }
      }).catch(() => {});
    }
    if (user?.display_name) {
      setDispatchForm(prev => ({
        ...prev,
        worker_name: !prev.worker_name || prev.worker_name === 'เจ้าของฟาร์ม' ? user.display_name : prev.worker_name,
      }));
    }
  }, [user]);

  // Generate dynamic QR code locking amount when selectedOrder changes
  useEffect(() => {
    if (!selectedOrder || !promptPayNumber) {
      setOrderPromptPayQr(null);
      return;
    }
    let active = true;
    const amount = Number(selectedOrder.total_amount);
    generatePromptPayQR(promptPayNumber, amount > 0 ? amount : undefined, { width: 320, margin: 1 })
      .then(url => {
        if (active) setOrderPromptPayQr(url);
      })
      .catch(err => {
        console.error('Failed to generate order PromptPay QR:', err);
      });
    return () => { active = false; };
  }, [selectedOrder, promptPayNumber]);

  const handleDownloadOrderQr = (order, qrUrl) => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `PromptPay-Order-${order?.order_code || 'GAP'}-THB${order?.total_amount || '0'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('ดาวน์โหลดรูปภาพ QR Code พร้อมเพย์เรียบร้อยแล้ว!');
  };

  const handleCopyOrderText = (text, label) => {
    navigator.clipboard.writeText(String(text));
    setCopiedField(label);
    toast.success(`คัดลอก ${label} แล้ว`);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
    worker_name: user?.display_name || 'เจ้าของฟาร์ม',
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
      storage_location: 'คลังบรรจุและกระจายสินค้าฟาร์ม',
      shipped_to: realAddress,
      buyer: fullOrder.customer_name || 'ลูกค้าทั่วไป',
      vehicle: 'รถจักรยานยนต์ส่วนตัว (เจ้าของฟาร์มส่งเอง)',
      vehicle_clean_status: true,
      storage_conditions: 'บรรจุในกล่อง/ถุงเก็บความสด ป้องกันแสงแดดและความร้อน',
      delivery_condition: 'ดี',
      worker_name: user?.display_name || 'เจ้าของฟาร์ม',
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

  const getStatusBadge = (order) => {
    if (!order) return null;
    const status = typeof order === 'string' ? order : order.status;
    const isCod = typeof order === 'object' && order.payment_method === 'cod';

    if (isCod) {
      switch (status) {
        case 'pending':
          return (
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-2xs">
              <Truck className="w-3 h-3 text-emerald-600" />
              <span>💵 เก็บปลายทาง (รอส่ง)</span>
            </span>
          );
        case 'shipping':
          return (
            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
              <Truck className="w-3 h-3" />
              <span>กำลังจัดส่ง (COD)</span>
            </span>
          );
        case 'completed':
          return (
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3" />
              <span>เก็บเงินสำเร็จแล้ว</span>
            </span>
          );
        case 'cancelled':
          return (
            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
              <XCircle className="w-3 h-3" />
              <span>ยกเลิกแล้ว</span>
            </span>
          );
        default:
          return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">{status}</span>;
      }
    }

    switch (status) {
      case 'pending':
        return typeof order === 'object' && order.slip_image_url ? (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
            <Clock className="w-3 h-3" /> รอตรวจสลิป
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
            <Clock className="w-3 h-3" /> รอลูกค้าโอนเงิน
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3" /> ชำระแล้ว / เตรียมของ
          </span>
        );
      case 'shipping':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
            <Truck className="w-3 h-3" /> กำลังจัดส่ง
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3" /> จัดส่งสำเร็จ
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
            <XCircle className="w-3 h-3" /> ยกเลิกแล้ว
          </span>
        );
      default:
        return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const getStatusText = (status, paymentMethod = null) => {
    if (paymentMethod === 'cod') {
      switch (status) {
        case 'pending': return 'เก็บเงินปลายทาง (รอจัดส่ง)';
        case 'shipping': return 'กำลังจัดส่ง (COD)';
        case 'completed': return 'เก็บเงินสำเร็จแล้ว';
        case 'cancelled': return 'ยกเลิกออเดอร์';
        default: return status;
      }
    }
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
    let matchTab = false;
    if (activeTab === 'all') matchTab = true;
    else if (activeTab === 'pending') matchTab = o.status === 'pending' && o.payment_method !== 'cod';
    else if (activeTab === 'cod') matchTab = o.payment_method === 'cod' && o.status !== 'cancelled';
    else if (activeTab === 'paid') matchTab = o.status === 'paid';
    else if (activeTab === 'shipping') matchTab = o.status === 'shipping';
    else if (activeTab === 'completed') matchTab = o.status === 'completed';
    else if (activeTab === 'cancelled') matchTab = o.status === 'cancelled';

    const matchSearch = search === '' || 
      o.order_code?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_phone?.includes(search);
    return matchTab && matchSearch;
  });

  const pendingSlipCount = orders.filter(o => o.status === 'pending' && o.payment_method !== 'cod').length;
  const codCount = orders.filter(o => o.payment_method === 'cod' && (o.status === 'pending' || o.status === 'shipping')).length;
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="surface rounded-2xl p-4 border border-emerald-100/60 bg-white shadow-xs">
          <div className="text-[11px] text-slate-500 font-semibold mb-1">คำสั่งซื้อทั้งหมด</div>
          <div className="text-xl sm:text-2xl font-black text-[#173f2a]">{orders.length} <span className="text-xs font-normal text-slate-400">รายการ</span></div>
        </div>
        <div className="surface rounded-2xl p-4 border border-amber-200/60 bg-amber-50/40 shadow-xs">
          <div className="text-[11px] text-amber-700 font-semibold mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> รอตรวจสลิปโอน</div>
          <div className="text-xl sm:text-2xl font-black text-amber-800">{pendingSlipCount} <span className="text-xs font-normal text-amber-600">ออเดอร์</span></div>
        </div>
        <div className="surface rounded-2xl p-4 border border-emerald-200/60 bg-emerald-50/40 shadow-xs">
          <div className="text-[11px] text-emerald-800 font-semibold mb-1 flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-emerald-700" /> เก็บปลายทาง (COD)</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-900">{codCount} <span className="text-xs font-normal text-emerald-700">ออเดอร์</span></div>
        </div>
        <div className="surface rounded-2xl p-4 border border-slate-200/60 bg-white shadow-xs">
          <div className="text-[11px] text-slate-600 font-semibold mb-1">ยอดขายรวมจาก LINE</div>
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
              { key: 'pending', label: 'รอตรวจสลิป', count: pendingSlipCount },
              { key: 'cod', label: 'เก็บปลายทาง (COD)', count: orders.filter(o => o.payment_method === 'cod' && o.status !== 'cancelled').length },
              { key: 'paid', label: 'ชำระแล้ว', count: orders.filter(o => o.status === 'paid').length },
              { key: 'shipping', label: 'กำลังจัดส่ง', count: shippingCount },
              { key: 'completed', label: 'จัดส่งสำเร็จ', count: orders.filter(o => o.status === 'completed').length },
              { key: 'cancelled', label: 'ยกเลิก', count: orders.filter(o => o.status === 'cancelled').length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? 'bg-[#173f2a] text-white border-[#173f2a] shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === tab.key ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหารหัส, ชื่อ, เบอร์โทร..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input !pl-9 text-xs w-full py-2 rounded-xl"
            />
          </div>
        </div>

        {/* MOBILE & TABLET VIEW: Order Cards (<lg) */}
        <div className="block lg:hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="animate-spin text-2xl mb-1">🌱</div>
              <span className="text-xs">กำลังโหลดคำสั่งซื้อ...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-bold">ไม่พบรายการคำสั่งซื้อ</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredOrders.map(o => (
                <OrderCard
                  key={o.id}
                  order={o}
                  getStatusBadge={getStatusBadge}
                  formatDeliveryDate={formatDeliveryDate}
                  onOpenSlipModal={(img) => setSlipModalImage(img)}
                  onViewDetails={viewOrderDetails}
                  onOpenDispatchModal={openDispatchModal}
                  onUpdateStatus={handleUpdateStatus}
                  updatingId={updatingId}
                />
              ))}
          </div>
        )}
      </div>

        {/* DESKTOP & TABLET LANDSCAPE VIEW: Sleek Table (hidden on mobile & iPad portrait, block on lg:) */}
        <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50/95 border-b border-slate-200 text-slate-700">
              <tr>
                <th className="text-left px-4 py-3.5 font-bold whitespace-nowrap min-w-[150px]">รหัสออเดอร์</th>
                <th className="text-left px-4 py-3.5 font-bold whitespace-nowrap min-w-[200px]">ลูกค้า</th>
                <th className="text-left px-4 py-3.5 font-bold whitespace-nowrap min-w-[160px]">วันที่สั่ง / นัดหมาย</th>
                <th className="text-left px-4 py-3.5 font-bold whitespace-nowrap min-w-[130px]">การจัดส่ง</th>
                <th className="text-right px-4 py-3.5 font-bold whitespace-nowrap min-w-[100px]">ยอดเงิน</th>
                <th className="text-center px-4 py-3.5 font-bold whitespace-nowrap min-w-[100px]">สลิปโอนเงิน</th>
                <th className="text-center px-4 py-3.5 font-bold whitespace-nowrap min-w-[130px]">สถานะ</th>
                <th className="text-right px-4 py-3.5 font-bold whitespace-nowrap min-w-[250px]">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">กำลังโหลดคำสั่งซื้อ...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">ไม่พบรายการคำสั่งซื้อ</td></tr>
              ) : (
                filteredOrders.map(o => (
                  <OrderTableRow
                    key={o.id}
                    order={o}
                    getStatusBadge={getStatusBadge}
                    formatDeliveryDate={formatDeliveryDate}
                    onOpenSlipModal={(img) => setSlipModalImage(img)}
                    onViewDetails={viewOrderDetails}
                    onOpenDispatchModal={openDispatchModal}
                    onUpdateStatus={handleUpdateStatus}
                    updatingId={updatingId}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      <OrderDetailModal
        selectedOrder={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        getStatusBadge={getStatusBadge}
        formatDeliveryDate={formatDeliveryDate}
        promptPayNumber={promptPayNumber}
        orderPromptPayQr={orderPromptPayQr}
        copiedField={copiedField}
        onDownloadOrderQr={handleDownloadOrderQr}
        onCopyOrderText={handleCopyOrderText}
        onOpenSlipModal={(img) => setSlipModalImage(img)}
        onUpdateStatus={handleUpdateStatus}
        onOpenDispatchModal={openDispatchModal}
        updatingId={updatingId}
      />

      {/* Slip Fullscreen Preview Modal */}
      <OrderSlipModal
        slipModalImage={slipModalImage}
        onClose={() => setSlipModalImage(null)}
      />

      {/* MODAL: Smart Dispatch & GAP #6 Storage Log Sync */}
      <SmartDispatchModal
        dispatchModalOrder={dispatchModalOrder}
        onClose={() => setDispatchModalOrder(null)}
        dispatchForm={dispatchForm}
        setDispatchForm={setDispatchForm}
        onSubmit={handleDispatchSubmit}
        submitting={dispatchSubmitting}
      />
    </div>
  );
}
