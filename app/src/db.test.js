import { describe, it, expect } from 'vitest'
import {
  createEvent, addFamily, addPerson, addExpense,
  expensesOf, personsOf, familiesOf,
  addSettlement, settlementsOf,
  seedExample, listEvents, dinnersOf, plansOf, listDishes, bungasOf,
  addShopItem, shopItemsOf, updateShopItem, removeShopItem, clearBoughtShopItems,
} from './db.js'
import { computeFamilyBalances, simplifyDebts } from './lib/reparto.js'

// Helper: replica lo que hace la pantalla de Saldos, pero desde la DB.
async function balancesFor(eventId) {
  const [expenses, persons, settlements] = await Promise.all([
    expensesOf(eventId), personsOf(eventId), settlementsOf(eventId),
  ])
  const personsById = Object.fromEntries(persons.map((p) => [p.id, p]))
  return computeFamilyBalances(expenses, settlements, personsById)
}

describe('DB — CRUD básico', () => {
  it('crea un evento y lo lista', async () => {
    const id = await createEvent({ name: 'Test', currency: 'EUR' })
    const events = await listEvents()
    expect(events.map((e) => e.id)).toContain(id)
  })

  it('estampa updatedAt en cada registro (para el merge)', async () => {
    const ev = await createEvent({ name: 'X', currency: 'EUR' })
    const fam = await addFamily(ev, { name: 'A' })
    const [f] = await familiesOf(ev)
    expect(f.id).toBe(fam)
    expect(typeof f.updatedAt).toBe('string')
  })
})

describe('DB + reparto — flujo real gasto → saldo', () => {
  it('30€ pagados por A, 2 personas de A y 1 de B → B debe 10 a A', async () => {
    const ev = await createEvent({ name: 'E', currency: 'EUR' })
    const A = await addFamily(ev, { name: 'A' })
    const B = await addFamily(ev, { name: 'B' })
    const a1 = await addPerson(ev, { name: 'a1', familyId: A, edad: 'adulto' })
    const a2 = await addPerson(ev, { name: 'a2', familyId: A, edad: 'adulto' })
    const b1 = await addPerson(ev, { name: 'b1', familyId: B, edad: 'adulto' })

    await addExpense(ev, {
      description: 'Cena', amountCents: 3000, currency: 'EUR', category: 'restaurante',
      dateISO: '2026-08-09', payers: [{ familyId: A, amountCents: 3000 }],
      participantIds: [a1, a2, b1],
    })

    const bal = await balancesFor(ev)
    expect(bal.get(A)).toBe(1000)
    expect(bal.get(B)).toBe(-1000)
    expect(simplifyDebts(bal)).toEqual([
      { fromFamilyId: B, toFamilyId: A, amountCents: 1000 },
    ])
  })

  it('marcar pagado deja el saldo a cero', async () => {
    const ev = await createEvent({ name: 'E', currency: 'EUR' })
    const A = await addFamily(ev, { name: 'A' })
    const B = await addFamily(ev, { name: 'B' })
    const a1 = await addPerson(ev, { name: 'a1', familyId: A, edad: 'adulto' })
    const b1 = await addPerson(ev, { name: 'b1', familyId: B, edad: 'adulto' })
    await addExpense(ev, {
      description: 'x', amountCents: 2000, currency: 'EUR', category: 'varios',
      dateISO: '2026-08-09', payers: [{ familyId: A, amountCents: 2000 }],
      participantIds: [a1, b1],
    })
    await addSettlement(ev, { fromFamilyId: B, toFamilyId: A, amountCents: 1000 })
    const bal = await balancesFor(ev)
    expect(bal.get(A)).toBe(0)
    expect(bal.get(B)).toBe(0)
  })

  it('el niño con peso 0,5 paga la mitad que un adulto', async () => {
    const ev = await createEvent({ name: 'E', currency: 'EUR' })
    const A = await addFamily(ev, { name: 'A' })
    const adulto = await addPerson(ev, { name: 'adulto', familyId: A, edad: 'adulto' }) // peso 1
    const nino = await addPerson(ev, { name: 'nino', familyId: A, edad: 'niño' }) // peso 0,5
    const B = await addFamily(ev, { name: 'B' })
    const bPayer = await addPerson(ev, { name: 'b', familyId: B, edad: 'adulto' })
    await addExpense(ev, {
      description: 'x', amountCents: 3000, currency: 'EUR', category: 'comida',
      dateISO: '2026-08-09', payers: [{ familyId: B, amountCents: 3000 }],
      participantIds: [adulto, nino, bPayer],
    })
    // pesos 1 + 0,5 + 1 = 2,5 → cuota 1200/peso. A debe 1·1200 + 0,5·1200 = 1800.
    const bal = await balancesFor(ev)
    expect(bal.get(A)).toBe(-1800)
    expect(bal.get(B)).toBe(1800)
  })
})

