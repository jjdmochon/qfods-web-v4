import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

const base = process.env.PAGES_BASE || './';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3004,
    open: true,
    watch: {
      usePolling: true,
      interval: 800
    }
  }
});
