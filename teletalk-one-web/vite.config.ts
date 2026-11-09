/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves a project site from a sub-path (/<repo>/portal/), so
  // every asset URL needs that prefix. Only the Pages workflow sets this;
  // `npm run dev` and a plain build stay at '/'.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: { port: 5173 },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Vendor split so an app-code release doesn't invalidate the React and
        // i18n chunks in every retailer's browser cache.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
    chunkSizeWarningLimit: 300,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
})
