/**
 * Lo que hace falta saber de una persona, sin React de por medio.
 *
 * **Una persona es quien potencialmente tiene cuenta.** El alta es por
 * invitación (SPECS §14.9) y quien administra enlaza la petición de acceso con
 * la persona que ya está apuntada aquí: por eso la lista de gente no es una
 * lista de nombres para el reparto, es el censo del grupo.
 */

/**
 * Cuánto cuenta cada uno al dividir por cabezas. Son **dos**, y a propósito: el
 * campo libre de peso estaba pidiendo una decisión («¿un chaval de 15 cuánto
 * pesa?») cada vez que se apuntaba a alguien, y la respuesta era siempre una de
 * estas dos. Si algún día hace falta el bebé a 0, se añade aquí y sale en los
 * dos sitios a la vez.
 */
export const EDADES = [
  { id: 'adulto', etiqueta: 'Adulto', peso: 1 },
  { id: 'niño', etiqueta: 'Niño', peso: 0.6 },
]

export const pesoDe = (edad) => EDADES.find((e) => e.id === edad)?.peso ?? 1

/**
 * Dinero escribe solo con manos adultas (SPECS §14.41): con la identidad de un
 * niño puesta, los gastos y los saldos se miran pero no se tocan. Sin identidad
 * se puede tocar —la libreta local y el primer arranque no tienen a nadie
 * elegido y capar ahí dejaría la app muda—; con ella, decide la edad.
 */
export const puedeTocarDinero = (me) => me?.edad !== 'niño'

/**
 * Emoji para elegir de un toque, además de escribir el que quieras.
 *
 * El del cromo se fue (§14.13), pero el que eliges tú es contenido y se queda —y
 * teclear un emoji en un móvil es abrir el teclado de emoji y buscarlo, que es
 * justo la fricción que hace que todo el mundo se quede con el 🧑 de fábrica.
 */
export const EMOJIS_PERSONA = [
  '🧑', '👴', '👵', '🧔', '👶', '🦸', '🧜', '🧙',
  '🤿', '🏄', '🕺', '💃', '🍻', '🐙', '🦑', '🦀',
  '🐳', '🦩', '🥸', '🤠', '😎', '🤪', '👻', '🦥',
]
