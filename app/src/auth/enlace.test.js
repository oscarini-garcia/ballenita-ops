import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { canjearEnlace, limpiarLaUrl, paseDeLaUrl, urlDeEnlace } from './enlace.js'

const CONFIG = { api: 'https://ejemplo.workers.dev', web: 'https://ballenita-ops.ejemplo' }

const contesta = (cuerpo, ok = true, status = 200) => {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok, status, json: async () => cuerpo })
}

beforeEach(() => { delete globalThis.fetch })
afterEach(() => { delete globalThis.fetch })

describe('el pase que trae la URL', () => {
  it('sale del fragmento', () => {
    expect(paseDeLaUrl('https://ballenita.ejemplo/#pase=abc.def.ghi')).toBe('abc.def.ghi')
  })

  it('convive con otras cosas en el mismo fragmento', () => {
    expect(paseDeLaUrl('https://ballenita.ejemplo/#algo=1&pase=abc')).toBe('abc')
  })

  it('sin fragmento no hay pase', () => {
    expect(paseDeLaUrl('https://ballenita.ejemplo/')).toBe(null)
    expect(paseDeLaUrl('')).toBe(null)
  })

  // El fragmento no viaja al servidor, y esa es la mitad de la razón de que el
  // pase vaya ahí. Uno en la consulta no se lee: si apareciera, es que lo puso
  // algo que no somos nosotros.
  it('en la consulta no cuenta', () => {
    expect(paseDeLaUrl('https://ballenita.ejemplo/?pase=abc')).toBe(null)
  })
})

describe('la dirección que se manda', () => {
  it('sale de `config.json`, porque quien la genera está dentro de la app', () => {
    expect(urlDeEnlace(CONFIG, 'abc.def')).toBe('https://ballenita-ops.ejemplo/#pase=abc.def')
  })

  it('no dobla la barra si la base ya la trae', () => {
    expect(urlDeEnlace({ web: 'https://ballenita-ops.ejemplo/' }, 'abc')).toBe('https://ballenita-ops.ejemplo/#pase=abc')
  })

  it('sin `web` configurada cae al origen propio, que es el bueno en el navegador', () => {
    expect(urlDeEnlace({}, 'abc')).toBe(`${globalThis.location.origin}/#pase=abc`)
  })
})

describe('canjear el pase', () => {
  it('devuelve la sesión que contesta el servidor', async () => {
    contesta({ estado: 'dentro', token: 'jwt', cuenta: { id: 'cta_1' } })
    const r = await canjearEnlace(CONFIG, 'abc')
    expect(r).toEqual({ estado: 'dentro', token: 'jwt', cuenta: { id: 'cta_1' } })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ejemplo.workers.dev/api/sesion/enlace',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  // Los tres finales que no son entrar llegan tal cual: se arreglan en sitios
  // distintos y por eso no se juntan en un «no se pudo».
  it('un enlace ya usado se dice con esas palabras', async () => {
    contesta({ estado: 'usado', mensaje: 'Este enlace ya se ha usado.' }, false, 401)
    expect(await canjearEnlace(CONFIG, 'abc')).toEqual({
      estado: 'usado', mensaje: 'Este enlace ya se ha usado.',
    })
  })

  it('un fallo de red es «sin respuesta», que es el único que se reintenta', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await canjearEnlace(CONFIG, 'abc')).toEqual({ estado: 'sin-respuesta' })
  })

  it('una respuesta que no dice nada tampoco se toma por buena', async () => {
    contesta({ vaya: 'cosa' })
    expect(await canjearEnlace(CONFIG, 'abc')).toEqual({ estado: 'sin-respuesta' })
  })

  it('sin API configurada no se pregunta nada', async () => {
    expect(await canjearEnlace({}, 'abc')).toEqual({ estado: 'sin-respuesta' })
    expect(globalThis.fetch).toBeUndefined()
  })
})

describe('limpiar la URL', () => {
  it('quita el fragmento sin dejar entrada en el historial', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    limpiarLaUrl()
    expect(replaceState).toHaveBeenCalledWith(
      null, '', `${window.location.origin}${window.location.pathname}${window.location.search}`,
    )
    replaceState.mockRestore()
  })
})
