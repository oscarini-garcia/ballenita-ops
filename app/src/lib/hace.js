/**
 * Cuánto hace, escrito en palabras.
 *
 * Es un dato que se lee **para tranquilizarse**, y «hoy a las 14:03» tranquiliza
 * de un vistazo mientras que `2026-08-01T14:03:22.481Z` hay que descifrarlo para
 * llegar a lo mismo. Copiado de `garciadoral-ops`, donde lo usa la línea de
 * «última actualización».
 *
 * Los tramos no son arbitrarios: por debajo de cinco minutos el número exacto no
 * añade nada —«hace un rato» es la respuesta—, y a partir de una semana la hora
 * ya no importa y sí la fecha.
 */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const soloFecha = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const hora = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

export function formatearHace(momento, ahora = new Date()) {
  if (momento == null) return ''
  const cuando = momento instanceof Date ? momento : new Date(momento)
  if (Number.isNaN(cuando.getTime())) return ''

  const minutos = Math.round((ahora - cuando) / 60000)
  if (minutos < 0) return 'ahora mismo'
  if (minutos < 60) return minutos < 5 ? 'hace un rato' : `hace ${minutos} min`

  const dias = Math.round((soloFecha(ahora) - soloFecha(cuando)) / 86400000)
  if (dias === 0) return `hoy a las ${hora(cuando)}`
  if (dias === 1) return `ayer a las ${hora(cuando)}`
  if (dias < 7) return `el ${DIAS[cuando.getDay()]}`

  const fecha = `el ${cuando.getDate()} de ${MESES[cuando.getMonth()]}`
  return cuando.getFullYear() === ahora.getFullYear() ? fecha : `${fecha} de ${cuando.getFullYear()}`
}
