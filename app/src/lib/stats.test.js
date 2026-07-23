import { describe, it, expect } from 'vitest'
import { computeStats } from './stats.js'

describe('computeStats', () => {
  const base = {
    persons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    families: [{ id: 'F1' }, { id: 'F2' }],
    bungas: [{ id: 'b1', name: 'B1' }, { id: 'b2', name: 'B2' }],
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
      { estado: 'confirmado', votos: { a: '👍', b: '👎' } },
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

  it('balance de anfitrión por bunga', () => {
    const s = computeStats(base)
    const b1 = s.hostBalance.find((h) => h.bungaId === 'b1')
    expect(b1).toMatchObject({ mayores: 2, ninos: 0, total: 2 })
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
  })
})
