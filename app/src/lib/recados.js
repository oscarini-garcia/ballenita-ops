/**
 * Los recados: un emoji y una frase, sacados de lo que está pasando en el viaje.
 *
 * Son las opciones **D3 + D2** de `docs/diseño/verano.html`. Dos fuentes que se
 * mezclan en una sola bolsa y de la que se saca una al azar:
 *
 * - **Con los datos del evento** (esto, puro y testeado): no son frases, son
 *   plantillas con un número dentro, sacadas de lo que ya hay apuntado. No dan
 *   risa por ser ingeniosas sino **por ser verdad**, y no se repiten porque los
 *   datos cambian.
 * - **De la IA** (`lib/tanda.js` + `api/src/recados.js`): una tanda por evento,
 *   compuesta en el servidor con el contexto del viaje, que se refresca cada dos
 *   horas y se guarda en el móvil.
 *
 * Tres reglas que hay que respetar al añadir una plantilla:
 *
 * - **Cada una lleva su guarda.** Una regla que se dispara con datos absurdos
 *   dice tonterías —«0 cañas en 0 días»—, y una tontería con un número dentro se
 *   lee como que la app cuenta mal.
 * - **No se señala a nadie.** Ni a una persona ni a una familia: «lleváis cuatro
 *   días sin apuntar nada» tiene gracia y «los García llevan cuatro días sin
 *   apuntar nada» la pierde el día que alguien lo lea torcido. Se habla en
 *   plural o de números, nunca de quién.
 * - **La frase cabe en 37 caracteres… o no.** No hay tope duro porque el recado
 *   vive al final de la lista y en los vacíos, donde una segunda línea no cuesta
 *   nada (por eso se descartó el renglón fijo, C1). Pero corta se lee mejor.
 */

import { formatCents } from './money.js'
import { hoyISO, diasEntre } from './dias.js'
import { seHace } from './planes.js'

/** Plural sin pensar: `n === 1 ? uno : varios`. */
const pl = (n, uno, varios) => (n === 1 ? uno : varios)

/**
 * Los recados que salen de los datos del evento **ahora mismo**.
 *
 * Devuelve solo los que se cumplen: la lista puede venir vacía perfectamente
 * —un evento recién creado no tiene nada que contar— y quien la use tiene que
 * aguantar eso sin pintar un hueco.
 */
