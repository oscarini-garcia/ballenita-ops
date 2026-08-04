import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Lo que este test sujeta es la diferencia que costó una versión: en la app de
 * iOS la versión nueva llega en un **paquete OTA**, no por el service worker, y
 * el paquete solo se aplica cuando alguien lo aplica.
 */
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))

const MANIFIESTO = { version: '0.9.1', url: 'https://ejemplo/bundle.zip', checksum: 'abc' }

function pluginFalso({ instalada = '0.9.0' } = {}) {
  const llamadas = { descargas: 0, puestos: 0, armados: 0 }
  return {
    llamadas,
    modulo: {
      CapacitorUpdater: {
        current: async () => ({ bundle: { version: instalada } }),
        download: async () => { llamadas.descargas += 1; return { id: 'b1' } },
        // `set` **recarga en el acto** y destruye el contexto de JavaScript: lo
        // dice la documentación del plugin, «terminal operation». `next` es el
        // que deja el paquete puesto para el próximo arranque.
        set: async () => { llamadas.puestos += 1 },
        next: async () => { llamadas.armados += 1 },
        notifyAppReady: async () => {},
      },
    },
  }
}

beforeEach(() => {
  vi.resetModules()
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => MANIFIESTO }))
})

describe('checkForOtaUpdate', () => {
  it('en segundo plano lo deja puesto para el próximo arranque, sin recargar encima', async () => {
    // Esto es lo que este test **ya decía** antes de que el código lo cumpliera:
    // se llamaba a `set()`, que recarga en el acto, también en la comprobación
    // de fondo de `initNative()`. O sea que abrir la app con versión nueva la
    // reiniciaba sola nada más arrancar.
    const falso = pluginFalso()
    vi.doMock('@capgo/capacitor-updater', () => falso.modulo)
    const { checkForOtaUpdate } = await import('./native.js')

    expect(await checkForOtaUpdate()).toEqual({ status: 'armed', version: '0.9.1' })
    expect(falso.llamadas.descargas).toBe(1)
    expect(falso.llamadas.armados).toBe(1)
    expect(falso.llamadas.puestos).toBe(0)
  })

  it('con `aplicarYa` se aplica en el acto, que es lo que espera quien toca el botón', async () => {
    const falso = pluginFalso()
    vi.doMock('@capgo/capacitor-updater', () => falso.modulo)
    const { checkForOtaUpdate } = await import('./native.js')

    expect(await checkForOtaUpdate({ aplicarYa: true })).toEqual({ status: 'updated', version: '0.9.1' })
    // `set` es el que recarga: no hace falta un `reload()` detrás, y el que
    // había era código muerto porque nunca llegaba a ejecutarse.
    expect(falso.llamadas.puestos).toBe(1)
    expect(falso.llamadas.armados).toBe(0)
  })

  it('si ya estás en la última, no descarga nada', async () => {
    const falso = pluginFalso({ instalada: '0.9.1' })
    vi.doMock('@capgo/capacitor-updater', () => falso.modulo)
    const { checkForOtaUpdate } = await import('./native.js')

    expect(await checkForOtaUpdate({ aplicarYa: true })).toEqual({ status: 'up-to-date', version: '0.9.1' })
    expect(falso.llamadas.descargas).toBe(0)
    expect(falso.llamadas.puestos).toBe(0)
  })

  it('sin manifiesto no se rompe nada', async () => {
    const falso = pluginFalso()
    vi.doMock('@capgo/capacitor-updater', () => falso.modulo)
    globalThis.fetch = vi.fn(async () => ({ ok: false }))
    const { checkForOtaUpdate } = await import('./native.js')

    expect(await checkForOtaUpdate()).toEqual({ status: 'no-manifest' })
  })
})

/**
 * Qué paquetes hay en el móvil y en qué estado (§14.20-sexies).
 *
 * Es lo que faltaba para poder decir por qué la app se queda en la versión de
 * antes: hasta ahora el manifiesto decía una cosa, el release estaba publicado,
 * el zip constaba descargado, y la pantalla seguía con el número viejo. Con eso
 * no se puede saber si el fallo está en bajarlo, en aplicarlo, o en que el
 * plugin lo ha devuelto.
 */
describe('estadoDelPaquete', () => {
  it('dice cuál está puesto, cuál es la del binario y qué hay bajado', async () => {
    vi.doMock('@capgo/capacitor-updater', () => ({
      CapacitorUpdater: {
        current: async () => ({ bundle: { id: 'b2', version: '0.18.1', status: 'success' }, native: '0.14.0' }),
        list: async () => ({ bundles: [
          { id: 'b1', version: '0.18.0', status: 'success' },
          { id: 'b2', version: '0.18.1', status: 'success' },
        ] }),
      },
    }))
    const { estadoDelPaquete } = await import('./native.js')

    expect(await estadoDelPaquete()).toEqual({
      actual: { id: 'b2', version: '0.18.1', estado: 'success' },
      nativa: '0.14.0',
      bundles: [
        { id: 'b1', version: '0.18.0', estado: 'success' },
        { id: 'b2', version: '0.18.1', estado: 'success' },
      ],
      error: null,
    })
  })

  it('un paquete devuelto se ve, que desde fuera parece que no se bajó', async () => {
    // capgo hace rollback si el paquete nuevo no llama a `notifyAppReady()` a
    // tiempo, y lo deja en `error`. Sin enseñarlo, eso es indistinguible de una
    // descarga que nunca ocurrió.
    vi.doMock('@capgo/capacitor-updater', () => ({
      CapacitorUpdater: {
        current: async () => ({ bundle: { id: 'b1', version: '0.18.0', status: 'success' }, native: '0.14.0' }),
        list: async () => ({ bundles: [{ id: 'b2', version: '0.18.1', status: 'error' }] }),
      },
    }))
    const { estadoDelPaquete } = await import('./native.js')

    const e = await estadoDelPaquete()
    expect(e.actual.version).toBe('0.18.0')
    expect(e.bundles).toContainEqual({ id: 'b2', version: '0.18.1', estado: 'error' })
  })

  it('si el plugin no contesta, se dice y no se rompe la pantalla', async () => {
    vi.doMock('@capgo/capacitor-updater', () => ({
      CapacitorUpdater: {
        current: async () => { throw new Error('sin plugin') },
        list: async () => { throw new Error('sin plugin') },
      },
    }))
    const { estadoDelPaquete } = await import('./native.js')
    expect((await estadoDelPaquete()).error).toMatch(/sin plugin/)
  })
})
