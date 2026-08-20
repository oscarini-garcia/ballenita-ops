// ─────────────────────────────────────────────────────────────────────────────
// Entre quién se divide un gasto: los atajos, las familias y el buscador.
//
// Puro y sin React (SPECS §14.27, `docs/diseño/gasto-entre.html`). Todo lo que
// decide qué está marcado vive aquí; la hoja solo lo pinta. Es lo que permite
// probar «Solo los peques» o «esta familia está a medias» sin montar nada.
//
// Un peso no entra en esta cuenta: aquí solo se decide **quién**. Cuánto le toca
// a cada uno lo sigue diciendo `lib/reparto.js`, que es la regla de oro.
// ─────────────────────────────────────────────────────────────────────────────

import { esMayor, estaAqui, losQueEstan } from './personas.js'

/**
 * **Mayores son todos los que no son niños, por su edad** (SPECS §14.49).
 *
 * Lo decidía `cuentaComoAdultoReparto`, una casilla guardada por persona que se
 * ponía sola al crearla y luego no se movía: quien se apuntó de niño antes de
 * que existiera «Adolescente» salía dentro de «Mayores» con la ficha diciendo
 * «Niño». Ahora manda la edad, que es lo único que se ve.
 */
export const mayoresDe = (persons) => persons.filter(esMayor)
/** Y el contrario. Ya no tiene atajo —§14.49—, pero sigue nombrando el reparto. */
export const pequesDe = (persons) => persons.filter((p) => !esMayor(p))

/**
 * Los tres atajos, en el orden en que se pintan.
 *
 * «Peques» se retiró (§14.49): un gasto solo de los niños no lo apunta nadie
 * —la merienda de la playa la paga alguien y se reparte entre todos—, y su
 * casilla costaba un cuarto del mando para no usarse nunca. Quien lo necesite
 * lo tiene a dos toques: «Nadie» y marcar la familia.
 *
 * «Nadie» no es un estado como los otros dos —un gasto sin nadie dentro no se
 * puede guardar— pero es el que hace baratos los repartos raros: vaciar y marcar
 * dos, en vez de quitar siete.
 */
export const ATAJOS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'mayores', etiqueta: 'Mayores' },
  { id: 'nadie', etiqueta: 'Nadie' },
]

/**
 * Los ids que deja puestos un atajo.
 *
 * **Quien está fuera no entra** (§14.78): «Todos» son los que están, que es lo
 * que quiere decir la palabra el martes que los Pérez se han vuelto a casa. No
 * se le esconde de la lista —abajo sale, marcado, y se puede marcar a mano—
 * porque un gasto legítimo puede tocarle: la garrafa de aceite se compró cuando
 * estaba. Lo que se quita es que entre **solo**.
 */
export function genteDeAtajo(atajo, persons = []) {
  if (atajo === 'todos') return losQueEstan(persons).map((p) => p.id)
  if (atajo === 'mayores') return mayoresDe(losQueEstan(persons)).map((p) => p.id)
  return []
}

/**
 * Qué atajo describe lo que hay marcado, o `null` si no lo describe ninguno.
 *
 * Se calcula, no se guarda: si se guardara «mayores» y luego alguien quitara a
 * una persona a mano, el mando seguiría diciendo «Mayores» de un reparto que ya
 * no lo es. Con nueve personas comparar cuatro listas no cuesta nada.
 */
export function atajoDe(ids = [], persons = []) {
  const dentro = new Set(ids)
  for (const { id } of ATAJOS) {
    const esperado = genteDeAtajo(id, persons)
    if (esperado.length === dentro.size && esperado.every((x) => dentro.has(x))) return id
  }
  return null
}

/**
 * La gente agrupada por familia, ordenada por nombre.
 *
 * Dexie devuelve las familias en el orden en que caen los ids, o sea al azar, y
 * una lista que cambia de orden entre móviles no se aprende. Quien no tiene
 * familia cae en «Sueltos», que es como se llama en Grupo (§14.14) y no un
 * invento de esta pantalla.
 */
