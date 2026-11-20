import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// This config runs in Node; @types/node is not a project dependency, so declare
// the single global this file needs instead of pulling in the whole typings set.
declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    // Dev-only proxy: keeps the browser same-origin so no CORS config is needed.
    // VITE_API_TARGET lets a second API instance (another port) be used without
    // editing this file; production builds never read it.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
