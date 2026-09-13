// Dynamic API URL resolver supporting window.__RUNTIME_CONFIG__ at runtime
export function getApiUrl() {
  // 1. Highest Priority: window.__RUNTIME_CONFIG__.apiUrl (from /config.js)
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.apiUrl !== undefined) {
    const raw = String(window.__RUNTIME_CONFIG__.apiUrl).trim();
    return raw.replace(/\/+$/, '');
  }

  // 2. Build-time environment variable (if runtime config is not present)
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).trim().replace(/\/+$/, '');
  }

  // 3. Development fallback
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' && window.location.port === '5173') {
      return 'http://localhost:4000';
    }
    return '';
  }

  return '';
}

export const config = {
  get apiUrl() {
    return getApiUrl();
  },
};
