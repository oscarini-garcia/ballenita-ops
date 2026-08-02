import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  forzarActualizacion, comprobarActualizacion, UPDATE_STEPS,
  marcarPostActualizacion, veniaDeActualizar, limpiarMarcaActualizacion,
} from './pwa.js'

afterEach(() => {
  delete navigator.serviceWorker
  delete globalThis.caches
  sessionStorage.clear()
})

describe('los rótulos de los pasos', () => {
  it('no llevan emoji ni puntos suspensivos: la lista se queda puesta', () => {
    // La lista ya no vive en un modal que se cierra, se queda en Ajustes. Un
    // «Descargando…» con su ✓ al lado se lee mal, y quien dice en qué estado va
    // es la marca de la lista. Los emoji del cromo se retiraron (SPECS §14.13).
    for (const texto of Object.values(UPDATE_STEPS)) {
      expect(texto).not.toMatch(/…|\.\.\./)
      expect(texto).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })
})

describe('forzarActualizacion', () => {
  it('espera a que el SW nuevo se active antes de recargar y reporta el progreso', async () => {
    // Worker nuevo ya activado: esperaActivado resuelve al momento.
    const worker = { state: 'activated', postMessage: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const reg = { update: vi.fn().mockResolvedValue(), installing: worker, waiting: null }
    navigator.serviceWorker = { getRegistration: vi.fn().mockResolvedValue(reg) }

    const pasos = []
    const reload = vi.fn()
    const res = await forzarActualizacion((p) => pasos.push(p), { reload })

    expect(res).toBe('updated')
    expect(reg.update).toHaveBeenCalled()
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).toHaveBeenCalledTimes(1)
    // Progreso visible: buscando → descargando → aplicando.
    expect(pasos).toEqual(['checking', 'downloading', 'applying'])
    pasos.forEach((p) => expect(UPDATE_STEPS[p]).toBeTruthy())
  })

  it('sin worker nuevo, limpia cachés y recarga como último recurso', async () => {
    const reg = { update: vi.fn().mockResolvedValue(), installing: null, waiting: null }
    navigator.serviceWorker = { getRegistration: vi.fn().mockResolvedValue(reg) }
    globalThis.caches = { keys: vi.fn().mockResolvedValue(['a', 'b']), delete: vi.fn().mockResolvedValue(true) }

    const pasos = []
    const reload = vi.fn()
    const res = await forzarActualizacion((p) => pasos.push(p), { reload })

    expect(res).toBe('reloaded')
    expect(globalThis.caches.delete).toHaveBeenCalledTimes(2)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(pasos).toContain('applying')
  })

  it('recarga aunque algo falle', async () => {
    navigator.serviceWorker = { getRegistration: vi.fn().mockRejectedValue(new Error('boom')) }
    globalThis.caches = { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() }
    const reload = vi.fn()
    await forzarActualizacion(() => {}, { reload })
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('comprobarActualizacion', () => {
  it('sin worker nuevo dice «al-dia» y NO recarga', async () => {
    // Es la diferencia con `forzarActualizacion`, y su razón de existir: el punto
    // de la cabecera se toca a menudo y no puede recargar la app cada vez.
    const reg = { update: vi.fn().mockResolvedValue(), installing: null, waiting: null }
    navigator.serviceWorker = { getRegistration: vi.fn().mockResolvedValue(reg) }
    const reload = vi.fn()

    expect(await comprobarActualizacion({ reload })).toBe('al-dia')
    expect(reload).not.toHaveBeenCalled()
  })

  it('con worker nuevo lo activa, recarga y va contando los pasos', async () => {
    const worker = { state: 'activated', postMessage: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const reg = { update: vi.fn().mockResolvedValue(), installing: worker, waiting: null }
    navigator.serviceWorker = { getRegistration: vi.fn().mockResolvedValue(reg) }

    const pasos = []
    const reload = vi.fn()
    const res = await comprobarActualizacion({ onStatus: (p) => pasos.push(p), reload })

    expect(res).toBe('actualizando')
    expect(pasos).toEqual(['checking', 'downloading', 'applying'])
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('sin service worker registrado dice «no-aplica» y no toca nada', async () => {
    navigator.serviceWorker = { getRegistration: vi.fn().mockResolvedValue(undefined) }
    const reload = vi.fn()
    expect(await comprobarActualizacion({ reload })).toBe('no-aplica')
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('marca post-actualización', () => {
  it('marca, se lee y se limpia', () => {
    expect(veniaDeActualizar()).toBe(false)
    marcarPostActualizacion()
    expect(veniaDeActualizar()).toBe(true)
    limpiarMarcaActualizacion()
    expect(veniaDeActualizar()).toBe(false)
  })
})
