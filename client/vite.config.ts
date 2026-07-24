import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // /api isteklerini backend'e yonlendir
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Yuklenen fotograflar (ayni origin -> PDF/canvas icin taint yok)
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
