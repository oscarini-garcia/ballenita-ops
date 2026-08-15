// ─────────────────────────────────────────────────────────────────────────────
// La bitácora del viaje: qué ha hecho cada uno, para el recap del final.
//
// Puro y sin base de datos (SPECS §14.50). Aquí solo se decide **qué merece un
// renglón y cómo se dice**; quién lo escribe y cuándo es cosa de `db.js`, que
// lo apunta dentro de la misma transacción que el dato — igual que la cola.
//
// Dos reglas que son la mitad del asunto:
//
//  · **Se apunta el hecho, no el campo.** «Marta apuntó “Cena del sábado”» es un
//    renglón del recap; «`description` pasó de X a Y» es un log de programador.
//    Por eso cada tabla tiene su frase y las que no la merecen devuelven `null`
//    en vez de un renglón genérico.
//  · **Lo mismo repetido es una vez.** Corregir un gasto cuatro veces seguidas
//    son cuatro escrituras y **un** hecho; sin juntarlas, el recap de un viaje
//    lo escribe quien más dudó al teclear. `MISMA_COSA_MS` es esa ventana.
// ─────────────────────────────────────────────────────────────────────────────

import { fmtDiaCorto } from './dias.js'
import { CATEGORIES } from './categorias.js'

/** Dentro de esta ventana, tocar otra vez la misma fila no es otro renglón. */
export const MISMA_COSA_MS = 10 * 60 * 1000

/**
 * Qué tablas dejan rastro.
 *
 * `outbox` y `registro` no están por lo evidente —el registro se registraría a
 * sí mismo—, y `events` tampoco: cambiarle las fechas al viaje es de quien
 * administra y ya se cuenta solo, con las cenas y los planes que aparta.
 */
export const TABLAS_QUE_SE_APUNTAN = new Set([
  'expenses', 'settlements', 'dinners', 'plans', 'planIdeas', 'shop',
  'persons', 'families', 'bungas', 'dishes', 'mejoras',
])

const entre = (t) => `«${String(t).trim()}»`
const cambio = (antes, fila, campo) => antes && String(antes[campo] ?? '') !== String(fila[campo] ?? '')

/** «👍 2 · 🤷 1» → cuántos votos hay puestos, para ver si alguien ha votado. */
const cuantosVotos = (fila) => Object.keys(fila?.votos ?? {}).length

/**
 * El renglón que deja una escritura, o `null` si no deja ninguno.
 *
 * `fila` es la fila **ya fusionada** —lo de antes con el parche encima—, que es
 * lo que hace que la frase pueda decir el título de un gasto que esta vez no se
 * ha tocado. `antes` es la de antes, y es lo único que separa «votó» de
 * «cambió el día» cuando las dos cosas son un `upsert` sobre `plans`.
 */
