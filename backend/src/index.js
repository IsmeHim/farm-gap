import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import { crudRouter } from './routes/crud.js';
import reportRouter from './routes/report.js';
import traceRouter from './routes/trace.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/plots', crudRouter('plots', ['name','crop_name','area_sqm','planting_date','expected_harvest_date','water_source','soil_notes','status','notes']));
app.use('/api/water', crudRouter('water_logs', ['plot_id','log_date','water_source','amount_liters','worker_name','notes']));
app.use('/api/chemicals', crudRouter('chemical_logs', ['plot_id','log_date','chem_type','product_name','amount','unit','reason','phi_days','worker_name','notes']));
app.use('/api/pests', crudRouter('pest_logs', ['plot_id','log_date','pest_or_disease','severity','treatment_method','worker_name','notes']));
app.use('/api/harvest', crudRouter('harvest_logs', ['plot_id','harvest_date','quantity','unit','quality_grade','lot_code','revenue','worker_name','notes']));
app.use('/api/storage', crudRouter('storage_logs', ['harvest_id','log_date','storage_location','shipped_to','buyer','vehicle','worker_name','notes']));
app.use('/api/workers', crudRouter('workers', ['name','role','phone','hygiene_training']));
app.use('/api/costs', crudRouter('cost_logs', ['plot_id','log_date','category','description','amount']));
app.use('/api/report', reportRouter);
app.use('/api/trace', traceRouter); // public

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`🌱 FarmGAP API on :${port}`));
