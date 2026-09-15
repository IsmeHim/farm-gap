// Dynamic API URL resolver supporting window.__RUNTIME_CONFIG__ at runtime
export function getApiUrl() {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // 1. Highest Priority: window.__RUNTIME_CONFIG__.apiUrl (from /config.js)
    if (window.__RUNTIME_CONFIG__?.apiUrl !== undefined) {
      const raw = String(window.__RUNTIME_CONFIG__.apiUrl).trim();

      // Guard: If accessing via ngrok, public domain, or remote host,
      // never attempt to call localhost/loopback because browsers strictly block public-to-private CORS
      if (!isLocalhost && (raw.includes('localhost') || raw.includes('127.0.0.1'))) {
        return ''; // Fallback to same-origin relative path
      }

      if (raw) return raw.replace(/\/+$/, '');
      return ''; // Empty string means relative path
    }

    // 2. Build-time environment variable
    if (import.meta.env.VITE_API_URL) {
      const envUrl = String(import.meta.env.VITE_API_URL).trim().replace(/\/+$/, '');
      if (!isLocalhost && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
        return '';
      }
      return envUrl;
    }

    // 3. Development fallback (Vite dev server port 5173 targeting backend port 4000)
    if (isLocalhost && window.location.port === '5173') {
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
