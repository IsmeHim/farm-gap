import axios from 'axios';
import { getApiUrl } from './config.js';

export const api = axios.create();

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;

  // Dynamically resolve baseURL on every request from window.__RUNTIME_CONFIG__ (via getApiUrl())
  if (!cfg.baseURL) {
    const resolvedUrl = getApiUrl();
    if (resolvedUrl) {
      cfg.baseURL = resolvedUrl;
    }
  }

  return cfg;
});
