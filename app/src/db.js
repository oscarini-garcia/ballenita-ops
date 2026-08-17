import Dexie from 'dexie'
import { uid, now } from './lib/ids.js'
import { SYNC_TABLES } from './sync/tables.js'
import { esMayor, pesoDe } from './lib/personas.js'
import { MISMA_COSA_MS, apunteDe } from './lib/registro.js'
import { getMeId } from './lib/identidad.js'
import { loQueHayQueComprar } from './lib/compra.js'
import { olvidarTandas } from './lib/tanda.js'
import { olvidarTodosLosLeidos } from './lib/comentarios.js'

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

// v6: el catálogo de ideas de plan (SPECS §14.18, `docs/diseño/planes-catalogo.html` · A3).
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

// v7: las mejoras — el roadmap de la app, apuntado desde el móvil (SPECS §14.22,
// `docs/diseño/mejoras.html` · A1·B1·C2·D2·E1·F2).
//
// La figura es el bloque «Mejoras» de `garciadoral-ops`: ideas sobre la propia
// aplicación, que ven todos y cualquiera tacha. Tabla sincronizada y no una
// nota del móvil, porque sobre una mejora se actúa en otra máquina. Sin índice:
// es un cuaderno de decenas de filas.
db.version(7).stores({
  mejoras: '&id',
})

// v8: el registro — qué ha hecho cada uno, para el recap del final (SPECS §14.50).
//
// Tabla sincronizada y no un log del móvil, porque la gracia está en **juntar**:
// un recap que solo cuenta lo que tecleaste tú no es un recap. Índice por evento
// y por cuándo, que es exactamente como se lee.
db.version(8).stores({
  registro: '&id, eventId, cuando',
})

// v9: la tanda de §14.52–§14.57, cuatro tablas de una vez.
//
// Van juntas porque salen de la misma vuelta y porque ninguna necesita índices
// que las demás no tengan; separarlas en cuatro versiones de Dexie sería contar
// cuatro veces la misma migración vacía.
//
//  · `trucos` — lo que hay que acordarse de un viaje a otro. **Compartido entre
//    eventos**, como `dishes` y `planIdeas`: un truco no caduca en septiembre.
//    Sin estado por evento a propósito (§14.53).
//  · `comentarios` — el hilo de cualquier cosa, con **ancla** (`plan:abc`) en
//    vez de una columna por tabla, que es lo que hace que el octavo sitio donde
//    se enchufe cueste tres líneas y no una migración (§14.55).
//  · `alojamientos` — el catálogo que hace que un bunga sea **el mismo bunga**
//    de un año a otro, y por tanto que pueda tener notas e histórico (§14.56).
//  · `cacharros` — el que trae cada familia, y sus votos (§14.57).
db.version(9).stores({
  trucos: '&id',
  comentarios: '&id, eventId, ancla',
  alojamientos: '&id',
  cacharros: '&id, eventId',
})

