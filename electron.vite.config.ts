import { readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version) },
    // The CSP (src/renderer/index.html) blocks data: images, so assets must stay files.
    build: { assetsInlineLimit: 0 },
    plugins: [react()]
  }
})
