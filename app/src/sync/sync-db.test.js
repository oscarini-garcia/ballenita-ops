import { describe, it, expect, beforeEach } from 'vitest'
import {
  db, addExpense, addFamily, colaPendiente, createEvent, exportSnapshot,
  importSnapshot, olvidarTodo, removeExpense, updateExpense, vaciarCola,
} from '../db.js'

// El modelo de sincronización cambió al migrar al Worker: ya no hay merge en el
// cliente ni lápidas, sino una cola de cambios y una instantánea del servidor
// que manda. Lo que se prueba aquí es esa frontera.

beforeEach(async () => {
  await olvidarTodo()
})

describe('cola de cambios', () => {
  it('cada escritura deja en la cola solo lo que cambia', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    const id = await addExpense(eventId, { description: 'Hielo', amountCents: 300 })
    await updateExpense(id, { category: 'bebida' })

    const delGasto = (await colaPendiente()).filter((c) => c.tabla === 'expenses')

    expect(delGasto).toHaveLength(2)
    expect(delGasto[0].op).toBe('upsert')
    expect(delGasto[0].campos.description).toBe('Hielo')
    expect(delGasto[1].campos).toEqual({ category: 'bebida' })
    expect(delGasto[1].campos.description).toBeUndefined()
  })

  it('el dato y su entrada en la cola se escriben juntos', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    const antes = (await colaPendiente()).filter((c) => c.tabla === 'families').length
    const id = await addFamily(eventId, { name: 'García' })

    expect(await db.families.get(id)).toBeTruthy()
    expect((await colaPendiente()).filter((c) => c.tabla === 'families')).toHaveLength(antes + 1)
  })

  // §14.50: cada cosa que se hace deja además su renglón del recap, que sube
  // por la misma cola. Va aquí escrito porque es lo que hace que la cola tenga
  // el doble de entradas que cambios, y eso se descubre a lo tonto.
  it('cada escritura deja también su renglón del recap, por la misma cola', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    await db.outbox.clear()
    await addFamily(eventId, { name: 'García' })

    const cola = await colaPendiente()
    expect(cola.map((c) => c.tabla)).toEqual(['families', 'registro'])
    expect(cola[1].campos.texto).toBe('dio de alta a los García')
  })

  it('borrar encola un cambio y no deja lápida', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    const id = await addExpense(eventId, { description: 'Birras', amountCents: 900 })
    await removeExpense(id)

    expect(await db.expenses.get(id)).toBeUndefined()
    expect((await colaPendiente()).find((c) => c.op === 'borrar')).toMatchObject({ tabla: 'expenses', id })
    expect(db.tables.map((t) => t.name)).not.toContain('tombstones')
  })

  it('vaciarCola descarta hasta la marca subida y conserva el resto', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    await addExpense(eventId, { description: 'Uno', amountCents: 100 })
    const cola = await colaPendiente()
    const corte = cola[cola.length - 1].orden

    await addExpense(eventId, { description: 'Llegó tarde', amountCents: 200 })
    await vaciarCola(corte)

    const quedan = (await colaPendiente()).filter((c) => c.tabla === 'expenses')
    expect(quedan).toHaveLength(1)
    expect(quedan[0].campos.description).toBe('Llegó tarde')
  })
})

describe('instantánea del servidor', () => {
  it('sustituye la copia local: lo que el servidor no manda, deja de existir', async () => {
    const eventId = await createEvent({ name: 'Viejo' })
    await addExpense(eventId, { description: 'Fantasma', amountCents: 100 })
    await vaciarCola((await colaPendiente()).at(-1).orden)

    await importSnapshot({
      v: 1,
      tables: {
        events: [{ id: 'ev_srv', name: 'Ballenita 2026', updatedAt: '2026-08-01T00:00:00.000Z' }],
        expenses: [],
      },
    })

    const events = await db.events.toArray()
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('ev_srv')
    expect(await db.expenses.count()).toBe(0)
  })

  it('aplicar la instantánea no realimenta la cola', async () => {
    await importSnapshot({
      v: 1,
      tables: { events: [{ id: 'ev_srv', name: 'Ballenita', updatedAt: '2026-08-01T00:00:00.000Z' }] },
    })
    expect(await colaPendiente()).toHaveLength(0)
  })

  it('lo encolado durante el vuelo sobrevive a la instantánea', async () => {
    // Un gasto apuntado mientras la petición estaba en camino: el servidor
    // todavía no lo conoce, y aun así tiene que seguir en pantalla al volver.
    const eventId = await createEvent({ name: 'Ballenita' })
    const enVuelo = await addExpense(eventId, { description: 'En vuelo', amountCents: 500 })

    await importSnapshot({ v: 1, tables: { events: [{ id: eventId, name: 'Ballenita' }], expenses: [] } })

    const superviviente = await db.expenses.get(enVuelo)
    expect(superviviente).toBeTruthy()
    expect(superviviente.description).toBe('En vuelo')
  })

  it('un borrado en vuelo no lo resucita la instantánea', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    const id = await addExpense(eventId, { description: 'Se va', amountCents: 100 })
    await vaciarCola((await colaPendiente()).at(-1).orden)
    await removeExpense(id)

    // El servidor todavía lo tiene y su instantánea lo trae de vuelta.
    await importSnapshot({
      v: 1,
      tables: { expenses: [{ id, eventId, description: 'Se va', amountCents: 100 }] },
    })

    expect(await db.expenses.get(id)).toBeUndefined()
  })
})

describe('volcado y olvido', () => {
  it('exportSnapshot recoge todas las tablas sincronizadas', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    await addFamily(eventId, { name: 'García' })
    await addExpense(eventId, { description: 'Hielo', amountCents: 300 })

    const snap = await exportSnapshot()
    expect(snap.v).toBe(1)
    for (const tabla of ['events', 'families', 'bungas', 'persons', 'expenses', 'settlements', 'dishes', 'dinners', 'plans', 'shop']) {
      expect(Array.isArray(snap.tables[tabla])).toBe(true)
    }
    expect(snap.tables.expenses).toHaveLength(1)
    expect(snap.tables.families).toHaveLength(1)
  })

  it('olvidarTodo deja el móvil limpio, datos y cola', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    await addExpense(eventId, { description: 'Hielo', amountCents: 300 })

    await olvidarTodo()

    expect(await db.events.count()).toBe(0)
    expect(await db.expenses.count()).toBe(0)
    expect(await colaPendiente()).toHaveLength(0)
  })
})
