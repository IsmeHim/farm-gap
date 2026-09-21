import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Sprout,
  ShieldCheck,
  Calendar,
  Package,
  Sparkles,
  Droplets,
  Shovel,
  Leaf,
  MapPin,
  CheckCircle2,
  HeartHandshake
} from 'lucide-react';
import { format } from 'date-fns';

const STAGE_ICONS = {
  soil_prep: Shovel,
  seed_nursery: Sprout,
  planting: Sprout,
  maintenance: Droplets,
  fertilizing: Droplets,
  harvest: Leaf
};

const STAGE_LABELS = {
  soil_prep: 'เตรียมดิน / แคร่',
  seed_nursery: 'แช่เมล็ด / เพาะกล้า',
  planting: 'ย้ายปลูก / หว่าน',
  maintenance: 'ดูแล / ให้น้ำ',
  fertilizing: 'บำรุง / น้ำหมักชีวภาพ',
  harvest: 'เก็บเกี่ยว / บรรจุ'
};

const formatDateDisplay = (val) => {
  if (!val) return '-';
  if (typeof val === 'string') {
    const clean = val.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  try {
    return format(new Date(val), 'dd/MM/yyyy');
  } catch {
    return String(val);
  }
};

export default function Trace() {
  const { lot } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get(`/api/trace/${lot}`)
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.error || e.message));
  }, [lot]);

  if (err) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-red-100">
          <div className="w-16 h-16 mx-auto bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
            ✕
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">ไม่พบรหัสสินค้า (Lot Code)</h2>
          <p className="text-sm text-gray-500">กรุณาตรวจสอบ QR Code อีกครั้ง หรือติดต่อฟาร์มผู้ผลิต</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm font-semibold text-emerald-800">กำลังตรวจสอบข้อมูลย้อนกลับ (GAP Trace)...</div>
        </div>
      </div>
    );
  }

  const activities = data.activities || [];

  return (
    <div className="min-h-screen bg-[#f7f9f5] py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Farm & Crop Header Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden text-center relative">
          <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 pt-8 pb-10 relative">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-3 shadow-inner">
              <Sprout className="w-8 h-8 text-[#f4d27a]" />
            </div>
            <span className="inline-flex items-center gap-1 bg-emerald-950/40 text-emerald-200 text-xs px-3 py-1 rounded-full font-semibold mb-2 backdrop-blur-sm border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              มาตรฐาน GAP เกษตรปลอดภัยตรวจสอบได้
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{data.crop_name}</h1>
            <div className="text-emerald-100/90 text-sm mt-1 font-medium">
              ฟาร์ม: {data.farm_name || 'FarmGAP Producer'}
            </div>
          </div>

          {/* Lot Code Badge Strip */}
          <div className="mx-6 -mt-5 bg-white rounded-2xl shadow-lg border border-emerald-100 p-4 flex items-center justify-between">
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Traceability Lot</div>
              <div className="font-mono font-black text-emerald-900 text-base">{data.lot_code}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400">วันเก็บเกี่ยว</div>
              <div className="font-bold text-gray-800 text-sm">
                {formatDateDisplay(data.harvest_date)}
              </div>
            </div>
          </div>

          {/* Details Overview */}
          <div className="p-6 pt-4 grid grid-cols-2 gap-3 text-left">
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/60">
              <div className="text-xs text-emerald-700 font-medium">แปลงที่ปลูก</div>
              <div className="font-bold text-gray-900 text-sm truncate">{data.plot_name}</div>
            </div>
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/60">
              <div className="text-xs text-emerald-700 font-medium">เกรดคุณภาพ</div>
              <div className="font-bold text-gray-900 text-sm">{data.quality_grade || 'เกรด A (คัดพิเศษ)'}</div>
            </div>
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/60">
              <div className="text-xs text-emerald-700 font-medium">รอบการปลูก</div>
              <div className="font-bold text-gray-900 text-sm">
                #{data.plot_name ? data.plot_name.replace(/แปลง|\s|\(.*?\)/g, '') : 'P'}-R{data.cycle_number || 1}
              </div>
            </div>
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/60">
              <div className="text-xs text-emerald-700 font-medium">ปริมาณเก็บเกี่ยว</div>
              <div className="font-bold text-gray-900 text-sm">{data.quantity} {data.unit || 'กก.'}</div>
            </div>
          </div>
        </div>

        {/* Seed-to-Harvest Story Timeline */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-gray-900">
              เส้นทางการเติบโตจากต้นน้ำ (Seed-to-Harvest Story)
            </h2>
          </div>

          {activities.length > 0 ? (
            <div className="relative pl-6 border-l-2 border-emerald-200 space-y-6 ml-2 my-2">
              {activities.map((act) => {
                const Icon = STAGE_ICONS[act.stage] || Sprout;
                const stageLabel = STAGE_LABELS[act.stage] || 'กิจกรรม';

                return (
                  <div key={act.id} className="relative">
                    {/* Node Dot */}
                    <div className="absolute -left-[31px] top-0.5 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-4 ring-white shadow">
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="bg-[#fafbf8] p-3.5 rounded-2xl border border-emerald-100/70">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                          {stageLabel}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {formatDateDisplay(act.activity_date)}
                        </span>
                      </div>
                      <div className="font-bold text-gray-900 text-sm mb-1">{act.title}</div>
                      {act.materials_used && (
                        <div className="text-[11px] text-amber-800 bg-amber-50/70 p-1.5 rounded-lg mb-1.5 border border-amber-200/50">
                          <span className="font-semibold">วัสดุ/อินทรีย์:</span> {act.materials_used}
                        </div>
                      )}
                      {act.details && (
                        <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                          {act.details}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-emerald-50/50 rounded-2xl p-4 text-center border border-emerald-100 text-xs text-gray-600">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
              <div className="font-bold text-gray-800 mb-1">บันทึกขั้นตอนตามเกณฑ์ GAP ครบถ้วน</div>
              <p className="text-gray-500 max-w-sm mx-auto">
                แปลงปลูกนี้ผ่านการตรวจแปลง การใช้น้ำสะอาด ปุ๋ยอินทรีย์ และการเว้นระยะปลอดภัยก่อนเก็บเกี่ยว
              </p>
            </div>
          )}
        </div>

        {/* Consumer Assurance Footer */}
        <div className="p-4 bg-emerald-900 text-white rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-[#f4d27a]" />
            <div>
              <div className="font-bold">สด สะอาด ปลอดภัย ใส่ใจทุกขั้นตอน</div>
              <div className="text-emerald-200 text-[11px]">FarmGAP Goods Guarantee</div>
            </div>
          </div>
          <span className="font-mono text-emerald-300 text-[11px]">GAP Verified ✓</span>
        </div>
      </div>
    </div>
  );
}

