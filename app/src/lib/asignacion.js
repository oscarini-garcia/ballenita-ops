/**
 * Quién se queda con qué bunga: el emparejamiento familia ↔ bunga.
 *
 * El vínculo se guarda en un solo sitio —`bunga.familyId`— y se mira desde los
 * dos lados: el formulario de familia elige bunga, y el de bunga elige familia.
 * Como es el mismo dato, los dos desplegables tienen que ofrecer lo mismo: **lo
 * que está libre**. Ofrecer un bunga que ya tiene familia es ofrecer
 * quitárselo sin decirlo, y el que lo elige se entera cuando la otra familia ya
 * no lo tiene.
 *
 * Un bunga cuyo `familyId` apunta a una familia **borrada** cuenta como libre.
 * Si no, se quedaría atado a un fantasma para siempre: no aparecería en ninguna
 * lista de disponibles y no habría manera de asignarlo desde la interfaz.
 */

const existe = (lista, id) => Boolean(id) && lista.some((x) => x.id === id)

/** El bunga de una familia, o `null`. Es uno a uno: si hubiera varios por datos
 *  antiguos, manda el primero. */
export function bungaDeFamilia(bungas = [], familyId) {
  if (!familyId) return null
  return bungas.find((b) => b.familyId === familyId) ?? null
}

/**
 * Los bungas que se pueden ofrecer: sin familia, o con una familia que ya no
 * existe. `paraFamilia` añade el que ya tiene esa familia, para que al editarla
 * su propio bunga siga en la lista y no parezca que lo ha perdido.
 */
export function bungasLibres(bungas = [], families = [], { paraFamilia = null } = {}) {
  return bungas.filter((b) => !existe(families, b.familyId) || b.familyId === paraFamilia)
}

/**
 * Las familias que se pueden ofrecer: las que no tienen bunga. `paraBunga`
 * añade la del bunga que se está editando, por el mismo motivo.
 */
export function familiasLibres(families = [], bungas = [], { paraBunga = null } = {}) {
  const ocupadas = new Set(
    bungas.filter((b) => b.id !== paraBunga && b.familyId).map((b) => b.familyId),
  )
  return families.filter((f) => !ocupadas.has(f.id))
}

/** «Bunga 1 (el de la piscina)» — el nombre con el alias, si lo tiene. */
export const etiquetaBunga = (b) => (b ? (b.alias ? `${b.name} (${b.alias})` : b.name) : '')
