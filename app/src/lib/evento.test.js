import { describe, it, expect } from 'vitest'
import { dentroDeFechas, loQueSeCaeFuera, enPalabras, porDia } from './evento.js'

const FECHAS = { startDate: '2026-08-08', endDate: '2026-08-15' }
const DATOS = {
  dinners: [{ id: 'c1', dia: '2026-08-09' }, { id: 'c2', dia: '2026-08-20' }],
  plans: [{ id: 'p1', dia: '2026-08-07' }, { id: 'p2', dia: '2026-08-10' }, { id: 'p3' }],
  expenses: [{ id: 'g1', dateISO: '2026-08-07T10:00:00.000Z' }, { id: 'g2', dateISO: '2026-08-10' }],
}

describe('dentroDeFechas', () => {
  it('los extremos cuentan como dentro', () => {
    expect(dentroDeFechas('2026-08-08', FECHAS)).toBe(true)
    expect(dentroDeFechas('2026-08-15', FECHAS)).toBe(true)
    expect(dentroDeFechas('2026-08-16', FECHAS)).toBe(false)
  })
  it('sin fecha de inicio no hay nada fuera', () => {
    expect(dentroDeFechas('2026-01-01', {})).toBe(true)
  })
  it('un evento de un solo día vale con `startDate`', () => {
    expect(dentroDeFechas('2026-08-08', { startDate: '2026-08-08' })).toBe(true)
    expect(dentroDeFechas('2026-08-09', { startDate: '2026-08-08' })).toBe(false)
  })
})

describe('loQueSeCaeFuera', () => {
  it('separa cenas, planes y gastos que quedan fuera', () => {
    const fuera = loQueSeCaeFuera(FECHAS, DATOS)
    expect(fuera.cenas.map((c) => c.id)).toEqual(['c2'])
    expect(fuera.planes.map((p) => p.id)).toEqual(['p1'])
    expect(fuera.gastos.map((g) => g.id)).toEqual(['g1'])
  })
  it('un plan sin día todavía no está en el calendario: no se cae', () => {
    expect(loQueSeCaeFuera(FECHAS, DATOS).planes.some((p) => p.id === 'p3')).toBe(false)
  })
  it('sin fechas nuevas no se cae nada', () => {
    const fuera = loQueSeCaeFuera({}, DATOS)
    expect(fuera).toEqual({ cenas: [], planes: [], gastos: [] })
  })
})

describe('enPalabras', () => {
  it('dice qué se lleva, en cristiano', () => {
    expect(enPalabras({ cenas: [1], planes: [1, 2] })).toBe('1 cena y 2 planes')
    expect(enPalabras({ cenas: [1, 2] })).toBe('2 cenas')
    expect(enPalabras({})).toBe('')
  })
})

/**
 * El caso que lo destapó: un viaje que empieza el 15 y una cena del 14 abriendo
 * la lista. Las cenas salían en el orden en que IndexedDB las devolvía —o sea,
 * ninguno— y sin mirar si su día pertenecía al viaje.
 */
describe('porDia', () => {
  const VIAJE = { startDate: '2026-08-15', endDate: '2026-08-22' }

  it('lo de fuera no abre la lista: se va al final', () => {
    const { dentro, fuera } = porDia(
      [{ id: 'c14', dia: '2026-08-14' }, { id: 'c16', dia: '2026-08-16' }],
      VIAJE,
    )
    expect(dentro.map((x) => x.id)).toEqual(['c16'])
    expect(fuera.map((x) => x.id)).toEqual(['c14'])
  })

  it('ordena por día lo que sí es del viaje', () => {
    const { dentro } = porDia(
      [{ id: 'c', dia: '2026-08-20' }, { id: 'a', dia: '2026-08-15' }, { id: 'b', dia: '2026-08-17' }],
      VIAJE,
    )
    expect(dentro.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('lo que no tiene día es de dentro, y va al final', () => {
    // Un plan sin fecha todavía no está en el calendario: no se ha caído de él.
    const { dentro, fuera } = porDia([{ id: 'sin' }, { id: 'con', dia: '2026-08-16' }], VIAJE)
    expect(dentro.map((x) => x.id)).toEqual(['con', 'sin'])
    expect(fuera).toEqual([])
  })

  it('sin fechas en el evento no hay nada fuera', () => {
    const { dentro, fuera } = porDia([{ id: 'a', dia: '2020-01-01' }], {})
    expect(dentro).toHaveLength(1)
    expect(fuera).toEqual([])
  })

  it('los extremos son de dentro', () => {
    const { fuera } = porDia(
      [{ id: 'i', dia: '2026-08-15' }, { id: 'f', dia: '2026-08-22' }],
      VIAJE,
    )
    expect(fuera).toEqual([])
  })

  it('no toca el array que le dan', () => {
    const filas = [{ id: 'b', dia: '2026-08-20' }, { id: 'a', dia: '2026-08-16' }]
    porDia(filas, VIAJE)
    expect(filas.map((x) => x.id)).toEqual(['b', 'a'])
  })
})
