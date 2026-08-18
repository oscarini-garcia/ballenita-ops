import { describe, it, expect } from 'vitest'
import { computeStats } from './stats.js'

describe('computeStats', () => {
  const base = {
    persons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    families: [{ id: 'F1' }, { id: 'F2' }],
    // `b2` se queda sin familia dueña a propósito: es el caso que el balance
    // tiene que saber enseñar con su alias, como el selector del bunga.
    bungas: [{ id: 'b1', name: 'B1', familyId: 'F1' }, { id: 'b2', name: 'B2' }],
    dishes: [{ id: 'd1', name: 'Paella' }, { id: 'd2', name: 'Sandía' }],
    expenses: [
      { amountCents: 3000, category: 'comida', payers: [{ familyId: 'F1', amountCents: 3000 }] },
      { amountCents: 1000, category: 'bebida', payers: [{ familyId: 'F2', amountCents: 1000 }] },
      { amountCents: 2000, category: 'comida', payers: [{ familyId: 'F1', amountCents: 2000 }] },
    ],
    dinners: [
      { platoIds: ['d1', 'd2'], bungaMayoresId: 'b1', bungaNinosId: 'b2' },
      { platoIds: ['d1'], bungaMayoresId: 'b1', bungaNinosId: 'b2' },
    ],
    plans: [
      { estado: 'sehace', votos: { a: '👍', b: '👎' } },
      { estado: 'votando', votos: { b: '👎', c: '👎' } },
    ],
  }

  it('total y media por persona', () => {
    const s = computeStats(base)
    expect(s.totalCents).toBe(6000)
    expect(s.perPersonAvgCents).toBe(2000)
    expect(s.countExpenses).toBe(3)
  })

  it('categoría más cara y familia que más adelanta', () => {
    const s = computeStats(base)
    expect(s.byCategory[0]).toEqual({ category: 'comida', cents: 5000 })
    expect(s.byPayerFamily[0]).toEqual({ familyId: 'F1', cents: 5000 })
  })

  it('plato más repetido', () => {
    const s = computeStats(base)
    expect(s.topDish).toEqual({ id: 'd1', name: 'Paella', count: 2 })
  })

  it('balance de anfitrión por bunga, con su familia dueña', () => {
    const s = computeStats(base)
    const b1 = s.hostBalance.find((h) => h.bungaId === 'b1')
    // La familia viaja con el balance: la pantalla lo enseña como el selector
    // del bunga —la familia manda y el alias es la seña—, y a quién le toca
    // acoger es a una familia.
    expect(b1).toMatchObject({ mayores: 2, ninos: 0, total: 2, familyId: 'F1' })
    expect(s.hostBalance.find((h) => h.bungaId === 'b2').familyId).toBe(null)
  })

  /**
   * Una noche fuera no la acoge nadie (§14.70-bis).
   *
   * Los bungas **no se borran** al marcar «se cena fuera» —se quedan por si se
   * vuelve al camping, como los platos—, así que sin la guarda el balance le
   * apuntaba una noche de anfitrión a quien esa noche estaba en el chiringuito.
   */
  it('una cena fuera no le cuenta de anfitrión a nadie', () => {
    const antes = computeStats(base).hostBalance.find((h) => h.bungaId === 'b1')
    expect(antes.mayores).toBe(2)

    const conFuera = computeStats({
      ...base,
      dinners: base.dinners.map((d, i) => (i === 0 ? { ...d, fuera: 1, donde: 'El chiringuito' } : d)),
    })
    const b1 = conFuera.hostBalance.find((h) => h.bungaId === 'b1')
    expect(b1.mayores).toBe(antes.mayores - 1)
  })

  it('planes y el que más vota no', () => {
    const s = computeStats(base)
    expect(s.plansProposed).toBe(2)
    expect(s.plansConfirmed).toBe(1)
    expect(s.topNoVoter).toEqual({ personId: 'b', count: 2 })
  })

  it('no revienta sin datos', () => {
    const s = computeStats({})
    expect(s.totalCents).toBe(0)
    expect(s.topDish).toBe(null)
    expect(s.topNoVoter).toBe(null)
    expect(s.topDay).toBe(null)
    expect(s.forecastCents).toBe(null)
    expect(s.daysWithPlan).toEqual({ con: 0, total: 0 })
    expect(s.dinnerStreak).toBe(0)
    expect(s.topYesVoter).toBe(null)
    expect(s.topShrugVoter).toBe(null)
  })
})

/** Las fichas de `docs/diseño/numeros.html` (T1–T4, T7, T8). */
describe('computeStats — las fichas de Números', () => {
  const EVENTO = { startDate: '2026-08-08', endDate: '2026-08-15' }

  it('T1: el día más caro agrupa por el día local, no por el de Greenwich', () => {
    // 22:30Z del día 8 es la madrugada del 9 en Madrid (verano, UTC+2): el
    // gasto de la 0:30 cuenta para la noche en la que se pagó, no para ayer.
    const s = computeStats({
      expenses: [
        { amountCents: 1000, dateISO: '2026-08-08T10:00:00.000Z' },
        { amountCents: 2000, dateISO: '2026-08-08T22:30:00.000Z' },
        { amountCents: 500, dateISO: '2026-08-09T10:00:00.000Z' },
      ],
    })
    expect(s.topDay).toEqual({ dia: '2026-08-09', cents: 2500 })
  })

  it('T2: el pronóstico solo existe durante el viaje, y se corrige con los días', () => {
    const gastos = { expenses: [{ amountCents: 23230, dateISO: '2026-08-08T10:00:00.000Z' }] }
    // Primer día: todo lo gastado, por ocho.
    expect(computeStats({ ...gastos, event: EVENTO, hoy: '2026-08-08' }).forecastCents).toBe(185840)
    // A mitad de viaje el susto se ha corregido solo.
    expect(computeStats({ ...gastos, event: EVENTO, hoy: '2026-08-11' }).forecastCents).toBe(46460)
    // Antes y después del viaje no hay pronóstico que valga.
    expect(computeStats({ ...gastos, event: EVENTO, hoy: '2026-08-02' }).forecastCents).toBe(null)
    expect(computeStats({ ...gastos, event: EVENTO, hoy: '2026-08-20' }).forecastCents).toBe(null)
  })

  it('T3: cuenta los días del evento con al menos un plan, sin repetir', () => {
    const s = computeStats({
      event: EVENTO,
      plans: [
        { dia: '2026-08-10' }, { dia: '2026-08-10' }, { dia: '2026-08-12' },
        { dia: null }, { dia: '2026-08-20' },
      ],
    })
    expect(s.daysWithPlan).toEqual({ con: 2, total: 8 })
  })

  it('T4: la racha es la tirada más larga de noches seguidas', () => {
    const s = computeStats({
      dinners: [
        { dia: '2026-08-09' }, { dia: '2026-08-11' }, { dia: '2026-08-12' }, { dia: '2026-08-13' },
      ],
    })
    expect(s.dinnerStreak).toBe(3)
  })

  it('T7 y T8: los retratos del pique dicen los empates', () => {
    const s = computeStats({
      plans: [
        { votos: { curro: '👍', ana: '👍', pablo: '🤷' } },
        { votos: { curro: '👍', ana: '🤷' } },
      ],
    })
    expect(s.topYesVoter).toEqual({ count: 2, personIds: ['curro'] })
    expect(s.topShrugVoter).toEqual({ count: 1, personIds: ['pablo', 'ana'] })
  })
})
