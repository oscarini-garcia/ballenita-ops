/**
 * Las dos reglas de un par de fechas «desde – hasta».
 *
 * Un viaje siempre tiene principio y final, y el final nunca va antes: dejarlo
 * a mano significaba poder guardar un evento del 15 al 8, que no da error en
 * ninguna parte y hace que la agenda salga vacía sin decir por qué. Así que la
 * fecha de fin **se propone sola** —el día siguiente al de inicio, que es lo que
 * más se usa— y el propio campo **no deja** elegir un día anterior.
 */

/** El día siguiente a `iso`, en el mismo formato. */
export function diaSiguiente(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Qué fin corresponde al elegir un inicio.
 *
 * Vacío o anterior al inicio → el día siguiente. Si ya había uno posterior, se
 * respeta: mover el principio de un viaje de ocho días no debería recortarlo.
 */
export function finPara(inicio, finActual) {
  if (!inicio) return finActual ?? ''
  if (!finActual || finActual < inicio) return diaSiguiente(inicio)
  return finActual
}
