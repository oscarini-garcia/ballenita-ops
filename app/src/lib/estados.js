/**
 * Un estado es **un emoji y una frase corta**: «🍺 de resaca».
 *
 * Vive en la persona (`persons.estado`) y **sincroniza**, así que lo ve todo el
 * grupo (SPECS §14.36). Se guarda como una sola cadena porque es como se lee y
 * como se escribía ya; partirlo en dos columnas obligaría a una migración para
 * no ganar nada.
 *
 * Estas funciones son puras y viven aparte porque las usan tres sitios: la
 * pastilla de la cabecera, el modal que lo cambia y la tira de caras de «Hoy».
 */

/** Los de coña de siempre, para que la lista traiga algo sin llamar a nadie. */
export const ESTADOS_DE_SIEMPRE = [
  { emoji: '🍺', texto: 'de resaca' },
  { emoji: '🏖️', texto: 'tirado en la toalla' },
  { emoji: '😴', texto: 'echando la siesta' },
  { emoji: '🐳', texto: 'avistando ballenas' },
  { emoji: '💸', texto: 'sin blanca' },
  { emoji: '🍷', texto: 'vino en mano' },
  { emoji: '🔥', texto: 'a la parrilla' },
  { emoji: '🤿', texto: 'buceando' },
  { emoji: '🫥', texto: 'desaparecido en combate' },
  { emoji: '🍤', texto: 'en modo gamba' },
  { emoji: '🚗', texto: 'haciendo de chófer' },
  { emoji: '🧴', texto: 'poniéndome crema' },
]

/**
 * El emoji y la frase de un estado guardado.
 *
 * El emoji es lo que va delante hasta el primer espacio, **y solo si no es una
 * letra**: quien escribió «a mi bola» sin emoji no debe ver su «a» ascendida a
 * emoji. Un estado vacío devuelve las dos mitades vacías.
 */
export function partirEstado(estado = '') {
  const limpio = String(estado).trim()
  if (!limpio) return { emoji: '', texto: '' }
  const [primera, ...resto] = limpio.split(/\s+/)
  const esEmoji = primera.length <= 4 && !/[\p{Letter}\p{Number}]/u.test(primera)
  if (esEmoji && resto.length) return { emoji: primera, texto: resto.join(' ') }
  if (esEmoji) return { emoji: primera, texto: '' }
  return { emoji: '', texto: limpio }
}

/** Lo que se enseña de un estado en una línea: tal cual, que ya es corto. */
export const estadoEnUnaLinea = ({ emoji, texto }) => [emoji, texto].filter(Boolean).join(' ')

/**
 * Cinco al azar de los doce, sin repetir.
 *
 * Al azar y no los cinco primeros porque el modal se abre muchas veces durante
 * un viaje y ver siempre los mismos cinco es tener tres de los doce.
 */
export function cincoAlAzar(lista = ESTADOS_DE_SIEMPRE, cuantos = 5) {
  const copia = [...lista]
  const salida = []
  while (copia.length && salida.length < cuantos) {
    salida.push(...copia.splice(Math.floor(Math.random() * copia.length), 1))
  }
  return salida
}

/**
 * Quién tiene estado puesto, para la tira de «Hoy» (§14.36 · G3).
 *
 * Solo los que han dicho algo: una tira con nueve caras mudas no cuenta nada, y
 * la de «Hoy» está para lo que **hay**, no para lo que falta.
 *
 * **Por novedad**, el más reciente primero: la tira se mira dos veces al día y
 * ordenada por nombre lo nuevo no se distinguía de lo de anteayer. El «cuándo»
 * es `estadoEl`, que escribe el cliente al guardar (migración 0013) — y no
 * `updatedAt`, que se mueve con cualquier cambio de la persona y subiría al
 * principio a quien solo se ha corregido el apodo. Quien todavía no tenga
 * `estadoEl` —los estados escritos antes de esto— va detrás de los fechados, y
 * entre ellos por nombre, que es lo que había.
 */
export function quienTieneEstado(personas = []) {
  const porNombre = (a, b) => (a.apodo || a.name || '').localeCompare(b.apodo || b.name || '', 'es')
  return personas
    .filter((p) => String(p.estado ?? '').trim())
    .sort((a, b) => {
      const ea = a.estadoEl ?? ''
      const eb = b.estadoEl ?? ''
      if (ea && eb) return eb.localeCompare(ea) || porNombre(a, b)
      if (ea) return -1
      if (eb) return 1
      return porNombre(a, b)
    })
}
