/**
 * El orden de la carta: qué categorías hay y en qué orden se sirven.
 *
 * Vivía en `db.js` porque allí nació la tabla `dishes`, pero **no es un hecho de
 * la base**: es cómo se come. Y ahora lo leen cuatro sitios —la Carta, el
 * elegidor de una cena, el día y «Hoy»—, tres de los cuales tenían su propia
 * copia de la misma línea (`etiquetaCategoria`, `catLabel`, `etiqueta`). `db.js`
 * lo reexporta para no romper lo que ya lo importaba de ahí.
 *
 * El orden **es el de la lista**: aperitivo, entrante, principal, acompañamiento
 * y postre. De él salen las dos cosas que hacen falta para enseñar una cena
 * —ordenarla y agruparla—, y por eso están aquí y no repetidas en cada pantalla.
 */
export const DISH_CATEGORIES = [
  { id: 'aperitivo', label: 'Aperitivo' },
  { id: 'entrante', label: 'Entrante' },
  { id: 'principal', label: 'Principal' },
  { id: 'acompanamiento', label: 'Acompañamiento' },
  { id: 'postre', label: 'Postre' },
]

/** El rótulo de una categoría; si no la conoce, devuelve lo que le llegó. */
export const etiquetaCategoria = (id) => DISH_CATEGORIES.find((c) => c.id === id)?.label ?? id

/**
 * La categoría con la que se enseña un plato: **la primera que tenga en el orden
 * de la carta**, no la primera que le pusieron. Un plato puede llevar varias
 * —«principal» y «acompañamiento»—, y en una cena se lee por lo que es antes.
 */
export function categoriaDe(plato) {
  const suyas = plato?.categorias ?? []
  return DISH_CATEGORIES.find((c) => suyas.includes(c.id))?.id ?? null
}

/** El puesto de un plato en la carta. Lo que no tiene categoría va al final. */
const puesto = (plato) => {
  const cat = categoriaDe(plato)
  const i = DISH_CATEGORIES.findIndex((c) => c.id === cat)
  return i === -1 ? DISH_CATEGORIES.length : i
}

/**
 * Los platos de una cena en el orden en que se comen.
 *
 * Se guardan en el orden en que se marcaron, que es el orden en que a alguien se
 * le fueron ocurriendo: el postre puede salir el primero. **Estable dentro de
 * cada categoría**, para que dos principales conserven el orden en que se
 * pusieron.
 */
export function porOrdenDeCarta(platos = []) {
  return [...platos].map((p, i) => [p, i])
    .sort((a, b) => (puesto(a[0]) - puesto(b[0])) || (a[1] - b[1]))
    .map(([p]) => p)
}

/**
 * Los mismos, partidos por categoría y en orden. Devuelve solo los grupos que
 * tienen algo: cinco rótulos para dos platos es más cabecera que comida.
 *
 * `sinTipo` recoge lo que no tiene ninguna categoría conocida, y va al final con
 * su propio rótulo — esconderlo sería perder un plato de la cena.
 */
export function agrupadosPorCategoria(platos = []) {
  const grupos = DISH_CATEGORIES
    .map((c) => ({ id: c.id, label: c.label, platos: platos.filter((p) => categoriaDe(p) === c.id) }))
    .filter((g) => g.platos.length > 0)
  const sueltos = platos.filter((p) => categoriaDe(p) === null)
  return sueltos.length ? [...grupos, { id: null, label: 'Sin tipo', platos: sueltos }] : grupos
}