// ── Señal de cambios locales (para disparar la sync) ──
let applyingRemote = false
// Y si lo que se escribe deja renglón en el recap. Se apaga para sembrar el
// Demo, que son 45 escrituras que nadie ha hecho (§14.50).
let registrando = true
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
  await db.transaction('rw', db[tabla], db.outbox, db.registro, async () => {
    const anterior = await db[tabla].get(id)
    const fila = { ...(anterior ?? {}), ...campos, id, updatedAt }
    await db[tabla].put(fila)
    if (!applyingRemote) await db.outbox.add({ tabla, id, op: 'upsert', campos, updatedAt })
    await apuntar({
      tabla, id, accion: anterior ? 'editar' : 'crear', fila, antes: anterior ?? null, cuando: updatedAt,
    })
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
  await db.transaction('rw', db[tabla], db.outbox, db.registro, async () => {
    // La fila se lee **antes** de borrarla: el renglón del recap dice qué se
    // fue («borró “Cena del sábado”»), y después del `delete` ya no hay de dónde
    // sacar el nombre.
    const anterior = await db[tabla].get(id)
    await db[tabla].delete(id)
    if (!applyingRemote) await db.outbox.add({ tabla, id, op: 'borrar', updatedAt })
    await apuntar({ tabla, id, accion: 'borrar', fila: anterior ?? {}, antes: anterior ?? null, cuando: updatedAt })
  })
  bump()
}

/**
 * Deja el renglón del recap, dentro de la transacción del dato (SPECS §14.50).
 *
 * Tres cosas que no son detalles:
 *
 *  · **No se apunta lo que llega del servidor** (`applyingRemote`). El renglón
 *    lo escribió ya el móvil donde se hizo y viaja con la instantánea; volver a
 *    apuntarlo aquí multiplicaría cada hecho por los teléfonos que hay.
 *  · **El registro no se registra a sí mismo**, ni la cola. `apunteDe` solo
 *    conoce las tablas que dejan rastro, así que la recursión no llega a nacer.
 *  · **Lo mismo repetido se junta.** Corregir un gasto cuatro veces son cuatro
 *    escrituras y un hecho: si el último renglón es de la misma persona sobre la
 *    misma fila y no ha pasado `MISMA_COSA_MS`, se **actualiza** en vez de
 *    añadir otro. Sin esto, el recap del viaje lo escribe quien más dudó al
 *    teclear.
 */
async function apuntar({ tabla, id, accion, fila, antes, cuando }) {
  if (applyingRemote || !registrando) return null
  const apunte = apunteDe({ tabla, accion, fila, antes })
  if (!apunte) return null

  // `events` no deja rastro, así que la fila siempre trae su evento; los dos
  // catálogos y las mejoras pueden no tenerlo, y entonces el renglón es del
  // evento que se esté mirando.
  const eventId = fila.eventId ?? antes?.eventId ?? eventoEnCurso() ?? null
  const personId = eventId ? getMeId(eventId) : null

  // Sin evento no se busca el renglón anterior: `where` no admite una clave
  // nula, y un apunte huérfano no tiene con qué juntarse de todas formas.
  const previo = eventId
    ? (await db.registro.where({ eventId }).toArray())
      .filter((r) => r.tabla === tabla && r.filaId === id && r.personId === personId && r.accion === accion)
      .sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)))[0]
    : null

  const juntar = previo && Date.parse(cuando) - Date.parse(previo.cuando) < MISMA_COSA_MS
  const registroId = juntar ? previo.id : uid('reg')
  const anterior = juntar ? previo : {}

  const fijo = {
    ...anterior,
    id: registroId,
    eventId: eventId ?? null,
    personId,
    tabla,
    filaId: id,
    accion,
    clase: apunte.clase,
    texto: apunte.texto,
    cuando,
    updatedAt: cuando,
  }
  await db.registro.put(fijo)
  await db.outbox.add({
    tabla: 'registro',
    id: registroId,
    op: 'upsert',
    campos: {
      eventId: fijo.eventId, personId, tabla, filaId: id, accion,
      clase: apunte.clase, texto: apunte.texto, cuando,
    },
    updatedAt: cuando,
  })
  return fijo
}

/**
 * Cuál es el evento que se está mirando. Lo guarda `App.jsx` al entrar, y aquí
 * solo se lee: un renglón de la carta —que es catálogo de todos— sin evento
 * detrás no saldría en el recap de ninguno, que es lo mismo que no apuntarlo.
 */
const EVENTO_EN_CURSO = 'ballena.activeEventId'
function eventoEnCurso() {
  try { return localStorage.getItem(EVENTO_EN_CURSO) || null } catch { return null }
}

/** Los renglones del recap de un evento, del más nuevo al más viejo. */
export const registroDe = (eventId) =>
  db.registro.where({ eventId }).toArray()
    .then((filas) => filas.sort((a, b) => String(b.cuando).localeCompare(String(a.cuando))))

/** Cambios pendientes de subir, en orden de llegada. */
export const colaPendiente = () => db.outbox.orderBy('orden').toArray()
export const hayCambiosPendientes = async () => (await db.outbox.count()) > 0
/**
 * Cuántos, no solo si los hay: al salir de la cuenta hay que decir qué se
 * perdería, y «tienes cambios sin subir» no deja decidir. Ver `lib/salida.js`.
 *
 * **El registro no cuenta** (§14.50): cada cosa que se hace deja además su
 * renglón del recap, así que sin este filtro apuntar un gasto diría «2 cambios
 * sin subir» y el número que enseña el punto de la cabecera —que existe para
 * poder decidir si esperar a tener cobertura— pasaría a mentir por el doble.
 * Se suben igual: lo que cambia es lo que se cuenta en voz alta.
 */
export const cuantosPendientes = () => db.outbox.where('tabla').notEqual('registro').count()

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
  // Las tandas de recadillos no están en Dexie —son una copia de algo del
  // servidor, no un hecho del grupo—, así que hay que llevárselas aparte. Si no,
  // el que entre después en este móvil leería las bromas del viaje del anterior.
  olvidarTandas()
  // Y las marcas de qué comentarios has leído tú, por lo mismo (§14.55 · K6):
  // son del móvil y no se sincronizan, así que nadie más se las lleva.
  olvidarTodosLosLeidos()
}

