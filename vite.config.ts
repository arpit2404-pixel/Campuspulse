import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
    host: true,
    // While developing, forward /api requests to the Express server (npm run server)
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true }
    }
  }
});
