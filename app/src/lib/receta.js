/**
 * Una receta con cantidades, y cómo se estira para la gente que hay.
 *
 * Decidido en [`docs/diseño/cenas-cantidades.html`](../../../docs/diseño/cenas-cantidades.html)
 * · **B3 · A1 · D5**. Antes un plato guardaba **nombres sueltos** —«arroz,
 * mejillones, pollo»— escritos en una caja con comas. Con eso no se puede
 * comprar: «2 kg» tampoco sirve, porque **falta el denominador**. Una cantidad
 * sin saber para cuántos era no se puede repartir entre dos mesas ni escalar al
 * viaje siguiente.
 *
 * Por eso la receta lleva **para cuántas raciones es** (`raciones`, una sola vez
 * por plato) y cada ingrediente lleva **cuánto** de eso. Estirar es una regla de
 * tres, sin IA de por medio: una multiplicación que unas veces diera 3 kg y
 * otras 2,8 no valdría para comprar.
 *
 * El **lote** es cómo se compra —«paquetes de 1 kg»— y vive en el ingrediente
 * porque es un dato suyo, no de la receta ni de la cena: se dice una vez y sirve
 * para siempre. Lo propone la IA (§14.16-quinquies) porque nadie va a rellenar
 * eso a mano en cuarenta ingredientes.
 */

/**
 * De lo que hay guardado a lo que se usa.
 *
 * Los platos de antes tienen `ingredientes: ['arroz', 'mejillones']` y siguen
 * ahí: se leen como líneas sin cantidad, que es exactamente lo que son. No hay
 * migración que correr ni nada que se pierda.
 */
export function normalizarIngredientes(ingredientes = [], { recortar = true } = {}) {
  return (ingredientes ?? [])
    .map((x) => (typeof x === 'string' ? { nombre: x } : x))
    // `recortar: false` es para **mientras se escribe**: con el recorte puesto,
    // el espacio que acabas de teclear desaparecía antes de la letra siguiente y
    // «Arroz bomba» se guardaba «Arrozbomba». Al guardar sí se recorta.
    .filter((x) => x && (recortar ? String(x.nombre ?? '').trim() : String(x.nombre ?? '') !== undefined))
    .map((x) => ({
      nombre: recortar ? String(x.nombre ?? '').trim() : String(x.nombre ?? ''),
      cantidad: Number.isFinite(Number(x.cantidad)) && x.cantidad !== null && x.cantidad !== '' ? Number(x.cantidad) : null,
      unidad: String(x.unidad ?? '').trim(),
      // `{ tamano, unidad, nombre }` — «1 kg, paquete». Sin lote no se redondea
      // y se compra la cifra exacta, que es lo honrado: mejor «1,62 kg» que un
      // «2 paquetes» inventado.
      lote: x.lote?.tamano > 0 ? { tamano: Number(x.lote.tamano), unidad: String(x.lote.unidad ?? '').trim(), nombre: String(x.lote.nombre ?? '').trim() } : null,
      // Quién puso la cifra. Se enseña hasta que alguien la toque: sirve para
      // saber de quién era el número cuando algo sale corto.
      deIA: Boolean(x.deIA),
    }))
}

/** ¿Le falta la cantidad? Es lo que la IA rellena y lo que la compra no sabe estirar. */
export const sinCantidad = (ing) => ing.cantidad === null || ing.cantidad === undefined

/**
 * Cuánto hace falta para `raciones` raciones.
 *
 * Sin `raciones` en la receta no se puede estirar nada, y **no se inventa**: se
 * devuelve la cantidad tal cual con `estirado: false`, para que la pantalla
 * pueda decir que ese número es el de la receta y no el del viaje.
 */
export function estirar(ing, { raciones, deLaReceta }) {
  if (sinCantidad(ing)) return { ...ing, cantidad: null, estirado: false }
  if (!(deLaReceta > 0) || !(raciones > 0)) return { ...ing, estirado: false }
  return { ...ing, cantidad: (ing.cantidad * raciones) / deLaReceta, estirado: true }
}

/** Un número corto: 1,62 y no 1,6200000000000001; 2 y no 2,0. */
export function cifra(n) {
  if (!Number.isFinite(n)) return ''
  const redondeado = Math.round(n * 100) / 100
  return String(redondeado).replace('.', ',')
}

/**
 * Lo que hay que comprar de verdad, redondeando al alza al lote.
 *
 * 16,2 raciones de arroz a 100 g salen **1,62 kg**, y eso no se compra: se
 * compran dos paquetes de uno. Al alza y no al más cercano porque quedarse
 * corto de comida en un camping se arregla con otro viaje al súper, y pasarse
 * se arregla guardando.
 */
