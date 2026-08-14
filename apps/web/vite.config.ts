import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Web app. Served over http, so assets resolve from the server root.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 5174, strictPort: true },
});
