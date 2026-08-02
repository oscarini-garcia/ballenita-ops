import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Servida en Cloudflare Pages, en la raíz de su propio dominio. Antes vivía en
// GitHub Pages bajo /ballenita-ops/, y ese subpath obligaba a construir dos
// bundles distintos —uno para la web y otro para la app de iOS, que se sirve
// desde la raíz—. Con dominio propio, base '/' vale para los dos.
const base = '/'

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
        // `/privacidad` y `/soporte` son páginas sueltas, no rutas de la SPA: son
        // las dos URL que exige la ficha de la App Store y Apple las comprueba.
        // Sin esta lista, el service worker contestaría a esas navegaciones con
        // el `index.html` de la app y quien las abriera vería la aplicación en
        // vez de la página —incluido, con mala suerte, quien revisa—.
        navigateFallbackDenylist: [/^\/privacidad/, /^\/soporte/],
      },
      manifest: {
        name: 'Ballena Ops',
        short_name: 'Ballena',
        description: 'El gestor de los eventos del grupo — gastos, cenas y planes. 🐳',
        lang: 'es',
        theme_color: '#0E7CA6',
        background_color: '#EDF3F5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        // Salen de `assets/icon.png`, el mismo dibujo del que come el icono de
        // la app nativa (`npm run assets:ios`). Se regeneran con
        // `npm run iconos:web` y están versionados en `public/`.
        //
        // El `maskable` va aparte y no como `purpose: 'any maskable'` en el
        // mismo fichero: quien recorta se cree ese `maskable` y le corta la cola
        // a la ballena, porque el dibujo llega casi al borde. El de 512 con
        // margen es el que aguanta el círculo.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    // Las pruebas corren en **la zona horaria del grupo**, no en la del
    // contenedor. Con UTC pasaban en verde mientras el calendario de un viaje
    // que empieza el 8 de agosto salía empezando el 7 en cualquier móvil de
    // España: `toISOString()` resta dos horas en verano (ver `lib/dias.js`).
    env: { TZ: 'Europe/Madrid' },
  },
})
