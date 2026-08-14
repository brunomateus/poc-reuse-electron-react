import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Electron renderer. Loaded from disk via file://, so asset URLs are relative.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 5173, strictPort: true },
});
