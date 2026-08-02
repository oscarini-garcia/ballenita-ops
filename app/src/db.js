import Dexie from 'dexie'
import { uid, now } from './lib/ids.js'
import { SYNC_TABLES } from './sync/tables.js'
import { pesoDe } from './lib/personas.js'

// IndexedDB desde el día 1 (§14). Cada tabla guarda registros con `id` de cliente
// y `updatedAt`. Desde la migración a la API propia (Worker + D1), IndexedDB deja
// de ser la fuente de la verdad y pasa a ser **la copia local de la instantánea**
// que manda el servidor, más una **cola de cambios** pendientes de subir.
//
// La regla de oro no cambia: aquí solo hay hechos. Los saldos los sigue
// calculando `lib/reparto.js` en el dispositivo, y no se sincronizan jamás.
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

// v3: tombstones para propagar borrados en la sincronización (§14).
db.version(3).stores({
  tombstones: '&key', // key = `${tabla}:${id}`
})

// v4: lista de la compra compartida (§6.6). Ítems simples que cualquiera apunta
// y el que va a comprar marca como hecho.
db.version(4).stores({
  shop: '&id, eventId, updatedAt',
})

// v5: cola de cambios, y adiós a las lápidas.
//
// Con el documento de JSONBin cada móvil fusionaba el estado entero y hacía
// falta una lápida para que un borrado no resucitara desde otro dispositivo.
// Ahora el borrado es un cambio más de la cola y el servidor lo conserva
// marcado, así que la tabla sobra: ponerla a `null` la elimina al migrar.
db.version(5).stores({
  outbox: '++orden, tabla',
  tombstones: null,
})

// v6: el catálogo de ideas de plan (SPECS §14.15, `docs/diseño/planes-catalogo.html` · A3).
//
// Un plan es dos cosas a la vez: la **idea**, que se repite cada verano —«Playa
// de la Cala», su ubicación, su enlace— y la **propuesta de este año**, con su
// día, su estado y sus votos. Estaban en la misma fila, así que reutilizar un
// plan de otro viaje habría arrastrado el día del año pasado y los votos de
// gente que no viene.
//
// Es la misma figura que `dishes` ↔ `dinners` y no un invento nuevo: un
// catálogo, y lo que se hace con él. Sin índice: son decenas de filas.
db.version(6).stores({
  planIdeas: '&id',
})

// ── Señal de cambios locales (para disparar la sync) ──
let applyingRemote = false
export function setApplyingRemote(v) { applyingRemote = v }
function bump() {
  if (applyingRemote || typeof window === 'undefined') return
  window.dispatchEvent(new Event('ballena:changed'))
}

// ---------------------------------------------------------------------------
// Escritura: dato y cola, siempre juntos
// ---------------------------------------------------------------------------

/**
 * Toda escritura de la app pasa por aquí.
 *
 * El dato y su entrada en la cola se guardan en **la misma transacción**. Si se
 * hicieran por separado, cerrar la app entre una y otra dejaría un cambio que
 * se ve en el móvil y que el servidor no llega a conocer nunca: el peor fallo
 * posible en una app de gastos compartidos, porque no se nota hasta que las
 * cuentas no cuadran.
 *
 * A la cola va **solo lo que cambia**, no la fila entera. Así dos personas que
 * editan campos distintos del mismo gasto no se pisan (lo resuelve el servidor
 * campo a campo), y de paso la cola ocupa lo que tiene que ocupar.
 */
async function escribir(tabla, id, campos) {
  const updatedAt = now()
  await db.transaction('rw', db[tabla], db.outbox, async () => {
    const anterior = await db[tabla].get(id)
    await db[tabla].put({ ...(anterior ?? {}), ...campos, id, updatedAt })
    if (!applyingRemote) await db.outbox.add({ tabla, id, op: 'upsert', campos, updatedAt })
  })
  bump()
  return id
}

/**
 * Borrado: desaparece de la copia local y sube como un cambio más. El servidor
 * lo marca y deja de transmitirlo; no hacen falta lápidas locales.
 */
export async function removeRow(tabla, id) {
  const updatedAt = now()
  await db.transaction('rw', db[tabla], db.outbox, async () => {
    await db[tabla].delete(id)
    if (!applyingRemote) await db.outbox.add({ tabla, id, op: 'borrar', updatedAt })
  })
  bump()
}

