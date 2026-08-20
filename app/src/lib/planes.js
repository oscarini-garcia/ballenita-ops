/**
 * Lo que se dice de un plan sin abrirlo: cuántos lo quieren y quién falta.
 *
 * Vive aparte porque lo dicen **dos pantallas** —la fila cerrada de Planes y la
 * hoja que coloca un plan en un día desde Agenda— y dos sitios que cuentan lo
 * mismo con palabras distintas se leen como dos cosas distintas. Además es
 * lógica pura: se prueba sin montar React.
 *
 * Ver `docs/diseño/planes-votar.html · V5` (qué dice la fila cerrada) y
 * `docs/diseño/agenda-dia.html · C2` (la hoja de planes libres).
 */

/** Cuántos han dicho que sí. El 🤷 y el 👎 no suman. */
import { losQueEstan } from './personas.js'

export const votosDe = (plan) => Object.values(plan?.votos ?? {}).filter((v) => v === '👍').length

/**
 * **Hay cosas que no se someten a votación: se hacen y punto** (SPECS §14.59,
 * `docs/diseño/siete-encargos.html` · P1·P3·P4).
 *
 * La columna `plans.estado` existe desde §14.18 y llevaba desde entonces
 * escribiéndose (`'votando'`), viajando a D1 y a la instantánea, y **sin que la
 * leyera nadie**: lo que separaba «Elegidos» de «Disponibles» era tener día. El
 * encargo no pedía una columna nueva, pedía usar la que estaba.
 *
 * Lo que cambia en pantalla es lo que se quería: un plan que se hace **no
 * enseña sus 👍 ni cuenta quién falta por votar**. Enseñarlo era la queja —un
 * plan ya decidido con «faltan Ana y Luis» debajo dice que aún se está
 * decidiendo—, y lo único que le queda pendiente es el día.
 *
 * Los votos **no se borran** al marcarlo, y por eso el interruptor se puede
 * tocar sin miedo: si vuelve a votación, vuelve con lo que había. Un cambio de
 * opinión no puede costar los votos de nueve personas.
 */
export const ESTADO_VOTANDO = 'votando'
export const ESTADO_SE_HACE = 'sehace'

/**
 * Un plan viejo no tiene estado, o lo tiene en `'votando'`: los dos se votan.
 * Solo `'sehace'` es lo contrario, así que la comprobación es por el valor
 * afirmativo y no por su ausencia — así los planes de antes de esta versión
 * siguen leyéndose exactamente igual.
 */
export const seHace = (plan) => plan?.estado === ESTADO_SE_HACE

/**
 * «falta por votar Luis», «faltan 3 por votar», «han votado todos».
 *
 * Los nombres solo cuando son uno o dos: ahí un nombre es accionable —«dale un
 * toque a Luis»—. Con cinco es una lista que no cabe y que no dice nada que el
 * número no diga.
 */
export function quienFaltaPorVotar(plan, todas = []) {
  const votos = plan?.votos ?? {}
  // **A quien no está no se le espera** (§14.78): un plan del jueves con «faltan
  // 3 por votar» que son los tres que se volvieron el martes no se cierra nunca.
  // Su voto, si lo dejó puesto, sigue contando — eso es `votosDe` y no se toca.
  const personas = losQueEstan(todas)
  const sinVotar = personas.filter((p) => !votos[p.id])
  if (sinVotar.length === 0) return 'han votado todos'
  if (sinVotar.length === personas.length) return 'sin votos todavía'
  const quienes = sinVotar.map((p) => p.apodo || p.name)
  if (quienes.length <= 2) return `falta por votar ${quienes.join(' y ')}`
  return `faltan ${quienes.length} por votar`
}