// ── Eventos ──
// `cocina` es con qué se cocina en este viaje y **solo lo lee la IA** al
// componer sus sugerencias (SPECS §14.20-quater). Nace vacío a propósito: vacío
// vale el texto de origen que tiene el servidor, así que funciona sin que nadie
// rellene nada.
export async function createEvent({ name, lugar = '', currency = 'EUR', startDate, endDate, esDemo = false, cocina = '' }) {
  return escribir('events', uid('ev'), { name, lugar, currency, startDate, endDate, status: 'activo', esDemo, cocina })
}
export const listEvents = () => db.events.orderBy('updatedAt').reverse().toArray()
export const getEvent = (id) => db.events.get(id)
export const updateEvent = (id, patch) => escribir('events', id, patch)

// ── Familias ──
export async function addFamily(eventId, { name, alias = '', color = '#1FA6D6', avatar = '👨‍👩‍👧' }) {
  // Sin `estado`: se retiró en §14.66 — quien dice en qué anda es cada persona.
  return escribir('families', uid('fam'), { eventId, name, alias, color, avatar })
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
export async function addBunga(eventId, { name, alias = '', familyId = null, alojamientoId = null }) {
  // `alojamientoId` es lo que hace que éste sea **el mismo bunga** que el del
  // año pasado, y por tanto que tenga notas e histórico (§14.56). Nulo = un
  // bunga suelto de este viaje, que es lo que eran todos hasta ahora.
  return escribir('bungas', uid('bunga'), { eventId, name, alias, familyId, alojamientoId })
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
    // El adolescente arranca con los mayores en la mesa y en el reparto: pesa
    // como un adulto (§14.41) y solo se distingue en que no toca Dinero.
    comeConMayores: p.comeConMayores ?? edad !== 'niño',
    cuentaComoAdultoReparto: p.cuentaComoAdultoReparto ?? edad !== 'niño',
    pesoReparto: p.pesoReparto ?? pesoDe(edad),
    avatar: p.avatar ?? '🧑',
    estado: p.estado ?? '',
    // Quién se entera de **todos** los gastos, le toquen o no (§14.58). Nace
    // apagado: es un encargo, no un rasgo, y lo pone quien administra.
    llevaLasCuentas: p.llevaLasCuentas ?? false,
  })
}
export const personsOf = (eventId) => db.persons.where({ eventId }).toArray()
export const updatePerson = (id, patch) => escribir('persons', id, patch)
export const removePerson = (id) => removeRow('persons', id)

/**
 * Tu estado, con su «cuándo» (§14.36-bis). El `estadoEl` lo escribe el cliente
 * —no vale `updatedAt`, que se mueve al corregir un apodo— y por eso la tira de
 * «Hoy» ordena por novedad desde el primer pintado, sin esperar a sincronizar.
 * Vaciarlo lo borra. Vive aquí y no en cada pantalla porque lo escriben dos
 * —la pastilla de la cabecera y el botón de «Hoy» (§14.45)— y dos copias de la
 * misma regla se separan a la primera.
 */
export const ponerEstado = (id, texto) =>
  updatePerson(id, { estado: texto, estadoEl: texto ? now() : null })

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
// El orden de la carta vive en `lib/carta.js`: no es un hecho de la base, es
// cómo se come, y lo leen cuatro pantallas. Se reexporta para no romper a quien
// ya lo importaba de aquí.
export { DISH_CATEGORIES } from './lib/carta.js'
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
export async function addDish({ name, categorias = [], esFavorito = false, ingredientes = [], raciones = null, receta = '' }, evento = null) {
  const eventId = evento?.esDemo ? evento.id : null
  // `raciones` es **para cuántos es la receta**, y sin él una cantidad no se
  // puede estirar (SPECS §14.20). Va una vez por plato y no por ingrediente: el
  // arroz para 12 y el pan para 20 es exactamente el lío que hace que nadie
  // rellene nada.
  // `receta` es **cómo se hace**, texto libre (§14.64). Va aparte de
  // `ingredientes` porque son dos preguntas: de la lista sale la compra, y de
  // esto sale lo que se lee delante del fuego. Vacío = sin receta escrita.
  return escribir('dishes', uid('dish'), { name, categorias, esFavorito, ingredientes, raciones, receta, eventId })
}

export async function listDishes(evento = null) {
  const todos = await db.dishes.toArray()
  return evento?.esDemo
    ? todos.filter((d) => d.eventId === evento.id)
    : todos.filter((d) => !d.eventId)
}
export const updateDish = (id, patch) => escribir('dishes', id, patch)
export const removeDish = (id) => removeRow('dishes', id)

