import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import { crudRouter } from './routes/crud.js';
import reportRouter from './routes/report.js';
import traceRouter from './routes/trace.js';
import { productsRouter } from './routes/products.js';
import { customersRouter } from './routes/customers.js';
import { ordersRouter } from './routes/orders.js';
import { lineRouter } from './routes/line.js';
import { aiRouter } from './routes/ai.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.join(__dirname, '../../frontend/dist');

import { plotsRouter } from './routes/plots.js';
import { waterRouter, processAutoWaterRoutineForAllUsers } from './routes/water.js';
import { harvestRouter } from './routes/harvest.js';
import { uploadRouter } from './routes/upload.js';
import { salesRouter } from './routes/sales.js';
import { diaryRouter } from './routes/diary.js';
import { cropsRouter } from './routes/crops.js';
import { batchesRouter } from './routes/batches.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({
  limit: '15mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Serve uploaded files statically
const uploadsStaticPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsStaticPath)) {
  fs.mkdirSync(uploadsStaticPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsStaticPath));

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/plots', plotsRouter);
app.use('/api/water', waterRouter);
app.use('/api/chemicals', crudRouter('chemical_logs', ['plot_id','log_date','chem_type','product_name','amount','unit','reason','application_method','safety_ppe','manufacturer','chemical_label','phi_days','worker_name','notes']));
app.use('/api/pests', crudRouter('pest_logs', ['plot_id','log_date','pest_or_disease','severity','treatment_method','worker_name','notes']));
app.use('/api/harvest', harvestRouter);
app.use('/api/storage', crudRouter('storage_logs', ['harvest_id','order_id','log_date','storage_location','shipped_to','buyer','vehicle','vehicle_clean_status','storage_conditions','transport_time','delivery_condition','worker_name','notes']));
app.use('/api/costs', crudRouter('cost_logs', ['plot_id','log_date','category','description','amount']));
app.use('/api/report', reportRouter);
app.use('/api/trace', traceRouter); // public
app.use('/api/products', productsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/sales', salesRouter);
app.use('/api/line', lineRouter);
app.use('/api/ai', aiRouter);
app.use('/api/diary', diaryRouter);
app.use('/api/crops', cropsRouter);
app.use('/api/batches', batchesRouter);

// Serve Frontend SPA (LIFF Order, LIFF History, Admin Dashboard)
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`🌱 FarmGAP API on : http://localhost:${port}/api/health`);

  // Auto-Watering Background Daemon (every 15 minutes)
  setTimeout(() => {
    processAutoWaterRoutineForAllUsers().catch(err => console.error('Initial auto-water failed:', err.message));
  }, 5000);
  setInterval(() => {
    processAutoWaterRoutineForAllUsers().catch(err => console.error('Scheduled auto-water failed:', err.message));
  }, 15 * 60 * 1000);
});


