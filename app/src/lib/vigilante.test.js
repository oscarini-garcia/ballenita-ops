import { describe, it, expect, vi } from 'vitest'
import { creaVigilante } from './vigilante.js'

/**
 * El vigilante de la versión (SPECS §14.46): preguntar es barato y se hace cada
 * minuto; aplicar es caro e intrusivo y se hace al volver a primer plano.
 */
describe('vigilante de versión', () => {
  it('sin versión nueva no hay nada pendiente ni nada que aplicar', async () => {
    const aplicar = vi.fn()
    const v = creaVigilante({ hayNueva: async () => ({ hay: false }), aplicar })

    expect(await v.comprobar()).toBe(null)
    expect(await v.aplicarSiToca()).toBe(null)
    expect(aplicar).not.toHaveBeenCalled()
  })

  it('con versión nueva se apunta, pero **no** se aplica en el latido', async () => {
    const aplicar = vi.fn()
    const v = creaVigilante({ hayNueva: async () => ({ hay: true, version: '0.43.0' }), aplicar })

    expect(await v.comprobar()).toBe('0.43.0')
    expect(aplicar).not.toHaveBeenCalled()
    expect(v.pendiente).toBe('0.43.0')
  })

  it('en cuanto hay noticia se deja de preguntar', async () => {
    const hayNueva = vi.fn(async () => ({ hay: true, version: '0.43.0' }))
    const v = creaVigilante({ hayNueva, aplicar: vi.fn() })

    await v.comprobar()
    await v.comprobar()
    await v.comprobar()

    expect(hayNueva).toHaveBeenCalledTimes(1)
  })

  it('al volver a primer plano se aplica, y solo una vez', async () => {
    const aplicar = vi.fn(async () => {})
    const v = creaVigilante({ hayNueva: async () => ({ hay: true, version: '0.43.0' }), aplicar })

    await v.comprobar()
    expect(await v.aplicarSiToca()).toBe('0.43.0')
    expect(aplicar).toHaveBeenCalledTimes(1)

    // Segunda vuelta al primer plano: ya no hay nada que poner.
    expect(await v.aplicarSiToca()).toBe(null)
    expect(aplicar).toHaveBeenCalledTimes(1)
  })

  it('dos regresos a la vez no descargan el paquete dos veces', async () => {
    let resolver
    const aplicar = vi.fn(() => new Promise((r) => { resolver = r }))
    const v = creaVigilante({ hayNueva: async () => ({ hay: true, version: '0.43.0' }), aplicar })
    await v.comprobar()

    const a = v.aplicarSiToca()
    const b = v.aplicarSiToca()
    resolver()
    await Promise.all([a, b])

    expect(aplicar).toHaveBeenCalledTimes(1)
  })

  it('si aplicar falla, la noticia se queda para el siguiente regreso', async () => {
    const aplicar = vi.fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValueOnce(undefined)
    const v = creaVigilante({ hayNueva: async () => ({ hay: true, version: '0.43.0' }), aplicar })
    await v.comprobar()

    expect(await v.aplicarSiToca()).toBe(null)
    expect(v.pendiente).toBe('0.43.0')
    expect(await v.aplicarSiToca()).toBe('0.43.0')
  })
})