export function apunteDe({ tabla, accion, fila = {}, antes = null }) {
  if (!TABLAS_QUE_SE_APUNTAN.has(tabla)) return null

  const nuevo = accion === 'crear'
  const fuera = accion === 'borrar'

  switch (tabla) {
    case 'expenses': {
      // Sin descripción, la categoría — que es exactamente lo que hace la fila
      // de la lista de gastos desde §14.26, donde describir dejó de ser
      // obligatorio. «Curro apuntó “un gasto”» no cuenta nada.
      const que = fila.description?.trim()
        || CATEGORIES.find((c) => c.id === fila.category)?.label
        || 'un gasto'
      if (fuera) return { clase: 'gasto', texto: `borró ${entre(que)}` }
      return { clase: 'gasto', texto: nuevo ? `apuntó ${entre(que)}` : `retocó ${entre(que)}` }
    }

    case 'settlements':
      return {
        clase: 'gasto',
        texto: fuera ? 'deshizo una liquidación' : 'saldó una deuda',
      }

    case 'dinners': {
      const dia = fila.dia ? fmtDiaCorto(fila.dia) : 'un día'
      if (fuera) return { clase: 'cena', texto: `quitó la cena del ${dia}` }
      return { clase: 'cena', texto: nuevo ? `montó la cena del ${dia}` : `cambió la cena del ${dia}` }
    }

    case 'plans': {
      const que = fila.titulo?.trim() || 'un plan'
      if (fuera) return { clase: 'plan', texto: `retiró ${entre(que)}` }
      if (nuevo) return { clase: 'plan', texto: `propuso ${entre(que)}` }
      // Votar es lo que más se hace y lo que menos se parece a «editar un plan»,
      // así que tiene clase propia. Se reconoce porque cambia el mapa de votos.
      if (antes && cuantosVotos(antes) !== cuantosVotos(fila)) {
        return { clase: 'voto', texto: `votó ${entre(que)}` }
      }
      if (cambio(antes, fila, 'estado')) {
        return { clase: 'plan', texto: `puso ${entre(que)} en «${fila.estado}»` }
      }
      if (cambio(antes, fila, 'dia')) {
        return {
          clase: 'plan',
          texto: fila.dia ? `puso ${entre(que)} el ${fmtDiaCorto(fila.dia)}` : `dejó ${entre(que)} sin día`,
        }
      }
      return { clase: 'plan', texto: `retocó ${entre(que)}` }
    }

    case 'planIdeas': {
      const que = fila.titulo?.trim() || 'una idea'
      if (fuera) return { clase: 'idea', texto: `borró la idea ${entre(que)}` }
      return { clase: 'idea', texto: nuevo ? `apuntó la idea ${entre(que)}` : `retocó la idea ${entre(que)}` }
    }

    case 'shop': {
      const que = fila.texto?.trim() || 'algo'
      // Lo que sale de una receta lo pone y lo quita la app sola al cambiar una
      // cena (§14.20), y quien tenga la pantalla abierta cuando eso pase saldría
      // firmando seis líneas que no ha escrito. Medido en el Demo: abrir Compra
      // dejaba seis renglones de «Curro apuntó “Arroz bomba”». Marcarla sí es
      // suyo, y por eso el interruptor de abajo se apunta igual.
      const deUnaCena = (fila.origen ?? antes?.origen) === 'cena'
      if (fuera) return deUnaCena ? null : { clase: 'compra', texto: `quitó ${entre(que)} de la compra` }
      if (nuevo) return deUnaCena ? null : { clase: 'compra', texto: `apuntó ${entre(que)} en la compra` }
      // Marcar es el gesto de la compra —se hace en el pasillo del súper— y
      // desmarcar es rectificar. Lo demás de una línea no interesa al recap.
      if (antes && Boolean(antes.comprado) !== Boolean(fila.comprado)) {
        return { clase: 'compra', texto: fila.comprado ? `tachó ${entre(que)}` : `desmarcó ${entre(que)}` }
      }
      return null
    }

    case 'persons': {
      const quien = fila.name?.trim() || 'alguien'
      if (fuera) return { clase: 'grupo', texto: `borró a ${quien}` }
      if (nuevo) return { clase: 'grupo', texto: `apuntó a ${quien}` }
      // Un estado es lo que la app pregunta en «Hoy» y lo único de una ficha que
      // cambia todos los días: va con clase propia y con lo que se ha dicho.
      if (cambio(antes, fila, 'estado')) {
        return fila.estado
          ? { clase: 'estado', texto: `anda ${entre(fila.estado)}` }
          : { clase: 'estado', texto: 'se quitó el estado' }
      }
      return { clase: 'grupo', texto: `retocó la ficha de ${quien}` }
    }

    case 'families': {
      const quien = fila.name?.trim() || 'una familia'
      if (fuera) return { clase: 'grupo', texto: `borró a los ${quien}` }
      return { clase: 'grupo', texto: nuevo ? `dio de alta a los ${quien}` : `retocó a los ${quien}` }
    }

    case 'bungas': {
      const cual = fila.alias?.trim() || fila.name?.trim() || 'un bunga'
      if (fuera) return { clase: 'grupo', texto: `borró ${entre(cual)}` }
      return { clase: 'grupo', texto: nuevo ? `dio de alta ${entre(cual)}` : `retocó ${entre(cual)}` }
    }

    case 'dishes': {
      const que = fila.name?.trim() || 'un plato'
      if (fuera) return { clase: 'carta', texto: `quitó ${entre(que)} de la carta` }
      return { clase: 'carta', texto: nuevo ? `añadió ${entre(que)} a la carta` : `retocó la receta de ${entre(que)}` }
    }

    case 'mejoras': {
      if (fuera) return { clase: 'mejora', texto: 'borró una mejora' }
      if (nuevo) return { clase: 'mejora', texto: 'apuntó una mejora' }
      if (antes && Boolean(antes.hecho) !== Boolean(fila.hecho)) {
        return { clase: 'mejora', texto: fila.hecho ? 'dio por hecha una mejora' : 'reabrió una mejora' }
      }
      return null
    }

    default:
      return null
  }
}

/**
 * El nombre de cada clase, para agrupar el recap. El orden es el del recap y no
 * el alfabético: primero lo que mueve dinero, al final lo de la propia app.
 */
export const CLASES = [
  { id: 'gasto', etiqueta: 'Dinero', emoji: '💸' },
  { id: 'cena', etiqueta: 'Cenas', emoji: '🍽️' },
  { id: 'compra', etiqueta: 'La compra', emoji: '🧺' },
  { id: 'plan', etiqueta: 'Planes', emoji: '🗺️' },
  { id: 'voto', etiqueta: 'Votos', emoji: '👍' },
  { id: 'idea', etiqueta: 'Ideas', emoji: '💡' },
  { id: 'carta', etiqueta: 'La carta', emoji: '📖' },
  { id: 'estado', etiqueta: 'Estados', emoji: '💬' },
  { id: 'grupo', etiqueta: 'El grupo', emoji: '👪' },
  { id: 'mejora', etiqueta: 'Mejoras', emoji: '🔧' },
]

export const claseDe = (id) => CLASES.find((c) => c.id === id) ?? null
