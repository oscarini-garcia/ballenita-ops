import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Lo que este test sujeta es la diferencia que costó una versión: en la app de
 * iOS la versión nueva llega en un **paquete OTA**, no por el service worker, y
 * el paquete solo se aplica cuando alguien lo aplica.
 */
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))

const MANIFIESTO = { version: '0.9.1', url: 'https://ejemplo/bundle.zip', checksum: 'abc' }

function pluginFalso({ instalada = '0.9.0' } = {}) {
  const llamadas = { descargas: 0, puestos: 0, recargas: 0 }
  return {
    llamadas,
    modulo: {
      CapacitorUpdater: {
        current: async () => ({ bundle: { version: instalada } }),
        download: async () => { llamadas.descargas += 1; return { id: 'b1' } },
        set: async () => { llamadas.puestos += 1 },
        reload: async () => { llamadas.recargas += 1 },
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
  it('descarga y deja puesto el paquete nuevo', async () => {
    const falso = pluginFalso()
    vi.doMock('@capgo/capacitor-updater', () => falso.modulo)
    const { checkForOtaUpdate } = await import('./native.js')

    const r = await checkForOtaUpdate()
    expect(r).toEqual({ status: 'updated', version: '0.9.1' })
    expect(falso.llamadas.descargas).toBe(1)
    expect(falso.llamadas.puestos).toBe(1)
    // Sin pedirlo, no recarga: se aplica al abrir la app la próxima vez.
    expect(falso.llamadas.recargas).toBe(0)
  })

  it('con `aplicarYa` recarga en el acto, que es lo que espera quien toca el botón', async () => {
    const falso = pluginFalso()
    vi.doMock('@capgo/capacitor-updater', () => falso.modulo)
    const { checkForOtaUpdate } = await import('./native.js')

    await checkForOtaUpdate({ aplicarYa: true })
    expect(falso.llamadas.recargas).toBe(1)
  })

  it('si ya estás en la última, no descarga nada', async () => {
    const falso = pluginFalso({ instalada: '0.9.1' })
    vi.doMock('@capgo/capacitor-updater', () => falso.modulo)
    const { checkForOtaUpdate } = await import('./native.js')

    expect(await checkForOtaUpdate({ aplicarYa: true })).toEqual({ status: 'up-to-date', version: '0.9.1' })
    expect(falso.llamadas.descargas).toBe(0)
    expect(falso.llamadas.recargas).toBe(0)
  })

  it('sin manifiesto no se rompe nada', async () => {
    const falso = pluginFalso()
    vi.doMock('@capgo/capacitor-updater', () => falso.modulo)
    globalThis.fetch = vi.fn(async () => ({ ok: false }))
    const { checkForOtaUpdate } = await import('./native.js')

    expect(await checkForOtaUpdate()).toEqual({ status: 'no-manifest' })
  })
})
