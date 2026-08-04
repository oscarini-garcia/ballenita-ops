/**
 * A qué hora sale y se pone el sol, y en qué punto del día estamos.
 *
 * Es la opción **B2** de `docs/diseño/verano.html`: la hora se calcula, no se
 * escribe a mano. Las dos alternativas se caían solas —dos constantes de verano
 * mienten tres horas y media en un puente de diciembre, y cuatro tramos de reloj
 * no dan el continuo que necesita la franja de la cabecera (A4)—.
 *
 * La fórmula es la de siempre (día juliano → anomalía media → declinación →
 * ángulo horario). Cuarenta y tantas líneas, **sin red y sin dependencias**, del
 * mismo corte que `lib/reparto.js` o `lib/dias.js`: entran una fecha y una
 * latitud, salen dos instantes. Se comprueba contra tres fechas conocidas en
 * `sol.test.js`.
 *
 * La latitud va **escrita a mano** y no sale del `lugar` del evento, que habría
 * que geocodificar —red, y una cuenta más—. No se nota: 500 km al norte o al sur
 * mueven el ocaso unos 20 minutos en agosto, que es menos de un punto de los 358
 * que mide la franja.
 */

// De donde sale el grupo. Sirve para todo el país con error de minutos.
export const LAT = 40.4
export const LON = -3.7

const rad = Math.PI / 180
const DIA_MS = 86400000

/** Del instante al día juliano, que es en lo que sabe contar la fórmula. */
const aJuliano = (ms) => ms / DIA_MS + 2440587.5
const aMs = (j) => (j - 2440587.5) * DIA_MS

/**
 * Salida y puesta del sol del día natural de `fecha`, como instantes (`Date`).
 *
 * El «día natural» se toma en UTC a mediodía, que es lo que evita que un evento
 * de madrugada calcule el sol del día anterior.
 */
export function solDelDia(fecha, { lat = LAT, lon = LON } = {}) {
  const d = new Date(fecha)
  const medioDia = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12)
  const n = Math.round(aJuliano(medioDia) - 2451545 + 0.0008 + lon / 360)

  const J = 2451545 + 0.0009 - lon / 360 + n
  const M = (357.5291 + 0.98560028 * (J - 2451545)) % 360
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad)
  const lambda = (M + C + 180 + 102.9372) % 360
  const transito = J + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad)
  const declinacion = Math.asin(Math.sin(lambda * rad) * Math.sin(23.44 * rad))

  // −0,833° es el borde superior del disco con la refracción de siempre.
  const cosOmega =
    (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(declinacion)) /
    (Math.cos(lat * rad) * Math.cos(declinacion))

  // En un círculo polar el sol no sale o no se pone: no hay ángulo que valga.
  if (cosOmega > 1) return { salida: null, puesta: null, sinSol: 'noche' }
  if (cosOmega < -1) return { salida: null, puesta: null, sinSol: 'dia' }

  const omega = Math.acos(cosOmega) / rad / 360
  return {
    salida: new Date(aMs(transito - omega)),
    puesta: new Date(aMs(transito + omega)),
    sinSol: null,
  }
}

/**
 * En qué punto del día estamos: de día o de noche, y cuánto llevamos recorrido.
 *
 * `fraccion` va de 0 a 1 **dentro de su fase**, que es lo que la franja de la
 * cabecera pinta: al amanecer 0, al mediodía ~0,5, al ponerse 1; y otra vez de 0
 * a 1 durante la noche. `quedan` son los minutos que faltan para el cambio, que
 * es la pregunta de verdad en un camping —si da tiempo a la piscina—.
 */
export function momentoDelDia(ahora = new Date(), sitio = {}) {
  const t = new Date(ahora).getTime()
  const hoy = solDelDia(ahora, sitio)

  if (hoy.sinSol) {
    return { fase: hoy.sinSol, fraccion: 0.5, quedan: null, salida: null, puesta: null }
  }

  const salida = hoy.salida.getTime()
  const puesta = hoy.puesta.getTime()

  if (t >= salida && t < puesta) {
    return {
      fase: 'dia',
      fraccion: (t - salida) / (puesta - salida),
      quedan: Math.round((puesta - t) / 60000),
      salida: hoy.salida,
      puesta: hoy.puesta,
    }
  }

  // De noche: la noche va de la puesta de un día a la salida del siguiente, así
  // que antes del amanecer hay que mirar la puesta de **ayer**.
  const antesDelAlba = t < salida
  const otro = solDelDia(new Date(t + (antesDelAlba ? -DIA_MS : DIA_MS)), sitio)
  const desde = antesDelAlba ? otro.puesta?.getTime() : puesta
  const hasta = antesDelAlba ? salida : otro.salida?.getTime()

  // Sin el otro extremo (día polar al lado) la noche no se puede medir; se dice
  // que es de noche y se deja la franja a la mitad, que es no mentir.
  if (!desde || !hasta) return { fase: 'noche', fraccion: 0.5, quedan: null, salida: hoy.salida, puesta: hoy.puesta }

  return {
    fase: 'noche',
    fraccion: (t - desde) / (hasta - desde),
    quedan: Math.round((hasta - t) / 60000),
    salida: hoy.salida,
    puesta: hoy.puesta,
  }
}

/** «3 h 12», «47 min». Para el rótulo de la franja, que se lee con el dedo. */
export function enPalabras(minutos) {
  if (minutos == null) return ''
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m ? `${h} h ${m}` : `${h} h`
}
