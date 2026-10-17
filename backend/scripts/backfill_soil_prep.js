import { pool } from '../src/db.js';

async function backfillSoilPrep() {
  const [batches] = await pool.query(`
    SELECT b.id, b.user_id, b.plot_id, b.batch_code, b.start_date, b.soil_recipe, b.soil_prep_date,
           p.name AS plot_name, p.soil_recipe AS plot_soil_recipe, c.name AS crop_name,
           u.display_name
    FROM planting_batches b
    JOIN plots p ON p.id = b.plot_id
    LEFT JOIN crops c ON c.id = b.crop_id
    LEFT JOIN users u ON u.id = b.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM crop_activities a WHERE a.batch_id = b.id AND a.stage = 'soil_prep'
    )
  `);
  console.log('Batches to backfill:', batches.length);
  for (const b of batches) {
    const soilDate = b.soil_prep_date || b.start_date;
    const soilRecipe = b.soil_recipe || b.plot_soil_recipe || 'ผสมดิน 8 กระบะปูน (กากยางพัฒนาที่ดิน 2 กระสอบ + ขี้ไก่ 1/2 กระสอบ)';
    const cropName = b.crop_name || 'ผัก';
    await pool.query(`
      INSERT INTO crop_activities (user_id, plot_id, batch_id, activity_date, stage, title, details, materials_used, operator_name)
      VALUES (?, ?, ?, ?, 'soil_prep', ?, ?, ?, ?)
    `, [
      b.user_id,
      b.plot_id,
      b.id,
      soilDate,
      `เตรียมดินและแคร่ปลูก (${b.batch_code})`,
      `ผสมดินและปรับปรุงแปลงปลูกตามสูตรมาตรฐานฟาร์ม เตรียมแปลงสำหรับการปลูก ${cropName}`,
      soilRecipe,
      b.display_name || 'เจ้าของฟาร์ม'
    ]);
  }
  console.log('Backfill finished successfully.');
  process.exit(0);
}

backfillSoilPrep().catch(err => {
  console.error(err);
  process.exit(1);
});
