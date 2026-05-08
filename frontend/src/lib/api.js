import axios from 'axios';
import { config } from './config.js';

export const api = axios.create({
  baseURL: config.apiUrl,
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
