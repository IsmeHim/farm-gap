import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import liff from '@line/liff';
import { api } from '../lib/api';
import { Search, Phone, RefreshCw, ShoppingCart, Eye, Calendar, MapPin, Receipt, Clock, CheckCircle2, Truck, XCircle, Download, Copy, Lock, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { generatePromptPayQR } from '../lib/promptpay';

export default function LiffHistory() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  const [isLiffLoading, setIsLiffLoading] = useState(true);
  const [mockLineUserId, setMockLineUserId] = useState('mock-user-12345');
  const [isMockMode, setIsMockMode] = useState(false);

  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [orderQr, setOrderQr] = useState(null);
  const [copiedText, setCopiedText] = useState(null);

  // 1. Initialize LINE LIFF & Auto-Detect Customer
  useEffect(() => {
    const savedCustomerId = typeof window !== 'undefined' ? localStorage.getItem('farmgap_customer_id') : null;
    const savedLineUserId = typeof window !== 'undefined' ? localStorage.getItem('farmgap_line_user_id') : null;
    const savedPhone = typeof window !== 'undefined' ? localStorage.getItem('farmgap_customer_phone') : null;

    liff.init({ liffId: import.meta.env.VITE_LIFF_ID || 'dummy-liff-id' })
      .then(() => {
        setIsLiffLoading(false);
        if (liff.isLoggedIn()) {
          liff.getProfile().then(p => {
            setProfile(p);
            try {
              localStorage.setItem('farmgap_line_user_id', p.userId);
            } catch (e) {}
            fetchCustomerAndOrders(p.userId);
          });
        } else {
          // If in LINE client, try login
          if (liff.isInClient()) {
            liff.login();
          } else {
            setIsMockMode(true);
            // Auto fallback to saved storage
            if (savedLineUserId) {
              fetchCustomerAndOrders(savedLineUserId);
            } else if (savedCustomerId) {
              fetchOrdersByCustomerId(savedCustomerId);
            } else if (savedPhone) {
              fetchOrdersByPhone(savedPhone);
            } else {
              setLoadingOrders(false);
            }
          }
        }
      })
      .catch((err) => {
        console.warn('LIFF initialization failed:', err);
        setIsLiffLoading(false);
        setIsMockMode(true);
        // Auto fallback to saved storage
        if (savedLineUserId) {
          fetchCustomerAndOrders(savedLineUserId);
        } else if (savedCustomerId) {
          fetchOrdersByCustomerId(savedCustomerId);
        } else if (savedPhone) {
          fetchOrdersByPhone(savedPhone);
        } else {
          setLoadingOrders(false);
        }
      });
  }, []);

  // Load farm payment info (PromptPay and bank details)
  useEffect(() => {
    api.get('/api/auth/payment-info')
      .then(res => setPaymentInfo(res.data))
      .catch(err => console.warn('Could not load payment info:', err));
  }, []);

  // Generate dynamic QR code when selectedOrder is pending
  useEffect(() => {
    if (!selectedOrder || selectedOrder.status !== 'pending' || !paymentInfo?.promptpay_number) {
      setOrderQr(null);
      return;
    }
    let active = true;
    const amount = Number(selectedOrder.total_amount) || undefined;
    generatePromptPayQR(paymentInfo.promptpay_number, amount, { width: 280, margin: 1 })
      .then(url => {
        if (active) setOrderQr(url);
      })
      .catch(err => console.error('Failed to generate history order QR:', err));
    return () => { active = false; };
  }, [selectedOrder, paymentInfo?.promptpay_number]);

  const handleDownloadQr = () => {
    const src = orderQr || paymentInfo?.promptpay_qr_url;
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `PromptPay-${selectedOrder?.order_code || 'Order'}-THB${selectedOrder?.total_amount || '0'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('ดาวน์โหลดรูปภาพ QR Code พร้อมเพย์เรียบร้อยแล้ว!');
  };

  const handleCopyText = (text, label) => {
    navigator.clipboard.writeText(String(text));
    setCopiedText(label);
    toast.success(`คัดลอก ${label} แล้ว`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // 2. Fetch Customer DB Record and Orders by Line User ID
  const fetchCustomerAndOrders = async (lineUserId) => {
    setLoadingOrders(true);
    try {
      const res = await api.get(`/api/customers/line/${lineUserId}`);
      setCustomer(res.data);
      if (res.data?.id) {
        localStorage.setItem('farmgap_customer_id', res.data.id);
      }
      const ordRes = await api.get(`/api/orders?customer_id=${res.data.id}`);
      setOrders(ordRes.data);
    } catch (err) {
      console.warn('Customer not found by line_id, trying storage/phone:', err.message);
      const savedCustomerId = localStorage.getItem('farmgap_customer_id');
      if (savedCustomerId) {
        fetchOrdersByCustomerId(savedCustomerId);
      } else {
        setOrders([]);
        setLoadingOrders(false);
      }
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchOrdersByCustomerId = async (customerId) => {
    setLoadingOrders(true);
    try {
      const ordRes = await api.get(`/api/orders?customer_id=${customerId}`);
      setOrders(ordRes.data);
      if (ordRes.data.length > 0) {
        setCustomer({
          display_name: ordRes.data[0].customer_name,
          phone: ordRes.data[0].customer_phone
        });
      }
    } catch (err) {
      console.warn('Failed to load orders by customer_id:', err);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchOrdersByPhone = async (phone) => {
    if (!phone) return;
    setSearching(true);
    setLoadingOrders(true);
    try {
      const ordRes = await api.get(`/api/orders?phone=${encodeURIComponent(phone.trim())}`);
      setOrders(ordRes.data);
      if (ordRes.data.length > 0) {
        setCustomer({
          display_name: ordRes.data[0].customer_name,
          phone: ordRes.data[0].customer_phone
        });
        localStorage.setItem('farmgap_customer_phone', phone.trim());
      }
    } catch (err) {
      console.warn('Failed to load orders by phone:', err);
      setOrders([]);
    } finally {
      setSearching(false);
      setLoadingOrders(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1"><Clock className="w-3 h-3" /> รอตรวจสอบ/แนบสลิป</span>;
      case 'paid':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> ชำระเงินแล้ว / เตรียมผัก</span>;
      case 'shipping':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1"><Truck className="w-3 h-3" /> กำลังจัดส่ง</span>;
      case 'completed':
        return <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> จัดส่งสำเร็จ</span>;
      case 'cancelled':
        return <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1"><XCircle className="w-3 h-3" /> ยกเลิกออเดอร์</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-full">{status}</span>;
    }
  };

  // 3. Load single order items details
  const viewOrderDetails = async (orderId) => {
    try {
      const res = await api.get(`/api/orders/${orderId}`);
      setSelectedOrder(res.data);
    } catch (err) {
      alert('ไม่สามารถโหลดรายละเอียดออเดอร์ได้');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Warning if Mock Mode on localhost developer environment */}
      {isMockMode && typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-semibold text-center flex items-center justify-between">
          <span>🖥️ Dev Mode (Localhost)</span>
          <div className="flex items-center gap-2">
            <label className="text-[10px]">ป้อน LINE ID:</label>
            <input
              type="text"
              value={mockLineUserId}
              onChange={(e) => {
                setMockLineUserId(e.target.value);
                fetchCustomerAndOrders(e.target.value);
              }}
              className="bg-amber-600 text-white rounded px-2 py-0.5 w-32 border-none text-[11px] focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 text-white p-6 shadow-md rounded-b-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span>📦</span> ติดตามและประวัติการสั่งซื้อ
            </h1>
            <p className="text-xs text-green-100 mt-1">เช็คสถานะการจัดส่งผักสดปลอดสารพิษจากแปลง</p>
          </div>
          {profile && (
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-xs">
              {profile.pictureUrl && (
                <img src={profile.pictureUrl} alt={profile.displayName} className="w-6 h-6 rounded-full border border-white" />
              )}
              <span className="text-xs font-medium truncate max-w-[90px]">{profile.displayName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 max-w-lg mx-auto space-y-4">
        {loadingOrders ? (
          <div className="text-center py-16 space-y-3">
            <div className="animate-spin text-3xl">🌱</div>
            <p className="text-sm text-slate-500 font-medium">กำลังโหลดข้อมูลประวัติการสั่งซื้อ...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 space-y-4 shadow-xs">
            <div className="text-4xl">📭</div>
            <div>
              <p className="text-base font-bold text-slate-700">ไม่พบประวัติการสั่งซื้ออัตโนมัติ</p>
              <p className="text-xs text-slate-400 mt-1">คุณสามารถค้นหาด้วยเบอร์โทรศัพท์ที่เคยใช้สั่งซื้อได้ครับ</p>
            </div>

            {/* Phone Lookup Box */}
            <div className="flex gap-2 max-w-xs mx-auto">
              <div className="relative flex-1">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  placeholder="ใส่เบอร์โทรของคุณ..."
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-green-600"
                />
              </div>
              <button
                onClick={() => fetchOrdersByPhone(phoneSearch)}
                disabled={searching || !phoneSearch.trim()}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-2 rounded-xl transition disabled:opacity-50"
              >
                {searching ? 'ค้นหา...' : 'ค้นหา'}
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/liff/order')}
                className="bg-green-600 text-white text-xs px-5 py-2.5 rounded-full font-bold hover:bg-green-700 transition shadow-sm"
              >
                🛒 สั่งซื้อผักสดครั้งแรกที่นี่
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                คำสั่งซื้อของคุณ ({orders.length} รายการ)
              </span>
              <button
                onClick={() => {
                  const savedId = localStorage.getItem('farmgap_customer_id');
                  if (savedId) fetchOrdersByCustomerId(savedId);
                  else if (profile?.userId) fetchCustomerAndOrders(profile.userId);
                }}
                className="text-xs text-green-700 hover:underline flex items-center gap-1 font-semibold"
              >
                <RefreshCw className="w-3 h-3" /> รีเฟรช
              </button>
            </div>

            {orders.map(order => (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 space-y-3 transition hover:shadow-md"
              >
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-xs text-slate-400">เลขออเดอร์</div>
                    <div className="font-mono font-bold text-emerald-900 text-sm">{order.order_code}</div>
                  </div>
                  <div>
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {/* Body Details */}
                <div className="grid grid-cols-2 gap-2 text-xs py-1 text-slate-600">
                  <div>
                    <span className="text-slate-400">วันที่สั่ง:</span>
                    <p className="font-medium text-slate-700 mt-0.5">
                      {order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">การจัดส่ง:</span>
                    <p className="font-medium text-slate-700 mt-0.5">
                      {order.delivery_type === 'delivery' ? '🚚 ส่งตามที่อยู่' : '🏡 รับเองที่ฟาร์ม'}
                    </p>
                  </div>
                </div>

                {/* Total & Action */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[11px] text-slate-400">ยอดชำระสุทธิ:</span>
                    <div className="text-base font-black text-emerald-800">
                      ฿{Number(order.total_amount).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() => viewOrderDetails(order.id)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> ดูรายการผัก
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base">{selectedOrder.order_code}</h3>
                <p className="text-xs text-slate-400">วันที่ {selectedOrder.created_at ? format(new Date(selectedOrder.created_at), 'dd/MM/yyyy HH:mm') : '-'}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Delivery Details */}
            <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1 text-slate-600">
              <p><strong>ผู้รับ:</strong> {selectedOrder.customer_name} ({selectedOrder.customer_phone || '-'})</p>
              <p><strong>ที่อยู่จัดส่ง:</strong> {selectedOrder.customer_address || '-'}</p>
              <p><strong>วันนัดหมาย:</strong> {selectedOrder.delivery_date || '-'}</p>
              {selectedOrder.notes && <p><strong>หมายเหตุ:</strong> {selectedOrder.notes}</p>}
            </div>

            {/* Items */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">รายการผักที่สั่ง</h4>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden text-xs">
                {selectedOrder.items?.map(it => (
                  <div key={it.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">{it.product_name}</div>
                      <div className="text-slate-400">฿{it.unit_price} x {it.quantity} {it.unit}</div>
                    </div>
                    <div className="font-bold text-slate-800">
                      ฿{(it.unit_price * it.quantity).toLocaleString()}
                    </div>
                  </div>
                ))}
                <div className="p-3 bg-green-50/50 flex justify-between font-bold text-sm text-green-900">
                  <span>ยอดสุทธิรวม:</span>
                  <span className="text-emerald-700 font-black">฿{Number(selectedOrder.total_amount).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* PromptPay QR Code & Bank Transfer Section for Pending Orders */}
            {selectedOrder.status === 'pending' && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>รอการชำระเงิน</span>
                  </div>
                  <span className="text-[11px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    ยอดชำระ ฿{Number(selectedOrder.total_amount).toLocaleString()}
                  </span>
                </div>

                {/* Bank details */}
                {paymentInfo && (
                  <div className="bg-white/90 p-3 rounded-xl border border-amber-100 text-xs space-y-1 text-slate-700">
                    <div className="font-bold text-slate-800 text-[11px] mb-1">ช่องทางการชำระเงิน:</div>
                    {paymentInfo.bank_name && <div>• ธนาคาร: {paymentInfo.bank_name}</div>}
                    {paymentInfo.bank_account_no && (
                      <div className="flex items-center justify-between">
                        <span>• เลขบัญชี: <span className="font-mono font-bold">{paymentInfo.bank_account_no}</span></span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(paymentInfo.bank_account_no, 'เลขบัญชี')}
                          className="text-[10px] text-blue-700 hover:underline cursor-pointer font-bold"
                        >
                          {copiedText === 'เลขบัญชี' ? 'คัดลอกแล้ว' : 'คัดลอก'}
                        </button>
                      </div>
                    )}
                    {paymentInfo.bank_account_name && <div>• ชื่อบัญชี: {paymentInfo.bank_account_name}</div>}
                    {paymentInfo.promptpay_number && (
                      <div className="flex items-center justify-between">
                        <span>• พร้อมเพย์: <span className="font-mono font-bold">{paymentInfo.promptpay_number}</span></span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(paymentInfo.promptpay_number, 'เบอร์พร้อมเพย์')}
                          className="text-[10px] text-blue-700 hover:underline cursor-pointer font-bold"
                        >
                          {copiedText === 'เบอร์พร้อมเพย์' ? 'คัดลอกแล้ว' : 'คัดลอก'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Dynamic QR Code */}
                {(orderQr || paymentInfo?.promptpay_qr_url) && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col items-center p-3 space-y-2.5">
                    <div className="bg-[#003B70] text-white py-1.5 px-3 rounded-md text-center w-full flex items-center justify-between">
                      <span className="text-[9px] font-black tracking-wider uppercase">THAI QR PAYMENT</span>
                      <span className="text-[9px] bg-emerald-400 text-slate-950 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> ล็อกยอด ฿{Number(selectedOrder.total_amount).toLocaleString()}
                      </span>
                    </div>

                    <img
                      src={orderQr || paymentInfo?.promptpay_qr_url}
                      alt={`PromptPay QR ฿${selectedOrder.total_amount}`}
                      className="w-44 h-44 object-contain rounded-lg border border-slate-100"
                    />

                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-[#003B70] hover:bg-[#00284d] text-white font-bold text-xs py-2.5 px-3 rounded-xl transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>📥 บันทึกรูป QR Code (฿{Number(selectedOrder.total_amount).toLocaleString()})</span>
                    </button>
                    <p className="text-[10px] text-slate-400 text-center">
                      * บันทึกภาพแล้วเปิดสแกนจากแอปธนาคาร ยอดเงินจะล็อกอัตโนมัติ
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Payment Slip Preview */}
            {selectedOrder.slip_image_url && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">สลิปที่แนบไว้</h4>
                <img src={selectedOrder.slip_image_url} alt="สลิปโอนเงิน" className="w-full max-h-48 object-contain rounded-xl border border-slate-100 bg-slate-50 p-1" />
              </div>
            )}

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

      {/* Floating Shop Action Button */}
      <div className="fixed bottom-4 right-4">
        <button
          type="button"
          onClick={() => navigate('/liff/order')}
          className="bg-green-600 text-white font-bold px-4 py-3 rounded-full shadow-lg hover:bg-green-700 flex items-center gap-1.5 transition duration-150 text-xs"
        >
          <ShoppingCart className="w-4 h-4" /> สั่งผักสดเพิ่ม
        </button>
      </div>
    </div>
  );
}