/** Cambios pendientes de subir, en orden de llegada. */
export const colaPendiente = () => db.outbox.orderBy('orden').toArray()
export const hayCambiosPendientes = async () => (await db.outbox.count()) > 0
// Cuántos, no solo si los hay: al salir de la cuenta hay que decir qué se
// perdería, y «tienes cambios sin subir» no deja decidir. Ver `lib/salida.js`.
export const cuantosPendientes = () => db.outbox.count()

/** Descarta de la cola lo que el servidor ya ha aceptado (o rechazado con motivo). */
export const vaciarCola = (hastaOrden) =>
  db.outbox.where('orden').belowOrEqual(hastaOrden).delete()

// ---------------------------------------------------------------------------
// Instantánea
// ---------------------------------------------------------------------------

/**
 * Sustituye la copia local por la instantánea del servidor, que es la autoridad.
 *
 * Se reemplaza en vez de fusionar: lo que el servidor no manda es que ya no
 * existe. Los cambios que hayan entrado en la cola mientras la petición estaba
 * en vuelo se vuelven a aplicar encima, para que nada de lo que el usuario
 * acaba de tocar desaparezca de su pantalla.
 */
export async function importSnapshot(snap) {
  setApplyingRemote(true)
  try {
    const pendientes = await colaPendiente()

    await db.transaction('rw', SYNC_TABLES.map((t) => db[t]), async () => {
      for (const t of SYNC_TABLES) {
        await db[t].clear()
        if (snap.tables?.[t]?.length) await db[t].bulkPut(snap.tables[t])
      }
    })

    for (const cambio of pendientes) {
      if (cambio.op === 'borrar') await db[cambio.tabla].delete(cambio.id)
      else {
        const anterior = await db[cambio.tabla].get(cambio.id)
        await db[cambio.tabla].put({
          ...(anterior ?? {}), ...cambio.campos, id: cambio.id, updatedAt: cambio.updatedAt,
        })
      }
    }
  } finally {
    setApplyingRemote(false)
  }
}

/** Volcado local completo. Sirve para sembrar la base nueva desde JSONBin. */
export async function exportSnapshot() {
  const tables = {}
  for (const t of SYNC_TABLES) tables[t] = await db[t].toArray()
  return { v: 1, tables }
}

/** Olvida todo lo local. Al cerrar sesión, para no dejar los datos del grupo
 *  en un móvil que ya no tiene acceso. */
export async function olvidarTodo() {
  await db.transaction('rw', [...SYNC_TABLES.map((t) => db[t]), db.outbox], async () => {
    for (const t of SYNC_TABLES) await db[t].clear()
    await db.outbox.clear()
  })
}

// ── Eventos ──
export async function createEvent({ name, lugar = '', currency = 'EUR', startDate, endDate, esDemo = false }) {
  return escribir('events', uid('ev'), { name, lugar, currency, startDate, endDate, status: 'activo', esDemo })
}
export const listEvents = () => db.events.orderBy('updatedAt').reverse().toArray()
export const getEvent = (id) => db.events.get(id)
export const updateEvent = (id, patch) => escribir('events', id, patch)

// ── Familias ──
export async function addFamily(eventId, { name, color = '#1FA6D6', avatar = '👨‍👩‍👧', estado = '' }) {
  return escribir('families', uid('fam'), { eventId, name, color, avatar, estado })
}
export const familiesOf = (eventId) => db.families.where({ eventId }).toArray()
export const updateFamily = (id, patch) => escribir('families', id, patch)
export const removeFamily = (id) => removeRow('families', id)

/**
 * Borrar una familia **suelta lo que colgaba de ella**: su bunga vuelve a estar
 * libre y su gente se queda sin familia.
 *
 * Sin esto, borrar dejaba `familyId` apuntando a algo que ya no existe, y eso no
 * es un hueco: es un dato falso. Es además lo que la confirmación promete
 * (`GrupoSection` · D1), y una confirmación que dice lo que no pasa es peor que
 * no tenerla.
 */
export async function borrarFamilia(eventId, familyId) {
  const [bungas, persons] = await Promise.all([bungasOf(eventId), personsOf(eventId)])
  for (const b of bungas) if (b.familyId === familyId) await updateBunga(b.id, { familyId: null })
  for (const p of persons) if (p.familyId === familyId) await updatePerson(p.id, { familyId: null })
  await removeFamily(familyId)
}

// ── Bungas ──
export async function addBunga(eventId, { name, alias = '', familyId = null }) {
  return escribir('bungas', uid('bunga'), { eventId, name, alias, familyId })
}
export const bungasOf = (eventId) => db.bungas.where({ eventId }).toArray()
export const updateBunga = (id, patch) => escribir('bungas', id, patch)
export const removeBunga = (id) => removeRow('bungas', id)

