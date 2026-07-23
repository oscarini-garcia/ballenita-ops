import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Servida en GitHub Pages bajo /ballenita-ops/ (§14 del spec).
// En local, base '/' para que el dev server funcione sin subpath.
const base = process.env.GITHUB_PAGES ? '/ballenita-ops/' : '/'

// Versión desde package.json, inyectada como global. Útil para ver qué bundle
// está vivo (sirve de prueba visual del OTA: al actualizar, cambia el número).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        name: 'Ballena Ops',
        short_name: 'Ballena',
        description: 'El gestor de los eventos del grupo — gastos, cenas y planes. 🐋',
        lang: 'es',
        theme_color: '#0E7CA6',
        background_color: '#EDF3F5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        // TODO: generar icon-192/512 PNG para un apple-touch-icon perfecto.
        // Por ahora un SVG cubre el manifest y el favicon.
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
})
