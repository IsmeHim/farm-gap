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

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({
  limit: '2mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/plots', crudRouter('plots', ['name','crop_name','area_sqm','planting_date','expected_harvest_date','water_source','water_source_type','soil_test_date','soil_test_result','previous_crop_history','field_safety_status','soil_notes','status','notes']));
app.use('/api/water', crudRouter('water_logs', ['plot_id','log_date','water_source','water_source_type','water_quality','contamination_check','amount_liters','worker_name','notes']));
app.use('/api/chemicals', crudRouter('chemical_logs', ['plot_id','log_date','chem_type','product_name','amount','unit','reason','application_method','safety_ppe','manufacturer','chemical_label','phi_days','worker_name','notes']));
app.use('/api/pests', crudRouter('pest_logs', ['plot_id','log_date','pest_or_disease','severity','treatment_method','worker_name','notes']));
app.use('/api/harvest', crudRouter('harvest_logs', ['plot_id','harvest_date','quantity','unit','quality_grade','lot_code','revenue','harvest_hygiene','postharvest_handling','worker_name','notes']));
app.use('/api/storage', crudRouter('storage_logs', ['harvest_id','log_date','storage_location','shipped_to','buyer','vehicle','vehicle_clean_status','storage_conditions','transport_time','delivery_condition','worker_name','notes']));
app.use('/api/workers', crudRouter('workers', ['name','role','phone','hygiene_training','training_date','personal_hygiene_check','health_status']));
app.use('/api/costs', crudRouter('cost_logs', ['plot_id','log_date','category','description','amount']));
app.use('/api/checklists', crudRouter('gap_checklists', ['plot_id','check_date','inspector_name','field_inspection_pass','cleaning_check','pest_management_check','water_quality_check','chemical_usage_check','hygiene_check','notes']));
app.use('/api/report', reportRouter);
app.use('/api/trace', traceRouter); // public
app.use('/api/products', productsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/line', lineRouter);
app.use('/api/ai', aiRouter);

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
app.listen(port, () => console.log(`🌱 FarmGAP API on : http://localhost:${port}/api/health`));


