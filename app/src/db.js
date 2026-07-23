import Dexie from 'dexie'
import { uid, now } from './lib/ids.js'

// IndexedDB desde el día 1 (§14). Cada tabla guarda registros con `id` de cliente
// y `updatedAt` para el merge. Aquí, en Fase 0, la app es local; la sincronización
// del documento compartido se enchufa después (ver src/sync/).
export const db = new Dexie('ballena-ops')

db.version(1).stores({
  events: '&id, updatedAt',
  families: '&id, eventId, updatedAt',
  bungas: '&id, eventId, updatedAt',
  persons: '&id, eventId, familyId, updatedAt',
  expenses: '&id, eventId, dateISO, updatedAt',
  settlements: '&id, eventId, updatedAt',
})

// v2: catálogo global de platos + cenas + planes (§6, §4).
db.version(2).stores({
  dishes: '&id', // catálogo GLOBAL, reutilizable entre eventos
  dinners: '&id, eventId, dia',
  plans: '&id, eventId, dia',
})

const stamp = (obj) => ({ ...obj, updatedAt: now() })

// ── Eventos ──
export async function createEvent({ name, lugar = '', currency = 'EUR', startDate, endDate }) {
  const id = uid('ev')
  await db.events.add(stamp({ id, name, lugar, currency, startDate, endDate, status: 'activo' }))
  return id
}
export const listEvents = () => db.events.orderBy('updatedAt').reverse().toArray()
export const getEvent = (id) => db.events.get(id)
export const updateEvent = (id, patch) => db.events.update(id, stamp(patch))

// ── Familias ──
export async function addFamily(eventId, { name, color = '#1FA6D6', avatar = '👨‍👩‍👧', estado = '' }) {
  const id = uid('fam')
  await db.families.add(stamp({ id, eventId, name, color, avatar, estado }))
  return id
}
export const familiesOf = (eventId) => db.families.where({ eventId }).toArray()
export const updateFamily = (id, patch) => db.families.update(id, stamp(patch))
export const removeFamily = (id) => db.families.delete(id)

// ── Bungas ──
export async function addBunga(eventId, { name, alias = '', familyId = null }) {
  const id = uid('bunga')
  await db.bungas.add(stamp({ id, eventId, name, alias, familyId }))
  return id
}
export const bungasOf = (eventId) => db.bungas.where({ eventId }).toArray()
export const updateBunga = (id, patch) => db.bungas.update(id, stamp(patch))
export const removeBunga = (id) => db.bungas.delete(id)

// ── Personas ──
export async function addPerson(eventId, p) {
  const id = uid('per')
  const edad = p.edad ?? 'adulto'
  await db.persons.add(
    stamp({
      id,
      eventId,
      name: p.name,
      apodo: p.apodo ?? '',
      familyId: p.familyId ?? null,
      edad,
      comeConMayores: p.comeConMayores ?? edad === 'adulto',
      cuentaComoAdultoReparto: p.cuentaComoAdultoReparto ?? edad === 'adulto',
      pesoReparto: p.pesoReparto ?? (edad === 'adulto' ? 1 : 0.5),
      avatar: p.avatar ?? '🧑',
      estado: p.estado ?? '',
    }),
  )
  return id
}
export const personsOf = (eventId) => db.persons.where({ eventId }).toArray()
export const updatePerson = (id, patch) => db.persons.update(id, stamp(patch))
export const removePerson = (id) => db.persons.delete(id)

// ── Gastos ──
export async function addExpense(eventId, e) {
  const id = uid('exp')
  await db.expenses.add(stamp({ id, eventId, ...e }))
  return id
}
export const expensesOf = (eventId) => db.expenses.where({ eventId }).reverse().sortBy('dateISO')
export const updateExpense = (id, patch) => db.expenses.update(id, stamp(patch))
export const removeExpense = (id) => db.expenses.delete(id)

// ── Liquidaciones ──
export async function addSettlement(eventId, s) {
  const id = uid('set')
  await db.settlements.add(stamp({ id, eventId, dateISO: now(), ...s }))
  return id
}
export const settlementsOf = (eventId) => db.settlements.where({ eventId }).toArray()
export const removeSettlement = (id) => db.settlements.delete(id)

// ── Platos (catálogo global, §6.2) ──
export const DISH_CATEGORIES = [
  { id: 'aperitivo', label: 'Aperitivo' },
  { id: 'entrante', label: 'Entrante' },
  { id: 'principal', label: 'Principal' },
  { id: 'acompanamiento', label: 'Acompañamiento' },
  { id: 'postre', label: 'Postre' },
]
export async function addDish({ name, categorias = [], esFavorito = false, ingredientes = [] }) {
  const id = uid('dish')
  await db.dishes.add(stamp({ id, name, categorias, esFavorito, ingredientes }))
  return id
}
export const listDishes = () => db.dishes.toArray()
export const updateDish = (id, patch) => db.dishes.update(id, stamp(patch))
export const removeDish = (id) => db.dishes.delete(id)

// ── Cenas (§6) — una por día ──
export async function addDinner(eventId, d) {
  const id = uid('cena')
  await db.dinners.add(stamp({
    id, eventId, dia: d.dia,
    platoIds: d.platoIds ?? [],
    bungaMayoresId: d.bungaMayoresId ?? null,
    bungaNinosId: d.bungaNinosId ?? null,
    queSeHace: d.queSeHace ?? '',
    cantidades: d.cantidades ?? '',
  }))
  return id
}
export const dinnersOf = (eventId) => db.dinners.where({ eventId }).sortBy('dia')
export const updateDinner = (id, patch) => db.dinners.update(id, stamp(patch))
export const removeDinner = (id) => db.dinners.delete(id)

