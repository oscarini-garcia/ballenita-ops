import { describe, it, expect } from 'vitest'
import {
  splitCents,
  computeFamilyBalances,
  simplifyDebts,
} from './reparto.js'

describe('splitCents — reparto del sobrante', () => {
  it('reparte 10€ entre 3 sin perder céntimos (3,34 / 3,33 / 3,33)', () => {
    const s = splitCents(1000, [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
      { id: 'c', weight: 1 },
    ])
    expect(s.get('a') + s.get('b') + s.get('c')).toBe(1000)
    const vals = [...s.values()].sort((x, y) => y - x)
    expect(vals).toEqual([334, 333, 333])
  })

  it('respeta pesos fraccionarios (niño 0,5)', () => {
    // 110€ entre García(2,5) Pérez(2) Solteros(1) = 5,5 → cuota 20€/peso
    const s = splitCents(11000, [
      { id: 'garcia', weight: 2.5 },
      { id: 'perez', weight: 2 },
      { id: 'solteros', weight: 1 },
    ])
    expect(s.get('garcia')).toBe(5000)
    expect(s.get('perez')).toBe(4000)
    expect(s.get('solteros')).toBe(2000)
  })

  it('nunca pierde ni inventa céntimos (propiedad)', () => {
    for (const total of [1, 7, 99, 100, 1234, 99999]) {
      const s = splitCents(total, [
        { id: 'a', weight: 1 },
        { id: 'b', weight: 0.5 },
        { id: 'c', weight: 2 },
      ])
      const sum = [...s.values()].reduce((x, y) => x + y, 0)
      expect(sum).toBe(total)
    }
  })
})

describe('computeFamilyBalances — ejemplo del spec (§14.7)', () => {
  const personsById = {
    g1: { familyId: 'garcia', pesoReparto: 1 },
    g2: { familyId: 'garcia', pesoReparto: 1 },
    g3: { familyId: 'garcia', pesoReparto: 0.5 }, // niño
    p1: { familyId: 'perez', pesoReparto: 1 },
    p2: { familyId: 'perez', pesoReparto: 1 },
    s1: { familyId: 'solteros', pesoReparto: 1 },
  }

  it('gasto de 110€ pagado por Pérez, split por persona', () => {
    const expenses = [
      {
        amountCents: 11000,
        payers: [{ familyId: 'perez', amountCents: 11000 }],
        participantIds: ['g1', 'g2', 'g3', 'p1', 'p2', 's1'],
      },
    ]
    const bal = computeFamilyBalances(expenses, [], personsById)
    expect(bal.get('garcia')).toBe(-5000)
    expect(bal.get('perez')).toBe(7000)
    expect(bal.get('solteros')).toBe(-2000)
    // los saldos siempre suman cero
    expect([...bal.values()].reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('simplifica a García→Pérez 50 y Solteros→Pérez 20', () => {
    const expenses = [
      {
        amountCents: 11000,
        payers: [{ familyId: 'perez', amountCents: 11000 }],
        participantIds: ['g1', 'g2', 'g3', 'p1', 'p2', 's1'],
      },
    ]
    const bal = computeFamilyBalances(expenses, [], personsById)
    const t = simplifyDebts(bal)
    expect(t).toContainEqual({ fromFamilyId: 'garcia', toFamilyId: 'perez', amountCents: 5000 })
    expect(t).toContainEqual({ fromFamilyId: 'solteros', toFamilyId: 'perez', amountCents: 2000 })
    expect(t).toHaveLength(2)
  })

  it('una liquidación apuntada reduce el saldo', () => {
    const expenses = [
      {
        amountCents: 11000,
        payers: [{ familyId: 'perez', amountCents: 11000 }],
        participantIds: ['g1', 'g2', 'g3', 'p1', 'p2', 's1'],
      },
    ]
    const settlements = [{ fromFamilyId: 'garcia', toFamilyId: 'perez', amountCents: 5000 }]
    const bal = computeFamilyBalances(expenses, settlements, personsById)
    expect(bal.get('garcia')).toBe(0)
    expect(bal.get('perez')).toBe(2000)
    expect(bal.get('solteros')).toBe(-2000)
  })
})

describe('simplifyDebts', () => {
  it('devuelve vacío si todo está saldado', () => {
    expect(simplifyDebts(new Map([['a', 0], ['b', 0]]))).toEqual([])
  })
  it('minimiza transferencias en un caso a tres bandas', () => {
    // a debe 30, b debe 20, c le deben 50
    const t = simplifyDebts(new Map([['a', -3000], ['b', -2000], ['c', 5000]]))
    expect(t).toHaveLength(2)
    expect(t.every((x) => x.toFamilyId === 'c')).toBe(true)
    expect(t.reduce((s, x) => s + x.amountCents, 0)).toBe(5000)
  })
})
