import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config kept intentionally minimal for Phase 0.
// No extra plugins, aliases, or environment variables yet.
export default defineConfig({
  plugins: [react()],
  server: {
    open: false
  }
});