/**
 * Emparejar una familia con un bunga desde el lado de la familia. El vínculo
 * vive en `bunga.familyId` y es uno a uno, así que asignar uno **libera** el
 * que esa familia tuviera antes: si no, la familia acabaría con dos y los
 * desplegables de disponibles dejarían de cuadrar.
 * Con `bungaId = null` se limita a soltar el que hubiera.
 */
export async function asignarBungaAFamilia(eventId, familyId, bungaId = null) {
  const todos = await bungasOf(eventId)
  for (const b of todos) {
    if (b.id === bungaId && b.familyId !== familyId) await updateBunga(b.id, { familyId })
    else if (b.id !== bungaId && b.familyId === familyId) await updateBunga(b.id, { familyId: null })
  }
}

// ── Personas ──
export async function addPerson(eventId, p) {
  const edad = p.edad ?? 'adulto'
  return escribir('persons', uid('per'), {
    eventId,
    name: p.name,
    apodo: p.apodo ?? '',
    familyId: p.familyId ?? null,
    edad,
    comeConMayores: p.comeConMayores ?? edad === 'adulto',
    cuentaComoAdultoReparto: p.cuentaComoAdultoReparto ?? edad === 'adulto',
    pesoReparto: p.pesoReparto ?? pesoDe(edad),
    avatar: p.avatar ?? '🧑',
    estado: p.estado ?? '',
  })
}
export const personsOf = (eventId) => db.persons.where({ eventId }).toArray()
export const updatePerson = (id, patch) => escribir('persons', id, patch)
export const removePerson = (id) => removeRow('persons', id)

// ── Gastos ──
export async function addExpense(eventId, e) {
  return escribir('expenses', uid('exp'), { eventId, ...e })
}
export const expensesOf = (eventId) => db.expenses.where({ eventId }).reverse().sortBy('dateISO')
export const updateExpense = (id, patch) => escribir('expenses', id, patch)
export const removeExpense = (id) => removeRow('expenses', id)

// ── Liquidaciones ──
export async function addSettlement(eventId, s) {
  return escribir('settlements', uid('set'), { eventId, dateISO: now(), ...s })
}
export const settlementsOf = (eventId) => db.settlements.where({ eventId }).toArray()
export const removeSettlement = (id) => removeRow('settlements', id)

// ── Platos (catálogo global, §6.2) ──
export const DISH_CATEGORIES = [
  { id: 'aperitivo', label: 'Aperitivo' },
  { id: 'entrante', label: 'Entrante' },
  { id: 'principal', label: 'Principal' },
  { id: 'acompanamiento', label: 'Acompañamiento' },
  { id: 'postre', label: 'Postre' },
]
/**
 * El catálogo de platos es **compartido entre eventos**, y así tiene que seguir:
 * la paella no se reescribe cada verano. La excepción es el evento de
 * demostración, que es un cajón de arena: lo que se apunte ahí no tiene por qué
 * aparecer el día que se prepare el viaje de verdad.
 *
 * Por eso un plato puede llevar `eventId`. Sin él es del catálogo de todos —el
 * comportamiento de siempre—; con él pertenece solo a ese evento, que hoy es
 * únicamente «Demo». No hace falta índice: el catálogo se lee entero y son
 * decenas de filas, no miles.
 *
 * Las cenas, los planes, los gastos y la compra ya colgaban de su evento y
 * nunca se mezclaron. Los platos eran la única tabla suelta.
 */
export async function addDish({ name, categorias = [], esFavorito = false, ingredientes = [] }, evento = null) {
  const eventId = evento?.esDemo ? evento.id : null
  return escribir('dishes', uid('dish'), { name, categorias, esFavorito, ingredientes, eventId })
}

export async function listDishes(evento = null) {
  const todos = await db.dishes.toArray()
  return evento?.esDemo
    ? todos.filter((d) => d.eventId === evento.id)
    : todos.filter((d) => !d.eventId)
}
export const updateDish = (id, patch) => escribir('dishes', id, patch)
export const removeDish = (id) => removeRow('dishes', id)

