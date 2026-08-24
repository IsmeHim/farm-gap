import axios from 'axios';

export const api = axios.create();

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;

  // If on Vite dev server (localhost:5173), target backend at localhost:4000
  // Otherwise (e.g. ngrok, production, or served via Express), use relative URL (current origin)
  if (!cfg.baseURL) {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' && window.location.port === '5173') {
        cfg.baseURL = 'http://localhost:4000';
      } else {
        cfg.baseURL = '';
      }
    }
  }

  return cfg;
});

