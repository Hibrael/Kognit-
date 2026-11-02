import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Em desenvolvimento a API KOGNIT (repositório correaaugusto/KOGNIT) roda em :5080
// e é servida pelo proxy na mesma origem. Em build, use VITE_API_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:5080', changeOrigin: true },
    },
  },
})