/**
 * ── Cenas (§6) — una por día ──
 *
 * Una cena es **sus platos y sus dos bungas**, y nada más. `queSeHace` y
 * `cantidades` —dos textos libres que se escribían en dos pantallas y se leían
 * en una tercera— se retiraron en §14.21 (`docs/diseño/agenda-dia.html · B4`).
 *
 * Las columnas siguen en D1 y en `tablas.js` **a propósito**: quitarlas no gana
 * nada —no ocupan, no se sincroniza de más— y rompería a un móvil que todavía no
 * se haya actualizado y siga mandando el campo. Lo escrito se queda dormido, que
 * es lo barato y lo reversible.
 */
export async function addDinner(eventId, d) {
  return escribir('dinners', uid('cena'), {
    eventId,
    dia: d.dia,
    platoIds: d.platoIds ?? [],
    // Los niños heredan la lista de arriba mientras esto sea `null` (G2). En
    // cuanto se les quita o se les añade algo, tienen la suya y las dos mesas
    // dejan de ser una división.
    platoIdsNinos: d.platoIdsNinos ?? null,
    bungaMayoresId: d.bungaMayoresId ?? null,
    bungaNinosId: d.bungaNinosId ?? null,
  })
}
export const dinnersOf = (eventId) => db.dinners.where({ eventId }).sortBy('dia')
export const updateDinner = (id, patch) => escribir('dinners', id, patch)
export const removeDinner = (id) => removeRow('dinners', id)

// ── Ideas de plan (catálogo compartido, §14.18) ──
/**
 * La idea: lo que se repite de un viaje a otro. Ni día, ni estado, ni votos —
 * esos tres son de *ese* agosto y no viajan nunca (`traerIdeaAlViaje`).
 *
 * Comparte con los platos el trato del evento de demostración: sin `eventId` la
 * idea es del catálogo de todos; con él, solo de ese evento, que hoy es
 * únicamente el Demo. Sin eso, trastear en la demostración volvería a ensuciar
 * el catálogo de verdad, que es lo que se acaba de arreglar en §14.9-quater.
 */
