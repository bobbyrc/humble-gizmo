import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only browser preview of the renderer with a fake window.gizmo.
export default defineConfig({
  root: __dirname,
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify('0.1.0') },
  plugins: [react()],
  server: { port: 5199, strictPort: true, fs: { allow: [resolve(__dirname, '../..')] } }
})