export function recadosDeDatos({
  evento = null,
  gastos = [],
  cenas = [],
  planes = [],
  compra = [],
  personas = [],
  platos = [],
  hoy = hoyISO(),
} = {}) {
  const salida = []
  const pon = (id, emoji, texto) => salida.push({ id, emoji, texto })
  const moneda = evento?.currency || 'EUR'

  // ── Dinero ───────────────────────────────────────────────────────────────
  const totalCents = gastos.reduce((s, g) => s + (g.amountCents ?? 0), 0)
  if (totalCents > 0 && personas.length > 0) {
    const cabeza = Math.round(totalCents / personas.length)
    pon('total', '💸', `${formatCents(totalCents, moneda)} apuntados. Salís a ${formatCents(cabeza, moneda)} por cabeza.`)
  }

  const bebidas = gastos.filter((g) => g.category === 'bebida')
  if (bebidas.length >= 3 && personas.length > 0) {
    pon('bebida', '🍻', `${bebidas.length} rondas apuntadas y sois ${personas.length}. La ballena no juzga.`)
  }

  // Cuántos días lleva la caja sin moverse. Es la plantilla que más gracia hace
  // y la que más cuidado pide: se habla de todos, no de quien no ha apuntado.
  const ultimo = gastos.map((g) => g.dateISO).filter(Boolean).sort().at(-1)
  if (ultimo) {
    const seco = diasEntre(ultimo, hoy)
    if (seco >= 2) pon('seco', '🧾', `${seco} días sin apuntar un gasto. O invita la casa.`)
  }

  // ── La compra ────────────────────────────────────────────────────────────
  const faltan = compra.filter((c) => !c.comprado).length
  if (faltan > 0) {
    const hayCenaHoy = cenas.some((c) => c.dia === hoy)
    pon('compra', '🛒', hayCenaHoy
      ? `Faltan ${faltan} ${pl(faltan, 'cosa', 'cosas')} de la compra y la cena es hoy.`
      : `Faltan ${faltan} ${pl(faltan, 'cosa', 'cosas')} de la compra.`)
  }

  // ── Cenas ────────────────────────────────────────────────────────────────
  const sinBunga = cenas.filter((c) => !c.bungaMayoresId).length
  if (sinBunga > 0) {
    pon('sinbunga', '🍳', `${sinBunga} ${pl(sinBunga, 'cena', 'cenas')} sin saber dónde se cena.`)
  }

  const cuenta = new Map()
  for (const c of cenas) for (const id of c.platoIds ?? []) cuenta.set(id, (cuenta.get(id) ?? 0) + 1)
  let campeon = null
  for (const [id, veces] of cuenta) if (!campeon || veces > campeon.veces) campeon = { id, veces }
  if (campeon && campeon.veces >= 3) {
    const nombre = platos.find((p) => p.id === campeon.id)?.name
    if (nombre) pon('plato', '🍽️', `${nombre}, por ${campeon.veces}ª vez. Nadie se ha quejado.`)
  }

  // ── Planes ───────────────────────────────────────────────────────────────
  // Lo mismo de §14.74: sin esto, un plan ya decidido seguía «esperando votos».
  const aVotacion = planes.filter((p) => !seHace(p))
  const sinVotos = aVotacion.filter((p) => Object.keys(p.votos ?? {}).length === 0)
  if (sinVotos.length > 0) {
    pon('sinvotos', '🗳️', `${sinVotos.length} ${pl(sinVotos.length, 'plan', 'planes')} sin un solo voto. Ni de quien lo propuso.`)
  } else if (aVotacion.length > 0) {
    pon('votacion', '🗳️', `${aVotacion.length} ${pl(aVotacion.length, 'plan', 'planes')} ${pl(aVotacion.length, 'espera', 'esperan')} votos.`)
  }

  // ── El calendario ────────────────────────────────────────────────────────
  if (evento?.endDate && evento?.startDate && hoy >= evento.startDate && hoy <= evento.endDate) {
    const quedan = diasEntre(hoy, evento.endDate)
    if (quedan === 0) pon('ultimo', '🫡', 'Último día. Aprovechad la piscina.')
    else if (quedan <= 2) pon('quedan', '⏳', `Quedan ${quedan} ${pl(quedan, 'día', 'días')}. Aprovechad la piscina.`)
  }

  return salida
}

/**
 * La bolsa entera: lo que sale de los datos y lo que trajo la IA.
 *
 * No se ordena ni se pondera: los de datos son pocos y condicionales —de cero a
 * cinco— y la tanda son una docena, así que sacando al azar de la bolsa junta
 * salen números de verdad una de cada cuatro o cinco veces, que es la
 * proporción que hace que sorprendan.
 */
export function bolsaDeRecados(datos = [], tanda = []) {
  const limpios = (tanda || [])
    .filter((r) => r && typeof r.texto === 'string' && r.texto.trim())
    .map((r, i) => ({ id: `ia-${i}`, emoji: String(r.emoji || '🐳').trim(), texto: r.texto.trim() }))
  return [...datos, ...limpios]
}

/**
 * Uno al azar.
 *
 * `semilla` existe para poder testear y para que **no cambie a cada pintado**:
 * quien lo use pasa algo estable mientras la pantalla esté montada (un número
 * sorteado una vez), no `Math.random()` en el render, que haría bailar la frase
 * cada vez que React vuelva a pintar.
 */
export function elegirRecado(bolsa = [], semilla = Math.random()) {
  if (!bolsa.length) return null
  const i = Math.floor(Math.abs(semilla) * bolsa.length) % bolsa.length
  return bolsa[i]
}
