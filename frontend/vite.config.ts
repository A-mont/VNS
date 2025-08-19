import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { checker } from 'vite-plugin-checker'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import svgr from 'vite-plugin-svgr'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    host: true,
    strictPort: false,
    allowedHosts: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills(),
    svgr(),
    checker({
      typescript: true, 
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
