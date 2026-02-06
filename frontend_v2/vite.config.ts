import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Combined Vite config: polyfills for Node globals used by Solana libs
// and dev-server proxy to backend API routes.
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis'
  },
  resolve: {
    alias: {
      // point imports of 'buffer' to the browser-friendly package
      buffer: 'buffer/'
    }
  },
  optimizeDeps: {
    include: ['buffer']
  },
  server: {
    proxy: {
      // Forward API calls to backend to avoid CORS / env issues during dev
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/admin': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/user': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/registry': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
