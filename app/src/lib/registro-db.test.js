import { describe, it, expect, beforeEach } from 'vitest'
import {
  db, createEvent, addExpense, updateExpense, removeExpense, addShopItem, updateShopItem,
  addFamily, olvidarTodo, registroDe, importSnapshot, cuantosPendientes, colaPendiente,
} from '../db.js'
import { setMeId } from './identidad.js'

// El registro escrito de verdad (SPECS §14.50): lo que `escribir()` y
// `removeRow()` dejan al pasar, dentro de su misma transacción.

beforeEach(async () => {
  await olvidarTodo()
  localStorage.clear()
})

describe('cada cosa que se hace deja su renglón', () => {
  it('apuntar un gasto lo apunta, con quién y cuándo', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    setMeId(eventId, 'p1')
    await addExpense(eventId, { description: 'Hielo y birras', amountCents: 2430 })

    const [reg] = await registroDe(eventId)
    expect(reg).toMatchObject({
      eventId, personId: 'p1', tabla: 'expenses', accion: 'crear',
      clase: 'gasto', texto: 'apuntó «Hielo y birras»',
    })
    expect(reg.cuando).toBeTruthy()
  })

  it('borrar dice qué se fue, porque la fila se lee antes del borrado', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    const id = await addExpense(eventId, { description: 'Gasolina', amountCents: 6000 })
    await removeExpense(id)

    expect((await registroDe(eventId)).map((r) => r.texto))
      .toContain('borró «Gasolina»')
  })

  it('lo que no merece renglón no lo deja', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    const id = await addShopItem(eventId, { texto: 'Hielos' })
    const antes = (await registroDe(eventId)).length

    // Rehacer una cantidad al cambiar una cena toca todas las líneas de golpe.
    await updateShopItem(id, { cantidad: 4 })
    expect(await registroDe(eventId)).toHaveLength(antes)

    // Marcarla sí: es el gesto de la compra.
    await updateShopItem(id, { comprado: true })
    expect((await registroDe(eventId))[0].texto).toBe('tachó «Hielos»')
  })
})

describe('lo mismo repetido es una vez', () => {
  it('corregir un gasto cuatro veces seguidas deja un renglón, no cuatro', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    setMeId(eventId, 'p1')
    const id = await addExpense(eventId, { description: 'Cena', amountCents: 1000 })

    await updateExpense(id, { amountCents: 2000 })
    await updateExpense(id, { amountCents: 3000 })
    await updateExpense(id, { description: 'Cena del sábado' })

    const ediciones = (await registroDe(eventId)).filter((r) => r.accion === 'editar')
    expect(ediciones).toHaveLength(1)
    // Y el renglón que queda cuenta lo último, no lo primero.
    expect(ediciones[0].texto).toBe('retocó «Cena del sábado»')
  })

  it('pero crear y editar son dos cosas, y no se juntan', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    const id = await addExpense(eventId, { description: 'Cena', amountCents: 1000 })
    await updateExpense(id, { amountCents: 2000 })

    expect((await registroDe(eventId)).map((r) => r.accion).sort()).toEqual(['crear', 'editar'])
  })

  it('y dos personas distintas sobre la misma fila son dos renglones', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    setMeId(eventId, 'p1')
    const id = await addExpense(eventId, { description: 'Cena', amountCents: 1000 })
    await updateExpense(id, { amountCents: 2000 })
    setMeId(eventId, 'p2')
    await updateExpense(id, { amountCents: 3000 })

    const ediciones = (await registroDe(eventId)).filter((r) => r.accion === 'editar')
    expect(ediciones.map((r) => r.personId).sort()).toEqual(['p1', 'p2'])
  })
})

describe('el registro y la cola', () => {
  it('sube por la cola, como cualquier otro hecho', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    await db.outbox.clear()
    await addFamily(eventId, { name: 'García' })

    const delRegistro = (await colaPendiente()).filter((c) => c.tabla === 'registro')
    expect(delRegistro).toHaveLength(1)
    expect(delRegistro[0].campos.texto).toBe('dio de alta a los García')
  })

  it('pero no cuenta como «cambio sin subir»', async () => {
    // El número del punto de la cabecera existe para decidir si esperar a tener
    // cobertura (§14.9-quinquies). Si cada gasto contara dos, mentiría el doble.
    const eventId = await createEvent({ name: 'Ballenita' })
    await db.outbox.clear()
    await addFamily(eventId, { name: 'García' })

    expect(await cuantosPendientes()).toBe(1)
    expect((await colaPendiente()).length).toBe(2)
  })

  it('lo que llega del servidor no se vuelve a apuntar', async () => {
    // El renglón lo escribió el móvil donde se hizo y viaja en la instantánea:
    // apuntarlo otra vez al recibirlo multiplicaría cada hecho por los
    // teléfonos que hay en el grupo.
    const eventId = await createEvent({ name: 'Ballenita' })
    await importSnapshot({
      tables: {
        events: [{ id: eventId, name: 'Ballenita', updatedAt: '2026-08-15T10:00:00.000Z' }],
        expenses: [{ id: 'e1', eventId, description: 'De otro móvil', amountCents: 500, updatedAt: '2026-08-15T10:00:00.000Z' }],
        registro: [],
      },
    })

    expect(await registroDe(eventId)).toHaveLength(0)
  })
})
