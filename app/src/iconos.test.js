import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * El icono, que hasta ahora eran dos dibujos distintos según por dónde entraras.
 *
 * La app nativa comía de `assets/icon.png` (vía `npm run assets:ios`) y el
 * navegador de un `favicon.svg` que era un emoji sobre un cuadrado. Ahora los
 * dos salen del mismo sitio, y esto lo vigila: los PNG están versionados en
 * `public/`, así que lo que se rompe no es un build sino un `git rm` distraído
 * o un `manifest` que deja de citarlos, y ninguna de las dos cosas se ve
 * mirando la app en el ordenador de quien la hizo.
 */
const raiz = process.cwd()
const publico = (nombre) => join(raiz, 'public', nombre)

const ICONOS = ['favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']

describe('iconos de la web y de la PWA', () => {
  it('el dibujo del que salen todos sigue en su sitio', () => {
    expect(existsSync(join(raiz, 'assets', 'icon.png'))).toBe(true)
  })

  for (const nombre of ICONOS) {
    it(`${nombre} existe y es un PNG de verdad`, () => {
      expect(existsSync(publico(nombre))).toBe(true)
      // Firma de PNG. Un fichero de 0 bytes o un SVG renombrado pasarían un
      // `existsSync` y fallarían en el móvil, que es donde no se mira.
      const cabecera = readFileSync(publico(nombre)).subarray(0, 8)
      expect([...cabecera]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(statSync(publico(nombre)).size).toBeGreaterThan(500)
    })
  }

  it('el manifest cita los tres del manifiesto, y el maskable va aparte', () => {
    const config = readFileSync(join(raiz, 'vite.config.js'), 'utf8')
    for (const nombre of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
      expect(config).toContain(nombre)
    }
    // `any maskable` en el mismo fichero es la trampa: quien recorta se lo cree
    // y le corta la cola a la ballena, que llega casi al borde del dibujo. Se
    // mira solo en las líneas que declaran un icono; el comentario que lo
    // explica lleva esas mismas palabras y no es lo que se persigue.
    const declaraciones = config.split('\n').filter((l) => l.includes('src:') && l.includes('purpose'))
    expect(declaraciones).toHaveLength(3)
    expect(declaraciones.filter((l) => l.includes('any maskable'))).toEqual([])
  })

  it('la portada declara su icono en vez de fiarse de /favicon.ico', () => {
    const html = readFileSync(join(raiz, 'index.html'), 'utf8')
    expect(html).toMatch(/rel="icon"[^>]*favicon-32\.png/)
    expect(html).toMatch(/rel="apple-touch-icon"[^>]*apple-touch-icon\.png/)
  })

  it('ya no queda nadie apuntando al favicon.svg que se fue', () => {
    expect(existsSync(publico('favicon.svg'))).toBe(false)
    for (const pagina of ['privacidad.html', 'soporte.html', '404.html']) {
      expect(readFileSync(publico(pagina), 'utf8')).not.toContain('favicon.svg')
    }
    expect(readFileSync(join(raiz, 'index.html'), 'utf8')).not.toContain('favicon.svg')
    expect(readFileSync(join(raiz, 'vite.config.js'), 'utf8')).not.toContain('favicon.svg')
  })
})
