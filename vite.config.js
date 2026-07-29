/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  // Тесты фронта. Раньше `pnpm test` был `node --test $(find src -name '*.test.js')`:
  // это гоняло только чистые модули-утилиты, а компоненты — никак (JSX голый node
  // не понимает), причём при нуле найденных файлов команда молча возвращала 0.
  // Vitest берёт трансформ у самого Vite, поэтому компоненты тестируются тем же
  // конвейером, которым собираются.
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    css: false,
  },
})