// ── Cenas (§6) — una por día ──
export async function addDinner(eventId, d) {
  return escribir('dinners', uid('cena'), {
    eventId,
    dia: d.dia,
    platoIds: d.platoIds ?? [],
    bungaMayoresId: d.bungaMayoresId ?? null,
    bungaNinosId: d.bungaNinosId ?? null,
    queSeHace: d.queSeHace ?? '',
    cantidades: d.cantidades ?? '',
  })
}
export const dinnersOf = (eventId) => db.dinners.where({ eventId }).sortBy('dia')
export const updateDinner = (id, patch) => escribir('dinners', id, patch)
export const removeDinner = (id) => removeRow('dinners', id)

// ── Ideas de plan (catálogo compartido, §14.15) ──
/**
 * La idea: lo que se repite de un viaje a otro. Ni día, ni estado, ni votos —
 * esos tres son de *ese* agosto y no viajan nunca (`traerIdeaAlViaje`).
 *
 * Comparte con los platos el trato del evento de demostración: sin `eventId` la
 * idea es del catálogo de todos; con él, solo de ese evento, que hoy es
 * únicamente el Demo. Sin eso, trastear en la demostración volvería a ensuciar
 * el catálogo de verdad, que es lo que se acaba de arreglar en §14.9-quater.
 */
export async function addPlanIdea({ titulo, descripcion = '', ubicacion = '', enlace = '', costeEstimado = null }, evento = null) {
  const eventId = evento?.esDemo ? evento.id : null
  return escribir('planIdeas', uid('idea'), { titulo, descripcion, ubicacion, enlace, costeEstimado, eventId })
}

export async function listPlanIdeas(evento = null) {
  const todas = await db.planIdeas.toArray()
  const suyas = evento?.esDemo
    ? todas.filter((i) => i.eventId === evento.id)
    : todas.filter((i) => !i.eventId)
  return suyas.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'es'))
}

export const updatePlanIdea = (id, patch) => escribir('planIdeas', id, patch)
export const removePlanIdea = (id) => removeRow('planIdeas', id)

/**
 * Traer una idea al viaje: **se copia, no se enlaza**
 * (`docs/diseño/planes-catalogo.html` · C1).
 *
 * A partir de aquí son dos cosas independientes. Corregir el enlace en el
 * catálogo no reescribe los viajes ya planeados, que es lo que uno espera de
 * algo que ya ocurrió. El `ideaId` se guarda solo para poder decir en el
 * catálogo «3 viajes»; no se lee para pintar nada.
 *
 * Y nace limpia: sin día, sin votos y en «votando». Los tres no viajan, y no es
 * una elección de diseño sino una consecuencia — los votos apuntan a personas de
 * otro evento, «confirmado» fue una decisión de aquel agosto y el día de
 * entonces no es un día de este viaje.
 */
export function traerIdeaAlViaje(eventId, idea) {
  return addPlan(eventId, {
    titulo: idea.titulo,
    descripcion: idea.descripcion,
    ubicacion: idea.ubicacion,
    enlace: idea.enlace,
    costeEstimado: idea.costeEstimado,
    ideaId: idea.id,
  })
}

/** El camino inverso: este plan ha salido bien, guárdalo para el año que viene. */
export async function guardarPlanComoIdea(plan, evento = null) {
  const ideaId = await addPlanIdea({
    titulo: plan.titulo,
    descripcion: plan.descripcion,
    ubicacion: plan.ubicacion,
    enlace: plan.enlace,
    costeEstimado: plan.costeEstimado,
  }, evento)
  await updatePlan(plan.id, { ideaId })
  return ideaId
}

/** En cuántos viajes se ha usado cada idea, para la nota de su fila. */
export async function usoDeIdeas() {
  const todos = await db.plans.toArray()
  const cuenta = {}
  for (const p of todos) {
    if (!p.ideaId) continue
    cuenta[p.ideaId] = (cuenta[p.ideaId] ?? new Set())
    cuenta[p.ideaId].add(p.eventId)
  }
  return Object.fromEntries(Object.entries(cuenta).map(([k, v]) => [k, v.size]))
}

// ── Planes (§4) ──
export async function addPlan(eventId, p) {
  return escribir('plans', uid('plan'), {
    eventId,
    titulo: p.titulo,
    descripcion: p.descripcion ?? '',
    dia: p.dia ?? null,
    costeEstimado: p.costeEstimado ?? null,
    ubicacion: p.ubicacion ?? '',
    enlace: p.enlace ?? '',
    estado: p.estado ?? 'votando',
    votos: p.votos ?? {},
    // De qué idea del catálogo salió, si salió de una. Solo sirve para contar
    // en cuántos viajes se ha usado: lo que se pinta son los campos de arriba,
    // que son copias (C1).
    ideaId: p.ideaId ?? null,
  })
}
export const plansOf = (eventId) => db.plans.where({ eventId }).toArray()
export const updatePlan = (id, patch) => escribir('plans', id, patch)
export const removePlan = (id) => removeRow('plans', id)

