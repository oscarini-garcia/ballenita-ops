import { describe, it, expect } from 'vitest'
import { dentroDeFechas, loQueSeCaeFuera, enPalabras } from './evento.js'

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
