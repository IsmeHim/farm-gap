/**
 * Helper to generate standardized Crop Cycle ID / Batch Code
 * Example: แปลง A1 (Hydro NFT) with cycle_number = 2 -> BATCH-A1-R2
 */
export function getCropCycleId(plot) {
  if (!plot) return '';
  const cleanName = (plot.name || '')
    .replace(/แปลง|\s|\(.*?\)/g, '')
    .trim() || `P${plot.id}`;
  const cycle = plot.cycle_number || 1;
  return `BATCH-${cleanName}-R${cycle}`;
}

export function formatPlotCycle(plot) {
  if (!plot) return '—';
  const cycleId = getCropCycleId(plot);
  return `${plot.name} [${cycleId}]`;
}
