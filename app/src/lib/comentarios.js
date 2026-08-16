/**
 * Los comentarios: de quién es un hilo, qué hay sin leer y a quién avisa
 * (SPECS §14.55, `docs/diseño/donde-vive-el-grupo.html` · K2 · K4 · K6).
 *
 * **El ancla es lo que hace que esto valga en ocho sitios.** Un comentario no
 * guarda «el plan» ni «el gasto»: guarda `'<tipo>:<id>'`. La alternativa era una
 * columna JSON en cada tabla, y tenía dos defectos que no se arreglan después —
 * una migración por sitio, y **dos personas comentando a la vez se pisan**,
 * porque cada una sube la fila entera del plan—.
 *
 * **Lo leído se guarda en el móvil y no se sincroniza** (K6, la variante
 * barata). La exacta —una marca por persona y por hilo, sincronizada— es una
 * tabla más y una escritura cada vez que abres algo; ésta se equivoca solo al
 * cambiar de teléfono, y lo que se pierde entonces es un punto azul.
 */

const CLAVE = (eventId) => `ballena.leido:${eventId}`

/** Lo visto en este móvil: `{ [ancla]: iso }`. Nunca lanza. */
export function leidos(eventId) {
  if (!eventId || typeof localStorage === 'undefined') return {}
  try {
    const puesto = JSON.parse(localStorage.getItem(CLAVE(eventId)) || '{}')
    return puesto && typeof puesto === 'object' ? puesto : {}
  } catch {
    return {}
  }
}

/**
 * Marca un hilo como visto **hasta el último que hay**, y no hasta «ahora».
 *
 * Con «ahora» un comentario escrito mientras tienes el hilo abierto quedaría
 * marcado como visto sin haberlo visto, porque su fecha es anterior al momento
 * en que se cierra la pantalla.
 */
export function marcarLeido(eventId, ancla, hasta) {
  if (!eventId || !ancla || typeof localStorage === 'undefined') return
  try {
    const puesto = leidos(eventId)
    if (hasta && String(puesto[ancla] ?? '') >= String(hasta)) return
    localStorage.setItem(CLAVE(eventId), JSON.stringify({ ...puesto, [ancla]: hasta ?? '' }))
  } catch { /* sin sitio en el disco: se pierde el punto, no el comentario */ }
}

/** Se olvida al salir de la cuenta, como el resto de lo local. */
export function olvidarLeidos(eventId) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(CLAVE(eventId)) } catch { /* da igual */ }
}

/**
 * Y todas de golpe, que es lo que hace falta al salir de la cuenta: no se sabe
 * de cuántos eventos había marcas, y el que entre después en este móvil no puede
 * heredar los puntos apagados del anterior.
 */
export function olvidarTodosLosLeidos() {
  if (typeof localStorage === 'undefined') return
  try {
    for (const clave of Object.keys(localStorage)) {
      if (clave.startsWith('ballena.leido:')) localStorage.removeItem(clave)
    }
  } catch { /* da igual */ }
}

/**
 * Cuántos de este hilo no has visto tú.
 *
 * **Lo tuyo nunca cuenta como sin leer.** Es lo primero que se nota si falta:
 * escribes un comentario y tu propia fila se enciende con un punto.
 */
export function sinLeer(comentarios = [], { eventId, ancla, meId } = {}) {
  const marca = leidos(eventId)[ancla] ?? ''
  return comentarios.filter((c) => c.autorId !== meId && String(c.escritoEl ?? '') > String(marca)).length
}

/** El más nuevo del hilo, que es hasta dónde se marca al abrirlo. */
export const ultimoDe = (comentarios = []) => comentarios
  .reduce((max, c) => (String(c.escritoEl ?? '') > max ? String(c.escritoEl) : max), '')

/**
 * Los dos últimos, que es lo que se enseña dentro de la capa (K2).
 *
 * Se eligió esto y no el hilo entero: la capa de un plan mide 470 pt y con ocho
 * comentarios dentro pasa de 900, así que habría que rodar dentro de un modal
 * para llegar a escribir — el defecto que §14.26 le quitó a la ficha de un
 * gasto. Con dos crece 130 pt y **se para ahí**, con ocho o con ochenta.
 */
export const LOS_ULTIMOS = 2
export const ultimos = (comentarios = [], cuantos = LOS_ULTIMOS) => comentarios.slice(-cuantos)

/**
 * A quién le importa un comentario nuevo (N1 ∪ N2).
 *
 * Dos listas que se suman, y las dos hacen falta:
 *
 *  · **los involucrados** (N1) — quien votó el plan, a quien le mueve el saldo
 *    el gasto, quien come en esa mesa. Es lo que se pidió y es lo correcto.
 *  · **los del hilo** (N2) — quien ya escribió ahí. Sin esto, contestarle a
 *    alguien que no votó el plan **no le llega**, y eso es lo primero que rompe
 *    una conversación.
 *
 * Nunca a quien lo escribe, que es la regla 1 de todos los avisos de la casa.
 */
export function aQuienLeImporta({ involucrados = [], enElHilo = [], autor = null } = {}) {
  const todos = new Set([...involucrados, ...enElHilo])
  todos.delete(autor)
  todos.delete(null)
  todos.delete(undefined)
  return [...todos]
}