export function porFamilias(persons = [], families = []) {
  const orden = [...families].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const grupos = orden.map((f) => ({ id: f.id, nombre: f.name, gente: persons.filter((p) => p.familyId === f.id) }))
  const sueltos = persons.filter((p) => !p.familyId || !families.some((f) => f.id === p.familyId))
  if (sueltos.length) grupos.push({ id: null, nombre: 'Sueltos', gente: sueltos })
  return grupos.filter((g) => g.gente.length > 0)
}

/**
 * `'todo'` · `'parte'` · `'nada'` — los tres estados de la casilla de una familia.
 * El de en medio es el que más se va a ver en cuanto alguien toque un nombre
 * suelto, y es el que hace falta dibujar para que «2 de 3» no haya que leerlo.
 */
export function estadoDeFamilia(gente = [], dentro = new Set()) {
  // **Quien está fuera no cuenta para el «todo»** (§14.78). Sin esto, la casilla
  // de cualquier familia con alguien de viaje se quedaría con la raya de «a
  // medias» **para siempre**, señalando como raro lo que es su estado normal.
  // Lo que cuenta es la gente que está **más** la que esté marcada a mano: si
  // alguien mete al que se fue, la familia vuelve a tener tres para llenarse.
  const cuentan = gente.filter((p) => estaAqui(p) || dentro.has(p.id))
  const cuantos = cuentan.filter((p) => dentro.has(p.id)).length
  if (cuantos === 0) return 'nada'
  return cuantos === cuentan.length ? 'todo' : 'parte'
}

/**
 * El renglón de una familia: **quién** está dentro mientras quepa, y «n de m»
 * cuando no (`docs/diseño/gasto-entre.html` · C4 sobre C2).
 *
 * El tope son 26 caracteres y no una medida de píxeles a propósito: medir texto
 * de verdad pide pintarlo primero, y aquí la diferencia entre acertar y fallar
 * es que se lea «3 de 3» en vez de tres nombres. Con la casilla, el nombre de la
 * familia y el chevrón puestos quedan unos 190 pt, que a `--t-label` dan para
 * tres nombres cortos.
 */
export function quienDeFamilia(gente = [], dentro = new Set(), tope = 26) {
  const puestos = gente.filter((p) => dentro.has(p.id))
  if (puestos.length === 0) return 'nadie'
  const nombres = puestos.map((p) => p.name).join(' · ')
  return nombres.length <= tope ? nombres : `${puestos.length} de ${gente.length}`
}

/** Sin tildes y en minúscula: quien busca «pablo» no escribe «Pabló». */
const plano = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Las personas que casan con lo escrito, por nombre o por apodo. */
export function buscarGente(persons = [], texto = '') {
  const q = plano(texto).trim()
  if (!q) return []
  return persons.filter((p) => plano(p.name).includes(q) || plano(p.apodo).includes(q))
}

/**
 * Cómo se reparte, dicho en dos palabras para el renglón «Entre» de la ficha y
 * para la fila de la lista de gastos. **Vacío cuando es el reparto de siempre**:
 * lo normal no se anuncia.
 *
 * Vivía en `FichaDeGasto.jsx` y lo miraban dos pantallas, así que baja aquí con
 * el resto de la aritmética de quién entra.
 */
export function comoSeReparte({ reparto, participantIds = [] }, persons = []) {
  if (reparto?.modo === 'partes') return 'a partes'
  if (reparto?.modo === 'importes') return 'por importes'
  const dentro = participantIds.length
  // **Dos repartos son «el de siempre»** desde §14.78: el grupo entero y el
  // grupo que está estos días. El primero, porque un gasto de la semana pasada
  // se apuntó cuando estaban todos y decir «entre 6» de él sería anunciar como
  // raro lo que era normal; el segundo, porque es lo normal hoy. Sin esto, en
  // cuanto alguien se va **todos** los gastos nuevos salen marcados.
  const aqui = losQueEstan(persons)
  if (!persons.length || dentro === persons.length || dentro === aqui.length) return ''
  if (dentro === 0) return 'nadie todavía'
  const mayores = mayoresDe(aqui)
  if (dentro === mayores.length && mayores.every((p) => participantIds.includes(p.id))) {
    return 'sin los niños'
  }
  const peques = pequesDe(aqui)
  if (peques.length && dentro === peques.length && peques.every((p) => participantIds.includes(p.id))) {
    return 'solo los peques'
  }
  return `entre ${dentro}`
}
