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
export const votosDe = (plan) => Object.values(plan?.votos ?? {}).filter((v) => v === '👍').length

/**
 * «falta por votar Luis», «faltan 3 por votar», «han votado todos».
 *
 * Los nombres solo cuando son uno o dos: ahí un nombre es accionable —«dale un
 * toque a Luis»—. Con cinco es una lista que no cabe y que no dice nada que el
 * número no diga.
 */
export function quienFaltaPorVotar(plan, personas = []) {
  const votos = plan?.votos ?? {}
  const sinVotar = personas.filter((p) => !votos[p.id])
  if (sinVotar.length === 0) return 'han votado todos'
  if (sinVotar.length === personas.length) return 'sin votos todavía'
  const quienes = sinVotar.map((p) => p.apodo || p.name)
  if (quienes.length <= 2) return `falta por votar ${quienes.join(' y ')}`
  return `faltan ${quienes.length} por votar`
}
