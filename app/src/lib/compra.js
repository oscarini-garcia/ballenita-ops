/**
 * De las cenas a la lista de la compra, pasando por las dos mesas.
 *
 * Decidido en [`docs/diseño/cenas-cantidades.html`](../../../docs/diseño/cenas-cantidades.html)
 * · **G2 · C1 · D5**.
 *
 * Tres cosas que conviene que queden escritas:
 *
 * - **Las dos mesas no son dos compras.** Se compra una vez: nadie va a dos
 *   supermercados. El reparto entre la mesa de mayores y la de niños es para
 *   saber cuánto lleva cada cocina, así que la lista enseña **el total** (C1) y
 *   el desglose se mira al abrir la línea.
 * - **Quién come en cada mesa ya se sabía.** `comeConMayores` decide el lado y
 *   `pesoReparto` —1 el adulto, 0,6 el niño— decide cuánto cuenta. Son los
 *   mismos números con los que se reparte un gasto; no hay un segundo censo.
 * - **La mesa de niños puede comer otra cosa** (G2): `platoIdsNinos` en `null`
 *   quiere decir «lo mismo que los mayores». En cuanto se le toca algo, tiene su
 *   lista y las dos cuentas dejan de ser una división.
 */

import { normalizarIngredientes, estirar, loQueSeCompra, claveDeIngrediente, cifra } from './receta.js'

/**
 * Cuántas raciones se sientan en cada mesa.
 *
 * En raciones y no en personas: seis niños no comen lo que seis adultos, y el
 * 0,6 ya está decidido en `lib/personas.js` desde que existe el reparto.
 */
export function racionesPorMesa(personas = []) {
  const suma = (lista) => lista.reduce((t, p) => t + (Number(p.pesoReparto) || 1), 0)
  const mayores = personas.filter((p) => p.comeConMayores ?? p.edad !== 'niño')
  const ninos = personas.filter((p) => !(p.comeConMayores ?? p.edad !== 'niño'))
  return {
    mayores: Math.round(suma(mayores) * 100) / 100,
    ninos: Math.round(suma(ninos) * 100) / 100,
  }
}

/** Qué platos come cada mesa. `platoIdsNinos` nulo = heredan los de arriba. */
export function platosDeLaCena(cena) {
  const mayores = cena?.platoIds ?? []
  return { mayores, ninos: cena?.platoIdsNinos ?? mayores, hereda: !cena?.platoIdsNinos }
}

/**
 * Todo lo que hace falta comprar para unas cenas.
 *
 * Devuelve una línea por ingrediente **ya sumado entre mesas y entre cenas**,
 * con el desglose guardado al lado. Lo que no tiene cantidad sale igual, con la
 * cantidad en `null`: esconderlo dejaría a alguien sin azafrán y sin saberlo.
 */
export function loQueHayQueComprar({ cenas = [], platos = [], personas = [] }) {
  const porId = new Map(platos.map((p) => [p.id, p]))
  const mesas = racionesPorMesa(personas)
  const juntos = new Map()

  const sumar = (plato, raciones, mesa) => {
    if (!plato || !(raciones > 0)) return
    for (const crudo of normalizarIngredientes(plato.ingredientes)) {
      const ing = estirar(crudo, { raciones, deLaReceta: plato.raciones })
      const clave = claveDeIngrediente(ing.nombre, ing.unidad)
      const ya = juntos.get(clave) ?? {
        clave,
        nombre: ing.nombre,
        unidad: ing.unidad,
        lote: ing.lote,
        cantidad: null,
        desglose: { mayores: 0, ninos: 0 },
        deIA: false,
        platos: [],
      }
      if (ing.cantidad !== null) {
        ya.cantidad = (ya.cantidad ?? 0) + ing.cantidad
        ya.desglose[mesa] += ing.cantidad
      }
      // El lote lo pone el primero que lo tenga: es del ingrediente, no del plato.
      if (!ya.lote && ing.lote) ya.lote = ing.lote
      if (ing.deIA) ya.deIA = true
      if (!ya.platos.includes(plato.name)) ya.platos.push(plato.name)
      juntos.set(clave, ya)
    }
  }

  for (const cena of cenas) {
    const { mayores, ninos } = platosDeLaCena(cena)
    for (const id of mayores) sumar(porId.get(id), mesas.mayores, 'mayores')
    for (const id of ninos) sumar(porId.get(id), mesas.ninos, 'ninos')
  }

  return [...juntos.values()].map((x) => {
    const compra = loQueSeCompra(x)
    return {
      ...x,
      desglose: { mayores: Math.round(x.desglose.mayores * 100) / 100, ninos: Math.round(x.desglose.ninos * 100) / 100 },
      texto: compra.texto,
      exacto: compra.exacto,
      envase: compra.envase,
    }
  })
}

/**
 * Cómo se lee el reparto entre las dos mesas, en una línea.
 *
 * Con los nombres de los bungas cuando se saben, porque «Pérez 1,3 · Solteros
 * 0,4» dice dónde llevarlo y «mayores/niños» solo dice a quién.
 */
export function comoSeReparte(desglose, { mayores = 'Mayores', ninos = 'Niños', unidad = '' } = {}) {
  const partes = []
  const u = unidad ? ` ${unidad}` : ''
  if (desglose.mayores > 0) partes.push(`${mayores} ${cifra(desglose.mayores)}${u}`)
  if (desglose.ninos > 0) partes.push(`${ninos} ${cifra(desglose.ninos)}${u}`)
  return partes.join(' · ')
}
