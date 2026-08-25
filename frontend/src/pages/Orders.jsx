import { useState, useEffect } from 'react';
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
  ChevronRight
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
          <p className="text-xs text-slate-500 mt-1">จัดการออเดอร์ผักสด ตรวจสอบสลิปโอนเงิน และอัปเดตสถานะจัดส่ง</p>
        </div>
        <button
          onClick={fetchOrders}
          className="inline-flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold px-3.5 py-2 rounded-xl border border-emerald-200 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรชข้อมูล
        </button>
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
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาเลขออเดอร์ / ชื่อลูกค้า..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9 text-xs w-full py-2 px-3 rounded-xl border border-slate-200"
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
                      onClick={() => handleUpdateStatus(o.id, 'shipping')}
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
                            onClick={() => handleUpdateStatus(o.id, 'shipping')}
                            disabled={updatingId === o.id}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer"
                          >
                            ส่งของ
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-lg font-black text-[#173f2a]">{selectedOrder.order_code}</h2>
                <p className="text-xs text-slate-500">สั่งเมื่อ: {selectedOrder.created_at ? format(new Date(selectedOrder.created_at), 'dd/MM/yyyy HH:mm') : '-'}</p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedOrder.status)}
                <button onClick={() => setSelectedOrder(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"><XCircle className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-400 font-semibold mb-1 flex items-center gap-1"><User className="w-3.5 h-3.5" /> ข้อมูลผู้รับ</div>
                <div className="font-bold text-slate-800">{selectedOrder.customer_name}</div>
                <div className="text-slate-600 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {selectedOrder.customer_phone || '-'}</div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> ที่อยู่จัดส่ง / นัดรับ</div>
                <div className="text-slate-700">{selectedOrder.customer_address || '-'}</div>
                <div className="text-emerald-700 font-bold mt-0.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> วันที่นัดหมาย: {selectedOrder.delivery_date || '-'}</div>
              </div>
            </div>

            {/* Items List */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">รายการผักที่สั่งซื้อ</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {selectedOrder.items?.map(it => (
                  <div key={it.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.product_name} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">🥦</div>
                      )}
                      <div>
                        <div className="font-bold text-slate-800">{it.product_name}</div>
                        <div className="text-slate-500">฿{it.unit_price} x {it.quantity} {it.unit}</div>
                      </div>
                    </div>
                    <div className="font-black text-slate-800">฿{(it.unit_price * it.quantity).toLocaleString()}</div>
                  </div>
                ))}
                <div className="p-3 bg-slate-50 flex justify-between items-center font-bold text-sm">
                  <span>ยอดสุทธิรวม:</span>
                  <span className="text-emerald-700 font-black text-base">฿{Number(selectedOrder.total_amount).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Slip Section */}
            {selectedOrder.slip_image_url && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">หลักฐานการโอนเงิน (สลิป)</h3>
                <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 inline-block">
                  <img
                    src={selectedOrder.slip_image_url}
                    alt="สลิปโอนเงิน"
                    className="max-h-48 rounded-lg object-contain cursor-pointer hover:opacity-90 transition"
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
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'shipping')}
                  className="btn bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 cursor-pointer"
                >
                  🚚 กำลังจัดส่ง
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
              <button onClick={() => setSlipModalImage(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-xl border border-slate-100 flex items-center justify-center bg-slate-900">
              <img src={slipModalImage} alt="สลิปโอนเงินขยายใหญ่" className="max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
