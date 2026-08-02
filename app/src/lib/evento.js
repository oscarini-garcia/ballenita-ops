/**
 * Qué se cae fuera al cambiar las fechas de un evento.
 *
 * Acortar un viaje no es un cambio de texto: las cenas y los planes viven **en
 * un día concreto**, y un día que ya no existe deja huérfano lo que hubiera en
 * él —invisible en Agenda, pero contando en Estadísticas y ocupando bunga en el
 * balance de anfitrión—. Así que al guardar se dice qué se lleva por delante,
 * con la misma regla que al borrar una familia (§14.14 · D1): la confirmación
 * dice lo que de verdad va a pasar.
 *
 * **Los gastos no se tocan.** Llevan fecha, sí, pero la compra grande es del día
 * antes de salir y la gasolina de la vuelta es del día después: borrar dinero
 * por haber movido una fecha cambiaría los saldos de todos sin que nadie lo
 * haya pedido. Se cuentan y se dicen, y ahí se queda.
 */

/** ¿Cae `dia` (AAAA-MM-DD) dentro del evento? Sin fechas, todo cabe. */
export function dentroDeFechas(dia, { startDate, endDate } = {}) {
  if (!dia || !startDate) return true
  const fin = endDate || startDate
  return dia >= startDate && dia <= fin
}

/**
 * Lo que quedaría fuera con las fechas nuevas.
 * `{ cenas: [], planes: [], gastos: [] }` — las dos primeras se borran al
 * guardar; los gastos solo se cuentan.
 */
export function loQueSeCaeFuera(fechas, { dinners = [], plans = [], expenses = [] } = {}) {
  if (!fechas?.startDate) return { cenas: [], planes: [], gastos: [] }
  return {
    cenas: dinners.filter((c) => c.dia && !dentroDeFechas(c.dia, fechas)),
    // Un plan sin día todavía no está en el calendario: no se cae de ningún sitio.
    planes: plans.filter((p) => p.dia && !dentroDeFechas(p.dia, fechas)),
    gastos: expenses.filter((g) => g.dateISO && !dentroDeFechas(String(g.dateISO).slice(0, 10), fechas)),
  }
}

/** «2 cenas y 1 plan» — para decirlo en la confirmación, en cristiano. */
export function enPalabras({ cenas = [], planes = [] } = {}) {
  const partes = []
  if (cenas.length) partes.push(`${cenas.length} ${cenas.length === 1 ? 'cena' : 'cenas'}`)
  if (planes.length) partes.push(`${planes.length} ${planes.length === 1 ? 'plan' : 'planes'}`)
  if (partes.length === 0) return ''
  return partes.join(' y ')
}