describe('Lista de la compra — apuntar, marcar y limpiar', () => {
  it('apunta ítems y los marca como comprados', async () => {
    const ev = await createEvent({ name: 'C', currency: 'EUR' })
    const hielo = await addShopItem(ev, { texto: 'Hielos', categoria: 'hielo' })
    await addShopItem(ev, { texto: 'Vino', categoria: 'bebida' })

    let items = await shopItemsOf(ev)
    expect(items.length).toBe(2)
    expect(items.every((x) => x.comprado === false)).toBe(true)

    await updateShopItem(hielo, { comprado: true })
    items = await shopItemsOf(ev)
    expect(items.find((x) => x.id === hielo).comprado).toBe(true)
  })

  it('categoría por defecto "otros" si no se indica', async () => {
    const ev = await createEvent({ name: 'C', currency: 'EUR' })
    await addShopItem(ev, { texto: 'Bolsas' })
    const [it] = await shopItemsOf(ev)
    expect(it.categoria).toBe('otros')
  })

  it('limpiar comprados borra solo lo marcado y deja tombstone', async () => {
    const ev = await createEvent({ name: 'C', currency: 'EUR' })
    const a = await addShopItem(ev, { texto: 'Fruta', categoria: 'fruta' })
    const b = await addShopItem(ev, { texto: 'Cerveza', categoria: 'bebida' })
    await updateShopItem(a, { comprado: true })

    const borrados = await clearBoughtShopItems(ev)
    expect(borrados).toBe(1)
    const items = await shopItemsOf(ev)
    expect(items.map((x) => x.id)).toEqual([b])

    const { db } = await import('./db.js')
    expect(await db.tombstones.get(`shop:${a}`)).toBeTruthy()
  })

  it('removeShopItem elimina el ítem', async () => {
    const ev = await createEvent({ name: 'C', currency: 'EUR' })
    const id = await addShopItem(ev, { texto: 'Hielo', categoria: 'hielo' })
    await removeShopItem(id)
    expect((await shopItemsOf(ev)).length).toBe(0)
  })
})

describe('seedExample — datos de ejemplo coherentes', () => {
  it('crea el evento con familias, gente, cena y planes', async () => {
    const ev = await seedExample()
    expect((await familiesOf(ev)).length).toBe(3)
    expect((await personsOf(ev)).length).toBe(6)
    expect((await dinnersOf(ev)).length).toBe(1)
    expect((await plansOf(ev)).length).toBe(3)
    expect((await listDishes()).length).toBeGreaterThanOrEqual(6)
    expect((await shopItemsOf(ev)).length).toBe(4)
  })

  it('la cena de ejemplo referencia platos y bungas válidos', async () => {
    const ev = await seedExample()
    const [cena] = await dinnersOf(ev)
    const bungaIds = new Set((await bungasOf(ev)).map((b) => b.id))
    expect(cena.platoIds.length).toBeGreaterThan(0)
    expect(bungaIds.has(cena.bungaMayoresId)).toBe(true)
    expect(bungaIds.has(cena.bungaNinosId)).toBe(true)
  })
})
