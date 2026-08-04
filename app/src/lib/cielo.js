/**
 * De qué color está el cielo a esta hora.
 *
 * Opción **A2** de `docs/diseño/verano.html`, que la hoja daba por buena junto
 * con la franja (A4) y que se dejó fuera de la primera vuelta. Fue un error de
 * lectura: la franja sola **se llena desde el amanecer**, así que a las 08:07 de
 * un 4 de agosto son 27,3 pt de naranja en la esquina izquierda y 363 de surco,
 * que bajo una cabecera negra se lee como el borde de la cabecera. A las ocho de
 * la mañana, que es cuando se abre la app, no había nada que ver.
 *
 * El cielo no tiene ese problema porque **no se llena, cambia**: a cualquier
 * hora ocupa los 390 pt de ancho y los 78,8 de alto de la cabecera. Cuesta 0 pt
 * —es un color, no un elemento— y se nota sin que nadie sepa qué se ha movido.
 *
 * Los siete tonos son **hondos a propósito**. El cielo literal de agosto se cayó
 * en la hoja (A6) por esto: la tinta de la cabecera es `#e6eef3` fija, y contra
 * un celeste de mediodía da **1,26 : 1**. Estos están elegidos para que el peor
 * de la serie sea **7,54 : 1**, muy por encima del 4,5 que exige el texto
 * pequeño, y hay un test que lo comprueba minuto a minuto de las 24 horas. La
 * barra de estado de iOS pinta la hora y la batería encima de este mismo color,
 * así que la cuenta vale para las dos cosas.
 */

/** El tramo de día: del amanecer al ocaso, de 0 a 1. */
const DIA = [
  [0.00, [0x2e, 0x2a, 0x44]], // amanecer, morado hondo
  [0.12, [0x12, 0x3a, 0x52]], // mañana
  [0.50, [0x15, 0x50, 0x66]], // mediodía, lo más claro que se permite
  [0.85, [0x4a, 0x2f, 0x3f]], // tarde, el vino de la hora de la piscina
  [1.00, [0x3a, 0x22, 0x33]], // ocaso, ciruela
]

/** Y el de la noche: del ocaso al amanecer siguiente. */
const NOCHE = [
  [0.00, [0x3a, 0x22, 0x33]], // el ocaso, para empalmar sin salto
  [0.25, [0x0b, 0x1f, 0x2c]], // noche cerrada, el azul de la marca
  [0.70, [0x08, 0x18, 0x21]], // madrugada, lo más hondo
  [1.00, [0x2e, 0x2a, 0x44]], // y otra vez el amanecer
]

const dosCifras = (n) => Math.round(n).toString(16).padStart(2, '0')

/** Mezcla en sRGB. Sobra para siete tonos que ya están puestos a mano. */
function entre(a, b, t) {
  return `#${a.map((c, i) => dosCifras(c + (b[i] - c) * t)).join('')}`
}

function enLaRampa(rampa, f) {
  const x = Math.max(0, Math.min(1, f))
  for (let i = 1; i < rampa.length; i += 1) {
    const [hasta, color] = rampa[i]
    if (x <= hasta) {
      const [desde, anterior] = rampa[i - 1]
      const tramo = hasta - desde
      return entre(anterior, color, tramo ? (x - desde) / tramo : 0)
    }
  }
  return entre(rampa.at(-1)[1], rampa.at(-1)[1], 0)
}

/**
 * El color de la cabecera para un momento de `lib/sol.js`.
 *
 * Sin momento —o en un sitio donde el sol no sale ni se pone— devuelve el azul
 * de siempre: nunca se queda sin contestar, porque quien lo pinta no tiene un
 * plan B.
 */
export function cieloDelMomento(momento) {
  if (!momento?.fase) return '#0b1f2c'
  return enLaRampa(momento.fase === 'dia' ? DIA : NOCHE, momento.fraccion ?? 0)
}
