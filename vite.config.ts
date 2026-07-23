import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Proxy API + SignalR hub to the TxGuard backend so the SPA is same-origin in dev.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5080', changeOrigin: true },
      '/hubs': { target: 'http://localhost:5080', changeOrigin: true, ws: true },
    },
  },
})
