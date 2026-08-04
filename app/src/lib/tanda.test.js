import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../sync/api.js', () => ({
  hayApi: vi.fn(async () => true),
  traerRecados: vi.fn(async () => ({ recados: [{ emoji: '🍉', texto: 'Sandía.' }], generadoEn: null })),
}))

import { hayApi, traerRecados } from '../sync/api.js'
import { VENTANA_MS, asegurarTanda, leerTanda, olvidarTandas, tocaPedir } from './tanda.js'

const T0 = Date.parse('2026-08-04T12:00:00.000Z')

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  hayApi.mockResolvedValue(true)
  traerRecados.mockResolvedValue({ recados: [{ emoji: '🍉', texto: 'Sandía.' }], generadoEn: null })
})
afterEach(() => localStorage.clear())

describe('tocaPedir', () => {
  it('sin haber pedido nunca, toca', () => {
    expect(tocaPedir(0, T0)).toBe(true)
    expect(tocaPedir(undefined, T0)).toBe(true)
  })

  it('dentro de las dos horas no, y justo al cumplirlas sí', () => {
    expect(tocaPedir(T0 - VENTANA_MS + 1000, T0)).toBe(false)
    expect(tocaPedir(T0 - VENTANA_MS, T0)).toBe(true)
  })
})

describe('asegurarTanda', () => {
  it('la primera vez pide y guarda', async () => {
    const tanda = await asegurarTanda('ev1', { ahora: T0 })
    expect(traerRecados).toHaveBeenCalledOnce()
    expect(tanda.recados).toHaveLength(1)
    expect(leerTanda('ev1').recados[0].texto).toBe('Sandía.')
  })

  // El motivo de que la ventana esté también aquí y no solo en el Worker: sin
  // esto, cada latido de cinco minutos sería una petición.
  it('dentro de la ventana no vuelve a preguntar', async () => {
    await asegurarTanda('ev1', { ahora: T0 })
    await asegurarTanda('ev1', { ahora: T0 + 60_000 })
    await asegurarTanda('ev1', { ahora: T0 + VENTANA_MS - 1 })
    expect(traerRecados).toHaveBeenCalledOnce()
  })

  it('pasadas las dos horas vuelve a pedir', async () => {
    await asegurarTanda('ev1', { ahora: T0 })
    traerRecados.mockResolvedValue({ recados: [{ emoji: '🧊', texto: 'Sin hielo.' }], generadoEn: null })
    const tanda = await asegurarTanda('ev1', { ahora: T0 + VENTANA_MS })
    expect(traerRecados).toHaveBeenCalledTimes(2)
    expect(tanda.recados[0].texto).toBe('Sin hielo.')
  })

  // Sin apuntar la hora, una instalación sin clave de IA preguntaría cada cinco
  // minutos para siempre. Vacío es una respuesta.
  it('una respuesta vacía también cuenta como haber preguntado', async () => {
    traerRecados.mockResolvedValue({ recados: [], generadoEn: null })
    await asegurarTanda('ev1', { ahora: T0 })
    await asegurarTanda('ev1', { ahora: T0 + 60_000 })
    expect(traerRecados).toHaveBeenCalledOnce()
  })

  it('una respuesta vacía no borra la tanda de antes', async () => {
    await asegurarTanda('ev1', { ahora: T0 })
    traerRecados.mockResolvedValue({ recados: [], generadoEn: null })
    const tanda = await asegurarTanda('ev1', { ahora: T0 + VENTANA_MS })
    expect(tanda.recados[0].texto).toBe('Sandía.')
  })

  it('si la petición falla se sigue con lo que hubiera, sin reventar', async () => {
    await asegurarTanda('ev1', { ahora: T0 })
    traerRecados.mockRejectedValue(new Error('sin red'))
    const tanda = await asegurarTanda('ev1', { ahora: T0 + VENTANA_MS })
    expect(tanda.recados[0].texto).toBe('Sandía.')
  })

  it('sin API no se pregunta nada: en la web esto no existe', async () => {
    hayApi.mockResolvedValue(false)
    const tanda = await asegurarTanda('ev1', { ahora: T0 })
    expect(traerRecados).not.toHaveBeenCalled()
    expect(tanda.recados).toEqual([])
  })

  it('cada evento tiene la suya', async () => {
    await asegurarTanda('ev1', { ahora: T0 })
    traerRecados.mockResolvedValue({ recados: [{ emoji: '🐳', texto: 'Otra.' }], generadoEn: null })
    await asegurarTanda('ev2', { ahora: T0 })
    expect(leerTanda('ev1').recados[0].texto).toBe('Sandía.')
    expect(leerTanda('ev2').recados[0].texto).toBe('Otra.')
  })

  it('sin evento no hace nada', async () => {
    expect((await asegurarTanda(null)).recados).toEqual([])
    expect(traerRecados).not.toHaveBeenCalled()
  })
})

describe('leerTanda', () => {
  it('con la basura de otro sitio devuelve vacío en vez de reventar', () => {
    localStorage.setItem('ballena.recados.ev1', 'esto no es JSON')
    expect(leerTanda('ev1')).toEqual({ recados: [], pedidaEn: 0 })
    localStorage.setItem('ballena.recados.ev1', '{"recados":"no es una lista"}')
    expect(leerTanda('ev1').recados).toEqual([])
  })
})

describe('olvidarTandas', () => {
  it('se lleva las de todos los eventos y no toca lo demás', async () => {
    await asegurarTanda('ev1', { ahora: T0 })
    await asegurarTanda('ev2', { ahora: T0 })
    localStorage.setItem('ballena.activeEventId', 'ev1')

    olvidarTandas()

    expect(leerTanda('ev1').recados).toEqual([])
    expect(leerTanda('ev2').recados).toEqual([])
    expect(localStorage.getItem('ballena.activeEventId')).toBe('ev1')
  })
})
