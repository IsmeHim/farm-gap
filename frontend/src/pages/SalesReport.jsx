import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import { toast } from 'sonner';
import {
  TrendingUp,
  Download,
  Printer,
  Calendar,
  DollarSign,
  ShoppingBag,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  Filter,
  RefreshCw,
  Search,
  User,
  Phone,
  MapPin,
  Tag,
  ArrowUpRight,
  Sparkles,
  Award,
  Wallet,
  X
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';

export default function SalesReport() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: {
      total_revenue: 0,
      total_orders: 0,
      completed_orders: 0,
      avg_order_value: 0,
      total_veggies_kg: 0,
      total_costs: 0,
      gross_profit: 0,
    },
    top_products: [],
    orders: []
  });

  // Filter state
  const [preset, setPreset] = useState('all'); // 'all', 'today', '7d', 'month', 'year', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('valid'); // 'valid' | 'all' | 'completed' | 'paid'
  const [searchQuery, setSearchQuery] = useState('');

  // Handle Preset change
  const applyPreset = (p) => {
    setPreset(p);
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    if (p === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (p === '7d') {
      setStartDate(format(subDays(today, 7), 'yyyy-MM-dd'));
      setEndDate(todayStr);
    } else if (p === 'month') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
    } else if (p === 'year') {
      setStartDate(format(startOfYear(today), 'yyyy-MM-dd'));
      setEndDate(format(endOfYear(today), 'yyyy-MM-dd'));
    } else if (p === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Fetch report data
  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/api/sales/report', { params });
      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถโหลดข้อมูลรายงานรายได้ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, statusFilter]);

  // Filter orders by search query
  const filteredOrders = (data.orders || []).filter(o => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (o.order_code && o.order_code.toLowerCase().includes(q)) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
      (o.customer_phone && o.customer_phone.includes(q))
    );
  });

  // Export Orders to CSV (with UTF-8 BOM for Excel)
  const exportOrdersCSV = () => {
    if (!data.orders || data.orders.length === 0) {
      toast.error('ไม่มีข้อมูลคำสั่งซื้อสำหรับส่งออก');
      return;
    }

    const headers = [
      'รหัสออเดอร์',
      'วันที่สั่งซื้อ',
      'เวลา',
      'ชื่อลูกค้า',
      'เบอร์โทรศัพท์',
      'ที่อยู่จัดส่ง',
      'ประเภทการจัดส่ง',
      'รายการสินค้า',
      'ยอดรวม (บาท)',
      'สถานะออเดอร์',
      'หมายเหตุ'
    ];

    const rows = data.orders.map(o => {
      const dateObj = o.created_at ? new Date(o.created_at) : null;
      const orderDate = dateObj ? format(dateObj, 'yyyy-MM-dd') : '-';
      const orderTime = dateObj ? format(dateObj, 'HH:mm:ss') : '-';
      const itemsStr = (o.items || [])
        .map(i => `${i.product_name} x ${i.quantity} ${i.unit}`)
        .join('; ');
      const deliveryText = o.delivery_type === 'delivery' ? 'ส่งตามที่อยู่' : 'รับเองที่ฟาร์ม';

      return [
        `"${o.order_code || ''}"`,
        `"${orderDate}"`,
        `"${orderTime}"`,
        `"${(o.customer_name || '').replace(/"/g, '""')}"`,
        `"${o.customer_phone || ''}"`,
        `"${(o.customer_address || '').replace(/"/g, '""')}"`,
        `"${deliveryText}"`,
        `"${itemsStr.replace(/"/g, '""')}"`,
        Number(o.total_amount || 0).toFixed(2),
        `"${o.status || ''}"`,
        `"${(o.notes || '').replace(/"/g, '""')}"`
      ];
    });

    // Add UTF-8 BOM for Microsoft Excel Thai compatibility
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `farmgap_sales_orders_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('ดาวน์โหลดไฟล์ CSV รายการคำสั่งซื้อเรียบร้อยแล้ว');
  };

  // Export Product Sales Summary to CSV
  const exportProductsCSV = () => {
    if (!data.top_products || data.top_products.length === 0) {
      toast.error('ไม่มีข้อมูลสินค้าสำหรับส่งออก');
      return;
    }

    const headers = [
      'ชื่อสินค้า/พืช',
      'จำนวนที่ขายได้',
      'หน่วย',
      'ยอดขายรวม (บาท)',
      'จำนวนครั้งที่สั่งซื้อ (ออเดอร์)',
      'สัดส่วนยอดขาย (%)'
    ];

    const totalRev = data.summary?.total_revenue || 1;
    const rows = data.top_products.map(p => {
      const share = ((p.total_revenue / totalRev) * 100).toFixed(1);
      return [
        `"${(p.product_name || '').replace(/"/g, '""')}"`,
        Number(p.total_quantity || 0).toFixed(2),
        `"${p.unit || 'กก.'}"`,
        Number(p.total_revenue || 0).toFixed(2),
        p.orders_count || 0,
        `${share}%`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `farmgap_product_sales_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('ดาวน์โหลดไฟล์ CSV สรุปยอดขายรายสินค้าเรียบร้อยแล้ว');
  };

  // Print Statement
  const handlePrint = () => {
    window.print();
  };

  const { summary, top_products } = data;

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Header - Screen View */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-900/15 shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                  รายงานรายได้ & ส่งออกข้อมูล
                </h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                  Sales & Revenue
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                สรุปยอดขายผลผลิตจากหน้าร้าน LINE OA เพื่อการบัญชี ตรวจสอบกำไร และยื่นภาษี
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <button
              type="button"
              onClick={exportOrdersCSV}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100/90 text-emerald-800 font-bold px-3.5 py-2.5 rounded-xl text-xs border border-emerald-200/80 transition active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap"
              title="ดาวน์โหลดไฟล์ Excel/CSV รายการคำสั่งซื้อทั้งหมด"
            >
              <Download className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Export CSV (ออเดอร์)</span>
            </button>

            <button
              type="button"
              onClick={exportProductsCSV}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-sky-50 hover:bg-sky-100/90 text-sky-800 font-bold px-3.5 py-2.5 rounded-xl text-xs border border-sky-200/80 transition active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap"
              title="ดาวน์โหลดไฟล์ Excel/CSV สรุปยอดขายแยกตามชนิดผัก"
            >
              <Download className="w-4 h-4 text-sky-700 shrink-0" />
              <span>Export CSV (ผัก)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition active:scale-95 cursor-pointer shadow-sm hover:shadow whitespace-nowrap"
              title="พิมพ์ใบสรุปยอดขาย หรือบันทึกเป็น PDF"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>พิมพ์รายงาน / PDF</span>
            </button>
          </div>
        </div>
      </div>


      {/* Filter Bar - Screen View */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-3.5 print:hidden">
        {/* Row 1: Presets Segmented Control */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-2xl gap-1 shrink-0">
            <span className="text-xs font-bold text-slate-500 px-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">ช่วงเวลา:</span>
            </span>
            {[
              { key: 'all', label: 'ทั้งหมด' },
              { key: 'today', label: 'วันนี้' },
              { key: '7d', label: '7 วันล่าสุด' },
              { key: 'month', label: 'เดือนนี้' },
              { key: 'year', label: 'ปีนี้' },
            ].map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  preset === p.key
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-slate-600 transition cursor-pointer text-xs font-semibold shrink-0"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>
        </div>

        {/* Row 2: Date pickers & Status filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80 text-xs">
              <span className="text-slate-400 font-medium">จาก</span>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setPreset('custom');
                  setStartDate(e.target.value);
                }}
                className="bg-transparent border-none text-xs font-mono text-slate-700 focus:outline-none p-0 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80 text-xs">
              <span className="text-slate-400 font-medium">ถึง</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setPreset('custom');
                  setEndDate(e.target.value);
                }}
                className="bg-transparent border-none text-xs font-mono text-slate-700 focus:outline-none p-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="flex-1 sm:flex-initial text-xs bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="valid">✅ ออเดอร์สำเร็จ (Paid / Shipping / Completed)</option>
              <option value="all">ทุกสถานะ (รวมรอตรวจ/ยกเลิก)</option>
              <option value="completed">เฉพาะจัดส่งสำเร็จ (Completed)</option>
              <option value="paid">เฉพาะชำระแล้ว (Paid)</option>
            </select>

            <button
              onClick={loadData}
              className="sm:hidden p-2 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-slate-600 transition cursor-pointer shrink-0"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================================
          SCREEN ONLY: Interactive Dashboard UI (Hidden when printing)
         ========================================================================================= */}
      <div className="space-y-5 print:hidden">
        {/* Financial Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Total Revenue */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-emerald-200/80 bg-gradient-to-br from-white via-white to-emerald-50/50 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-bold text-emerald-700 tracking-wider">ยอดขายรวมสุทธิ</span>
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                ฿{Number(summary.total_revenue || 0).toLocaleString()}
              </div>
              <div className="text-xs text-emerald-800 font-medium mt-1">
                จาก {summary.completed_orders || 0} คำสั่งซื้อที่สำเร็จ
              </div>
            </div>
          </div>

          {/* Avg Order Value */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">ยอดซื้อเฉลี่ย / บิล</span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-800 font-mono tracking-tight">
                ฿{Number(summary.avg_order_value || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Average Order Value (AOV)
              </div>
            </div>
          </div>

          {/* Veggies Sold Volume */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">ปริมาณผักที่จำหน่าย</span>
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-amber-900 font-mono tracking-tight">
                {Number(summary.total_veggies_kg || 0).toFixed(1)} <span className="text-sm font-normal text-slate-500">กก.</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                รวมทุกรายการผลผลิตสด
              </div>
            </div>
          </div>

          {/* Gross Profit / Costs */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">กำไรเบื้องต้นประเมิน</span>
              <div className={`p-2 rounded-xl ${summary.gross_profit >= 0 ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-700'}`}>
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${summary.gross_profit >= 0 ? 'text-purple-900' : 'text-rose-600'}`}>
                ฿{Number(summary.gross_profit || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                <span>หักต้นทุนแปลง/ปัจจัย:</span>
                <span className="font-mono font-semibold text-slate-700">฿{Number(summary.total_costs || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Products Breakdown & Order Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1 & 2: Top Selling Products */}
          <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h2 className="font-black text-slate-900 text-sm sm:text-base">
                  ผักขายดียอดนิยม (Top Selling Products)
                </h2>
              </div>
              <button
                type="button"
                onClick={exportProductsCSV}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Export CSV</span>
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {top_products.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-1">
                <p className="text-2xl">🥬</p>
                <p>ยังไม่มีข้อมูลการขายสินค้าในช่วงเวลานี้</p>
              </div>
            ) : (
              <div className="space-y-3">
                {top_products.map((prod, idx) => {
                  const maxRev = top_products[0]?.total_revenue || 1;
                  const percent = Math.min(100, Math.round((prod.total_revenue / maxRev) * 100));
                  const totalRev = summary.total_revenue || 1;
                  const shareOfTotal = ((prod.total_revenue / totalRev) * 100).toFixed(1);

                  const rankBadges = [
                    'bg-amber-100 text-amber-800 border-amber-300',
                    'bg-slate-100 text-slate-700 border-slate-300',
                    'bg-orange-100 text-orange-800 border-orange-300'
                  ];
                  const badgeClass = rankBadges[idx] || 'bg-slate-50 text-slate-600 border-slate-200';

                  return (
                    <div key={prod.product_id} className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2 hover:bg-slate-50 transition">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] border shrink-0 ${badgeClass}`}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </span>
                          <span className="font-bold text-slate-900 truncate text-sm">{prod.product_name}</span>
                          <span className="text-[11px] text-slate-400 font-mono shrink-0">({prod.orders_count} ออเดอร์)</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-slate-900 font-mono text-sm">฿{Number(prod.total_revenue).toLocaleString()}</span>
                          <span className="text-[11px] text-emerald-700 ml-1.5 font-bold">({shareOfTotal}%)</span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                        <span>ปริมาณจำหน่าย: <strong className="text-slate-800 font-semibold">{prod.total_quantity} {prod.unit || 'กก.'}</strong></span>
                        <span>สัดส่วนยอดขาย: <strong className="text-slate-800 font-semibold">{shareOfTotal}%</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Column 3: Summary Highlights */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h2 className="font-black text-slate-900 text-sm sm:text-base">
                  ภาพรวมการกระจายสินค้า & บัญชี
                </h2>
              </div>

              <div className="mt-4 space-y-3.5 text-xs">
                <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/70 space-y-1.5">
                  <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ความพร้อมตรวจสอบตามมาตรฐาน GAP</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    รายการออเดอร์ทั้งหมดบันทึกประวัติการขาย แหล่งที่มา และการกระจายสินค้าอย่างสมบูรณ์ สามารถนำไฟล์ส่งออกไปแนบเอกสารตรวจประเมินฟาร์มได้ทันที
                  </p>
                </div>

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 text-slate-600">
                    <span>จำนวนคำสั่งซื้อทั้งหมด:</span>
                    <span className="font-bold text-slate-900 font-mono">{summary.total_orders} รายการ</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 text-slate-600">
                    <span>ออเดอร์ที่รับเงินแล้ว:</span>
                    <span className="font-bold text-emerald-800 font-mono">{summary.completed_orders} รายการ</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 text-slate-600">
                    <span>ต้นทุนการผลิตสะสม:</span>
                    <span className="font-bold text-slate-700 font-mono">฿{Number(summary.total_costs || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 text-slate-600">
                    <span>กำไรสุทธิเบื้องต้น:</span>
                    <span className={`font-black font-mono text-sm ${summary.gross_profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      ฿{Number(summary.gross_profit || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 text-center">
              ข้อมูลอัปเดตแบบ Realtime ตามสถานะคำสั่งซื้อในระบบ
            </div>
          </div>
        </div>

        {/* Orders Section (Desktop Table + Mobile Cards) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  รายการคำสั่งซื้อ & รายรับ ({filteredOrders.length} รายการ)
                </h3>
                <p className="text-[11px] text-slate-400">บันทึกรายรับจริงจากลูกค้าหน้าร้าน LINE OA</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขออเดอร์, ชื่อลูกค้า..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-8 py-2 rounded-xl border border-slate-200/80 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={exportOrdersCSV}
                className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs shrink-0 active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-16 text-center text-xs text-slate-400 space-y-2">
              <div className="animate-spin text-2xl">🌱</div>
              <p>กำลังคำนวณและโหลดรายงานรายได้...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400 space-y-1">
              <p className="text-3xl">📭</p>
              <p className="font-bold text-slate-700">ไม่พบรายการคำสั่งซื้อในช่วงเวลานี้</p>
              <p className="text-slate-400">ลองเปลี่ยนช่วงวันที่ หรือเลือกดูทุกสถานะออเดอร์ดูครับ</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/90 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[11px]">
                    <tr>
                      <th className="px-4 py-3.5 whitespace-nowrap">รหัสออเดอร์</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">วันที่ / เวลา</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">ลูกค้า</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">การจัดส่ง</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">รายการผักที่ซื้อ</th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">ยอดชำระ</th>
                      <th className="px-4 py-3.5 text-center whitespace-nowrap">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3.5 align-middle font-mono font-bold text-emerald-900 whitespace-nowrap">
                          #{o.order_code}
                        </td>
                        <td className="px-4 py-3.5 align-middle whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {o.created_at ? format(new Date(o.created_at), 'dd/MM/yyyy HH:mm') : '—'}
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <div className="font-bold text-slate-900">{o.customer_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{o.customer_phone || '—'}</div>
                        </td>
                        <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            o.delivery_type === 'delivery' ? 'bg-amber-100/80 text-amber-800' : 'bg-blue-100/80 text-blue-800'
                          }`}>
                            {o.delivery_type === 'delivery' ? '🚚 ส่งตามที่อยู่' : '🏡 รับเองที่ฟาร์ม'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <div className="space-y-0.5 max-w-[260px]">
                            {o.items && o.items.length > 0 ? (
                              o.items.map((i, idx) => (
                                <div key={idx} className="text-[11px] text-slate-700 truncate">
                                  • {i.product_name} <strong className="text-slate-900 font-mono">x{i.quantity} {i.unit}</strong>
                                </div>
                              ))
                            ) : (
                              <span className="text-slate-300 italic text-[11px]">ไม่มีรายการย่อย</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                          <span className="font-black text-slate-900 font-mono text-sm">
                            ฿{Number(o.total_amount).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            o.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : o.status === 'shipping'
                              ? 'bg-purple-100 text-purple-800 border border-purple-300'
                              : o.status === 'paid'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : o.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {o.status === 'completed'
                              ? 'จัดส่งสำเร็จ'
                              : o.status === 'shipping'
                              ? 'กำลังจัดส่ง'
                              : o.status === 'paid'
                              ? 'ชำระแล้ว'
                              : o.status === 'pending'
                              ? 'รอตรวจสลิป'
                              : 'ยกเลิก'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-slate-100">
                {filteredOrders.map(o => (
                  <div key={o.id} className="p-4 space-y-2.5 hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-900 text-sm">#{o.order_code}</span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          o.delivery_type === 'delivery' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {o.delivery_type === 'delivery' ? '🚚 ส่ง' : '🏡 รับเอง'}
                        </span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        o.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : o.status === 'shipping'
                          ? 'bg-purple-100 text-purple-800'
                          : o.status === 'paid'
                          ? 'bg-blue-100 text-blue-800'
                          : o.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {o.status === 'completed'
                          ? 'จัดส่งสำเร็จ'
                          : o.status === 'shipping'
                          ? 'กำลังจัดส่ง'
                          : o.status === 'paid'
                          ? 'ชำระแล้ว'
                          : o.status === 'pending'
                          ? 'รอตรวจสลิป'
                          : 'ยกเลิก'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <div>
                        <span className="font-bold text-slate-900">{o.customer_name}</span>
                        {o.customer_phone && <span className="text-slate-400 font-mono ml-1.5 text-[11px]">({o.customer_phone})</span>}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {o.created_at ? format(new Date(o.created_at), 'dd/MM HH:mm') : '—'}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-xs">
                      {o.items && o.items.length > 0 ? (
                        o.items.map((i, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] text-slate-700">
                            <span className="truncate">{i.product_name}</span>
                            <span className="font-mono font-semibold text-slate-900 shrink-0 ml-2">x{i.quantity} {i.unit}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">ไม่มีรายการย่อย</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100/60 text-xs">
                      <span className="text-slate-500 font-medium">ยอดชำระสุทธิ</span>
                      <span className="font-black text-slate-900 font-mono text-base">
                        ฿{Number(o.total_amount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================================
          PRINT ONLY: Formal A4 Accounting & GAP Sales Statement Document
         ========================================================================================= */}
      <div className="hidden print:block text-slate-900 font-sans text-xs space-y-5">
        {/* 1. Official Document Header */}
        <div className="border-b-2 border-slate-900 pb-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-0.5">
                เอกสารรายงานสรุปรายได้ การจำหน่ายผลผลิต และบัญชีฟาร์ม (GAP SALES & ACCOUNTING REPORT)
              </div>
              <h1 className="text-2xl font-black text-slate-900 leading-tight">
                {user?.farm_name || 'ฟาร์มเกษตรปลอดภัย มาตรฐาน GAP'}
              </h1>
              <div className="text-[11px] text-slate-700 mt-1 space-x-4">
                <span><strong>ผู้ประกอบการ/ผู้รับผิดชอบ:</strong> {user?.display_name || user?.email || '-'}</span>
                {user?.gap_code && <span><strong>รหัสรับรอง GAP:</strong> {user.gap_code}</span>}
              </div>
              {user?.location && (
                <div className="text-[11px] text-slate-600 mt-0.5">
                  <strong>ที่ตั้งฟาร์ม:</strong> {user.location}
                </div>
              )}
            </div>
            <div className="text-right text-[11px] border border-slate-400 px-3 py-2 rounded bg-slate-50 shrink-0">
              <div className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-1">
                เลขที่เอกสาร: SR-{format(new Date(), 'yyyyMMdd')}
              </div>
              <div><strong>วันที่พิมพ์:</strong> {format(new Date(), 'dd/MM/yyyy HH:mm น.')}</div>
              <div>
                <strong>งวดข้อมูล:</strong>{' '}
                {startDate ? `${startDate} ถึง ${endDate || 'ปัจจุบัน'}` : 'ข้อมูลสะสมทั้งหมด'}
              </div>
              <div>
                <strong>ขอบเขตสถานะ:</strong>{' '}
                {statusFilter === 'valid'
                  ? 'ออเดอร์ที่ชำระ/จัดส่งสำเร็จ'
                  : statusFilter === 'completed'
                  ? 'เฉพาะจัดส่งสำเร็จ'
                  : statusFilter === 'paid'
                  ? 'เฉพาะชำระเงินแล้ว'
                  : 'ทุกสถานะคำสั่งซื้อ'}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Section 1: Financial Executive Summary Table */}
        <div className="gap-section">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1.5 flex items-center justify-between">
            <span>ส่วนที่ 1: สรุปผลการดำเนินงานและบัญชีรายรับ-รายจ่าย (Financial Summary)</span>
            <span className="text-[10px] font-normal text-slate-500">หน่วย: บาท (THB)</span>
          </h2>
          <table className="w-full border-collapse border border-slate-800 text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                <th className="border border-slate-800 px-2.5 py-2 text-center w-[16%]">จำนวนออเดอร์สำเร็จ</th>
                <th className="border border-slate-800 px-2.5 py-2 text-center w-[16%]">ปริมาณผลผลิตที่จำหน่าย</th>
                <th className="border border-slate-800 px-2.5 py-2 text-right w-[17%]">ยอดซื้อเฉลี่ยต่อบิล</th>
                <th className="border border-slate-800 px-2.5 py-2 text-right w-[17%]">รายรับจากการขายรวม</th>
                <th className="border border-slate-800 px-2.5 py-2 text-right w-[17%]">หัก ต้นทุนการผลิตสะสม</th>
                <th className="border border-slate-800 px-2.5 py-2 text-right w-[17%]">กำไรสุทธิเบื้องต้น</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-mono text-xs">
                <td className="border border-slate-800 px-2.5 py-2.5 text-center font-bold text-slate-900">
                  {summary.completed_orders || 0} รายการ
                  <div className="text-[9px] font-sans font-normal text-slate-500">
                    (จากทั้งหมด {summary.total_orders || 0} บิล)
                  </div>
                </td>
                <td className="border border-slate-800 px-2.5 py-2.5 text-center font-bold text-slate-900">
                  {Number(summary.total_veggies_kg || 0).toFixed(1)} กก.
                </td>
                <td className="border border-slate-800 px-2.5 py-2.5 text-right text-slate-800">
                  ฿{Number(summary.avg_order_value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border border-slate-800 px-2.5 py-2.5 text-right font-bold text-slate-900">
                  ฿{Number(summary.total_revenue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border border-slate-800 px-2.5 py-2.5 text-right text-slate-700">
                  ฿{Number(summary.total_costs || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border border-slate-800 px-2.5 py-2.5 text-right font-black text-slate-900 bg-slate-50">
                  ฿{Number(summary.gross_profit || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. Section 2: Product Sales Breakdown Table */}
        <div className="gap-section">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1.5">
            ส่วนที่ 2: ตารางสรุปยอดจำหน่ายแยกตามชนิดผลผลิต (Sales Breakdown by Product)
          </h2>
          <table className="w-full border-collapse border border-slate-800 text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                <th className="border border-slate-800 px-2 py-1.5 text-center w-[8%]">ลำดับ</th>
                <th className="border border-slate-800 px-3 py-1.5 text-left w-[42%]">รายการผลผลิต / ชนิดผัก</th>
                <th className="border border-slate-800 px-2 py-1.5 text-center w-[14%]">จำนวนออเดอร์</th>
                <th className="border border-slate-800 px-2.5 py-1.5 text-right w-[16%]">ปริมาณที่จำหน่าย</th>
                <th className="border border-slate-800 px-2.5 py-1.5 text-right w-[20%]">จำนวนเงินรวม (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {top_products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-slate-800 py-4 text-center text-slate-500">
                    — ไม่มีรายการจำหน่ายผลผลิตในช่วงเวลานี้ —
                  </td>
                </tr>
              ) : (
                top_products.map((prod, idx) => {
                  const totalRev = summary.total_revenue || 1;
                  const shareOfTotal = ((prod.total_revenue / totalRev) * 100).toFixed(1);
                  return (
                    <tr key={prod.product_id || idx}>
                      <td className="border border-slate-800 px-2 py-1.5 text-center font-mono">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-800 px-3 py-1.5 font-semibold text-slate-900">
                        {prod.product_name}
                      </td>
                      <td className="border border-slate-800 px-2 py-1.5 text-center font-mono">
                        {prod.orders_count} ครั้ง
                      </td>
                      <td className="border border-slate-800 px-2.5 py-1.5 text-right font-mono">
                        {Number(prod.total_quantity || 0).toLocaleString()} {prod.unit || 'ถุง'}
                      </td>
                      <td className="border border-slate-800 px-2.5 py-1.5 text-right font-mono font-bold text-slate-900">
                        ฿{Number(prod.total_revenue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                        <span className="text-[10px] font-normal text-slate-500">({shareOfTotal}%)</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {top_products.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                  <td colSpan={3} className="border border-slate-800 px-3 py-1.5 text-right">
                    รวมรายได้จากการจำหน่ายผลผลิตทั้งสิ้น
                  </td>
                  <td className="border border-slate-800 px-2.5 py-1.5 text-right font-mono">
                    {Number(summary.total_veggies_kg || 0).toFixed(1)} กก.
                  </td>
                  <td className="border border-slate-800 px-2.5 py-1.5 text-right font-mono text-slate-900">
                    ฿{Number(summary.total_revenue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* 4. Section 3: Detailed Order & Distribution Ledger Table */}
        <div>
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1.5 flex items-center justify-between">
            <span>ส่วนที่ 3: ทะเบียนรายการคำสั่งซื้อและการกระจายผลผลิต (Order & Traceability Ledger)</span>
            <span className="text-[10px] font-normal text-slate-600">จำนวน {filteredOrders.length} รายการ</span>
          </h2>
          <table className="w-full border-collapse border border-slate-800 text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                <th className="border border-slate-800 px-1.5 py-1.5 text-center w-[6%]">ลำดับ</th>
                <th className="border border-slate-800 px-2 py-1.5 text-left w-[15%]">รหัสออเดอร์ / วันที่</th>
                <th className="border border-slate-800 px-2 py-1.5 text-left w-[20%]">ชื่อผู้ซื้อ / เบอร์โทร</th>
                <th className="border border-slate-800 px-2 py-1.5 text-left w-[31%]">รายการผลผลิตและจำนวน</th>
                <th className="border border-slate-800 px-2 py-1.5 text-center w-[12%]">การส่ง / ชำระเงิน</th>
                <th className="border border-slate-800 px-2 py-1.5 text-right w-[16%]">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-slate-800 py-4 text-center text-slate-500">
                    — ไม่พบรายการคำสั่งซื้อในช่วงเวลานี้ —
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o, index) => (
                  <tr key={o.id}>
                    <td className="border border-slate-800 px-1.5 py-1.5 text-center font-mono align-top">
                      {index + 1}
                    </td>
                    <td className="border border-slate-800 px-2 py-1.5 align-top font-mono">
                      <div className="font-bold text-slate-900">{o.order_code}</div>
                      <div className="text-[9.5px] text-slate-600">
                        {o.created_at ? format(new Date(o.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                      </div>
                    </td>
                    <td className="border border-slate-800 px-2 py-1.5 align-top">
                      <div className="font-bold text-slate-900">{o.customer_name || '-'}</div>
                      <div className="text-[9.5px] text-slate-600 font-mono">โทร: {o.customer_phone || '-'}</div>
                    </td>
                    <td className="border border-slate-800 px-2 py-1.5 align-top">
                      {o.items && o.items.length > 0 ? (
                        <div className="space-y-0.5">
                          {o.items.map((item, idx) => (
                            <div key={idx} className="leading-snug">
                              • {item.product_name} <span className="font-mono font-semibold">x{item.quantity} {item.unit}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="border border-slate-800 px-2 py-1.5 align-top text-center text-[10px]">
                      <div>{o.delivery_type === 'delivery' ? 'จัดส่งตามที่อยู่' : 'รับเองที่ฟาร์ม'}</div>
                      <div className="text-slate-600">
                        ({o.payment_method === 'cod' ? 'ปลายทาง COD' : 'โอนชำระ'})
                      </div>
                      <div className="font-bold text-[9.5px] mt-0.5">
                        [{o.status === 'completed'
                          ? 'จัดส่งสำเร็จ'
                          : o.status === 'shipping'
                          ? 'กำลังจัดส่ง'
                          : o.status === 'paid'
                          ? 'ชำระแล้ว'
                          : o.status === 'pending'
                          ? 'รอตรวจสอบ'
                          : 'ยกเลิก'}]
                      </div>
                    </td>
                    <td className="border border-slate-800 px-2 py-1.5 align-top text-right font-mono font-bold text-slate-900">
                      ฿{Number(o.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredOrders.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                  <td colSpan={5} className="border border-slate-800 px-3 py-1.5 text-right">
                    รวมยอดคำสั่งซื้อตามรายการข้างต้น ({filteredOrders.length} รายการ)
                  </td>
                  <td className="border border-slate-800 px-2 py-1.5 text-right font-mono text-slate-900">
                    ฿{filteredOrders
                      .reduce((sum, ord) => sum + (ord.status !== 'cancelled' ? Number(ord.total_amount || 0) : 0), 0)
                      .toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* 5. Official Sign-off & Certification Footer */}
        <div className="gap-section pt-6 mt-4 border-t border-slate-400">
          <div className="text-[10px] text-slate-600 mb-6">
            <strong>คำรับรอง:</strong> ข้าพเจ้าขอรับรองว่ารายการจำหน่ายผลผลิตและข้อมูลรายรับ-รายจ่ายข้างต้นเป็นความจริงทุกประการ และสามารถตรวจสอบย้อนกลับแหล่งที่มาของผลผลิตตามมาตรฐานการปฏิบัติทางการเกษตรที่ดีสำหรับพืช (GAP)
          </div>
          <div className="grid grid-cols-2 gap-12 text-xs">
            <div className="text-center space-y-6">
              <div>ลงชื่อ .......................................................................... ผู้จัดทำรายงาน</div>
              <div>( {user?.display_name || '..........................................................................'} )</div>
              <div className="text-[11px] text-slate-600">ตำแหน่ง: ผู้บันทึกข้อมูล / เจ้าหน้าที่การเงินฟาร์ม</div>
              <div className="text-[11px] text-slate-600">วันที่ ........../........../..........</div>
            </div>
            <div className="text-center space-y-6">
              <div>ลงชื่อ .......................................................................... ผู้รับรองข้อมูล</div>
              <div>( {user?.display_name || '..........................................................................'} )</div>
              <div className="text-[11px] text-slate-600">ตำแหน่ง: เจ้าของฟาร์ม / ผู้จัดการฟาร์มมาตรฐาน GAP</div>
              <div className="text-[11px] text-slate-600">วันที่ ........../........../..........</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
