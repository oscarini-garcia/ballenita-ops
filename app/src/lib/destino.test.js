import { describe, it, expect, beforeEach } from 'vitest'
import {
  destinoDeAviso, guardarDestino, hayDestino, leerDestino, tomarDestino,
} from './destino.js'

describe('a dónde lleva tocar un aviso (§14.60)', () => {
  beforeEach(() => { tomarDestino() })

  it('lee los tres niveles: pestaña, área y fila', () => {
    expect(leerDestino('dinero/gastos/exp_9f2')).toEqual({
      tab: 'dinero', area: 'gastos', fila: 'exp_9f2',
    })
  })

  it('los avisos viejos mandan solo la pestaña y siguen valiendo', () => {
    // `ir: 'dinero'` es lo que lleva mandando el Worker desde que existen los
    // avisos; romperlo sería romper los que ya están en la pantalla de bloqueo.
    expect(leerDestino('dinero')).toEqual({ tab: 'dinero', area: null, fila: null })
    expect(leerDestino('ajustes/cuentas')).toEqual({ tab: 'ajustes', area: 'cuentas', fila: null })
  })

  it('«hoy» no es una pestaña pero es el destino de siempre', () => {
    expect(leerDestino('hoy')).toEqual({ tab: 'agenda', area: 'hoy', fila: null })
  })

  it('un día lleva barras y no se pierde por el camino', () => {
    expect(leerDestino('agenda/dias/2026-08-15')).toEqual({
      tab: 'agenda', area: 'dias', fila: '2026-08-15',
    })
  })

  it('lo que no se reconoce lleva a Hoy: mejor la portada que una pantalla vacía', () => {
    expect(leerDestino('pestaña-inventada/x')).toEqual({ tab: 'agenda', area: 'hoy', fila: null })
    expect(leerDestino('')).toBe(null)
    expect(leerDestino(null)).toBe(null)
  })

  it('el destino espera a que la app esté lista, y se consume una sola vez', () => {
    // Con la app cerrada el toque llega antes de que haya nada montado (R4).
    guardarDestino({ tab: 'planes', area: 'planes', fila: 'p1' })
    expect(hayDestino()).toBe(true)
    expect(tomarDestino()).toEqual({ tab: 'planes', area: 'planes', fila: 'p1' })
    // Y no se navega dos veces.
    expect(tomarDestino()).toBe(null)
    expect(hayDestino()).toBe(false)
  })

  it('el sobre trae el evento además de la pantalla', () => {
    expect(destinoDeAviso({ ir: 'planes/planes/p1', evento: 'ev_7' })).toEqual({
      tab: 'planes', area: 'planes', fila: 'p1', eventId: 'ev_7',
    })
  })

  it('sin evento se navega igual: es el caso de los avisos de antes', () => {
    expect(destinoDeAviso({ ir: 'dinero' })).toEqual({
      tab: 'dinero', area: null, fila: null, eventId: null,
    })
  })

  it('un sobre sin nada dentro no manda a ninguna parte', () => {
    expect(destinoDeAviso(null)).toBe(null)
    expect(destinoDeAviso({})).toBe(null)
    expect(destinoDeAviso('no soy un objeto')).toBe(null)
  })
})
