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
  X,
  Printer,
  QrCode,
  Download,
  Copy,
  Lock
} from 'lucide-react';
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

  // Fetch farm profile for promptpay_number if not already loaded in user
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
                <div key={o.id} className="surface rounded-2xl p-4 sm:p-5 bg-white border border-slate-200/80 shadow-xs space-y-3.5 flex flex-col justify-between hover:border-emerald-200 transition">
                  {/* Card Header: Code, Customer, Status */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-[#173f2a] tracking-tight">{o.order_code}</span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-1 truncate">{o.customer_name || 'ลูกค้าทั่วไป'}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{o.customer_phone || '-'}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {getStatusBadge(o)}
                    </div>
                  </div>

                  {/* Card Body: Delivery, Appointment, Price, Slip */}
                  <div className="grid grid-cols-2 gap-3 text-xs py-0.5">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">การจัดส่ง</span>
                      <div className="font-semibold text-slate-700 text-xs">
                        {o.delivery_type === 'delivery' ? '🚚 ส่งตามที่อยู่' : '🏡 รับเองที่ฟาร์ม'}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">นัดหมาย</span>
                      <div className="font-semibold text-emerald-800 text-xs truncate" title={o.delivery_date}>
                        {formatDeliveryDate(o.delivery_date)}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">ยอดชำระสุทธิ</span>
                      <div className="text-base font-black text-slate-900 tracking-tight">
                        ฿{Number(o.total_amount).toLocaleString()}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">สลิปโอนเงิน</span>
                      <div className="mt-0.5">
                        {o.payment_method === 'cod' ? (
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            💵 เก็บปลายทาง
                          </span>
                        ) : o.slip_image_url ? (
                          <button
                            onClick={() => setSlipModalImage(o.slip_image_url)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50/90 hover:bg-blue-100 active:bg-blue-200 px-2.5 py-1 rounded-lg border border-blue-200/90 transition cursor-pointer shadow-2xs"
                          >
                            <Receipt className="w-3 h-3 text-blue-600" />
                            <span>ดูสลิป</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">ยังไม่แนบสลิป</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Card Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    {/* Utility Actions (Print & Details) - 2 equal columns */}
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to={`/orders/${o.id}/print`}
                        target="_blank"
                        className="inline-flex items-center justify-center gap-1.5 bg-emerald-50/80 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 text-xs font-bold py-2.5 px-2.5 rounded-xl border border-emerald-200/90 transition shadow-2xs whitespace-nowrap cursor-pointer"
                        title="พิมพ์ใบปะหน้าพัสดุและเช็คลิสต์แพ็คสินค้า"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>ใบปะหน้า</span>
                      </Link>

                      <button
                        onClick={() => viewOrderDetails(o)}
                        className="inline-flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-2.5 rounded-xl border border-slate-200 transition shadow-2xs whitespace-nowrap cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>รายละเอียด</span>
                      </button>
                    </div>

                    {/* Lifecycle Primary Action Button (Full-width prominence) */}
                    {o.status === 'pending' && (
                      o.payment_method === 'cod' ? (
                        <button
                          onClick={() => openDispatchModal(o)}
                          disabled={updatingId === o.id}
                          className="w-full inline-flex items-center justify-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-[0.99] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          <Truck className="w-4 h-4 text-emerald-300" />
                          <span>บันทึกจัดส่งสินค้า (เก็บเงินปลายทาง)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(o.id, 'paid')}
                          disabled={updatingId === o.id}
                          className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          <Check className="w-4 h-4" />
                          <span>{updatingId === o.id ? 'กำลังบันทึก...' : 'อนุมัติสลิป (ชำระแล้ว)'}</span>
                        </button>
                      )
                    )}
                    {o.status === 'paid' && (
                      <button
                        onClick={() => openDispatchModal(o)}
                        disabled={updatingId === o.id}
                        className="w-full inline-flex items-center justify-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-[0.99] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <Truck className="w-4 h-4 text-emerald-300" />
                        <span>บันทึกจัดส่งสินค้า (ลง GAP #6)</span>
                      </button>
                    )}
                    {o.status === 'shipping' && (
                      <button
                        onClick={() => handleUpdateStatus(o.id, 'completed')}
                        disabled={updatingId === o.id}
                        className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>{updatingId === o.id ? 'กำลังบันทึก...' : 'ยืนยันจัดส่งสำเร็จเรียบร้อย'}</span>
                      </button>
                    )}
                  </div>
                </div>
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
                  <tr key={o.id} className="hover:bg-emerald-50/40 transition">
                    <td className="px-4 py-3.5 font-bold text-[#173f2a] whitespace-nowrap min-w-[150px]">
                      <button 
                        onClick={() => viewOrderDetails(o)}
                        className="text-left hover:underline text-emerald-800 font-mono font-bold cursor-pointer"
                        title="คลิกเพื่อดูรายละเอียดออเดอร์"
                      >
                        {o.order_code}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap min-w-[200px]">
                      <div className="font-bold text-slate-800 text-xs truncate max-w-[240px]" title={o.customer_name}>
                        {o.customer_name || 'ลูกค้าทั่วไป'}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{o.customer_phone || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap min-w-[160px]">
                      <div>สั่งเมื่อ: {o.created_at ? format(new Date(o.created_at), 'dd/MM/yy HH:mm') : '-'}</div>
                      <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                        นัดรับ: {formatDeliveryDate(o.delivery_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${o.delivery_type === 'delivery' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
                        {o.delivery_type === 'delivery' ? '🚚 ส่งตามที่อยู่' : '🏡 รับเองที่ฟาร์ม'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                      ฿{Number(o.total_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {o.payment_method === 'cod' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          💵 เก็บปลายทาง
                        </span>
                      ) : o.slip_image_url ? (
                        <button
                          onClick={() => setSlipModalImage(o.slip_image_url)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100 active:bg-blue-200 px-2.5 py-1 rounded-lg border border-blue-200 transition shadow-2xs cursor-pointer"
                        >
                          <Receipt className="w-3 h-3 text-blue-600" />
                          <span>ดูสลิป</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">ยังไม่แนบ</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {getStatusBadge(o)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                        {/* Print Label Button */}
                        <Link
                          to={`/orders/${o.id}/print`}
                          target="_blank"
                          className="inline-flex items-center gap-1 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-2.5 py-1.5 rounded-xl transition shadow-2xs whitespace-nowrap cursor-pointer"
                          title="พิมพ์ใบปะหน้าพัสดุและเช็คลิสต์แพ็คสินค้า"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>ใบปะหน้า</span>
                        </Link>

                        {/* Details Button */}
                        <button
                          onClick={() => viewOrderDetails(o)}
                          className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2.5 py-1.5 rounded-xl transition shadow-2xs whitespace-nowrap cursor-pointer"
                          title="ดูรายละเอียดออเดอร์"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>รายละเอียด</span>
                        </button>
                        
                        {/* Primary Action Button on Desktop */}
                        {o.status === 'pending' && o.payment_method === 'cod' && (
                          <button
                            onClick={() => openDispatchModal(o)}
                            disabled={updatingId === o.id}
                            className="inline-flex items-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50"
                          >
                            <Truck className="w-3.5 h-3.5 text-emerald-300" />
                            <span>ส่งของ (COD)</span>
                          </button>
                        )}
                        {o.status === 'pending' && o.payment_method !== 'cod' && (
                          <button
                            onClick={() => handleUpdateStatus(o.id, 'paid')}
                            disabled={updatingId === o.id}
                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>อนุมัติสลิป</span>
                          </button>
                        )}
                        {o.status === 'paid' && (
                          <button
                            onClick={() => openDispatchModal(o)}
                            disabled={updatingId === o.id}
                            className="inline-flex items-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50"
                          >
                            <Truck className="w-3.5 h-3.5 text-emerald-300" />
                            <span>ส่งของ (GAP)</span>
                          </button>
                        )}
                        {o.status === 'shipping' && (
                          <button
                            onClick={() => handleUpdateStatus(o.id, 'completed')}
                            disabled={updatingId === o.id}
                            className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                            <span>สำเร็จ</span>
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
                  {getStatusBadge(selectedOrder)}
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
              <div className="text-slate-600 flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> วันที่นัดหมาย: {formatDeliveryDate(selectedOrder.delivery_date)}</div>
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

            {/* Payment Method Details (COD vs PromptPay) */}
            {selectedOrder.payment_method === 'cod' ? (
              <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
                  <span className="text-lg">💵</span>
                  <span>วิธีชำระเงิน: เก็บเงินปลายทาง (COD)</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  ลูกค้าระบุชำระเงินสดปลายทางเมื่อรับสินค้า <strong>ไม่ต้องรอตรวจสลิปโอนเงิน</strong> สามารถจัดเตรียมและส่งพัสดุได้ทันที โดยพนักงานจัดส่งจะเรียกเก็บเงินสดจำนวน <span className="font-black text-emerald-800 text-sm">฿{Number(selectedOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </p>
              </div>
            ) : (
              /* PromptPay Dynamic QR with Locked Amount */
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <span>QR Code พร้อมเพย์ สำหรับออเดอร์นี้</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> ล็อกยอด ฿{Number(selectedOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        EMVCo Dynamic QR ลูกค้าสแกนแล้วยอดเงินจะขึ้นตรงเป๊ะทันที ป้องกันโอนผิด
                      </p>
                    </div>
                  </div>
                </div>

                {promptPayNumber ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-xl border border-slate-100">
                    {orderPromptPayQr ? (
                      <div className="flex flex-col items-center shrink-0">
                        <div className="bg-[#003B71] text-white py-0.5 px-3 rounded-t-md text-center w-full">
                          <span className="text-[8px] font-black uppercase tracking-wider">THAI QR PAYMENT</span>
                        </div>
                        <img
                          src={orderPromptPayQr}
                          alt="Order PromptPay QR"
                          className="w-28 h-28 object-contain border border-t-0 rounded-b-md"
                        />
                      </div>
                    ) : (
                      <div className="w-28 h-28 flex items-center justify-center bg-slate-50 text-slate-400 text-xs rounded-xl border">
                        กำลังสร้าง QR...
                      </div>
                    )}

                    <div className="flex-1 space-y-2 text-xs w-full">
                      <div className="space-y-1">
                        <div className="text-slate-500 text-[11px]">
                          เบอร์พร้อมเพย์: <span className="font-mono font-bold text-slate-800">{promptPayNumber}</span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          ยอดชำระที่ล็อก: <span className="font-black text-emerald-800 text-sm">฿{Number(selectedOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {orderPromptPayQr && (
                          <button
                            type="button"
                            onClick={() => handleDownloadOrderQr(selectedOrder, orderPromptPayQr)}
                            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>บันทึกรูป QR ส่งลูกค้า</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyOrderText(promptPayNumber, 'เบอร์พร้อมเพย์')}
                          className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>{copiedField === 'เบอร์พร้อมเพย์' ? 'คัดลอกแล้ว' : 'คัดลอกเบอร์'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyOrderText(Number(selectedOrder.total_amount).toFixed(2), 'ยอดเงิน')}
                          className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>{copiedField === 'ยอดเงิน' ? 'คัดลอกแล้ว' : 'คัดลอกยอด'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center justify-between">
                    <span>ยังไม่ได้ตั้งค่าเบอร์พร้อมเพย์ของฟาร์ม</span>
                    <Link to="/profile" className="font-bold underline text-amber-900 hover:text-emerald-700">
                      ไปตั้งค่าในโปรไฟล์ &rarr;
                    </Link>
                  </div>
                )}
              </div>
            )}

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

            {/* Print Shipping Label Quick Action */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>ใบปะหน้าพัสดุ & เช็คลิสต์แพ็คสินค้า (GAP Shipping Label)</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  พิมพ์ใบปะหน้าแปะกล่องพัสดุ (100x150mm หรือ A4) พร้อม QR Code มาตรฐาน GAP ให้ลูกค้าสแกนตรวจสอบย้อนกลับ
                </p>
              </div>

              <Link
                to={`/orders/${selectedOrder.id}/print`}
                target="_blank"
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-xs shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>🖨️ พิมพ์ใบปะหน้า</span>
              </Link>
            </div>

            {/* Status Update Controls */}
            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-500">เปลี่ยนสถานะออเดอร์:</div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedOrder.status !== 'paid' && selectedOrder.payment_method !== 'cod' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'paid')}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>อนุมัติสลิป (ชำระแล้ว)</span>
                  </button>
                )}
                {selectedOrder.status === 'pending' && selectedOrder.payment_method === 'cod' && (
                  <button
                    onClick={() => openDispatchModal(selectedOrder)}
                    className="inline-flex items-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5 text-emerald-300" />
                    <span>ส่งของ (COD)</span>
                  </button>
                )}
                {selectedOrder.status === 'paid' && (
                  <button
                    onClick={() => openDispatchModal(selectedOrder)}
                    className="inline-flex items-center gap-1.5 bg-[#173f2a] hover:bg-[#20573a] active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5 text-emerald-300" />
                    <span>จัดส่งสินค้า (ลงสมุด GAP #6)</span>
                  </button>
                )}
                {selectedOrder.status !== 'completed' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'completed')}
                    className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                    <span>จัดส่งสำเร็จ</span>
                  </button>
                )}
                {selectedOrder.status !== 'cancelled' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                    className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>ยกเลิกออเดอร์</span>
                  </button>
                )}
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
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
                  🚚
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    จัดส่งสินค้าอัจฉริยะ (Smart Dispatch)
                  </h3>
                  <p className="text-xs text-slate-500">
                    อ้างอิงออเดอร์ <strong className="font-mono text-[#173f2a]">#{dispatchModalOrder.order_code}</strong> • {dispatchModalOrder.customer_name}
                  </p>
                </div>
              </div>
              <button onClick={() => setDispatchModalOrder(null)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Smart Sync Info Banner */}
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ระบบดึงข้อมูลจากคำสั่งซื้อและเตรียมบันทึก GAP #6 ให้อัตโนมัติ:</span>
              </div>
              <p className="text-[11px] text-emerald-800 pl-5 leading-relaxed">
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
                    <option value="คลังบรรจุและกระจายสินค้าฟาร์ม">คลังบรรจุและกระจายสินค้าฟาร์ม</option>
                    <option value="ลานพักผลผลิตชั่วคราว สะอาด มีหลังคา">ลานพักผลผลิตชั่วคราว สะอาด มีหลังคา</option>
                    <option value="อุณหภูมิห้อง ถ่ายเทอากาศดี">อุณหภูมิห้อง ถ่ายเทอากาศดี</option>
                    <option value="ห้องเย็นฟาร์ม Temp 4°C">ห้องเย็นฟาร์ม Temp 4°C</option>
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
                    <option value="รถจักรยานยนต์ส่วนตัว (เจ้าของฟาร์มส่งเอง)">🏍️ รถจักรยานยนต์ส่วนตัว (เจ้าของฟาร์มส่งเอง)</option>
                    <option value="รถยนต์ส่วนตัว">🚗 รถยนต์ส่วนตัว</option>
                    <option value="บริการขนส่งพัสดุเอกชน">📦 บริการขนส่งพัสดุเอกชน</option>
                    <option value="ลูกค้ามารับเองที่ฟาร์ม">🏡 ลูกค้ามารับเองที่ฟาร์ม</option>
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
                    className="w-4 h-4 text-emerald-700 rounded cursor-pointer"
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
                  className="px-5 py-2.5 bg-[#173f2a] hover:bg-[#20573a] text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Truck className="w-4 h-4 text-emerald-300" />
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
