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
  seeding: Sprout,
  seed_nursery: Sprout,
  nursery: Sprout,
  soil_prep: Shovel,
  planting: Sprout,
  growing: Leaf,
  maintenance: Droplets,
  fertilizing: Droplets,
  harvest: Package
};

const STAGE_LABELS = {
  seeding: '🌰 เพาะเมล็ดพันธุ์',
  seed_nursery: '🌰 แช่เมล็ด / เพาะกล้า',
  nursery: '🌱 ย้ายลงถาดหลุม',
  soil_prep: '🪴 เตรียมดิน / แคร่',
  planting: '🌿 ย้ายปลูกลงแปลง',
  growing: '🌿 ดูแลรอบปลูก',
  maintenance: '💧 ให้น้ำ / ดูแล',
  fertilizing: '💩 ปุ๋ย / น้ำหมักชีวภาพ',
  harvest: '🧺 เก็บเกี่ยว / บรรจุ'
};

const formatDateDisplay = (val) => {
  if (!val) return '-';
  try {
    const date = new Date(val);
    if (isNaN(date.getTime())) return String(val);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const yearBE = (date.getFullYear() + 543) % 100;
    return `${day}/${month}/${yearBE}`;
  } catch {
    return String(val);
  }
};

const formatFullDateDisplay = (val) => {
  if (!val) return '-';
  try {
    const date = new Date(val);
    if (isNaN(date.getTime())) return String(val);
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
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
      <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm max-w-sm w-full text-center border border-red-100">
          <div className="w-12 h-12 mx-auto bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-3 text-lg font-bold">
            ✕
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">ไม่พบรหัสสินค้า (Lot Code)</h2>
          <p className="text-xs text-gray-500">กรุณาตรวจสอบ QR Code อีกครั้ง หรือติดต่อฟาร์มผู้ผลิต</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
          <div className="text-xs font-bold text-emerald-800">กำลังตรวจสอบข้อมูลย้อนกลับ (GAP Trace)...</div>
        </div>
      </div>
    );
  }

  const activities = data.activities || [];

  return (
    <div className="min-h-screen bg-[#f4f7f2] py-4 sm:py-6 px-3 sm:px-6 flex flex-col justify-center">
      <div className="max-w-5xl w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">

          {/* Left Column: Farm & Product Passport Card (5 Cols on desktop) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-white rounded-3xl shadow-xs border border-emerald-100/90 overflow-hidden text-center">
              {/* Header Banner */}
              <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white p-5 pt-6 pb-6 relative">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-2.5 shadow-inner">
                  <Sprout className="w-6 h-6 text-[#f4d27a]" />
                </div>
                <div className="inline-flex items-center gap-1 bg-emerald-950/50 text-emerald-200 text-[10.5px] px-2.5 py-0.5 rounded-full font-bold mb-1.5 backdrop-blur-sm border border-white/10">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  มาตรฐาน GAP เกษตรปลอดภัย
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">{data.crop_name}</h1>
                <div className="text-emerald-200/90 text-xs mt-0.5 font-medium flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>ฟาร์ม: {data.farm_name || 'FarmGAP Producer'}</span>
                </div>
              </div>

              {/* Lot Code Floating Strip */}
              <div className="mx-3.5 -mt-3.5 bg-white rounded-2xl shadow-md border border-emerald-100 p-2.5 sm:p-3 flex items-center justify-between">
                <div className="text-left">
                  <div className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Traceability Lot</div>
                  <div className="font-mono font-black text-emerald-950 text-xs sm:text-sm">{data.lot_code}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">วันเก็บเกี่ยว</div>
                  <div className="font-bold text-slate-800 text-xs sm:text-sm">
                    {formatDateDisplay(data.harvest_date)}
                  </div>
                </div>
              </div>

              {/* Details Overview (2x2 Grid) */}
              <div className="p-3.5 sm:p-4 grid grid-cols-2 gap-2 text-left">
                <div className="bg-emerald-50/60 p-2 sm:p-2.5 rounded-xl border border-emerald-100/70">
                  <div className="text-[10px] text-emerald-700 font-semibold">แปลงที่ปลูก</div>
                  <div className="font-extrabold text-slate-900 text-xs truncate" title={data.plot_name}>{data.plot_name}</div>
                </div>
                <div className="bg-emerald-50/60 p-2 sm:p-2.5 rounded-xl border border-emerald-100/70">
                  <div className="text-[10px] text-emerald-700 font-semibold">เกรดคุณภาพ</div>
                  <div className="font-extrabold text-slate-900 text-xs">{data.quality_grade || 'เกรด A (คัดพิเศษ)'}</div>
                </div>
                <div className="bg-emerald-50/60 p-2 sm:p-2.5 rounded-xl border border-emerald-100/70">
                  <div className="text-[10px] text-emerald-700 font-semibold">รอบการปลูก</div>
                  <div className="font-extrabold text-slate-900 text-xs">
                    #{data.plot_name ? data.plot_name.replace(/แปลง|\s|\(.*?\)/g, '') : 'P'}-R{data.cycle_number || 1}
                  </div>
                </div>
                <div className="bg-emerald-50/60 p-2 sm:p-2.5 rounded-xl border border-emerald-100/70">
                  <div className="text-[10px] text-emerald-700 font-semibold">ปริมาณเก็บเกี่ยว</div>
                  <div className="font-extrabold text-slate-900 text-xs">{Number(data.quantity).toLocaleString()} {data.unit || 'กก.'}</div>
                </div>
              </div>
            </div>

            {/* Consumer Assurance Mini Footer */}
            <div className="p-3 bg-emerald-900 text-white rounded-2xl flex items-center justify-between text-xs shadow-xs">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-[#f4d27a] shrink-0" />
                <div>
                  <div className="font-bold text-[11px]">สด สะอาด ปลอดภัย มั่นใจได้ 100%</div>
                  <div className="text-emerald-200 text-[9.5px]">ระบบควบคุมมาตรฐาน GAP เกษตรปลอดภัย</div>
                </div>
              </div>
              <span className="font-mono text-emerald-300 text-[10px] font-bold shrink-0 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-700">
                GAP ✓
              </span>
            </div>
          </div>

          {/* Right Column: Seed-to-Harvest Timeline (7 Cols on desktop) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-4 sm:p-5 shadow-xs border border-emerald-100/90 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                    เส้นทางการเติบโตจากต้นน้ำ (Seed-to-Harvest)
                  </h2>
                  <p className="text-[10.5px] text-slate-500">บันทึกขั้นตอนจริงตั้งแต่เพาะเมล็ดจนถึงเก็บเกี่ยวผลผลิต</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                {activities.length} ขั้นตอน
              </span>
            </div>

            {/* Timeline Items (Fits on desktop view with internal scroll if many entries) */}
            <div className="lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto lg:pr-1.5 space-y-2.5">
              {activities.length > 0 ? (
                <div className="relative pl-5 sm:pl-6 border-l-2 border-emerald-200 space-y-3.5 ml-2 my-1">
                  {activities.map((act) => {
                    const Icon = STAGE_ICONS[act.stage] || Sprout;
                    const stageLabel = STAGE_LABELS[act.stage] || 'กิจกรรม';

                    return (
                      <div key={act.id} className="relative">
                        {/* Node Bullet Icon */}
                        <div className="absolute -left-[27px] sm:-left-[31px] top-0.5 w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-4 ring-white shadow-xs">
                          <Icon className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                        </div>

                        <div className="bg-[#fafbf8] p-3 rounded-2xl border border-emerald-100/80 hover:bg-white hover:shadow-2xs transition">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                              {stageLabel}
                            </span>
                            <span className="font-mono text-[10.5px] font-bold text-slate-500">
                              {formatDateDisplay(act.activity_date)}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1">{act.title}</div>
                          {act.materials_used && (
                            <div className="text-[10.5px] text-amber-900 bg-amber-50/80 p-1.5 rounded-lg mb-1.5 border border-amber-200/60 font-medium">
                              <span className="font-bold">วัสดุ/อุปกรณ์:</span> {act.materials_used}
                            </div>
                          )}
                          {act.details && (
                            <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
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
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                  <div className="font-bold text-gray-800 mb-0.5">บันทึกขั้นตอนตามเกณฑ์ GAP ครบถ้วน</div>
                  <p className="text-gray-500 text-[11px] max-w-sm mx-auto">
                    แปลงปลูกนี้ผ่านการตรวจแปลง การใช้น้ำสะอาด ปุ๋ยอินทรีย์ และการเว้นระยะปลอดภัยก่อนเก็บเกี่ยว
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

