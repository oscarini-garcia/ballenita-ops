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
  await addBunga(eventId, { name: 'Bunga 2', alias: 'El del ruido', familyId: perez })
  await addBunga(eventId, { name: 'Bunga 3', alias: 'El del fondo', familyId: solteros })
  await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto' })
  await addPerson(eventId, { name: 'Marta', familyId: garcia, edad: 'adulto' })
  await addPerson(eventId, { name: 'Fran', familyId: garcia, edad: 'niño', comeConMayores: true, cuentaComoAdultoReparto: true, pesoReparto: 1, apodo: 'el adolescente' })
  await addPerson(eventId, { name: 'Ana', familyId: perez, edad: 'adulto' })
  await addPerson(eventId, { name: 'Luis', familyId: perez, edad: 'adulto' })
  await addPerson(eventId, { name: 'Pablo', familyId: solteros, edad: 'adulto' })
  return eventId
}
