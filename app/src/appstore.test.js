import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Lo que la ficha de la App Store da por hecho.
 *
 * Apple comprueba las URL de privacidad y de soporte **antes** de que nadie mire
 * la aplicación: un 404 ahí es un rechazo administrativo. Estas pruebas no
 * pueden verificar que Cloudflare las sirva —eso es `curl` una vez desplegado,
 * docs/APPSTORE.md §5—, pero sí que sigan existiendo y que no se queden con un
 * correo de contacto de mentira, que es como se pierden de verdad: alguien las
 * reescribe y nadie se acuerda de que había una ficha apuntándoles.
 */
// Desde la raíz del proyecto y no desde `import.meta.url`: en jsdom la URL del
// módulo es una ruta del servidor de Vite, no del disco.
const leer = (nombre) => readFileSync(join(process.cwd(), 'public', nombre), 'utf8')

describe('páginas que exige la ficha de la App Store', () => {
  for (const pagina of ['privacidad.html', 'soporte.html']) {
    describe(pagina, () => {
      const html = leer(pagina)

      it('existe y tiene contenido', () => {
        expect(html.length).toBeGreaterThan(500)
      })

      it('lleva un correo de contacto de verdad', () => {
        const correo = html.match(/mailto:([^"]+)/)?.[1]
        expect(correo).toBeTruthy()
        expect(correo).not.toMatch(/ejemplo|example|EJEMPLO|tu-correo/i)
      })

      it('se puede leer en un móvil', () => {
        expect(html).toContain('name="viewport"')
      })
    })
  }

  it('la política de privacidad dice que no hay rastreo ni analítica', () => {
    // No es cosmético: es lo que tiene que coincidir con las etiquetas de
    // privacidad de App Store Connect. Si un día se añade analítica y esto
    // sigue puesto, la ficha pasa a mentir.
    const html = leer('privacidad.html')
    expect(html).toMatch(/No hay analítica/)
    expect(html).toMatch(/No hay rastreo/)
  })

  it('las dos páginas se enlazan entre sí', () => {
    expect(leer('privacidad.html')).toContain('/soporte')
    expect(leer('soporte.html')).toContain('/privacidad')
  })

  it('la política explica cómo eliminar la cuenta (directriz 5.1.1(v))', () => {
    expect(leer('privacidad.html')).toMatch(/Eliminar mi cuenta/)
  })
})
