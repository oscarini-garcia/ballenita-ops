import { describe, it, expect } from 'vitest'
import { mergeCollection, mergeEventDoc, unionTombstones } from './merge.js'

describe('mergeCollection — LWW + tombstones', () => {
  it('une por id sin duplicar', () => {
    const local = [{ id: 'a', updatedAt: '1' }]
    const remote = [{ id: 'b', updatedAt: '1' }]
    expect(mergeCollection(local, remote)).toHaveLength(2)
  })

  it('gana el updatedAt más reciente en colisión', () => {
    const local = [{ id: 'a', v: 'viejo', updatedAt: '2026-01-01' }]
    const remote = [{ id: 'a', v: 'nuevo', updatedAt: '2026-06-01' }]
    expect(mergeCollection(local, remote)[0].v).toBe('nuevo')
  })

  it('un tombstone borra el ítem…', () => {
    const merged = mergeCollection(
      [{ id: 'a', updatedAt: '2026-01-01' }],
      [],
      [{ id: 'a', ts: '2026-02-01' }],
    )
    expect(merged).toHaveLength(0)
  })

  it('…pero una edición posterior al borrado lo revive', () => {
    const merged = mergeCollection(
      [{ id: 'a', updatedAt: '2026-03-01' }],
      [],
      [{ id: 'a', ts: '2026-02-01' }],
    )
    expect(merged).toHaveLength(1)
  })
})

describe('mergeEventDoc — dos dispositivos que sincronizan', () => {
  it('convergen al mismo conjunto de gastos', () => {
    const base = { id: 'ev1', tombstones: {}, expenses: [] }
    const deviceA = {
      ...base,
      expenses: [{ id: 'g1', amountCents: 1000, updatedAt: '1' }],
    }
    const deviceB = {
      ...base,
      expenses: [{ id: 'g2', amountCents: 2000, updatedAt: '1' }],
    }
    const merged = mergeEventDoc(deviceA, deviceB)
    expect(merged.expenses.map((e) => e.id).sort()).toEqual(['g1', 'g2'])
  })

  it('el merge es conmutativo para inserciones (A∪B == B∪A)', () => {
    const A = { id: 'ev', tombstones: {}, expenses: [{ id: 'x', updatedAt: '1' }] }
    const B = { id: 'ev', tombstones: {}, expenses: [{ id: 'y', updatedAt: '1' }] }
    const ab = mergeEventDoc(A, B).expenses.map((e) => e.id).sort()
    const ba = mergeEventDoc(B, A).expenses.map((e) => e.id).sort()
    expect(ab).toEqual(ba)
  })
})

describe('unionTombstones', () => {
  it('conserva el ts más reciente por id', () => {
    const u = unionTombstones([{ id: 'a', ts: '1' }], [{ id: 'a', ts: '5' }])
    expect(u).toEqual([{ id: 'a', ts: '5' }])
  })
})
