import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Em desenvolvimento o back (qualquer linguagem, contrato em contracts/openapi.yaml) roda em :8000
// e é servido pelo proxy na mesma origem. Em build, use VITE_API_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
