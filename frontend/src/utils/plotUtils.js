// Date & Calculation Helpers for Plots & Batches

export const parseDateMidnight = (dateStr) => {
  if (!dateStr) return null;
  const cleanStr = String(dateStr).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// Safe local date string "YYYY-MM-DD" based on client local time (prevents UTC timezone shift)
export const getTodayLocalStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const formatDateForInput = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && dateVal.includes('-')) {
    return dateVal.split('T')[0];
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getDaysPlanted = (dateStr) => {
  const dZero = parseDateMidnight(dateStr);
  if (!dZero) return 0;
  const now = new Date();
  const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = nowZero.getTime() - dZero.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
};

export const getBatchProgressInfo = (batch, plot) => {
  const isHarvestReady = (plot && plot.status === 'harvest_ready') || (batch && batch.status === 'harvest_ready');
  const isHarvested = (plot && plot.status === 'harvested') || (batch && batch.status === 'harvested');
  const startDate = batch?.start_date || plot?.planting_date;
  const growthDays = Number(batch?.growth_days || plot?.growth_days || 30);

  // ตรวจสอบวันที่เริ่มเพาะเมล็ด / กิจกรรมต้นกล้า
  const seedDate = batch?.seed_prep_date || plot?.batch_seed_prep_date || plot?.seed_prep_date || plot?.activities?.find(a => a.stage === 'seeding')?.activity_date;

  const daysInBed = startDate ? getDaysPlanted(startDate) : 0;
  const plantAge = seedDate ? Math.max(daysInBed, getDaysPlanted(seedDate)) : daysInBed;
  const nurseryDays = Math.max(0, plantAge - daysInBed);

  // คำนวณวันคาดการณ์เก็บเกี่ยวที่แท้จริง: ถ้ามี seedDate ให้คำนวณจาก seedDate + growthDays
  let effectiveExpectedDate = batch?.expected_harvest_date || plot?.expected_harvest_date;
  if (seedDate) {
    const seedMidnight = parseDateMidnight(seedDate);
    if (seedMidnight) {
      const calcExp = new Date(seedMidnight.getTime() + growthDays * 24 * 60 * 60 * 1000);
      effectiveExpectedDate = calcExp.toISOString().split('T')[0];
    }
  }

  // คำนวณวันคงเหลือ
  const daysLeft = Math.max(0, growthDays - plantAge);

  if (isHarvested) {
    return {
      percent: 100,
      daysPlanted: daysInBed,
      plantAge,
      seedDate,
      effectiveExpectedDate,
      nurseryDays,
      growthDays,
      daysLeft: 0,
      statusLabel: 'เก็บเกี่ยวแล้ว',
      color: 'slate',
    };
  }

  if (isHarvestReady || daysLeft === 0 || (effectiveExpectedDate && parseDateMidnight(effectiveExpectedDate) <= new Date())) {
    return {
      percent: 100,
      daysPlanted: daysInBed,
      plantAge: Math.max(plantAge, growthDays),
      seedDate,
      effectiveExpectedDate,
      nurseryDays,
      growthDays,
      daysLeft: 0,
      statusLabel: 'พร้อมเก็บเกี่ยว',
      color: 'amber',
    };
  }

  const percent = Math.min(100, Math.max(0, Math.round((plantAge / growthDays) * 100)));

  return {
    percent,
    daysPlanted: daysInBed,
    plantAge,
    seedDate,
    effectiveExpectedDate,
    nurseryDays,
    growthDays,
    daysLeft,
    statusLabel: `เหลืออีก ~${daysLeft} วัน`,
    color: 'emerald',
  };
};

export const getPlotProgressInfo = (plot, batch) => {
  const isHarvestReady = (plot && plot.status === 'harvest_ready') || (batch && batch.status === 'harvest_ready');
  const isHarvested = (plot && plot.status === 'harvested') || (batch && batch.status === 'harvested');
  const startDate = batch?.start_date || plot?.planting_date;
  const growthDays = Number(batch?.growth_days || plot?.growth_days || 30);
  const seedDate = batch?.seed_prep_date || plot?.batch_seed_prep_date || plot?.seed_prep_date || plot?.activities?.find(a => a.stage === 'seeding')?.activity_date;
  const daysInBed = startDate ? getDaysPlanted(startDate) : 0;
  const plantAge = seedDate ? Math.max(daysInBed, getDaysPlanted(seedDate)) : daysInBed;

  let effectiveExpectedDate = batch?.expected_harvest_date || plot?.expected_harvest_date;
  if (seedDate) {
    const seedMidnight = parseDateMidnight(seedDate);
    if (seedMidnight) {
      const calcExp = new Date(seedMidnight.getTime() + growthDays * 24 * 60 * 60 * 1000);
      effectiveExpectedDate = calcExp.toISOString().split('T')[0];
    }
  }

  const daysLeft = Math.max(0, growthDays - plantAge);

  if (isHarvested) {
    return { percent: 100, plantAge, daysLeft: 0, statusLabel: 'เก็บเกี่ยวแล้ว', isReady: false };
  }
  if (isHarvestReady || daysLeft === 0 || (effectiveExpectedDate && parseDateMidnight(effectiveExpectedDate) <= new Date())) {
    return { percent: 100, plantAge: Math.max(plantAge, growthDays), daysLeft: 0, statusLabel: 'พร้อมเก็บเกี่ยว 100%', isReady: true };
  }
  const percent = Math.min(100, Math.max(0, Math.round((plantAge / growthDays) * 100)));
  return { percent, plantAge, daysLeft, statusLabel: `โต ${percent}% (เหลืออีก ~${daysLeft} วัน)`, isReady: false };
};
