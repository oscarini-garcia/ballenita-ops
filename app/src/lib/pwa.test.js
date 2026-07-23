import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { forzarActualizacion } from './pwa.js'

describe('forzarActualizacion', () => {
  beforeEach(() => {
    // Un registro con una versión esperando: debe recibir SKIP_WAITING.
    const waiting = { postMessage: vi.fn() }
    const reg = { update: vi.fn().mockResolvedValue(), waiting }
    navigator.serviceWorker = { getRegistrations: vi.fn().mockResolvedValue([reg]) }
    globalThis.__reg = reg

    // Dos cachés que deben borrarse.
    globalThis.caches = {
      keys: vi.fn().mockResolvedValue(['a', 'b']),
      delete: vi.fn().mockResolvedValue(true),
    }
  })

  afterEach(() => {
    delete navigator.serviceWorker
    delete globalThis.caches
    delete globalThis.__reg
  })

  it('busca actualización, activa el SW en espera, limpia cachés y recarga', async () => {
    const reload = vi.fn()
    await forzarActualizacion(reload)

    expect(globalThis.__reg.update).toHaveBeenCalled()
    expect(globalThis.__reg.waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(globalThis.caches.delete).toHaveBeenCalledTimes(2)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('recarga aunque algo falle', async () => {
    navigator.serviceWorker.getRegistrations = vi.fn().mockRejectedValue(new Error('boom'))
    const reload = vi.fn()
    await forzarActualizacion(reload)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
