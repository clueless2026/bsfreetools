import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sovereignObfuscatePlugin } from './vite-plugins/sovereignObfuscate.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    // This ensures the app works when hosted at bsfreetools.com/sovereign-ledger/dist/
    base: './', 
    plugins: [react(), ...(isProd ? [sovereignObfuscatePlugin()] : [])],
    build: {
      /** Obfuscation increases JS size; raise limit for single-bundle apps */
      chunkSizeWarningLimit: 1200,
      minify: 'terser',
      sourcemap: false,
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd,
          passes: 2,
        },
        format: {
          comments: false,
        },
      },
    },
  }
})