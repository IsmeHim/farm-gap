import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: true, watch: { usePolling: true } },
  optimizeDeps: {
    exclude: ['axios', 'lucide-react', 'html2canvas']
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          pdf: ['jspdf', 'jspdf-autotable'],
          icons: ['lucide-react'],
          charts: ['recharts'],
        }
      }
    }
  }
});
