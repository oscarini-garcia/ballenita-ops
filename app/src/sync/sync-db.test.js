import { describe, it, expect } from 'vitest'
import { db, createEvent, addExpense, addFamily, removeExpense, exportSnapshot, importSnapshot, expensesOf } from '../db.js'
import { mergeSnapshots } from './merge-snapshot.js'

describe('sync sobre la base de datos real', () => {
  it('exportSnapshot recoge todas las tablas', async () => {
    const ev = await createEvent({ name: 'E', currency: 'EUR' })
    await addFamily(ev, { name: 'A' })
    const snap = await exportSnapshot()
    expect(snap.tables.events.length).toBe(1)
    expect(snap.tables.families.length).toBe(1)
  })

  it('borrar deja un tombstone', async () => {
    const ev = await createEvent({ name: 'E', currency: 'EUR' })
    const gid = await addExpense(ev, { description: 'x', amountCents: 100, category: 'varios', dateISO: 'd', payers: [], participantIds: [] })
    await removeExpense(gid)
    const t = await db.tombstones.get(`expenses:${gid}`)
    expect(t).toMatchObject({ table: 'expenses', rowId: gid })
    expect(await db.expenses.get(gid)).toBeUndefined()
  })

  it('importar un snapshot remoto añade lo nuevo y aplica borrados', async () => {
    const ev = await createEvent({ name: 'E', currency: 'EUR' })
    const g1 = await addExpense(ev, { description: 'local', amountCents: 100, category: 'varios', dateISO: '2026-01-01', payers: [], participantIds: [] })

    // Snapshot "remoto": trae un gasto nuevo g2 y un tombstone que borra g1.
    const remote = {
      v: 1,
      tables: { expenses: [{ id: 'g2', eventId: ev, description: 'remoto', amountCents: 200, updatedAt: '2026-05-01' }] },
      tombstones: [{ key: `expenses:${g1}`, table: 'expenses', rowId: g1, ts: '2026-06-01' }],
    }
    const merged = mergeSnapshots(await exportSnapshot(), remote)
    await importSnapshot(merged)

    const ids = (await expensesOf(ev)).map((e) => e.id)
    expect(ids).toContain('g2')
    expect(ids).not.toContain(g1) // borrado por el tombstone remoto
  })
})
