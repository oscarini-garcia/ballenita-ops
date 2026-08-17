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
import { porOrdenDeCarta } from './carta.js'

/**
 * Un día en AAAA-MM-DD **desde la fecha local**, y nunca por `toISOString()`.
 *
 * `toISOString()` convierte a UTC, y en España eso es dos horas atrás en verano:
 * la medianoche del 8 de agosto es el 7 a las 22:00Z, así que el calendario de
 * un viaje que empieza el 8 salía empezando el 7 y la cena del primer día
 * aparecía el día de antes. En el contenedor de las pruebas —que va en UTC— no
 * se veía; en el móvil de cualquiera del grupo, sí.
 */
export const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const hoyISO = () => isoLocal(new Date())

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
      dias.push(isoLocal(d))
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
export const enLetras = (n) => (n >= 0 && n <= 10 ? LETRAS[n] : String(n))
export function titularDeCena(cena, platos = []) {
  if (!cena) return 'Sin cena montada'
  const plato = platoQueManda(platos)
  if (!plato) return 'Cena sin platos apuntados'
  const resto = platos.length - 1
  if (resto <= 0) return plato.name
  return `${plato.name} y ${enLetras(resto)} ${resto === 1 ? 'cosa más' : 'cosas más'}`
}

/** Sin tildes y en minúscula, la misma vara que `buscarGente` (lib/reparto-gente.js). */
const plano = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Las filas de un elegidor que casan con lo escrito
 * (`docs/diseño/elegidores.html` · L3). Con la caja vacía salen todas: el
 * buscador filtra la lista, no la esconde. Mira también la nota porque en los
 * platos es la categoría — buscar «postre» es tan legítimo como buscar «sandía».
 */
export function filtraOpciones(opciones = [], texto = '') {
  const q = plano(texto).trim()
  if (!q) return opciones
  return opciones.filter((o) => plano(o.etiqueta).includes(q) || plano(o.nota).includes(q))
}

/** «a», «a y b», «a, b y c» — la enumeración de toda la vida. */
const enumerar = (cosas = []) => (
  cosas.length <= 1 ? (cosas[0] ?? '')
    : `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`
)

/**
 * La cena de esta noche **redactada** (`docs/diseño/hoy-el-dia.html` · T1).
 *
 * Devuelve **trozos** y no una cadena porque hay que poner en negrita lo que se
 * busca —el plato que manda y los dos bungas— y componer eso en la pantalla
 * sería volver a partir la frase allí. `fuerte` es la negrita.
 *
 * Los nombres de los platos van **tal como están escritos**, también en medio de
 * la frase: bajarles la primera letra convertiría «BBQ de pescado» en «bBQ de
 * pescado», y un plato es un nombre propio.
 */
export function fraseDeLaNoche({ platos = [], bungaMayores, bungaNinos, esHoy = true } = {}) {
  const trozos = []
  const manda = platoQueManda(platos)
  // En el orden en que se comen y no en el que se marcaron: «con patatas
  // chafadas y helado» y no «con helado y patatas chafadas».
  const resto = porOrdenDeCarta(platos.filter((p) => p !== manda)).map((p) => p.name)

  if (!manda) {
    trozos.push({ t: esHoy ? 'Esta noche hay cena, todavía sin platos apuntados.' : 'Hay cena, todavía sin platos apuntados.' })
  } else {
    trozos.push({ t: esHoy ? 'Esta noche ' : 'Se cena ' })
    trozos.push({ t: manda.name, fuerte: true })
    trozos.push({ t: resto.length ? `, con ${enumerar(resto)}.` : '.' })
  }

  if (bungaMayores && bungaNinos) {
    trozos.push({ t: ' Los mayores cenan en ' }, { t: bungaMayores, fuerte: true })
    trozos.push({ t: ' y los niños en ' }, { t: bungaNinos, fuerte: true }, { t: '.' })
  } else if (bungaMayores) {
    trozos.push({ t: ' Se cena en ' }, { t: bungaMayores, fuerte: true }, { t: '.' })
  } else if (bungaNinos) {
    trozos.push({ t: ' Los niños cenan en ' }, { t: bungaNinos, fuerte: true }, { t: '.' })
  } else {
    trozos.push({ t: ' Sin bungas repartidos todavía.' })
  }
  return trozos
}

/**
 * El titular grande de «Hoy» titula **lo que hay**, no siempre la cena
 * (`docs/diseño/dia-abierto.html` · P2): la cena con platos manda; sin ella,
 * manda el plan del día; sin nada, «Día libre». Antes el lunes de la playa
 * confirmada abría la app diciendo «Sin cena montada» —lo que **no** hay— con
 * el día de verdad 127 pt más abajo, en letra de fila. Es la regla que la fila
 * de Días ya usaba (`resumenDeDia`): dos pantallas hermanas no contestan
 * distinto a la misma pregunta. Lo que no manda baja al renglón pequeño.
 *
 * Una cena vacía pero montada (con bungas y sin platos) solo manda si tampoco
 * hay plan: es un hueco reservado, no lo que se hace ese día.
 */
export function titularDeHoy({ cena, platos = [], planes = [], bungaMayores, bungaNinos, esHoy = true } = {}) {
  const conPlatos = (cena?.platoIds?.length ?? 0) > 0
  if (conPlatos || (cena && planes.length === 0)) {
    const bungas = [bungaMayores && `Mayores en ${bungaMayores}`, bungaNinos && `niños en ${bungaNinos}`]
      .filter(Boolean).join(' · ')
    return {
      grande: titularDeCena(cena, platos),
      pequeno: bungas || 'Sin bungas repartidos todavía',
      frase: fraseDeLaNoche({ platos, bungaMayores, bungaNinos, esHoy }),
    }
  }
  const deCena = cena ? 'cena sin platos apuntados' : 'sin cena montada todavía'
  if (planes.length > 0) {
    const plan = planes[0]
    const estado = plan.estado === 'confirmado' ? 'Confirmado' : 'A votación'
    const donde = plan.ubicacion ? `, en ${plan.ubicacion}` : ''
    return { grande: plan.titulo, pequeno: `${estado}${donde} · ${deCena}` }
  }
  return { grande: 'Día libre', pequeno: 'Sin cena montada y sin planes — también hace falta' }
}
