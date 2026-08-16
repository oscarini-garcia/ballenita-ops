import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { guardarSesion } from '../auth/sesion.js'

/**
 * Quién habla con la API, que es la guarda que abre el acceso web (SPECS §14.52).
 *
 * Aquí ponía «solo la app de iOS», y con la única puerta siendo Apple eso era
 * verdad por accidente: en el navegador no podía haber sesión. Lo que decide de
 * verdad no es dónde corre la app sino si tiene con qué autenticarse, y este
 * fichero fija las dos mitades — que con sesión el navegador sincroniza, y que
 * sin ella sigue siendo exactamente la libreta local de siempre.
 */
vi.mock('../lib/config.js', async (original) => ({
  ...(await original()),
  cargarConfiguracion: vi.fn(async () => ({ api: 'https://ejemplo.workers.dev' })),
}))

const { hayApi } = await import('./api.js')
const { cargarConfiguracion } = await import('../lib/config.js')

beforeEach(() => {
  localStorage.clear()
  cargarConfiguracion.mockResolvedValue({ api: 'https://ejemplo.workers.dev' })
})
afterEach(() => localStorage.clear())

describe('hayApi en el navegador', () => {
  // El modo local y la demostración no guardan sesión, así que los dos caen
  // aquí: la app es una libreta y no pide nada.
  it('sin sesión, no', async () => {
    expect(await hayApi()).toBe(false)
  })

  it('con la sesión que dejó un enlace de acceso, sí', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1' } })
    expect(await hayApi()).toBe(true)
  })

  it('con sesión pero sin API configurada, tampoco', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1' } })
    cargarConfiguracion.mockResolvedValue({})
    expect(await hayApi()).toBe(false)
  })

  // Una sesión a medias no es una sesión: sin token no hay nada que presentar.
  it('una sesión sin token no cuenta', async () => {
    guardarSesion({ cuenta: { id: 'cta_1' } })
    expect(await hayApi()).toBe(false)
  })
})
