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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-900/10 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight flex items-center gap-2">
              รายงานรายได้ & ส่งออกข้อมูล (Sales & Revenue)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              สรุปยอดขายผลผลิตจากหน้าร้าน LINE OA เพื่อการบัญชี ตรวจสอบกำไร และยื่นภาษี
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={exportOrdersCSV}
            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3.5 py-2.5 rounded-xl text-xs border border-emerald-200 transition active:scale-95 cursor-pointer shadow-2xs"
            title="ดาวน์โหลดไฟล์ Excel/CSV รายการคำสั่งซื้อทั้งหมด"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Export CSV (ออเดอร์)</span>
          </button>

          <button
            type="button"
            onClick={exportProductsCSV}
            className="inline-flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold px-3.5 py-2.5 rounded-xl text-xs border border-sky-200 transition active:scale-95 cursor-pointer shadow-2xs"
            title="ดาวน์โหลดไฟล์ Excel/CSV สรุปยอดขายแยกตามชนิดผัก"
          >
            <Download className="w-4 h-4 text-sky-700" />
            <span>Export CSV (ผัก)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition active:scale-95 cursor-pointer shadow-md"
            title="พิมพ์ใบสรุปยอดขาย หรือบันทึกเป็น PDF"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์รายงาน / PDF</span>
          </button>
        </div>
      </div>

      {/* Official Farm Header - Only Visible When Printing */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">รายงานสรุปรายได้ & การจำหน่ายผลผลิต (GAP STORE)</div>
            <h1 className="text-2xl font-black text-slate-900">{user?.farm_name || 'ฟาร์มเกษตร GAP'}</h1>
            <div className="text-xs text-slate-600 mt-1">ผู้ประกอบการ: {user?.display_name || user?.email}</div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>วันที่ออกรายงาน: {format(new Date(), 'dd/MM/yyyy HH:mm น.')}</div>
            <div>ช่วงเวลา: {startDate ? `${startDate} ถึง ${endDate || '-'}` : 'ข้อมูลสะสมทั้งหมด'}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar - Screen View */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              ช่วงเวลา:
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  preset === p.key
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date range inputs */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">จาก</span>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setPreset('custom');
                  setStartDate(e.target.value);
                }}
                className="input !py-1 text-xs rounded-xl border border-slate-200 font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">ถึง</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setPreset('custom');
                  setEndDate(e.target.value);
                }}
                className="input !py-1 text-xs rounded-xl border border-slate-200 font-mono"
              />
            </div>

            {/* Status select */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input !py-1 text-xs rounded-xl border border-slate-200 font-medium"
            >
              <option value="valid">✅ ยอดขายที่สำเร็จ (Paid / Shipping / Completed)</option>
              <option value="all">ทุกสถานะ (รวมรอตรวจ/ยกเลิก)</option>
              <option value="completed">เฉพาะจัดส่งสำเร็จ (Completed)</option>
              <option value="paid">เฉพาะชำระแล้ว (Paid)</option>
            </select>

            <button
              onClick={loadData}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Financial Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 bg-linear-to-br from-white to-emerald-50/40 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-emerald-700 tracking-wider">ยอดขายรวมสุทธิ</span>
            <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            ฿{Number(summary.total_revenue || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-800 font-medium">
            จาก {summary.completed_orders || 0} คำสั่งซื้อที่สำเร็จ
          </div>
        </div>

        {/* Avg Order Value */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">ยอดซื้อเฉลี่ย / บิล</span>
            <div className="p-1.5 rounded-xl bg-slate-100 text-slate-700">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 font-mono">
            ฿{Number(summary.avg_order_value || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">
            Average Ticket Size
          </div>
        </div>

        {/* Veggies Sold Volume */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">ปริมาณผักที่จำหน่าย</span>
            <div className="p-1.5 rounded-xl bg-amber-100 text-amber-800">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-900 font-mono">
            {Number(summary.total_veggies_kg || 0).toFixed(1)} <span className="text-sm font-normal text-slate-500">กก.</span>
          </div>
          <div className="text-[11px] text-slate-400">
            รวมทุกรายการผักสด
          </div>
        </div>

        {/* Gross Profit / Costs */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">กำไรเบื้องต้นประเมิน</span>
            <div className="p-1.5 rounded-xl bg-purple-100 text-purple-800">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-black font-mono ${summary.gross_profit >= 0 ? 'text-purple-900' : 'text-rose-600'}`}>
            ฿{Number(summary.gross_profit || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>หักต้นทุนฟาร์ม:</span>
            <span className="font-mono text-slate-600">฿{Number(summary.total_costs || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Top Products Breakdown & Order Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1 & 2: Top Selling Products */}
        <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3.5">
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
              className="text-xs text-emerald-700 hover:text-emerald-800 font-bold inline-flex items-center gap-1 print:hidden"
            >
              <span>Export CSV</span>
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          {top_products.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">ยังไม่มีข้อมูลการขายสินค้าในช่วงเวลานี้</div>
          ) : (
            <div className="space-y-3">
              {top_products.map((prod, idx) => {
                const maxRev = top_products[0]?.total_revenue || 1;
                const percent = Math.min(100, Math.round((prod.total_revenue / maxRev) * 100));
                const totalRev = summary.total_revenue || 1;
                const shareOfTotal = ((prod.total_revenue / totalRev) * 100).toFixed(1);

                return (
                  <div key={prod.product_id} className="space-y-1 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-900">{prod.product_name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">({prod.orders_count} ออเดอร์)</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-slate-900 font-mono">฿{Number(prod.total_revenue).toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5 font-medium">({shareOfTotal}%)</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>ปริมาณที่ขายได้: <strong className="text-slate-700">{prod.total_quantity} {prod.unit || 'กก.'}</strong></span>
                      <span>สัดส่วนยอดขาย: <strong>{shareOfTotal}%</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 3: Summary Highlights */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h2 className="font-black text-slate-900 text-sm sm:text-base">
              ภาพรวมการกระจายสินค้า
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200/60 space-y-1">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ความพร้อมสำหรับทำบัญชี & ภาษี:</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed pl-5">
                ข้อมูลคำสั่งซื้อทั้งหมดผูกรหัสลูกค้า วันที่ เวลา และรายการสินค้าอย่างเป็นระเบียบ สามารถส่งออกเป็นไฟล์ CSV ไปเปิดบน Excel ได้โดยตรง
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">จำนวนคำสั่งซื้อทั้งหมด:</span>
                <span className="font-bold text-slate-800 font-mono">{summary.total_orders} รายการ</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">ออเดอร์ที่รับเงินแล้ว:</span>
                <span className="font-bold text-emerald-800 font-mono">{summary.completed_orders} รายการ</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">ต้นทุนการผลิตสะสม:</span>
                <span className="font-bold text-slate-700 font-mono">฿{Number(summary.total_costs || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">กำไรสุทธิเบื้องต้น:</span>
                <span className="font-black text-emerald-900 font-mono">฿{Number(summary.gross_profit || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                รายการคำสั่งซื้อ & รายรับ ({filteredOrders.length} รายการ)
              </h3>
              <p className="text-[11px] text-slate-400">บันทึกรายรับจริงจากลูกค้าหน้าร้าน LINE OA</p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาเลขออเดอร์ หรือชื่อลูกค้า..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input !pl-9 !pr-3 text-xs w-full rounded-xl border border-slate-200"
              />
            </div>
            <button
              onClick={exportOrdersCSV}
              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs shrink-0"
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
          <div className="overflow-x-auto">
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
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        o.delivery_type === 'delivery' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        o.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : o.status === 'shipping'
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : o.status === 'paid'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : o.status === 'pending'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Official Sign-off Box - Only visible when printing */}
      <div className="hidden print:grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-300 text-xs">
        <div className="text-center space-y-8">
          <div>ลงชื่อ ..........................................................................</div>
          <div>( ผู้จัดทำรายงาน / เจ้าหน้าที่บัญชี )</div>
          <div>วันที่ .......... / .......... / ................</div>
        </div>
        <div className="text-center space-y-8">
          <div>ลงชื่อ ..........................................................................</div>
          <div>( เจ้าของฟาร์ม / ผู้จัดการฟาร์ม GAP )</div>
          <div>วันที่ .......... / .......... / ................</div>
        </div>
      </div>
    </div>
  );
}
