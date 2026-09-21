import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
  Printer,
  ArrowLeft,
  Package,
  ShieldCheck,
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-3 p-4">
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
    <div className="min-h-screen bg-slate-100 py-3 sm:py-8 px-2 sm:px-4 text-slate-800 font-sans print:p-0 print:bg-white print:min-h-0">
      {/* Dynamic Print Styles for Thermal Sticker vs A4 */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize === 'sticker' ? '100mm 150mm' : 'auto'};
            margin: ${paperSize === 'sticker' ? '4mm' : '10mm'};
          }
          body {
            background-color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* 1. SCREEN CONTROLS (Hidden during actual print) */}
      <div className="max-w-3xl mx-auto mb-4 sm:mb-5 print:hidden space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับรายการคำสั่งซื้อ</span>
          </button>

          {/* Size Selector */}
          <div className="grid grid-cols-2 sm:inline-flex items-center bg-slate-200/80 p-1 rounded-xl gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPaperSize('sticker')}
              className={`px-3 py-2 rounded-lg transition text-center cursor-pointer ${
                paperSize === 'sticker'
                  ? 'bg-white text-emerald-800 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 font-semibold'
              }`}
            >
              🏷️ สติ๊กเกอร์ (100x150mm)
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('a4')}
              className={`px-3 py-2 rounded-lg transition text-center cursor-pointer ${
                paperSize === 'a4'
                  ? 'bg-white text-emerald-800 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 font-semibold'
              }`}
            >
              📄 ขนาด A4 / A5
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-slate-800">
                ใบปะหน้า & เช็คลิสต์แพ็คสินค้า
              </span>
              <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                #{order.order_code}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span>สถานะ:</span>
              <strong className="text-emerald-700">
                {order.status === 'shipping'
                  ? '🚚 กำลังจัดส่ง'
                  : order.status === 'completed'
                  ? '✓ จัดส่งสำเร็จ'
                  : order.payment_method === 'cod'
                  ? '💵 เก็บเงินปลายทาง (COD)'
                  : order.status === 'paid'
                  ? '✓ ชำระเงินแล้ว (พร้อมแพ็ค)'
                  : '⏳ รอดำเนินการ'}
              </strong>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {order.status !== 'shipping' && order.status !== 'completed' && (
              <button
                type="button"
                onClick={handleMarkAsPacked}
                disabled={updating}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-blue-200 transition cursor-pointer whitespace-nowrap shadow-2xs"
              >
                <Package className="w-4 h-4" />
                <span>{updating ? 'กำลังบันทึก...' : '✅ แพ็คเสร็จ & บันทึกส่ง (GAP #6)'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-md cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ สั่งพิมพ์ใบปะหน้า</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. PRINTABLE SHIPPING LABEL (Standard 100x150mm or A4 layout) */}
      <div className="flex justify-center px-0.5 sm:px-0">
        <div
          className={`bg-white border-2 border-slate-900 p-3.5 sm:p-5 md:p-6 shadow-xl print:shadow-none print:border-2 print:border-black print:m-0 space-y-3 sm:space-y-4 w-full ${
            paperSize === 'sticker'
              ? 'max-w-[420px] rounded-2xl print:rounded-none'
              : 'max-w-2xl rounded-2xl print:rounded-none'
          }`}
          style={{ boxSizing: 'border-box' }}
        >
          {/* Header: Farm Logo & GAP Certification Tag */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2.5 sm:pb-3 gap-2">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm sm:text-base text-slate-950 tracking-tight break-words">
                  {farmInfo.farmName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded border border-emerald-300 font-black shrink-0">
                  GAP 100%
                </span>
                <span className="truncate">ผักสดปลอดภัยได้มาตรฐาน GAP</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                คำสั่งซื้อ (ORDER)
              </div>
              <div className="font-mono font-black text-xs sm:text-sm text-slate-900">
                {order.order_code}
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium">
                {order.created_at ? format(new Date(order.created_at), 'dd/MM/yy HH:mm') : '-'}
              </div>
            </div>
          </div>

          {/* Barcode Mock Visual */}
          <div className="text-center py-1 border-b border-slate-200">
            <div className="font-mono text-lg sm:text-2xl tracking-[0.2em] sm:tracking-[0.25em] font-black text-slate-900 select-none">
              ||| | |||| | |||||| | |||
            </div>
            <div className="font-mono text-[9px] sm:text-[10px] text-slate-500 font-bold tracking-widest">
              *{order.order_code}*
            </div>
          </div>

          {/* SENDER & RECIPIENT SECTION */}
          <div className="grid grid-cols-1 gap-2.5 sm:gap-3 border-b-2 border-slate-900 pb-3">
            {/* Sender (Compact) */}
            <div className="text-[10px] text-slate-600 bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-200 leading-relaxed break-words">
              <span className="font-bold text-slate-800">ผู้ส่ง (Sender): </span>
              {farmInfo.farmName} • โทร. {farmInfo.phone} ({farmInfo.address})
            </div>

            {/* Recipient (Highlight Large for Delivery Courier) */}
            <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-300 space-y-1">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  ผู้รับ (TO / RECIPIENT):
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-900 text-white rounded">
                  {order.delivery_type === 'delivery' ? '🚚 จัดส่งตามที่อยู่' : '🏡 รับเองที่ฟาร์ม'}
                </span>
              </div>

              <div className="text-base sm:text-lg font-black text-slate-950">
                คุณ {order.customer_name || 'ลูกค้าทั่วไป'}
              </div>

              <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                📞 โทร: <a href={`tel:${order.customer_phone || order.phone || ''}`} className="hover:underline">{order.customer_phone || order.phone || '-'}</a>
              </div>

              <div className="text-xs text-slate-800 leading-relaxed pt-0.5 break-words">
                <strong>ที่อยู่จัดส่ง:</strong> {order.customer_address || order.address || '—'}
              </div>
            </div>
          </div>

          {/* PACKING CHECKLIST TABLE (Items inside box) */}
          <div className="space-y-1.5 border-b-2 border-slate-900 pb-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
              <span>📋 เช็คลิสต์แพ็คผัก (Packing List)</span>
              <span className="text-[10px] text-slate-500">รวม {items.length} รายการ</span>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[280px]">
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
                          <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-slate-400 rounded mx-auto" />
                        </td>
                        <td className="py-1 px-1 font-bold text-slate-900 align-middle break-words">
                          {it.product_name || it.name || 'ผักสด GAP'}
                        </td>
                        <td className="py-1 px-1 text-center font-mono font-bold text-slate-800 align-middle whitespace-nowrap">
                          {it.quantity} {it.unit || 'กก.'}
                        </td>
                        <td className="py-1 px-1 text-right font-mono text-slate-700 align-middle whitespace-nowrap">
                          ฿{Number(it.subtotal || (it.quantity * (it.unit_price || it.price || 0))).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* BOTTOM SUMMARY: GAP QR CODE + PAYMENT STATUS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            {/* GAP Traceability QR Code */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <img
                src={traceQrUrl}
                alt="GAP Trace QR"
                className="w-14 h-14 sm:w-16 sm:h-16 p-0.5 border border-slate-300 rounded-lg bg-white shrink-0"
              />
              <div className="space-y-0.5 text-[10px] leading-tight">
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 inline shrink-0" />
                  <span>GAP TRACE QR</span>
                </div>
                <p className="text-slate-500 text-[9px] max-w-[200px]">
                  สแกนตรวจสอบย้อนกลับมาตรฐานความปลอดภัย GAP แปลงปลูก และการใช้น้ำ
                </p>
              </div>
            </div>

            {/* Payment & Grand Total Box */}
            <div className="text-right w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
              <div>
                {order.payment_method === 'cod' ? (
                  <div className="inline-block px-2.5 py-1 rounded text-[11px] font-black border-2 border-amber-600 bg-amber-50 text-amber-950">
                    💵 เก็บเงินปลายทาง (COD)
                  </div>
                ) : (order.payment_status === 'paid' || order.slip_image_url || order.status === 'paid' || order.status === 'shipping' || order.status === 'completed') ? (
                  <div className="inline-block px-2.5 py-1 rounded text-[11px] font-black border-2 border-emerald-600 bg-emerald-50 text-emerald-950">
                    ✓ ชำระเงินแล้ว (PAID)
                  </div>
                ) : (
                  <div className="inline-block px-2.5 py-1 rounded text-[11px] font-bold border border-slate-800 bg-slate-100 text-slate-800">
                    รอชำระเงิน
                  </div>
                )}
              </div>

              <div className="mt-1">
                <span className="text-[10px] text-slate-500 uppercase block sm:inline mr-1">
                  {order.payment_method === 'cod' ? 'ยอดที่ต้องเก็บ:' : 'ยอดรวมทั้งสิ้น:'}
                </span>
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
