import { describe, it, expect } from 'vitest'
import {
  createEvent, addFamily, addPerson, addExpense,
  expensesOf, personsOf, familiesOf,
  addSettlement, settlementsOf,
  seedExample, listEvents, dinnersOf, plansOf, listDishes, addDish, getEvent, bungasOf,
  addShopItem, shopItemsOf, updateShopItem, removeShopItem, clearBoughtShopItems,
  addBunga, asignarBungaAFamilia, borrarFamilia,
  markBought, unmarkBought,
  addPlan, updatePlan, redondearHorasDePlanes, db,
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

  it('el niño pesa 0,6 y paga menos que un adulto', async () => {
    const ev = await createEvent({ name: 'E', currency: 'EUR' })
    const A = await addFamily(ev, { name: 'A' })
    const adulto = await addPerson(ev, { name: 'adulto', familyId: A, edad: 'adulto' }) // peso 1
    const nino = await addPerson(ev, { name: 'nino', familyId: A, edad: 'niño' }) // peso 0,6
    const B = await addFamily(ev, { name: 'B' })
    const bPayer = await addPerson(ev, { name: 'b', familyId: B, edad: 'adulto' })
    await addExpense(ev, {
      description: 'x', amountCents: 3000, currency: 'EUR', category: 'comida',
      dateISO: '2026-08-09', payers: [{ familyId: B, amountCents: 3000 }],
      participantIds: [adulto, nino, bPayer],
    })
    // pesos 1 + 0,6 + 1 = 2,6 → cuota 30 €/2,6. A paga 1 + 0,6 de esas cuotas.
    const bal = await balancesFor(ev)
    expect(bal.get(A)).toBe(-1846)
    expect(bal.get(B)).toBe(1846)
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

  it('markBought registra quién y cuándo; unmarkBought lo limpia', async () => {
    const ev = await createEvent({ name: 'C', currency: 'EUR' })
    const A = await addFamily(ev, { name: 'A' })
    const curro = await addPerson(ev, { name: 'Curro', familyId: A, edad: 'adulto' })
    const id = await addShopItem(ev, { texto: 'Hielos', categoria: 'hielo' })

    const nuevo = (await shopItemsOf(ev)).find((x) => x.id === id)
    expect(nuevo.compradoPor).toBe(null)
    expect(nuevo.compradoEn).toBe(null)

    await markBought(id, curro)
    let it = (await shopItemsOf(ev)).find((x) => x.id === id)
    expect(it.comprado).toBe(true)
    expect(it.compradoPor).toBe(curro)
    expect(typeof it.compradoEn).toBe('string')

    await unmarkBought(id)
    it = (await shopItemsOf(ev)).find((x) => x.id === id)
    expect(it.comprado).toBe(false)
    expect(it.compradoPor).toBe(null)
    expect(it.compradoEn).toBe(null)
  })

  it('markBought sin persona (anónimo) marca comprado igualmente', async () => {
    const ev = await createEvent({ name: 'C', currency: 'EUR' })
    const id = await addShopItem(ev, { texto: 'Vino', categoria: 'bebida' })
    await markBought(id)
    const it = (await shopItemsOf(ev)).find((x) => x.id === id)
    expect(it.comprado).toBe(true)
    expect(it.compradoPor).toBe(null)
    expect(typeof it.compradoEn).toBe('string')
  })

  it('categoría por defecto "otros" si no se indica', async () => {
    const ev = await createEvent({ name: 'C', currency: 'EUR' })
    await addShopItem(ev, { texto: 'Bolsas' })
    const [it] = await shopItemsOf(ev)
    expect(it.categoria).toBe('otros')
  })

  it('limpiar comprados borra solo lo marcado y encola el borrado', async () => {
    const ev = await createEvent({ name: 'C', currency: 'EUR' })
    const a = await addShopItem(ev, { texto: 'Fruta', categoria: 'fruta' })
    const b = await addShopItem(ev, { texto: 'Cerveza', categoria: 'bebida' })
    await updateShopItem(a, { comprado: true })

    const borrados = await clearBoughtShopItems(ev)
    expect(borrados).toBe(1)
    const items = await shopItemsOf(ev)
    expect(items.map((x) => x.id)).toEqual([b])

    // El borrado sube como un cambio más de la cola; el servidor lo marca y
    // deja de transmitirlo, de modo que ya no hacen falta lápidas locales.
    const { colaPendiente } = await import('./db.js')
    const encolado = (await colaPendiente()).find((c) => c.op === 'borrar' && c.id === a)
    expect(encolado).toMatchObject({ tabla: 'shop', id: a })
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
    expect((await shopItemsOf(ev)).length).toBe(4)
  })

  it('el Demo es un cajón de arena: sus platos no entran en el catálogo compartido', async () => {
    const ev = await seedExample()
    const evento = await getEvent(ev)
    expect(evento.esDemo).toBe(true)

    // Los seis de la cena de ejemplo están, pero solo para el Demo…
    expect((await listDishes(evento)).length).toBeGreaterThanOrEqual(6)
    // …y el catálogo de un evento de verdad sigue vacío. Antes se sembraban ahí
    // y quedaban entre los buenos para siempre.
    expect(await listDishes()).toEqual([])

    // Y lo que se apunte dentro del Demo se queda dentro.
    await addDish({ name: 'Sardinas', categorias: ['principal'] }, evento)
    expect((await listDishes()).map((d) => d.name)).not.toContain('Sardinas')

    // Mientras que un plato apuntado desde un evento normal es de todos.
    await addDish({ name: 'Tortilla', categorias: ['principal'] })
    expect((await listDishes()).map((d) => d.name)).toEqual(['Tortilla'])
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

describe('asignarBungaAFamilia — el emparejamiento es uno a uno', () => {
  it('asigna, y libera el que la familia tuviera antes', async () => {
    const ev = await createEvent({ name: 'Camping', currency: 'EUR' })
    const fam = await addFamily(ev, { name: 'García' })
    const b1 = await addBunga(ev, { name: 'Bunga 1' })
    const b2 = await addBunga(ev, { name: 'Bunga 2' })

    await asignarBungaAFamilia(ev, fam, b1)
    let bungas = Object.fromEntries((await bungasOf(ev)).map((b) => [b.id, b]))
    expect(bungas[b1].familyId).toBe(fam)

    await asignarBungaAFamilia(ev, fam, b2)
    bungas = Object.fromEntries((await bungasOf(ev)).map((b) => [b.id, b]))
    expect(bungas[b2].familyId).toBe(fam)
    expect(bungas[b1].familyId).toBe(null)
  })

  it('con bungaId nulo suelta el que hubiera', async () => {
    const ev = await createEvent({ name: 'Finde', currency: 'EUR' })
    const fam = await addFamily(ev, { name: 'Pérez' })
    const b = await addBunga(ev, { name: 'Bunga 1', familyId: fam })
    await asignarBungaAFamilia(ev, fam, null)
    expect((await bungasOf(ev))[0].familyId).toBe(null)
    expect(b).toBeTruthy()
  })
})

describe('borrarFamilia — suelta lo que colgaba de ella', () => {
  it('el bunga vuelve a estar libre y su gente se queda sin familia', async () => {
    const ev = await createEvent({ name: 'Camping', currency: 'EUR' })
    const fam = await addFamily(ev, { name: 'García' })
    const otra = await addFamily(ev, { name: 'Pérez' })
    const bun = await addBunga(ev, { name: 'Bunga 1', familyId: fam })
    const per = await addPerson(ev, { name: 'Curro', familyId: fam })
    await addPerson(ev, { name: 'Ana', familyId: otra })

    await borrarFamilia(ev, fam)

    expect((await familiesOf(ev)).map((f) => f.id)).toEqual([otra])
    expect((await bungasOf(ev)).find((b) => b.id === bun).familyId).toBe(null)
    expect((await personsOf(ev)).find((p) => p.id === per).familyId).toBe(null)
    // A la gente de otra familia no la toca.
    expect((await personsOf(ev)).find((p) => p.name === 'Ana').familyId).toBe(otra)
  })
})

/**
 * **Solo horas en punto, y la regla vive en la puerta** (SPECS §14.75).
 *
 * La pastilla de C2 enseña «20h», y eso solo es verdad si nada puede guardar
 * «20:45» — ni el elegidor, ni un cliente viejo por la cola de cambios. Por eso
 * se prueba contra `db.js` y no contra la pantalla.
 */
describe('la hora de un plan se guarda en punto', () => {
  it('al crearlo y al corregirlo, y el instante va con la hora redondeada', async () => {
    const eventId = await createEvent({ name: 'Ballenita', startDate: '2026-08-08', endDate: '2026-08-15' })
    const id = await addPlan(eventId, { titulo: 'Fata', dia: '2026-08-10', hora: '23:46' })

    const nacido = (await plansOf(eventId)).find((p) => p.id === id)
    expect(nacido.hora).toBe('23:00')
    expect(nacido.cuando).toBe(Math.floor(new Date('2026-08-10T23:00:00').getTime() / 1000))

    await updatePlan(id, { hora: '10:30' })
    const corregido = (await plansOf(eventId)).find((p) => p.id === id)
    expect(corregido.hora).toBe('10:00')
    // El instante se rehace **con la hora ya redondeada**: si no, el aviso
    // sonaría a las 10:30 de un plan que en pantalla pone «10h».
    expect(corregido.cuando).toBe(Math.floor(new Date('2026-08-10T10:00:00').getTime() / 1000))
  })

  it('quitar la hora se lleva el instante, y mover el día lo recalcula', async () => {
    const eventId = await createEvent({ name: 'Ballenita', startDate: '2026-08-08', endDate: '2026-08-15' })
    const id = await addPlan(eventId, { titulo: 'Kayak', dia: '2026-08-10', hora: '09:00' })

    await updatePlan(id, { dia: '2026-08-12', hora: '09:00' })
    expect((await plansOf(eventId)).find((p) => p.id === id).cuando)
      .toBe(Math.floor(new Date('2026-08-12T09:00:00').getTime() / 1000))

    await updatePlan(id, { dia: null, hora: null })
    const suelto = (await plansOf(eventId)).find((p) => p.id === id)
    expect(suelto.hora).toBeNull()
    expect(suelto.cuando).toBeNull()
  })

  it('el barrido redondea lo que quedara guardado, y es silencioso si no hay nada', async () => {
    const eventId = await createEvent({ name: 'Ballenita', startDate: '2026-08-08', endDate: '2026-08-15' })
    const id = await addPlan(eventId, { titulo: 'Fata', dia: '2026-08-10' })
    // Se mete a mano con minutos, que es lo que hay guardado de la v0.68.0: la
    // puerta ya no deja escribirlo, así que se salta para poder probarlo.
    await db.plans.update(id, { hora: '23:46' })

    expect(await redondearHorasDePlanes(eventId)).toBe(1)
    expect((await plansOf(eventId)).find((p) => p.id === id).hora).toBe('23:00')
    // Idempotente: la segunda vuelta no escribe nada.
    expect(await redondearHorasDePlanes(eventId)).toBe(0)
  })
})
