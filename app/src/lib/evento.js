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

/**
 * Ordena por día y **baja al final lo que se ha quedado fuera** de las fechas.
 *
 * Las cenas salían en el orden en que IndexedDB las devolvía, que no es ninguno,
 * y sin mirar si su día pertenece al viaje. Con un evento que empieza el 15, una
 * cena del 14 —de cuando las fechas eran otras, o de un dedo torcido al
 * teclearlas— aparecía **la primera de la lista**, con el mismo aspecto que las
 * de verdad. Lo primero que se ve de un viaje no puede ser un día que no existe.
 *
 * No se esconde, se aparta. Esconderla la dejaría invisible en Agenda y en
 * Comidas mientras sigue contando en Estadísticas y ocupando bunga en el balance
 * de anfitrión, que es exactamente el huérfano contra el que avisa este módulo.
 * Aparte y marcada se ve, se entiende y se puede quitar.
 *
 * Lo que no tiene día va al final de lo de dentro: un plan sin fecha todavía no
 * está en el calendario, así que tampoco se ha caído de él.
 */
const CLAVE = (f) => f.dia || '9999-99-99'
const PORDIA = (a, b) => CLAVE(a).localeCompare(CLAVE(b))

export function porDia(filas = [], fechas) {
  const dentro = []
  const fuera = []
  for (const f of filas) {
    if (f.dia && !dentroDeFechas(f.dia, fechas)) fuera.push(f)
    else dentro.push(f)
  }
  return { dentro: dentro.sort(PORDIA), fuera: fuera.sort(PORDIA) }
}

/** «2 cenas y 1 plan» — para decirlo en la confirmación, en cristiano. */
export function enPalabras({ cenas = [], planes = [] } = {}) {
  const partes = []
  if (cenas.length) partes.push(`${cenas.length} ${cenas.length === 1 ? 'cena' : 'cenas'}`)
  if (planes.length) partes.push(`${planes.length} ${planes.length === 1 ? 'plan' : 'planes'}`)
  if (partes.length === 0) return ''
  return partes.join(' y ')
}
