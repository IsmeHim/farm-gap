const runtimeConfig = typeof window !== 'undefined' ? window.__RUNTIME_CONFIG__ : undefined;

export const config = {
  apiUrl: runtimeConfig?.apiUrl || import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:4000'),
};

export function getApiUrl() {
  return config.apiUrl;
}