// ── Planes (§4) ──
export async function addPlan(eventId, p) {
  const id = uid('plan')
  await db.plans.add(stamp({
    id, eventId,
    titulo: p.titulo,
    descripcion: p.descripcion ?? '',
    dia: p.dia ?? null,
    costeEstimado: p.costeEstimado ?? null,
    ubicacion: p.ubicacion ?? '',
    enlace: p.enlace ?? '',
    estado: p.estado ?? 'votando',
    votos: p.votos ?? {},
  }))
  return id
}
export const plansOf = (eventId) => db.plans.where({ eventId }).toArray()
export const updatePlan = (id, patch) => db.plans.update(id, stamp(patch))
export const removePlan = (id) => db.plans.delete(id)

// ── Semilla de ejemplo (Ballenita 2026) para probar rápido ──
export async function seedExample() {
  const eventId = await createEvent({
    name: 'Ballenita 2026',
    lugar: 'Camping La Ballena Alegre',
    currency: 'EUR',
    startDate: '2026-08-08',
    endDate: '2026-08-15',
  })
  const garcia = await addFamily(eventId, { name: 'García', color: '#E5544B', avatar: '🏖️', estado: 'modo playa' })
  const perez = await addFamily(eventId, { name: 'Pérez', color: '#2E9E6B', avatar: '🍷', estado: 'a por el vino' })
  const solteros = await addFamily(eventId, { name: 'Solteros', color: '#1FA6D6', avatar: '🎉', estado: 'sin dormir' })
  await addBunga(eventId, { name: 'Bunga 1', alias: 'El de la piscina', familyId: garcia })
  const bPerez = await addBunga(eventId, { name: 'Bunga 2', alias: 'El del ruido', familyId: perez })
  const bSolteros = await addBunga(eventId, { name: 'Bunga 3', alias: 'El del fondo', familyId: solteros })
  const curro = await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto' })
  await addPerson(eventId, { name: 'Marta', familyId: garcia, edad: 'adulto' })
  await addPerson(eventId, { name: 'Fran', familyId: garcia, edad: 'niño', comeConMayores: true, cuentaComoAdultoReparto: true, pesoReparto: 1, apodo: 'el adolescente' })
  const ana = await addPerson(eventId, { name: 'Ana', familyId: perez, edad: 'adulto' })
  await addPerson(eventId, { name: 'Luis', familyId: perez, edad: 'adulto' })
  const pablo = await addPerson(eventId, { name: 'Pablo', familyId: solteros, edad: 'adulto' })

  // Gastos de ejemplo (para que Saldos y Stats tengan datos).
  const all = await personsOf(eventId)
  const allPids = all.map((p) => p.id)
  const soloMayores = all.filter((p) => p.cuentaComoAdultoReparto).map((p) => p.id)
  await addExpense(eventId, { description: 'Compra grande Mercadona', amountCents: 14800, currency: 'EUR', amountOriginal: 148, rate: 1, category: 'compra_general', dateISO: now(), payers: [{ familyId: perez, amountCents: 14800 }], participantIds: allPids })
  await addExpense(eventId, { description: 'Gasolina ida', amountCents: 6000, currency: 'EUR', category: 'varios', dateISO: now(), payers: [{ familyId: solteros, amountCents: 6000 }], participantIds: soloMayores })
  await addExpense(eventId, { description: 'Hielo y birras 🍷', amountCents: 2430, currency: 'EUR', category: 'bebida', dateISO: now(), payers: [{ familyId: garcia, amountCents: 2430 }], participantIds: soloMayores })

  // Platos (catálogo global) — solo si está vacío, para no duplicar entre eventos.
  if ((await db.dishes.count()) === 0) {
    await addDish({ name: 'Aceitunas y altramuces', categorias: ['aperitivo'] })
    await addDish({ name: 'Ensaladilla rusa', categorias: ['entrante'] })
    await addDish({ name: 'Paella mixta', categorias: ['principal'], esFavorito: true, ingredientes: ['arroz', 'mejillones', 'pollo'] })
    await addDish({ name: 'Pan con tomate', categorias: ['acompanamiento'] })
    await addDish({ name: 'Ensalada verde', categorias: ['acompanamiento'] })
    await addDish({ name: 'Sandía', categorias: ['postre'] })
  }
  const dishes = await listDishes()
  const dishId = (n) => dishes.find((d) => d.name === n)?.id
  await addDinner(eventId, {
    dia: '2026-08-09',
    platoIds: ['Aceitunas y altramuces', 'Ensaladilla rusa', 'Paella mixta', 'Pan con tomate', 'Ensalada verde', 'Sandía'].map(dishId).filter(Boolean),
    bungaMayoresId: bPerez,
    bungaNinosId: bSolteros,
    queSeHace: 'Curro enciende la paellera a las 20:00. Que nadie toque el socarrat.',
    cantidades: '2 kg arroz · 30 mejillones · 1 pollo · 6 barras · 4 botellas tinto',
  })

  await addPlan(eventId, { titulo: 'Playa de la Cala', dia: '2026-08-10', estado: 'confirmado', ubicacion: 'Cala del sur', votos: { [curro]: '👍', [ana]: '👍', [pablo]: '👍' } })
  await addPlan(eventId, { titulo: 'Excursión a las cuevas', dia: '2026-08-12', costeEstimado: 1200, enlace: 'https://example.com/cuevas', votos: { [curro]: '👍', [ana]: '🤷' } })
  await addPlan(eventId, { titulo: 'Noche de juegos de mesa', votos: { [pablo]: '🤷' } })
  return eventId
}
