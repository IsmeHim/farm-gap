import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
  Printer,
  ArrowLeft,
  CheckCircle2,
  Package,
  Truck,
  QrCode,
  ShieldCheck,
  Building,
  Phone,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  Copy,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';

export default function ShippingLabel() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [farmInfo, setFarmInfo] = useState({
    farmName: 'ฟาร์มผักไฮโดรโปนิกส์ กรีนการ์เดน GAP',
    displayName: 'เจ้าของฟาร์ม',
    phone: '081-234-5678',
    address: 'ฟาร์มเกษตรปลอดภัย GAP จ.เชียงใหม่',
  });
  const [loading, setLoading] = useState(true);
  const [paperSize, setPaperSize] = useState('sticker'); // 'sticker' (100x150mm) or 'a4'
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // Load Order Details
        const oRes = await api.get(`/api/orders/${id}`);
        setOrder(oRes.data);

        // Try to load Farm Profile Info
        try {
          const uRes = await api.get('/api/auth/me');
          if (uRes.data) {
            setFarmInfo({
              farmName: uRes.data.farm_name || 'ฟาร์มผักไฮโดรโปนิกส์ กรีนการ์เดน GAP',
              displayName: uRes.data.display_name || 'เจ้าของฟาร์ม',
              phone: uRes.data.phone || '081-234-5678',
              address: uRes.data.address || 'ฟาร์มเกษตรปลอดภัย GAP มาตรฐาน มกษ. 9001',
            });
          }
        } catch (_) {}
      } catch (err) {
        console.error(err);
        toast.error('ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleMarkAsPacked = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      // Update order status to 'shipping'
      await api.patch(`/api/orders/${order.id}/status`, { status: 'shipping' });
      toast.success('บันทึกแพ็คเสร็จแล้ว & ลงสมุดขนส่ง GAP #6 อัตโนมัติเรียบร้อย! 🚚');
      setOrder(prev => ({ ...prev, status: 'shipping' }));
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin text-3xl">🌱</div>
        <p className="text-xs text-slate-500 font-medium">กำลังเตรียมข้อมูลใบปะหน้าพัสดุ...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 space-y-4 text-center">
        <div className="text-4xl">📦</div>
        <h2 className="font-bold text-slate-800 text-lg">ไม่พบคำสั่งซื้อนี้</h2>
        <Link to="/orders" className="text-xs font-bold text-emerald-700 underline">
          ← กลับไปหน้ารายการคำสั่งซื้อ
        </Link>
      </div>
    );
  }

  const items = order.items || [];
  const traceQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    `${window.location.origin}/trace/${order.order_code || order.id}`
  )}`;

  return (
    <div className="min-h-screen bg-slate-100 py-4 sm:py-8 px-2 sm:px-4 text-slate-800 font-sans print:p-0 print:bg-white print:min-h-0">
      {/* 1. SCREEN CONTROLS (Hidden during actual print) */}
      <div className="max-w-3xl mx-auto mb-5 print:hidden space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shadow-2xs transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับรายการคำสั่งซื้อ</span>
          </button>

          {/* Size Selector */}
          <div className="inline-flex items-center bg-slate-200/80 p-1 rounded-xl gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPaperSize('sticker')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                paperSize === 'sticker'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏷️ สติ๊กเกอร์พัสดุ (100x150mm)
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('a4')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                paperSize === 'a4'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📄 ขนาด A4 / A5
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-slate-800">
                ใบปะหน้า & รายการแพ็คสินค้า
              </span>
              <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                #{order.order_code}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              สถานะปัจจุบัน:{' '}
              <strong className="text-emerald-700">
                {order.status === 'shipping'
                  ? '🚚 กำลังจัดส่ง'
                  : order.status === 'completed'
                  ? '✓ จัดส่งสำเร็จ'
                  : order.status === 'paid'
                  ? '✓ ชำระเงินแล้ว (พร้อมแพ็ค)'
                  : '⏳ รอดำเนินการ'}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {order.status !== 'shipping' && order.status !== 'completed' && (
              <button
                type="button"
                onClick={handleMarkAsPacked}
                disabled={updating}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-blue-200 transition cursor-pointer whitespace-nowrap shadow-2xs"
              >
                <Package className="w-4 h-4" />
                <span>{updating ? 'กำลังบันทึก...' : '✅ แพ็คเสร็จ & บันทึกส่ง (GAP #6)'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-md cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ สั่งพิมพ์ (Print)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. PRINTABLE SHIPPING LABEL (Standard 100x150mm or A4 layout) */}
      <div className="flex justify-center">
        <div
          className={`bg-white border-2 border-slate-900 p-5 sm:p-6 shadow-xl print:shadow-none print:border-2 print:border-black print:m-0 space-y-4 ${
            paperSize === 'sticker'
              ? 'w-full max-w-[420px] rounded-2xl print:rounded-none'
              : 'w-full max-w-2xl rounded-2xl print:rounded-none'
          }`}
          style={{ boxSizing: 'border-box' }}
        >
          {/* Header: Farm Logo & GAP Certification Tag */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 gap-2">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm sm:text-base text-slate-950 tracking-tight">
                  {farmInfo.farmName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded border border-emerald-300 font-black">
                  GAP 100%
                </span>
                <span>ผักสดปลอดภัยได้มาตรฐาน GAP</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                คำสั่งซื้อ (ORDER)
              </div>
              <div className="font-mono font-black text-xs sm:text-sm text-slate-900">
                {order.order_code}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy HH:mm') : '-'}
              </div>
            </div>
          </div>

          {/* Barcode Mock Visual */}
          <div className="text-center py-1 border-b border-slate-200">
            <div className="font-mono text-xl sm:text-2xl tracking-[0.25em] font-black text-slate-900 select-none">
              ||| | |||| | |||||| | |||
            </div>
            <div className="font-mono text-[10px] text-slate-500 font-bold tracking-widest">
              *{order.order_code}*
            </div>
          </div>

          {/* SENDER & RECIPIENT SECTION */}
          <div className="grid grid-cols-1 gap-3 border-b-2 border-slate-900 pb-3">
            {/* Sender (Compact) */}
            <div className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800">ผู้ส่ง (Sender): </span>
              {farmInfo.farmName} • โทร. {farmInfo.phone} ({farmInfo.address})
            </div>

            {/* Recipient (Highlight Large for Delivery Courier) */}
            <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-300 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  ผู้รับ (TO / RECIPIENT):
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-900 text-white rounded">
                  {order.delivery_type === 'delivery' ? '🚚 จัดส่งตามที่อยู่' : '🏡 รับเองที่ฟาร์ม'}
                </span>
              </div>

              <div className="text-sm sm:text-base font-black text-slate-950">
                คุณ {order.customer_name || 'ลูกค้าทั่วไป'}
              </div>

              <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                📞 โทร: {order.customer_phone || order.phone || '-'}
              </div>

              <div className="text-xs text-slate-700 leading-relaxed pt-0.5">
                <strong>ที่อยู่จัดส่ง:</strong> {order.customer_address || order.address || '—'}
              </div>
            </div>
          </div>

          {/* PACKING CHECKLIST TABLE (Items inside box) */}
          <div className="space-y-1.5 border-b-2 border-slate-900 pb-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
              <span>📋 รายการผักที่ต้องแพ็ค (Packing Checklist)</span>
              <span className="text-[10px] text-slate-500">รวม {items.length} รายการ</span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] text-slate-500 uppercase">
                  <th className="py-1 px-1 w-7 text-center">เช็ค</th>
                  <th className="py-1 px-1">รายการผัก</th>
                  <th className="py-1 px-1 text-center w-16">จำนวน</th>
                  <th className="py-1 px-1 text-right w-16">ยอดรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-2 text-center text-slate-400 text-[11px]">
                      (สั่งซื้อผักสดตามคำสั่งซื้อ)
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx} className="text-xs">
                      <td className="py-1 px-1 text-center align-middle">
                        <div className="w-4 h-4 border-2 border-slate-400 rounded mx-auto" />
                      </td>
                      <td className="py-1 px-1 font-bold text-slate-900 align-middle">
                        {it.product_name || it.name || 'ผักสด GAP'}
                      </td>
                      <td className="py-1 px-1 text-center font-mono font-bold text-slate-800 align-middle">
                        {it.quantity} {it.unit || 'กก.'}
                      </td>
                      <td className="py-1 px-1 text-right font-mono text-slate-700 align-middle">
                        ฿{Number(it.subtotal || (it.quantity * (it.unit_price || it.price || 0))).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* BOTTOM SUMMARY: GAP QR CODE + PAYMENT STATUS */}
          <div className="grid grid-cols-2 gap-3 items-center pt-1">
            {/* GAP Traceability QR Code */}
            <div className="flex items-center gap-2.5">
              <img
                src={traceQrUrl}
                alt="GAP Trace QR"
                className="w-16 h-16 sm:w-18 sm:h-18 p-0.5 border border-slate-300 rounded-lg bg-white shrink-0"
              />
              <div className="space-y-0.5 text-[10px] leading-tight">
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-700 inline" />
                  GAP TRACE QR
                </div>
                <p className="text-slate-500 text-[9px]">
                  สแกนตรวจสอบย้อนกลับมาตรฐานความปลอดภัย GAP แปลงปลูก และการใช้น้ำ
                </p>
              </div>
            </div>

            {/* Payment & Grand Total Box */}
            <div className="text-right space-y-1">
              <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold border border-slate-900 bg-slate-50 text-slate-900">
                {order.payment_status === 'paid' || order.slip_image_url || order.status === 'paid'
                  ? '✓ ชำระเงินแล้ว (PAID)'
                  : 'เก็บเงินปลายทาง (COD)'}
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase block">ยอดรวมทั้งสิ้น</span>
                <span className="font-mono font-black text-lg sm:text-xl text-slate-950">
                  ฿{Number(order.total_amount || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t border-dashed border-slate-300 pt-2 flex items-center justify-between text-[9px] text-slate-400">
            <span>FarmGAP Certified Organic & Good Agricultural Practices</span>
            <span>ผู้ตรวจและบรรจุ: .......................................</span>
          </div>
        </div>
      </div>
    </div>
  );
}
