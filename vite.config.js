import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/MaintenancePlanSW/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.app.github.dev', '.loca.lt', 'localhost'],
  },
})
