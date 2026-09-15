import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import liff from '@line/liff';
import { api } from '../lib/api';

export default function LiffOrder() {
  const navigate = useNavigate();
  const [liffError, setLiffError] = useState(null);

  const [profile, setProfile] = useState(null);
  const [isLiffLoading, setIsLiffLoading] = useState(true);
  const [mockLineUserId, setMockLineUserId] = useState('mock-user-12345');
  const [isMockMode, setIsMockMode] = useState(false);

  // Catalog and Cart
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({}); // product_id -> quantity
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Form details
  const [form, setForm] = useState({
    name: (typeof window !== 'undefined' ? localStorage.getItem('farmgap_customer_name') : '') || '',
    phone: (typeof window !== 'undefined' ? localStorage.getItem('farmgap_customer_phone') : '') || '',
    address: (typeof window !== 'undefined' ? localStorage.getItem('farmgap_customer_address') : '') || '',
    deliveryType: 'delivery', // delivery or pickup
    deliveryDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
    notes: '',
    slipImage: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);

  // 0. Fetch farm payment info
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/auth/payment-info');
        if (res.data) setPaymentInfo(res.data);
      } catch (e) {
        console.warn('Failed to load farm payment info:', e.message);
      }
    })();
  }, []);

  // 1. Initialize LINE LIFF
  useEffect(() => {
    liff.init({ liffId: import.meta.env.VITE_LIFF_ID || 'dummy-liff-id' })
      .then(() => {
        setIsLiffLoading(false);
        if (liff.isLoggedIn()) {
          liff.getProfile().then(p => {
            setProfile(p);
            try {
              localStorage.setItem('farmgap_line_user_id', p.userId);
            } catch (e) {}
            // Sync with backend customers
            api.post('/api/customers/sync', {
              line_user_id: p.userId,
              display_name: p.displayName,
              picture_url: p.pictureUrl
            }).catch(err => console.warn('Customer sync fail:', err.message));
          });
        } else {
          // If not logged in, only force login if inside LINE
          if (liff.isInClient()) {
            liff.login();
          } else {
            setIsMockMode(true);
          }
        }
      })
      .catch((err) => {
        console.warn('LIFF initialization failed:', err);
        setIsLiffLoading(false);
        setIsMockMode(true);
      });
  }, []);

  // 2. Fetch available products
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/products?status=available');
        setProducts(res.data.filter(p => p.stock_quantity > 0));
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  const updateCart = (id, change, maxStock) => {
    const current = cart[id] || 0;
    const next = current + change;
    if (next <= 0) {
      const nextCart = { ...cart };
      delete nextCart[id];
      setCart(nextCart);
    } else if (next <= maxStock) {
      setCart({ ...cart, [id]: next });
    }
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [id, qty]) => {
      const prod = products.find(p => p.id === Number(id));
      return total + (prod ? Number(prod.price) * qty : 0);
    }, 0);
  };

  const [recommendations, setRecommendations] = useState([]);

  // Fetch recommendations based on cart items
  useEffect(() => {
    const cartKeys = Object.keys(cart);
    if (cartKeys.length === 0) {
      setRecommendations([]);
      return;
    }
    const productId = cartKeys[0];
    (async () => {
      try {
        const res = await api.get(`/api/ai/recommendations/${productId}`);
        setRecommendations(res.data.filter(r => !cart[r.recommended_product_id]));
      } catch (err) {
        console.warn('Failed to load recommendations:', err.message);
      }
    })();
  }, [cart]);

  // Convert image upload to Base64 for receipt
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(prev => ({ ...prev, slipImage: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // 3. Submit Order
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Object.keys(cart).length === 0) {
      alert('กรุณาเลือกผักอย่างน้อย 1 รายการลงตะกร้า');
      return;
    }
    if (!form.name || !form.phone || (form.deliveryType === 'delivery' && !form.address)) {
      alert('กรุณากรอกข้อมูลส่วนตัวและที่อยู่จัดส่งให้ครบถ้วน');
      return;
    }
    if (!form.slipImage) {
      alert('กรุณาอัปโหลดสลิปหลักฐานการโอนเงินเพื่อยืนยันออเดอร์');
      return;
    }

    setIsSubmitting(true);

    const lineUserId = profile?.userId || mockLineUserId;

    try {
      // First sync customer profiles
      const syncRes = await api.post('/api/customers/sync', {
        line_user_id: lineUserId,
        display_name: form.name,
        phone: form.phone,
        address: form.address
      });

      const customerId = syncRes.data.customer.id;
      try {
        localStorage.setItem('farmgap_customer_id', customerId);
        localStorage.setItem('farmgap_line_user_id', lineUserId);
        localStorage.setItem('farmgap_customer_name', form.name);
        localStorage.setItem('farmgap_customer_phone', form.phone);
        localStorage.setItem('farmgap_customer_address', form.address);
      } catch (e) {}

      // Construct order items payload
      const orderItems = Object.entries(cart).map(([id, qty]) => ({
        product_id: Number(id),
        quantity: qty
      }));

      // Create Order
      const orderRes = await api.post('/api/orders', {
        customer_id: customerId,
        items: orderItems,
        delivery_type: form.deliveryType,
        delivery_date: form.deliveryDate,
        notes: form.notes
      });

      // Upload Payment Slip
      await api.post(`/api/orders/${orderRes.data.id}/slip`, {
        slip_image_url: form.slipImage
      });

      setOrderSuccess(orderRes.data);
      setCart({});
      // Reset slip
      setForm(prev => ({ ...prev, slipImage: '' }));
    } catch (err) {
      alert(err.response?.data?.error || 'เกิดข้อผิดพลาดในการสร้างออเดอร์');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-green-100">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-green-600">✓</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">สั่งซื้อผักสำเร็จ!</h2>
          <p className="text-gray-600 mb-6">เลขออเดอร์ของคุณคือ <strong className="text-green-700">{orderSuccess.order_code}</strong></p>
          
          <div className="bg-green-50 p-4 rounded-xl text-left text-sm text-green-800 mb-6 space-y-1">
            <p><strong>ชื่อผู้รับ:</strong> {form.name}</p>
            <p><strong>ยอดชำระ:</strong> {orderSuccess.total_amount} บาท</p>
            <p><strong>วิธีส่ง:</strong> {form.deliveryType === 'delivery' ? 'จัดส่งด่วนตามที่อยู่' : 'รับเองที่ฟาร์ม'}</p>
            <p><strong>วันที่นัดหมาย:</strong> {new Date(form.deliveryDate).toLocaleDateString('th-TH')}</p>
          </div>

          <button
            onClick={() => {
              setOrderSuccess(null);
              navigate('/liff/history');
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition duration-150"
          >
            ติดตามสถานะออเดอร์
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Warning if Mock Mode on localhost */}
      {isMockMode && typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-semibold text-center flex items-center justify-between">
          <span>🖥️ Mock Mode: พัฒนาและแสดงเดโมภายนอกแอป LINE</span>
          <div className="flex items-center gap-2">
            <label className="text-[10px]">จำลอง LINE ID:</label>
            <input
              type="text"
              value={mockLineUserId}
              onChange={(e) => setMockLineUserId(e.target.value)}
              className="bg-amber-600 text-white rounded px-2 py-0.5 w-32 border-none text-[11px] focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 text-white p-6 shadow-md rounded-b-3xl">
        <div className="flex items-center gap-3">
          {profile?.pictureUrl ? (
            <img src={profile.pictureUrl} alt="profile" className="w-12 h-12 rounded-full border-2 border-white/50" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-green-800 border-2 border-white/30 flex items-center justify-center font-bold">🌱</div>
          )}
          <div>
            <h1 className="text-xl font-bold">ฟาร์มผักสด FarmGAP AI</h1>
            <p className="text-xs text-green-100">สวัสดีครับ คุณ {profile?.displayName || form.name || 'ลูกค้า LINE'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* catalog */}
        <section>
          <h2 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
            🥬 สั่งผักสดเก็บเกี่ยววันนี้
          </h2>

          {loadingProducts ? (
            <div className="text-center py-8 text-sm text-slate-500">กำลังโหลดรายการผักสด...</div>
          ) : products.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-400 border border-dashed">
              วันนี้ไม่มีผักพร้อมเก็บเกี่ยวขายในระบบ
            </div>
          ) : (
            <div className="grid gap-4">
              {products.map(product => (
                <div key={product.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-16 h-16 rounded-xl object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-green-50 flex items-center justify-center text-2xl">🥦</div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-800">{product.name}</h3>
                      <p className="text-xs text-slate-400">{product.category || 'ผักสลัด'}</p>
                      <p className="text-sm font-semibold text-green-600 mt-1">
                        ฿{product.price} <span className="text-xs text-slate-400 font-normal">/ {product.unit}</span>
                      </p>
                      <p className="text-[10px] text-amber-600 font-medium">เหลือสต็อก {product.stock_quantity} {product.unit}</p>
                    </div>
                  </div>

                  {/* Quantity Actions */}
                  <div className="flex items-center gap-2">
                    {(cart[product.id] || 0) > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => updateCart(product.id, -1, product.stock_quantity)}
                          className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold hover:bg-slate-200"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-bold">{cart[product.id]}</span>
                        <button
                          type="button"
                          onClick={() => updateCart(product.id, 1, product.stock_quantity)}
                          className="w-8 h-8 rounded-full bg-green-600 text-white font-bold hover:bg-green-700"
                        >
                          +
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateCart(product.id, 1, product.stock_quantity)}
                        className="bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-4 py-1.5 rounded-full text-xs transition"
                      >
                        เพิ่มลงตะกร้า
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Cart items list summary */}
        {Object.keys(cart).length > 0 && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-3 border-b pb-2">🛒 สรุปรายการในตะกร้า</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(cart).map(([id, qty]) => {
                const prod = products.find(p => p.id === Number(id));
                if (!prod) return null;
                return (
                  <div key={id} className="flex justify-between">
                    <span>{prod.name} x {qty}</span>
                    <span className="font-semibold">฿{Number(prod.price) * qty}</span>
                  </div>
                );
              })}
              <div className="flex justify-between text-base font-bold text-green-700 border-t pt-2 mt-2">
                <span>ยอดรวมทั้งหมด:</span>
                <span>฿{getCartTotal()}</span>
              </div>
            </div>
          </section>
        )}

        {/* AI Recommendations */}
        {recommendations.length > 0 && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 animate-fade-in">
            <h3 className="font-bold text-xs text-green-700 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
              🤖 AI แนะนำ: ผักยอดฮิตซื้อคู่กัน
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {recommendations.map(rec => (
                <div key={rec.id} className="bg-slate-50 p-2 rounded-xl text-center flex flex-col justify-between border border-slate-100">
                  <div className="space-y-1">
                    {rec.image_url ? (
                      <img src={rec.image_url} alt={rec.name} className="w-full h-14 object-cover rounded-lg" />
                    ) : (
                      <div className="w-full h-14 bg-green-100 rounded-lg flex items-center justify-center text-lg">🥗</div>
                    )}
                    <h4 className="text-[10px] font-bold text-slate-800 line-clamp-1">{rec.name}</h4>
                    <p className="text-[9px] text-green-600 font-semibold">฿{rec.price}/{rec.unit}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateCart(rec.recommended_product_id, 1, rec.stock_quantity)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-1 rounded-lg text-[9px] transition mt-2"
                  >
                    + เพิ่มคู่กัน
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Checkout Form */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-1.5 border-b pb-2">
            📝 ข้อมูลผู้รับและชำระเงิน
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อ-นามสกุล ผู้รับ *</label>
              <input
                type="text"
                required
                placeholder="สมชาย ใจดี"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">เบอร์โทรศัพท์ผู้รับ *</label>
              <input
                type="tel"
                required
                placeholder="0812345678"
                value={form.phone}
                onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">รูปแบบการรับสินค้า *</label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, deliveryType: 'delivery' }))}
                  className={`py-2 px-4 rounded-xl text-xs font-bold transition ${
                    form.deliveryType === 'delivery'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  จัดส่งตามที่อยู่
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, deliveryType: 'pickup' }))}
                  className={`py-2 px-4 rounded-xl text-xs font-bold transition ${
                    form.deliveryType === 'pickup'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  มารับเองที่ฟาร์ม
                </button>
              </div>
            </div>

            {form.deliveryType === 'delivery' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ที่อยู่สำหรับการจัดส่ง *</label>
                <textarea
                  required={form.deliveryType === 'delivery'}
                  placeholder="หมู่บ้านกรีนแลนด์ เลขที่ 123/4 ซอย 5 ต.ในเมือง อ.เมือง จ.เชียงใหม่ 50000"
                  rows="3"
                  value={form.address}
                  onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition resize-none"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">วันที่ต้องการรับสินค้า *</label>
                <input
                  type="date"
                  required
                  value={form.deliveryDate}
                  onChange={(e) => setForm(prev => ({ ...prev, deliveryDate: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">บันทึกเพิ่มเติม (ถ้ามี)</label>
                <input
                  type="text"
                  placeholder="เช่น มะเขือเทศขอลูกสุกๆ"
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* QR Payment Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                💳 โอนเงินชำระค่าผัก
              </h4>
              <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-slate-150">
                <p className="font-semibold text-emerald-800">
                  {paymentInfo?.bank_name || 'ธนาคารกสิกรไทย (KBANK)'}
                </p>
                <p className="text-sm font-bold text-slate-800">
                  เลขบัญชี: <span className="font-mono">{paymentInfo?.bank_account_no || '123-4-56789-0'}</span>
                </p>
                <p className="text-slate-600">
                  ชื่อบัญชี: {paymentInfo?.bank_account_name || paymentInfo?.display_name || 'บจก. ฟาร์มผักเกษตรดี (FarmGAP)'}
                </p>
                {paymentInfo?.promptpay_number && (
                  <p className="text-slate-600">
                    พร้อมเพย์: <span className="font-mono font-medium">{paymentInfo.promptpay_number}</span>
                  </p>
                )}
              </div>

              {/* Display QR Code if available */}
              {(paymentInfo?.promptpay_qr_url || (paymentInfo?.promptpay_number && paymentInfo.promptpay_number.trim())) && (
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-150 text-center">
                  <p className="text-[11px] font-semibold text-slate-500 mb-2">สแกน QR Code เพื่อชำระเงิน</p>
                  <img
                    src={
                      paymentInfo?.promptpay_qr_url ||
                      `https://promptpay.io/${paymentInfo.promptpay_number.replace(/[^0-9]/g, '')}${getCartTotal() > 0 ? '/' + getCartTotal() : ''}.png`
                    }
                    alt="PromptPay QR"
                    className="w-36 h-36 object-contain rounded-lg border border-slate-100 shadow-xs"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div className="border-t pt-3">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">📷 แนบหลักฐานการโอนเงิน (สลิป) *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
                />
                {form.slipImage && (
                  <div className="mt-2 relative inline-block">
                    <img src={form.slipImage} alt="slip preview" className="h-32 rounded-lg object-contain border" />
                  </div>
                )}
              </div>
            </div>

            {/* Order Action Button */}
            <button
              type="submit"
              disabled={isSubmitting || Object.keys(cart).length === 0}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition duration-150 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'กำลังส่งออเดอร์...' : `ยืนยันการสั่งซื้อ • ฿${getCartTotal()}`}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
