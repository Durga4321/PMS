import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = (env.VITE_API_BASE_URL || env.REACT_APP_API_BASE_URL || 'https://jackpot-citrus-compare.ngrok-free.dev').trim().replace(/\/+$/, '')

  return {
    plugins: [react({ jsxImportSource: '@pms/i18n' })],
    resolve: { alias: { '@pms/i18n': fileURLToPath(new URL('./src/i18n', import.meta.url)) } },
    optimizeDeps: { exclude: ['@pms/i18n/jsx-runtime', '@pms/i18n/jsx-dev-runtime'] },
    server: {
      host: '0.0.0.0',
      port: 5000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          headers: { 'ngrok-skip-browser-warning': 'true' },
        },
      },
    },
  }
})
