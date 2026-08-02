/**
 * Los días de un evento, y qué se hace en cada uno.
 *
 * Vive aparte de las pantallas porque lo usan las dos áreas de Agenda —«Hoy» y
 * «Días»— y porque es justo la clase de cosa que conviene poder probar sin
 * montar React: fechas, plurales y el caso de «hoy no cae dentro del viaje».
 *
 * Ver `docs/diseño/navegacion.html` · B2 (Hoy · Días), E1 (qué enseña Hoy),
 * F3 (qué enseña cuando hoy no es del evento) y G1 (una fila por día).
 */

export const hoyISO = () => new Date().toISOString().slice(0, 10)

/**
 * Todos los días del evento, del primero al último, **incluidos los vacíos**.
 *
 * Antes la agenda saltaba los días sin nada (`if (!cena && !planes) return null`)
 * y un viaje de ocho días con cosas en tres enseñaba tres filas. El día vacío es
 * justo el que hay que poder tocar para llenarlo, así que sale igual que los otros.
 *
 * Sin fechas en el evento no hay calendario que valga: se cae a los días que
 * alguien haya apuntado, ordenados.
 */
export function diasDe(event, apuntados = []) {
  const dias = []
  if (event?.startDate) {
    const d = new Date(event.startDate + 'T00:00:00')
    const ultimo = new Date((event.endDate || event.startDate) + 'T00:00:00')
    // El tope de 60 es un seguro contra una fecha final disparatada: un evento
    // de dos meses no existe, y un bucle infinito cuelga la pestaña.
    let guarda = 0
    while (d <= ultimo && guarda++ < 60) {
      dias.push(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 1)
    }
    return dias
  }
  return [...new Set(apuntados.filter(Boolean))].sort()
}

const LARGO = { weekday: 'long', day: 'numeric', month: 'long' }
const CORTO = { weekday: 'short', day: 'numeric', month: 'short' }

export const fmtDiaLargo = (dia) => new Date(dia + 'T00:00:00').toLocaleDateString('es-ES', LARGO)
export const fmtDiaCorto = (dia) => new Date(dia + 'T00:00:00').toLocaleDateString('es-ES', CORTO)

/** El número y las tres letras del día, para la casilla de la izquierda de una fila. */
export function numeroYDia(dia) {
  const d = new Date(dia + 'T00:00:00')
  return {
    numero: String(d.getDate()),
    semana: d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '').slice(0, 3),
  }
}

/** Días enteros entre dos fechas ISO. Positivo si `b` es posterior a `a`. */
export function diasEntre(a, b) {
  const ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')
  return Math.round(ms / 86400000)
}

/**
 * El plato que da nombre a una cena: el principal si lo hay, y si no el primero.
 * Una cena de seis platos se anuncia por la paella, no por las aceitunas.
 */
export function platoQueManda(platos = []) {
  return platos.find((p) => p?.categorias?.includes('principal')) ?? platos[0] ?? null
}

/**
 * Cómo se resume un día en una fila: un titular y una línea de debajo.
 *
 * El titular dice **lo que se hace** —la cena si la hay, y si no el primer plan—
 * y la línea de debajo cuenta lo que hay, que es lo que sirve para comparar días
 * de un vistazo. Un día sin nada no se calla: dice que está libre.
 */
export function resumenDeDia({ cena, planes = [], platos = [], bungaMayores, esPrimero, esUltimo }) {
  const nPlatos = cena?.platoIds?.length ?? 0
  const nPlanes = planes.length

  let titulo
  if (cena) {
    // El plato manda y **la bunga no entra en el titular**: la hoja de opciones
    // lo dibujaba como «Paella mixta en El del ruido», y puesto en la app real
    // eso son 268 pt en una fila que tiene 237 con el lápiz — se recortaba en
    // «Paella mixta en El del…». Dónde se cena vive en el titular de «Hoy» y en
    // el modal del día, que es donde hay sitio; aquí solo cuando no hay plato
    // que enseñar y el titular se quedaría en un «Cena» pelado.
    const plato = platoQueManda(platos)
    if (plato) titulo = plato.name
    else titulo = bungaMayores ? `Cena en ${bungaMayores}` : 'Cena'
  } else if (nPlanes > 0) {
    titulo = planes[0].titulo
  } else if (esPrimero) {
    titulo = 'Llegada'
  } else if (esUltimo) {
    titulo = 'Vuelta a casa'
  } else {
    titulo = 'Día libre'
  }

  let detalle
  if (!cena && nPlanes === 0) {
    detalle = 'nada apuntado'
  } else {
    const dePlatos = cena
      ? (nPlatos ? `${nPlatos} ${nPlatos === 1 ? 'plato' : 'platos'}` : 'cena sin platos')
      : 'sin cena'
    const dePlanes = nPlanes
      ? `${nPlanes} ${nPlanes === 1 ? 'plan' : 'planes'}`
      : 'sin planes'
    detalle = `${dePlatos} · ${dePlanes}`
  }

  return { titulo, detalle }
}

/**
 * Qué día enseña «Hoy» y cómo se rotula (opción F3).
 *
 * Un evento dura ocho días y la app se abre los otros trescientos cincuenta y
 * siete también. Antes, esos días la pantalla decía «la agenda está vacía, añade
 * cenas y planes», que es mentira —hay ocho días apuntados— y hace que alguien
 * vuelva a apuntar lo que ya estaba. Ahora enseña el día más próximo diciendo
 * lo que es: el primero que viene, o el último que fue.
 */
export function diaQueEnsenaHoy(dias, hoy = hoyISO()) {
  if (dias.length === 0) return null
  if (dias.includes(hoy)) return { dia: hoy, estado: 'hoy', distancia: 0 }
  const primero = dias[0]
  const ultimo = dias[dias.length - 1]
  if (hoy < primero) return { dia: primero, estado: 'antes', distancia: diasEntre(hoy, primero) }
  return { dia: ultimo, estado: 'despues', distancia: diasEntre(ultimo, hoy) }
}

/** El rótulo del titular: «Domingo 9 · esta noche», «Sábado 8 · dentro de 6 días». */
export function rotuloDelDia({ dia, estado, distancia }, { hayCena = false } = {}) {
  const fecha = fmtDiaCorto(dia)
  if (estado === 'hoy') return `${fecha} · ${hayCena ? 'esta noche' : 'hoy'}`
  if (estado === 'antes') {
    const cuando = distancia === 1 ? 'mañana' : `dentro de ${distancia} días`
    return `${fecha} · el primer día, ${cuando}`
  }
  const cuando = distancia === 1 ? 'fue ayer' : `hace ${distancia} días`
  return `${fecha} · el último día, ${cuando}`
}

/**
 * El titular de la cena: «Paella mixta y cinco cosas más».
 *
 * Se cuenta con letra hasta diez porque un número dentro de una frase se lee
 * como un dato, y aquí es una manera de hablar.
 */
const LETRAS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez']
export function titularDeCena(cena, platos = []) {
  if (!cena) return 'Sin cena montada'
  const plato = platoQueManda(platos)
  if (!plato) return 'Cena sin platos apuntados'
  const resto = platos.length - 1
  if (resto <= 0) return plato.name
  const cuantas = resto <= 10 ? LETRAS[resto] : String(resto)
  return `${plato.name} y ${cuantas} ${resto === 1 ? 'cosa más' : 'cosas más'}`
}
