import { useState } from 'react';
import { api } from '../lib/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { FileDown, QrCode } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { format } from 'date-fns';

export default function Report() {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [qrs, setQrs] = useState([]);

  const exportPDF = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/report/${year}`);
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(`GAP Annual Report ${year}`, 14, 18);
      doc.setFontSize(10);
      doc.text(`Farm: ${data.profile?.farm_name || '-'}`, 14, 26);
      doc.text(`Owner: ${data.profile?.display_name || '-'}`, 14, 32);
      doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 38);

      let y = 46;
      const plotName = (id) => data.plots.find(p => p.id === id)?.name || '-';
      const section = (title, head, rows) => {
        doc.setFontSize(12);
        doc.text(title, 14, y);
        autoTable(doc, {
          startY: y + 3,
          head: [head],
          body: rows.length ? rows : [['— no data —', ...head.slice(1).map(()=>'')]],
          styles: { fontSize: 8 },
          headStyles: { fillColor: [76, 125, 60] },
        });
        y = doc.lastAutoTable.finalY + 8;
        if (y > 260) { doc.addPage(); y = 20; }
      };

      section('1. Plots', ['Name','Crop','Area','Planted','Status'],
        data.plots.map(p => [p.name, p.crop_name, p.area_sqm ?? '-', p.planting_date, p.status]));
      section('2. Water (GAP #1)', ['Date','Plot','Source','Liters','Worker'],
        data.water.map(w => [w.log_date, plotName(w.plot_id), w.water_source ?? '-', w.amount_liters ?? '-', w.worker_name ?? '-']));
      section('3. Chemicals (GAP #3)', ['Date','Plot','Type','Product','Amount','PHI','Worker'],
        data.chems.map(c => [c.log_date, plotName(c.plot_id), c.chem_type, c.product_name, `${c.amount ?? ''} ${c.unit ?? ''}`, c.phi_days ?? 0, c.worker_name ?? '-']));
      section('4. Pests', ['Date','Plot','Pest','Severity','Treatment'],
        data.pests.map(p => [p.log_date, plotName(p.plot_id), p.pest_or_disease, p.severity ?? '-', p.treatment_method ?? '-']));
      section('5. Harvest (GAP #5)', ['Date','Plot','Qty','Unit','Grade','Lot','Revenue'],
        data.harvest.map(h => [h.harvest_date, plotName(h.plot_id), h.quantity, h.unit, h.quality_grade ?? '-', h.lot_code ?? '-', h.revenue ?? '-']));
      section('6. Storage/Transport (GAP #6)', ['Date','Storage','Shipped To','Buyer','Vehicle'],
        data.storage.map(s => [s.log_date, s.storage_location ?? '-', s.shipped_to ?? '-', s.buyer ?? '-', s.vehicle ?? '-']));
      section('7. Workers (GAP #7)', ['Name','Role','Phone','Hygiene'],
        data.workers.map(w => [w.name, w.role ?? '-', w.phone ?? '-', w.hygiene_training ? 'Yes' : 'No']));

      const totalRev = data.harvest.reduce((s, h) => s + Number(h.revenue||0), 0);
      const totalCost = data.costs.reduce((s, c) => s + Number(c.amount||0), 0);
      const totalQty = data.harvest.reduce((s, h) => s + Number(h.quantity||0), 0);
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.text('Summary', 14, y);
      doc.setFontSize(11);
      doc.text(`Total Harvest: ${totalQty.toFixed(1)} kg`, 14, y+8);
      doc.text(`Total Revenue: ${totalRev.toLocaleString()} THB`, 14, y+15);
      doc.text(`Total Cost: ${totalCost.toLocaleString()} THB`, 14, y+22);
      doc.text(`Profit: ${(totalRev - totalCost).toLocaleString()} THB`, 14, y+29);

      doc.save(`GAP-Report-${year}.pdf`);
      toast.success('Export สำเร็จ');
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const generateQRs = async () => {
    const { data: harvest } = await api.get('/api/harvest');
    const lots = harvest.filter(h => h.lot_code);
    const out = await Promise.all(lots.map(async h => ({
      ...h,
      url: `${window.location.origin}/trace/${h.lot_code}`,
      qr: await QRCode.toDataURL(`${window.location.origin}/trace/${h.lot_code}`, { width: 200 }),
    })));
    setQrs(out);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">รายงาน GAP & QR Traceability</h1>

      <div className="card mb-6">
        <h2 className="font-bold mb-4">ออกรายงาน GAP รายปี (PDF)</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label">ปี</label>
            <input className="input" type="number" placeholder="YYYY" value={year} onChange={e => setYear(Number(e.target.value))} />
          </div>
          <button className="btn w-full sm:w-auto" onClick={exportPDF} disabled={loading}>
            <FileDown className="w-4 h-4" /> {loading ? 'กำลังสร้าง...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="font-bold">QR Code Traceability</h2>
          <button className="btn btn-outline w-full sm:w-auto" onClick={generateQRs}><QrCode className="w-4 h-4" /> สร้าง QR</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {qrs.map(q => (
            <div key={q.id} className="border border-gray-200 rounded-3xl p-4 text-center transition hover:shadow-md">
              <img src={q.qr} alt={q.lot_code} className="mx-auto" />
              <div className="text-xs font-mono mt-3 wrap-break-word">{q.lot_code}</div>
              <a href={q.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-2 inline-block">เปิด</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
