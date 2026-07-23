import { describe, it, expect } from 'vitest'
import { mergeSnapshots, differs } from './merge-snapshot.js'

const snap = (over = {}) => ({ v: 1, tables: { expenses: [], persons: [] }, tombstones: [], ...over })

describe('mergeSnapshots', () => {
  it('une gastos de dos dispositivos', () => {
    const a = snap({ tables: { expenses: [{ id: 'g1', updatedAt: '1' }], persons: [] } })
    const b = snap({ tables: { expenses: [{ id: 'g2', updatedAt: '1' }], persons: [] } })
    const m = mergeSnapshots(a, b)
    expect(m.tables.expenses.map((e) => e.id).sort()).toEqual(['g1', 'g2'])
  })

  it('gana el updatedAt más reciente en colisión', () => {
    const a = snap({ tables: { expenses: [{ id: 'g1', v: 'viejo', updatedAt: '2026-01-01' }], persons: [] } })
    const b = snap({ tables: { expenses: [{ id: 'g1', v: 'nuevo', updatedAt: '2026-06-01' }], persons: [] } })
    expect(mergeSnapshots(a, b).tables.expenses[0].v).toBe('nuevo')
  })

  it('un tombstone remoto borra el gasto local', () => {
    const a = snap({ tables: { expenses: [{ id: 'g1', updatedAt: '2026-01-01' }], persons: [] } })
    const b = snap({ tombstones: [{ key: 'expenses:g1', table: 'expenses', rowId: 'g1', ts: '2026-02-01' }] })
    const m = mergeSnapshots(a, b)
    expect(m.tables.expenses).toHaveLength(0)
    expect(m.tombstones).toHaveLength(1)
  })

  it('una edición posterior al borrado revive el gasto', () => {
    const a = snap({ tables: { expenses: [{ id: 'g1', updatedAt: '2026-03-01' }], persons: [] } })
    const b = snap({ tombstones: [{ key: 'expenses:g1', table: 'expenses', rowId: 'g1', ts: '2026-02-01' }] })
    expect(mergeSnapshots(a, b).tables.expenses).toHaveLength(1)
  })

  it('es conmutativo para inserciones (A∪B == B∪A)', () => {
    const a = snap({ tables: { expenses: [{ id: 'x', updatedAt: '1' }], persons: [] } })
    const b = snap({ tables: { expenses: [{ id: 'y', updatedAt: '1' }], persons: [] } })
    const ab = mergeSnapshots(a, b).tables.expenses.map((e) => e.id).sort()
    const ba = mergeSnapshots(b, a).tables.expenses.map((e) => e.id).sort()
    expect(ab).toEqual(ba)
  })

  it('differs detecta cambios', () => {
    const a = snap({ tables: { expenses: [{ id: 'g1', updatedAt: '1' }], persons: [] } })
    const b = snap()
    expect(differs(a, b)).toBe(true)
    expect(differs(a, a)).toBe(false)
  })
})
