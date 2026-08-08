import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Una API que no contesta tiene que romper, no quedarse.
 *
 * `fetch` no lleva plazo, y esa es la frase entera: si la dirección de
 * `config.json` no responde, la promesa ni se cumple ni se rompe. Dentro de un
 * `await` eso es un botón girando para siempre, y es lo que dejaba «Pidiendo…»
 * puesto en Notificaciones —el permiso ya estaba dado, el identificador ya
 * estaba pedido, y lo que no volvía era el `POST /api/push`—.
 */
beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem('ballena.sesion', JSON.stringify({ token: 'tok' }))
})
afterEach(() => { vi.unstubAllGlobals() })

async function conFetch(fetchFalso) {
  vi.doMock('../lib/config.js', () => ({
    cargarConfiguracion: async () => ({ api: 'https://api.ejemplo' }),
    estaConfigurada: (c) => Boolean(c?.api),
  }))
  vi.doMock('../lib/native.js', () => ({ isNative: () => true }))
  vi.doMock('../auth/sesion.js', () => ({
    leerSesion: () => ({ token: 'tok' }),
    borrarSesion: () => {},
  }))
  vi.stubGlobal('fetch', fetchFalso)
  return import('./api.js')
}

describe('el plazo de la API', () => {
  it('toda petición sale con un corte puesto', async () => {
    const visto = {}
    const { registrarPush } = await conFetch(async (_url, opciones) => {
      visto.signal = opciones.signal
      return { ok: true, status: 200, json: async () => ({ ok: true }) }
    })
    await registrarPush('tok_apns', true)
    expect(visto.signal).toBeInstanceOf(AbortSignal)
  })

  it('si no contesta, se dice con esas palabras en vez de esperar sin final', async () => {
    // El corte lo levanta el motor: aquí se imita su error, que es lo único que
    // este módulo puede reconocer —`TimeoutError` no trae nada más—.
    const { registrarPush } = await conFetch(async () => {
      const e = new Error('The operation was aborted')
      e.name = 'TimeoutError'
      throw e
    })
    await expect(registrarPush('tok_apns', true)).rejects.toThrow(/no contestó en \d+ s/)
  })

  it('el corte se distingue de un fallo de red, que sube tal cual', async () => {
    const { registrarPush } = await conFetch(async () => { throw new TypeError('Load failed') })
    await expect(registrarPush('tok_apns', true)).rejects.toThrow('Load failed')
  })
})
