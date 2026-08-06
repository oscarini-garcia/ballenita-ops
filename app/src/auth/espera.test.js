import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { guardarEspera, leerEspera, olvidarEspera, preguntarSiYaEntro } from './espera.js'

const CONFIG = { api: 'https://ejemplo.workers.dev' }

beforeEach(() => localStorage.clear())
afterEach(() => { delete globalThis.fetch })

describe('la sala de espera guardada', () => {
  it('se recuerda entre arranques', () => {
    guardarEspera({ nombre: 'Ana Doral', pase: 'p.a.se' })
    expect(leerEspera()).toEqual({ nombre: 'Ana Doral', pase: 'p.a.se' })
  })

  it('se olvida cuando ya no hace falta', () => {
    guardarEspera({ nombre: 'Ana', pase: 'p.a.se' })
    olvidarEspera()
    expect(leerEspera()).toBe(null)
  })

  // Lo que se recuerda no es «lo intenté» sino «puedo volver a preguntar»: un
  // servidor viejo no manda pase, y entonces no hay nada que guardar.
  it('sin pase no se guarda nada', () => {
    expect(guardarEspera({ nombre: 'Ana' })).toBe(null)
    expect(leerEspera()).toBe(null)
  })

  it('una espera a medias en el almacenamiento se lee como si no hubiera', () => {
    localStorage.setItem('ballena.espera', '{ esto no es json')
    expect(leerEspera()).toBe(null)
  })
})

describe('preguntarSiYaEntro', () => {
  it('le pregunta al Worker con el pase', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ estado: 'espera' }) })

    expect(await preguntarSiYaEntro(CONFIG, 'p.a.se')).toEqual({ estado: 'espera' })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ejemplo.workers.dev/api/sesion/espera',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ pase: 'p.a.se' }) }),
    )
  })

  it('devuelve la sesión tal cual cuando ya te han enlazado', async () => {
    const dentro = { estado: 'dentro', token: 'jwt', cuenta: { id: 'cta_1' } }
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => dentro })

    expect(await preguntarSiYaEntro(CONFIG, 'p.a.se')).toEqual(dentro)
  })

  // Un pase que el servidor ya no acepta no se arregla reintentando: hay que
  // volver a la puerta, que es donde se consigue uno nuevo.
  it('un pase que ya no vale se cuenta como solicitud desconocida', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
    expect(await preguntarSiYaEntro(CONFIG, 'viejo')).toEqual({ estado: 'desconocida' })
  })

  // Esto se llama solo cada veinte segundos: una sala de espera que se llena de
  // errores rojos porque el ascensor tiene mala cobertura miente sobre lo que
  // está pasando.
  it('un fallo de red no lanza, dice que no hubo respuesta', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('sin red'))
    expect(await preguntarSiYaEntro(CONFIG, 'p.a.se')).toEqual({ estado: 'sin-respuesta' })
  })

  it('un 500 tampoco saca a nadie de la sala', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    expect(await preguntarSiYaEntro(CONFIG, 'p.a.se')).toEqual({ estado: 'sin-respuesta' })
  })

  it('sin API o sin pase no se llama a nadie', async () => {
    globalThis.fetch = vi.fn()
    expect(await preguntarSiYaEntro({}, 'p.a.se')).toEqual({ estado: 'sin-respuesta' })
    expect(await preguntarSiYaEntro(CONFIG, null)).toEqual({ estado: 'sin-respuesta' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