// ── Lista de la compra (§6.6) — ítems simples que cualquiera apunta ──
export const SHOP_CATEGORIES = [
  { id: 'bebida', label: 'Bebida', icon: '🍺' },
  { id: 'fruta', label: 'Fruta y verdura', icon: '🍎' },
  { id: 'comida', label: 'Comida', icon: '🥖' },
  { id: 'hielo', label: 'Hielo y frío', icon: '🧊' },
  { id: 'otros', label: 'Otros', icon: '🧺' },
]
export async function addShopItem(eventId, { texto, categoria = 'otros' }) {
  return escribir('shop', uid('shop'), {
    eventId, texto, categoria, comprado: false, compradoPor: null, compradoEn: null,
  })
}
export const shopItemsOf = (eventId) => db.shop.where({ eventId }).toArray()
export const updateShopItem = (id, patch) => escribir('shop', id, patch)
export const removeShopItem = (id) => removeRow('shop', id)
// Marcar/desmarcar comprado registrando quién (personId) y cuándo.
export const markBought = (id, personId = null) =>
  updateShopItem(id, { comprado: true, compradoPor: personId, compradoEn: now() })
export const unmarkBought = (id) =>
  updateShopItem(id, { comprado: false, compradoPor: null, compradoEn: null })
// Vacía lo ya comprado para dejar la lista limpia.
export async function clearBoughtShopItems(eventId) {
  const done = (await db.shop.where({ eventId }).toArray()).filter((x) => x.comprado)
  for (const it of done) await removeRow('shop', it.id)
  return done.length
}

/**
 * ── El evento de demostración ──
 *
 * Se llama **«Demo»**, y el nombre es la mitad de su trabajo. Se llamaba
 * «Ballenita 2026», que es exactamente como se llamaría un viaje de verdad: en
 * la lista de eventos, junto a los reales, no había forma de distinguirlo, y lo
 * apuntado dentro parecía apuntado en el sitio bueno. El sitio y las fechas se
 * quedan —sin ellos la app abre vacía y no enseña lo que hace—, pero el rótulo
 * dice lo que es.
 *
 * Lo usan los dos caminos: la demostración de la pantalla de acceso
 * (`lib/demo.js`, directriz 2.1 de Apple) y el «cargar el de ejemplo» de la
 * lista de eventos cuando no hay ninguno.
 */
export const NOMBRE_DEMO = 'Demo'

export async function seedExample() {
  const eventId = await createEvent({
    name: NOMBRE_DEMO,
    // La marca que hace del Demo un cajón de arena: sus platos son suyos y no
    // entran en el catálogo compartido (ver `addDish`/`listDishes`).
    esDemo: true,
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

  // Los platos del Demo son **suyos**: llevan su eventId, así que no entran en el
  // catálogo compartido ni lo miran. Antes se sembraban en el catálogo global y
  // solo si estaba vacío, con lo que en una instalación con platos de verdad la
  // cena de ejemplo salía sin nada, y en una vacía dejaba seis platos inventados
  // metidos entre los buenos para siempre.
  const evento = await getEvent(eventId)
  for (const plato of [
    { name: 'Aceitunas y altramuces', categorias: ['aperitivo'] },
    { name: 'Ensaladilla rusa', categorias: ['entrante'] },
    { name: 'Paella mixta', categorias: ['principal'], esFavorito: true, ingredientes: ['arroz', 'mejillones', 'pollo'] },
    { name: 'Pan con tomate', categorias: ['acompanamiento'] },
    { name: 'Ensalada verde', categorias: ['acompanamiento'] },
    { name: 'Sandía', categorias: ['postre'] },
  ]) await addDish(plato, evento)
  const dishes = await listDishes(evento)
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

  // Lista de la compra de ejemplo (§6.6).
  await addShopItem(eventId, { texto: 'Hielos', categoria: 'hielo' })
  await addShopItem(eventId, { texto: 'Vino tinto', categoria: 'bebida' })
  await addShopItem(eventId, { texto: 'Fruta variada', categoria: 'fruta' })
  await addShopItem(eventId, { texto: 'Bolsas de basura', categoria: 'otros' })
  return eventId
}
