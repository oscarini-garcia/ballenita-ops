/**
 * El alias de una familia: **dos letras**.
 *
 * Nace de un sitio muy concreto: la firma de una idea, que es una línea de
 * 15,7 pt donde tienen que caber el nombre de quien la apuntó, la familia y la
 * fecha (`docs/diseño/planes-ideas.html` · B3). «García» entero no cabe; «GA»
 * sí, y con el color de la familia detrás se lee sin leerlo.
 *
 * **Se propone del nombre y se puede corregir** (D3, frente a D4, que lo
 * calculaba siempre): «Solteros» sale `SO` y quien quiera dejarlo en `SL` puede.
 * Lo que no puede es quedarse vacío —una firma sin familia es media firma—, así
 * que `aliasDe` cae al propuesto cuando no hay nada guardado. Eso cubre además
 * a las familias que ya existían antes de que la columna existiera.
 *
 * Los acentos se quitan a propósito: `ÁL` y `AL` son la misma marca leída de
 * lejos, y en mayúsculas el acento se pierde igualmente en la mitad de los
 * teclados.
 */
const sinTildes = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Lo que se ofrece de fábrica en la ficha de familia: «García» → «GA». */
export function aliasSugerido(nombre = '') {
  const limpio = sinTildes(String(nombre)).replace(/[^A-Za-zÑñ0-9]/g, '')
  return limpio.slice(0, 2).toUpperCase()
}

/** El alias con el que se pinta una familia: el suyo, o el propuesto. */
export function aliasDe(familia) {
  if (!familia) return ''
  const puesto = (familia.alias ?? '').trim()
  return puesto ? puesto.toUpperCase() : aliasSugerido(familia.name)
}

/**
 * ¿Sigue el alias a lo que se escribe en el nombre?
 *
 * El campo se rellena solo mientras nadie lo haya tocado a mano. Para saberlo no
 * hace falta guardar una bandera: si lo que hay puesto es exactamente lo que se
 * propondría, es que no se ha tocado. Un campo vacío también sigue —es el estado
 * de partida de una familia que ya existía—.
 */
export const aliasSigueAlNombre = (alias, nombre) =>
  !alias || alias === aliasSugerido(nombre)
