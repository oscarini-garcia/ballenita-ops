/**
 * Lo que hace falta saber de una persona, sin React de por medio.
 *
 * **Una persona es quien potencialmente tiene cuenta.** El alta es por
 * invitación (SPECS §14.9) y quien administra enlaza la petición de acceso con
 * la persona que ya está apuntada aquí: por eso la lista de gente no es una
 * lista de nombres para el reparto, es el censo del grupo.
 */

/**
 * Cuánto cuenta cada uno al dividir por cabezas, y qué puede tocar.
 *
 * El campo libre de peso estaba pidiendo una decisión («¿un chaval de 15 cuánto
 * pesa?») cada vez que se apuntaba a alguien, y la respuesta era siempre una de
 * estas. El **adolescente** contesta esa misma pregunta sin tocar el reparto:
 * pesa como un adulto —come y cuesta como uno— y lo único que lo distingue es
 * `dinero`, que es quién puede escribir en Gastos y Saldos (SPECS §14.41).
 * Si algún día hace falta el bebé a 0, se añade aquí y sale en todos los
 * sitios a la vez.
 *
 * `mayor` es quién entra en el atajo «Mayores» de un gasto (§14.49). Es una
 * columna y no `peso === 1` porque son dos preguntas distintas —cuánto cuestas
 * y si eres de los mayores— que hoy contestan igual y mañana a lo mejor no.
 */
export const EDADES = [
  { id: 'adulto', etiqueta: 'Adulto', peso: 1, organiza: true, mayor: true },
  { id: 'adolescente', etiqueta: 'Adolescente', peso: 1, organiza: false, mayor: true },
  { id: 'niño', etiqueta: 'Niño', peso: 0.6, organiza: false, mayor: false },
]

export const pesoDe = (edad) => EDADES.find((e) => e.id === edad)?.peso ?? 1

/**
 * Si esta persona es de los mayores, **por su edad** (SPECS §14.49).
 *
 * Antes lo decía `cuentaComoAdultoReparto`, una casilla guardada en cada
 * persona: se ponía sola al crearla y luego se quedaba quieta, así que un niño
 * apuntado antes de que existiera «Adolescente» —Fran, en el Demo— salía dentro
 * de «Mayores» aunque su ficha dijera «Niño». Una casilla que nadie ve y que
 * contradice a la edad que sí se ve no es un dato, es una trampa.
 *
 * Edad desconocida cuenta como mayor: es lo que menos daño hace —entrar en el
 * reparto de un gasto— frente a desaparecer de él sin que nadie lo pida.
 */
export const esMayor = (persona) => EDADES.find((e) => e.id === persona?.edad)?.mayor ?? true

/**
 * Quién escribe lo que **organiza el viaje** (SPECS §14.41 y §14.43): el dinero
 * —gastos y liquidaciones—, las cenas, pasar una idea a plan y colocar el día.
 *
 * Es una sola regla y por eso un solo predicado: lo que decide no es la
 * pantalla sino si quien tiene el móvil delante responde de lo que apunte. Lo
 * que **sí** hace todo el mundo se queda fuera de aquí a propósito: votar un
 * plan, apuntar una idea, marcar la compra, cambiar su estado y mirarlo todo.
 *
 * Sin identidad no se capa —la libreta local, la demostración y el primer
 * arranque no tienen a nadie elegido, y una app muda no invita a entrar— y una
 * edad desconocida tampoco: mejor un cerrojo de menos que una pantalla muerta
 * por un dato viejo.
 */
export const puedeOrganizar = (me) => !me || (EDADES.find((e) => e.id === me.edad)?.organiza ?? true)

/**
 * Quién está estos días (SPECS §14.78).
 *
 * El grupo no siempre está entero: alguien llega el miércoles, alguien se vuelve
 * el viernes. Quien no está **no cuenta** —ni en el reparto de un gasto nuevo, ni
 * en la compra, ni entre los que faltan por votar—, y esas tres son las cuentas
 * que se hacían mal cuando la única forma de quitar a alguien era borrarlo, que
 * se lleva por delante todo lo que ya había apuntado a su nombre.
 *
 * **Un interruptor y no dos fechas**, que es lo que se pidió: unas fechas de ida
 * y vuelta obligan a decidir qué pasa con el gasto apuntado el martes por quien
 * se fue el miércoles, y aquí no hay nada que decidir. Cuenta o no cuenta.
 *
 * `ausente` nulo es «está»: las filas de antes de la migración `0023` quedan
 * bien sin tocarlas, y nadie desaparece de un reparto sin que alguien lo pida —
 * la misma regla que `esMayor` con la edad desconocida.
 */
export const estaAqui = (persona) => !persona?.ausente

/** Los que están, que es entre quiénes se cuenta todo lo que se cuenta ahora. */
export const losQueEstan = (personas = []) => personas.filter(estaAqui)

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