export function loQueSeCompra(ing) {
  if (sinCantidad(ing)) return { texto: 'sin cantidad', exacto: null, envase: '' }
  const exacto = `${cifra(ing.cantidad)}${ing.unidad ? ` ${ing.unidad}` : ''}`
  // **El lote solo vale si mide lo mismo que la receta.** «30 ud» de mejillones
  // con una malla de «1 kg» no se dividen: salía «15 mallas de 1 kg», que es un
  // disparate con pinta de cuenta. Cuando no coinciden, la cifra exacta y el
  // envase dicho aparte, que es lo honrado.
  const mismaUnidad = !ing.lote?.unidad || !ing.unidad
    || ing.lote.unidad.toLowerCase() === ing.unidad.toLowerCase()
  if (!ing.lote?.tamano || !mismaUnidad) {
    return { texto: exacto, exacto: null, envase: ing.lote?.tamano ? envaseDe(ing.lote) : '' }
  }

  const lotes = Math.ceil(ing.cantidad / ing.lote.tamano - 1e-9)
  const total = lotes * ing.lote.tamano
  // En la unidad de la receta y no en envases: en la línea de la compra caben
  // «2 kg» y no «2 paquetes de 1 kg», que empujaba el nombre hasta «Arr…». El
  // envase se dice al abrir la línea, que es cuando importa cuántos coger.
  return {
    texto: `${cifra(total)}${ing.unidad ? ` ${ing.unidad}` : ''}`,
    exacto: total === ing.cantidad ? null : exacto,
    envase: `${lotes} ${lotes === 1 ? (ing.lote.nombre || 'envase') : pluralDe(ing.lote.nombre || 'envase')} de ${cifra(ing.lote.tamano)}${ing.lote.unidad ? ` ${ing.lote.unidad}` : ''}`,
  }
}

/** «malla de 1 kg» — cómo se compra, cuando no se puede convertir a la receta. */
const envaseDe = (lote) =>
  `${lote.nombre || 'envase'} de ${cifra(lote.tamano)}${lote.unidad ? ` ${lote.unidad}` : ''}`

/** Plurales de las palabras que salen aquí: paquete, malla, bandeja, bote, kg. */
function pluralDe(palabra) {
  if (/[aeiouáéíóú]$/i.test(palabra)) return `${palabra}s`
  if (/[zZ]$/.test(palabra)) return `${palabra.slice(0, -1)}ces`
  if (/[rlndsj]$/i.test(palabra)) return `${palabra}es`
  return palabra
}

/**
 * De «1,2 kg» a `{ cantidad: 1.2, unidad: 'kg' }` (§14.20-bis · U1).
 *
 * La línea tiene **dos campos** y no tres: la unidad vive dentro del de la
 * cantidad porque es como se dice en voz alta —«kilo y medio de arroz»— y
 * porque decidir la unidad antes de haber escrito qué es no tiene sentido. Pero
 * la compra la necesita aparte: sin ella no puede sumar dos recetas ni redondear
 * al envase.
 *
 * Lo que no se entiende **no se inventa**: vuelve tal cual en `resto`, para que
 * la pantalla lo enseñe como está y el botón de arreglar sepa qué mirar.
 */
export function partirCantidad(texto) {
  const limpio = String(texto ?? '').trim().replace(',', '.')
  if (!limpio) return { cantidad: null, unidad: '', resto: '' }
  const m = limpio.match(/^(-?\d+(?:\.\d+)?)\s*([^\s\d]*)$/)
  if (!m) return { cantidad: null, unidad: '', resto: String(texto).trim() }
  const cantidad = Number(m[1])
  if (!Number.isFinite(cantidad)) return { cantidad: null, unidad: '', resto: String(texto).trim() }
  return { cantidad, unidad: m[2].trim(), resto: '' }
}

/** Y de vuelta: lo que se enseña en la caja. */
export function juntarCantidad(ing) {
  if (sinCantidad(ing)) return ''
  return `${String(ing.cantidad).replace('.', ',')}${ing.unidad ? ` ${ing.unidad}` : ''}`
}

/**
 * Una receta pegada de golpe, línea a línea (§14.20-bis · L4).
 *
 * Es lo que hace que una receta de internet entre en dos toques. Cada línea se
 * queda **entera en el nombre**: partirla aquí sería adivinar, y para eso está
 * el botón de arreglar, que lo hace mirando el plato entero.
 */
export function partirPegado(texto) {
  return String(texto ?? '')
    .split(/[\n\r]+/)
    .map((x) => x.replace(/^[\s•·\-*]+/, '').trim())
    .filter(Boolean)
}

/** La clave con la que dos ingredientes son «el mismo» al juntar la compra. */
export const claveDeIngrediente = (nombre, unidad = '') =>
  `${String(nombre).trim().toLowerCase()}|${String(unidad).trim().toLowerCase()}`