export async function addPlanIdea({ titulo, descripcion = '', enlace = '', creadaPor = null }, evento = null) {
  const eventId = evento?.esDemo ? evento.id : null
  // `apuntadaEl` la escribe el cliente, y no vale `creadoEn`: esa la pone el
  // Worker al insertar, así que una idea recién apuntada no tendría fecha hasta
  // sincronizar, y en la web —que no sincroniza a propósito— no la tendría
  // nunca (§14.19-ter, `docs/diseño/planes-ideas.html`, defecto 1).
  return escribir('planIdeas', uid('idea'), {
    titulo, descripcion, enlace, creadaPor, apuntadaEl: now(), eventId,
  })
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

// ── Mejoras: el roadmap de la app, apuntado desde el móvil (§14.22) ──
/**
 * Lo que cabe en una mejora. El mismo número que rechaza el Worker
 * (`TOPE_DE_MEJORA` en `api/src/repositorio.js`): aquí se corta antes de
 * guardar y allí se rechaza, que es lo que hace que siga siendo verdad cuando
 * el que escribe no es esta pantalla. Sin tope, un pegado largo entra en la
 * instantánea del grupo entero y se descarga en cada sincronización, para
 * siempre.
 */
export const TOPE_DE_MEJORA = 2000

/**
 * Una mejora es una idea sobre la propia aplicación, no sobre el viaje
 * (figura del bloque «Mejoras» de `garciadoral-ops`). No se llama «idea»
 * porque una idea aquí es una idea de plan, y compartir el nombre obligaría a
 * cada frase a decir de cuál habla.
 *
 * Es global como los catálogos —una mejora no caduca con el evento— y comparte
 * con ellos el trato del Demo: sin `eventId` es de todos; con él, solo de ese
 * evento, que hoy es únicamente el cajón de arena (§14.9-quater).
 *
 * `hecho` va sin quién ni cuándo a propósito: eso sería un registro de trabajo
 * y esto es una lista de la compra. `apuntadaEl` la escribe el cliente, como en
 * las ideas (§14.19-ter): `creadoEn` es del servidor y no existe hasta
 * sincronizar.
 */
export async function addMejora({ texto, autorId = null }, evento = null) {
  const eventId = evento?.esDemo ? evento.id : null
  return escribir('mejoras', uid('mej'), {
    texto: String(texto).slice(0, TOPE_DE_MEJORA),
    hecho: false,
    autorId,
    apuntadaEl: now(),
    eventId,
  })
}

/**
 * Las de la casa: lo que falta arriba y lo hecho al final, tachado.
 *
 * Es el orden de una lista que se mira para saber qué queda —no debe empezar
 * por lo que ya no queda—. Dentro de cada mitad, las más nuevas primero, sobre
 * cuándo se tuvo la idea (`apuntadaEl`) y no sobre cuándo se le arregló una
 * errata (`updatedAt`).
 */
export async function listMejoras(evento = null) {
  const todas = await db.mejoras.toArray()
  const suyas = evento?.esDemo
    ? todas.filter((m) => m.eventId === evento.id)
    : todas.filter((m) => !m.eventId)
  return suyas.sort((a, b) => (Boolean(a.hecho) === Boolean(b.hecho)
    ? (b.apuntadaEl || '').localeCompare(a.apuntadaEl || '')
    : Boolean(a.hecho) - Boolean(b.hecho)))
}

export const updateMejora = (id, patch) => escribir('mejoras', id, {
  ...patch,
  ...(typeof patch.texto === 'string' ? { texto: patch.texto.slice(0, TOPE_DE_MEJORA) } : {}),
})
export const removeMejora = (id) => removeRow('mejoras', id)

// ── Trucos: lo que hay que acordarse de un viaje a otro (§14.53) ──
//
// Hermano de `mejoras` en la forma y distinto en el fondo: una mejora se hace y
// se tacha, y un truco **no se tacha nunca** porque no es una tarea, es algo que
// sigue siendo verdad el año que viene. Por eso no hay `hecho` ni estado por
// evento: se pensó una lista de embarque que se tildara cada viaje y se
// descartó a propósito — lo que se pidió es saber, no una tarea más.
//
// Compartido entre eventos como los otros dos catálogos, con la misma excepción
// del Demo (§14.9-quater).
export const TOPE_DE_TRUCO = 2000

export const TRUCO_CATEGORIAS = [
  { id: 'antes', label: 'Antes de salir', icon: '🎒' },
  { id: 'coche', label: 'El coche', icon: '🚗' },
  { id: 'camping', label: 'El camping', icon: '⛺️' },
  { id: 'cocina', label: 'La cocina', icon: '🍳' },
  { id: 'playa', label: 'La playa', icon: '🏖️' },
  { id: 'otros', label: 'Otros', icon: '🐳' },
]

export async function addTruco({ texto, categoria = 'otros', autorId = null }, evento = null) {
  const eventId = evento?.esDemo ? evento.id : null
  return escribir('trucos', uid('truco'), {
    texto: String(texto).slice(0, TOPE_DE_TRUCO),
    categoria,
    autorId,
    apuntadoEl: now(),
    eventId,
  })
}

/** Los de esta instalación, agrupados por quien los pinte. Nuevos arriba. */
export async function listTrucos(evento = null) {
  const todos = await db.trucos.toArray()
  const suyos = evento?.esDemo
    ? todos.filter((t) => t.eventId === evento.id)
    : todos.filter((t) => !t.eventId)
  return suyos.sort((a, b) => (b.apuntadoEl || '').localeCompare(a.apuntadoEl || ''))
}

export const updateTruco = (id, patch) => escribir('trucos', id, {
  ...patch,
  ...(typeof patch.texto === 'string' ? { texto: patch.texto.slice(0, TOPE_DE_TRUCO) } : {}),
})
export const removeTruco = (id) => removeRow('trucos', id)

// ── Comentarios: el hilo de cualquier cosa (§14.55) ──
//
// **Una tabla con ancla, y no una columna por tabla.** El ancla es
// `'<tipo>:<id>'` —`plan:abc`, `gasto:def`, `dia:2026-08-15`—, y con ella el
// mismo componente sirve en las ocho pantallas donde un comentario pide salir.
// La alternativa era un JSON dentro de cada fila, y tenía dos defectos que no se
// arreglan después: una migración por sitio, y **dos personas comentando a la
// vez se pisan**, porque cada una sube la fila entera del plan.
export const TOPE_DE_COMENTARIO = 2000

/** El ancla de una cosa. Un solo sitio, para que las dos puntas coincidan. */
export const anclaDe = (tipo, id) => `${tipo}:${id}`

export async function addComentario(eventId, { ancla, texto, autorId = null }) {
  return escribir('comentarios', uid('com'), {
    eventId,
    ancla,
    texto: String(texto).slice(0, TOPE_DE_COMENTARIO),
    autorId,
    escritoEl: now(),
  })
}

/** El hilo de una cosa, del más viejo al más nuevo: se lee como una conversación. */
export const comentariosDe = (eventId, ancla) => db.comentarios
  .where({ ancla }).toArray()
  .then((filas) => filas
    .filter((c) => !eventId || c.eventId === eventId)
    .sort((a, b) => String(a.escritoEl).localeCompare(String(b.escritoEl))))

/** Todos los del evento, para contar sin abrir nada (el globo de la fila). */
export const comentariosDelEvento = (eventId) => db.comentarios.where({ eventId }).toArray()

export const updateComentario = (id, patch) => escribir('comentarios', id, {
  ...patch,
  ...(typeof patch.texto === 'string' ? { texto: patch.texto.slice(0, TOPE_DE_COMENTARIO) } : {}),
})
export const removeComentario = (id) => removeRow('comentarios', id)

// ── Alojamientos: el catálogo que hace que un bunga tenga historia (§14.56) ──
//
// `bungas` cuelga de un evento, así que el «Bunga 12» de 2025 y el de 2026 eran
// **dos filas sin nada que las una**: una nota escrita este agosto se iba con el
// evento y el histórico no existía. El catálogo es la misma figura que
// `dishes` ↔ `dinners` y `planIdeas` ↔ `plans`, por cuarta vez.
//
// Lo que vive aquí es lo que **no cambia de un año a otro**: cómo es el sitio.
// Lo que vive en el bunga del evento es de ese agosto: qué familia lo tiene.
export const PEGATINAS = [
  { id: 'nevera', label: 'buena nevera', icon: '🧊' },
  { id: 'bano', label: 'baño bien', icon: '🚿' },
  { id: 'tranquilo', label: 'tranquilo', icon: '🔇' },
  { id: 'sombra', label: 'sombra', icon: '🌳' },
  { id: 'enchufes', label: 'enchufes', icon: '🔌' },
  { id: 'bichos', label: 'bichos', icon: '🐜' },
  { id: 'cobertura', label: 'sin cobertura', icon: '📶' },
]

export async function addAlojamiento({ name, notas = '', pegatinas = [] }, evento = null) {
  const eventId = evento?.esDemo ? evento.id : null
  return escribir('alojamientos', uid('aloj'), { name, notas, pegatinas, eventId })
}

export async function listAlojamientos(evento = null) {
  const todos = await db.alojamientos.toArray()
  const suyos = evento?.esDemo
    ? todos.filter((a) => a.eventId === evento.id)
    : todos.filter((a) => !a.eventId)
  return suyos.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
}

export const updateAlojamiento = (id, patch) => escribir('alojamientos', id, patch)
export const removeAlojamiento = (id) => removeRow('alojamientos', id)

/** Todos los bungas de todos los eventos: es de donde sale el histórico. */
export const todosLosBungas = () => db.bungas.toArray()

// ── Cacharros: el que trae cada familia, y quién vota cuál (§14.57) ──
//
// Es un plan con otro nombre —`votos` es el mismo mapa persona → voto— con dos
// reglas propias: **uno por familia**, que es lo que lo convierte en un ranking
// y no en una lista, y **un voto por cabeza**, que es lo que hace que haya
// ganador. Con 👍 múltiple los tres empatan a nueve.
export const cacharrosOf = (eventId) => db.cacharros.where({ eventId }).toArray()

export async function addCacharro(eventId, { familyId, texto }) {
  return escribir('cacharros', uid('cach'), {
    eventId, familyId, texto, votos: {}, apuntadoEl: now(),
  })
}

export const updateCacharro = (id, patch) => escribir('cacharros', id, patch)
export const removeCacharro = (id) => removeRow('cacharros', id)

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
export function traerIdeaAlViaje(eventId, idea, { estado } = {}) {
  return addPlan(eventId, {
    titulo: idea.titulo,
    descripcion: idea.descripcion,
    enlace: idea.enlace,
    ideaId: idea.id,
    // Y desde §14.59, con qué cara nace: a votación (lo de siempre) o decidida.
    // La pregunta se hace **aquí**, al proponer, porque es donde uno la tiene en
    // la cabeza: proponer «la paella del sábado» ya es haberlo decidido.
    ...(estado ? { estado } : {}),
  })
}

/**
 * Qué ideas ya están propuestas en este viaje.
 *
 * Se podía proponer la misma dos veces y quedaban dos filas idénticas
 * compitiendo por los mismos votos, que además reparte el recuento en dos y
 * ninguna gana. Con esto el botón dice «Ya propuesta» y no hace nada.
 */
export async function ideasYaPropuestas(eventId) {
  const suyos = await db.plans.where({ eventId }).toArray()
  const mapa = new Map()
  for (const p of suyos) {
    if (!p.ideaId) continue
    // Si la misma idea estuviera dos veces —no debería, pero el dato viejo
    // manda—, vale la más reciente: es la que contesta «¿esto es de ahora?».
    const antes = mapa.get(p.ideaId)
    if (!antes || (p.propuestoEl ?? '') > (antes.propuestoEl ?? '')) mapa.set(p.ideaId, p)
  }
  return mapa
}

/**
 * Devolver un plan al catálogo: se va de este viaje y la idea se queda.
 *
 * Es lo contrario de proponer, y solo lo hace quien administra. Si el plan salió
 * de una idea, esa idea sigue donde estaba y basta con retirar el plan; si lo
 * escribió alguien a mano, primero se guarda para no perderlo.
 */
export async function devolverPlanAIdea(plan, evento = null) {
  if (!plan.ideaId) await guardarPlanComoIdea(plan, evento)
  await removePlan(plan.id)
}

/** El camino inverso: este plan ha salido bien, guárdalo para el año que viene. */
export async function guardarPlanComoIdea(plan, evento = null) {
  const ideaId = await addPlanIdea({
    titulo: plan.titulo,
    descripcion: plan.descripcion,
    enlace: plan.enlace,
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
    // Cuándo se propuso **a este viaje**, que no es cuándo se apuntó la idea:
    // en el catálogo puede llevar tres agostos. Es la fecha que enseña el grupo
    // «Propuestas» de Ideas (`docs/diseño/planes-ideas.html` · F2).
    propuestoEl: p.propuestoEl ?? now(),
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
export async function addShopItem(eventId, { texto, categoria = 'otros', ...resto }) {
  return escribir('shop', uid('shop'), {
    eventId, texto, categoria, comprado: false, compradoPor: null, compradoEn: null,
    // **De quién es la línea** (§14.54). Nula = común, que es como nace todo lo
    // de siempre y lo que calculan las cenas. Con valor, es de esa familia — y
    // se sigue viendo: en esta app no hay nada privado, y quien sale hacia el
    // súper mira la pantalla y pregunta una vez en vez de nueve.
    familyId: resto.familyId ?? null,
    // De dónde sale la línea. `mano` es lo de siempre —hielos, bolsas de
    // basura— y **no se toca nunca** al recalcular; `cena` viene de una receta
    // y es lo único que se puede rehacer solo (SPECS §14.20).
    origen: resto.origen ?? 'mano',
    clave: resto.clave ?? null,
    cantidad: resto.cantidad ?? null,
    unidad: resto.unidad ?? '',
    compra: resto.compra ?? '',
    exacto: resto.exacto ?? null,
    envase: resto.envase ?? '',
    desglose: resto.desglose ?? null,
    // Lo que decía antes, cuando el número ha cambiado por su cuenta. Se enseña
    // hasta que alguien marca la línea: un número que cambia sin decir por qué
    // no se lee como «bien calculado», se lee como «esto se mueve solo».
    cambio: resto.cambio ?? null,
  })
}
export const shopItemsOf = (eventId) => db.shop.where({ eventId }).toArray()
export const updateShopItem = (id, patch) => escribir('shop', id, patch)
export const removeShopItem = (id) => removeRow('shop', id)
// Marcar/desmarcar comprado registrando quién (personId) y cuándo. Marcar
// también borra el «venía de» del recálculo: ya se ha visto y ya está en el carro.
export const markBought = (id, personId = null) =>
  updateShopItem(id, { comprado: true, compradoPor: personId, compradoEn: now(), cambio: null })
export const unmarkBought = (id) =>
  updateShopItem(id, { comprado: false, compradoPor: null, compradoEn: null })
/**
 * Rehace las líneas de la compra que vienen de las cenas (SPECS §14.20).
 *
 * Tres reglas, y las tres son de una sola frase:
 *
 * - **Lo escrito a mano no se toca nunca.** «Hielos» y «bolsas de basura» no son
 *   de ninguna receta y la lista tiene que seguir siendo el sitio donde se
 *   apunta lo que se te ocurre.
 * - **Lo ya comprado tampoco.** Es lo único que no se puede deshacer: ya está en
 *   el carro. Si la cuenta ha cambiado después, esa línea se queda como estaba.
 * - **Lo que cambia, lo dice** (E2): se guarda de cuánto venía en `cambio`, y el
 *   renglón desaparece en cuanto alguien marca la línea.
 *
 * Devuelve un resumen —cuántas nacieron, cuántas cambiaron y cuántas se
 * quitaron— para poder contarlo sin volver a leer la tabla.
 */
export async function sincronizarCompraDesdeCenas(eventId, { cenas, platos, personas }) {
  const calculado = loQueHayQueComprar({ cenas, platos, personas })
  const enLista = (await db.shop.where({ eventId }).toArray()).filter((x) => x.origen === 'cena')
  const porClave = new Map(enLista.map((x) => [x.clave, x]))
  const resumen = { nuevas: 0, cambiadas: 0, quitadas: 0 }

  for (const linea of calculado) {
    const ya = porClave.get(linea.clave)
    porClave.delete(linea.clave)
    const campos = {
      texto: linea.nombre,
      cantidad: linea.cantidad,
      unidad: linea.unidad,
      desglose: linea.desglose,
      // Lo que se mete en el carro, ya redondeado al envase —«2 paquetes de
      // 1 kg»—, y debajo la cifra exacta por si se ve claro coger de menos.
      // 1,62 kg no se compran; dos paquetes de uno, sí.
      compra: linea.texto,
      exacto: linea.exacto,
      envase: linea.envase,
    }
    if (!ya) {
      await addShopItem(eventId, { ...campos, categoria: 'comida', origen: 'cena', clave: linea.clave })
      resumen.nuevas += 1
      continue
    }
    if (ya.comprado) continue
    const igual = ya.cantidad === linea.cantidad && ya.texto === linea.nombre && ya.compra === linea.texto
    if (igual) continue
    await updateShopItem(ya.id, {
      ...campos,
      cambio: { antes: ya.cantidad, unidad: ya.unidad ?? '' },
    })
    resumen.cambiadas += 1
  }

  // Lo que ya no sale en ninguna cena se va, salvo que esté comprado: eso ya
  // está en el carro y quitarlo de la lista no lo saca de ahí.
  for (const sobra of porClave.values()) {
    if (sobra.comprado) continue
    await removeShopItem(sobra.id)
    resumen.quitadas += 1
  }
  return resumen
}

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
  // **Sembrar no es hacer** (§14.50). Sin esto, cargar el Demo deja 45 renglones
  // —«Alguien dio de alta a los García», «Alguien apuntó a Curro»— y el recap se
  // abre lleno antes de que nadie haya tocado nada. Medido en el navegador: son
  // exactamente las 45 escrituras de esta función.
  registrando = false
  try {
    return await sembrarElEjemplo()
  } finally {
    registrando = true
  }
}

async function sembrarElEjemplo() {
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
  const garcia = await addFamily(eventId, { name: 'García', color: '#E5544B', avatar: '🏖️' })
  const perez = await addFamily(eventId, { name: 'Pérez', color: '#2E9E6B', avatar: '🍷' })
  const solteros = await addFamily(eventId, { name: 'Solteros', color: '#1FA6D6', avatar: '🎉' })
  await addBunga(eventId, { name: 'Bunga 1', alias: 'El de la piscina', familyId: garcia })
  const bPerez = await addBunga(eventId, { name: 'Bunga 2', alias: 'El del ruido', familyId: perez })
  const bSolteros = await addBunga(eventId, { name: 'Bunga 3', alias: 'El del fondo', familyId: solteros })
  const curro = await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto' })
  await addPerson(eventId, { name: 'Marta', familyId: garcia, edad: 'adulto' })
  // Fran es el caso que dio pie a §14.49: se apuntó de «niño» con las dos
  // casillas puestas a mano —come con los mayores y cuenta como uno— porque la
  // edad «Adolescente» todavía no existía, y así salía dentro de «Mayores» con
  // la ficha diciendo «Niño». Ahora la edad lo dice sola.
  await addPerson(eventId, { name: 'Fran', familyId: garcia, edad: 'adolescente', apodo: 'el adolescente' })
  const ana = await addPerson(eventId, { name: 'Ana', familyId: perez, edad: 'adulto' })
  await addPerson(eventId, { name: 'Luis', familyId: perez, edad: 'adulto' })
  const pablo = await addPerson(eventId, { name: 'Pablo', familyId: solteros, edad: 'adulto' })

  // Gastos de ejemplo (para que Saldos y Stats tengan datos).
  const all = await personsOf(eventId)
  const allPids = all.map((p) => p.id)
  const soloMayores = all.filter(esMayor).map((p) => p.id)
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
    {
      name: 'Paella mixta',
      categorias: ['principal'],
      esFavorito: true,
      raciones: 12,
      ingredientes: [
        { nombre: 'Arroz bomba', cantidad: 1.2, unidad: 'kg', lote: { tamano: 1, unidad: 'kg', nombre: 'paquete' } },
        { nombre: 'Mejillones', cantidad: 30, unidad: 'ud', lote: { tamano: 1, unidad: 'kg', nombre: 'malla' } },
        { nombre: 'Pollo troceado', cantidad: 1, unidad: 'ud' },
        // Sin cantidad a propósito: es el caso que enseña el botón de la IA.
        { nombre: 'Azafrán' },
      ],
    },
    {
      name: 'Pan con tomate',
      categorias: ['acompanamiento'],
      raciones: 12,
      ingredientes: [
        { nombre: 'Pan de payés', cantidad: 2, unidad: 'ud', lote: { tamano: 1, unidad: 'ud', nombre: 'hogaza' } },
        { nombre: 'Tomate de untar', cantidad: 8, unidad: 'ud' },
      ],
    },
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
