import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { COCINA_DE_ORIGEN } from './cocina.js'

/**
 * La copia de la app y el original del Worker dicen lo mismo.
 *
 * El campo del evento nace vacío y vacío vale el texto de origen, así que la
 * pantalla lo enseña en gris para que la regla se vea. Si las dos copias se
 * separan, la pantalla enseñaría una cosa y el modelo leería otra — que es el
 * peor fallo posible de un valor por defecto: invisible hasta que las
 * propuestas dejan de tener sentido.
 */
function raizDelRepo() {
  let d = resolve(process.cwd())
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(d, 'api', 'src', 'cocina.js'))) return d
    d = dirname(d)
  }
  return null
}

describe('con qué se cocina', () => {
  it('la app y el Worker dicen lo mismo', () => {
    const raiz = raizDelRepo()
    // En un despliegue solo de la PWA el Worker no está al lado, y eso no es un
    // fallo: el test se salta en vez de fallar por algo que no existe.
    if (!raiz) return

    const fuente = readFileSync(join(raiz, 'api', 'src', 'cocina.js'), 'utf8')
    const bloque = fuente.match(/COCINA_DE_ORIGEN = \[([\s\S]*?)\]\.join\(' '\)/)
    expect(bloque, 'no encuentro COCINA_DE_ORIGEN en api/src/cocina.js').toBeTruthy()

    const delWorker = [...bloque[1].matchAll(/'([^']*)'/g)].map((m) => m[1]).join(' ')
    expect(COCINA_DE_ORIGEN).toBe(delWorker)
  })

  it('dice los cacharros que hay, que es lo único que tiene que hacer', () => {
    expect(COCINA_DE_ORIGEN).toMatch(/[Bb]arbacoa/)
    expect(COCINA_DE_ORIGEN).toMatch(/plancha/)
    // Y lo que **no** se puede, que es la mitad del dato: proponer cinco cosas
    // de sartén para un bungaló que se pone a 35 grados es no proponer nada.
    expect(COCINA_DE_ORIGEN).toMatch(/sartén/)
  })
})
