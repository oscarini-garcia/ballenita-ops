/**
 * A quién le importa lo que acaba de pasar, y qué se le dice.
 *
 * Aquí no se manda nada —eso es `apns.js`— ni se lee la base: entra la
 * instantánea y sale «a estas personas, esto». Puro a propósito, porque decidir
 * a quién le mueve el saldo un gasto es la clase de cosa que se prueba contando
 * y no abriendo el teléfono de nadie.
 *
 * **Tres reglas que valen para todas las clases.**
 *
 * 1. **Nunca se avisa a quien lo provocó.** Era el primer defecto que se vio en
 *    pantalla: administrando, los avisos de las solicitudes llegaban también al
 *    que las atendía. Un aviso de lo que uno acaba de hacer no informa de nada y
 *    es lo primero que hace que se apaguen los avisos enteros.
 * 2. **Se avisa de lo que cambia el saldo, no de lo que se toca.** Corregir la
 *    descripción de un gasto no le mueve un céntimo a nadie; cambiar el importe,
 *    sí. Sin esta distinción, editar tres veces seguidas un gasto son tres
 *    avisos a nueve teléfonos.
 * 3. **Lo que no está apagado, está encendido** (`repositorio.js`,
 *    `quiereLaClase`): una clase nueva llega encendida a todo el mundo.
 */

/**
 * El catálogo. El `id` viaja a la base y a la pantalla de Ajustes, así que se
 * escribe **una sola vez** y aquí: una clase que se llame distinto en los dos
 * sitios se apaga en uno y sigue sonando en el otro.
 */
export const CLASES_DE_AVISO = [
  {
    id: 'solicitud',
    titulo: 'Alguien quiere entrar',
    pista: 'Ha entrado con Apple y todavía no es nadie del grupo. Solo a quien administra.',
    soloAdministradores: true,
  },
  {
    id: 'dinero',
    titulo: 'Gastos que te tocan',
    pista: 'Un gasto nuevo que te mueve el saldo, o una deuda que alguien acaba de pagar.',
  },
  {
    id: 'estado',
    titulo: 'En qué anda la gente',
    pista: 'Cuando alguien cambia su estado en la cabecera.',
  },
]

export const ES_CLASE = (id) => CLASES_DE_AVISO.some((c) => c.id === id)

/** «48,60 €». Sin `Intl`: el Worker no lleva locales y esto es una línea. */
export function importe(centimos, moneda = 'EUR') {
  const cifra = (Math.abs(Number(centimos) || 0) / 100).toFixed(2).replace('.', ',')
  return moneda === 'EUR' ? `${cifra} €` : `${cifra} ${moneda || ''}`.trim()
}

const listaDe = (crudo) => {
  if (Array.isArray(crudo)) return crudo
  try {
    const puesto = JSON.parse(crudo || '[]')
    return Array.isArray(puesto) ? puesto : []
  } catch {
    return []
  }
}

/**
 * Las familias a las que un gasto les mueve el saldo: las que pagaron y las que
 * entran en el reparto. Sin lista de participantes el gasto es de todos, que es
 * como nace un gasto rápido (§14.26).
 *
 * Es el gemelo de `familiasQueTocaUnGasto` de la app (`lib/borrados.js`), y son
 * dos porque el Worker no puede importar del móvil. Si una cambia, la otra
 * también: las dos contestan la misma pregunta.
 */
export function familiasDeUnGasto(gasto, personas = []) {
  const participantes = listaDe(gasto?.participantIds)
  const dentro = participantes.length
    ? personas.filter((p) => participantes.includes(p.id))
    : personas
  const ids = new Set()
  for (const p of dentro) if (p.familyId) ids.add(p.familyId)
  for (const pagador of listaDe(gasto?.payers)) if (pagador?.familyId) ids.add(pagador.familyId)
  return [...ids]
}

/** Quién vive en esas familias, que es a quién hay que avisar. */
export const personasDeLasFamilias = (familyIds, personas = []) =>
  personas.filter((p) => familyIds.includes(p.familyId)).map((p) => p.id)

/**
 * ¿Este cambio de gasto merece un aviso?
 *
 * Solo si es nuevo o si le ha cambiado **el dinero o el reparto**. Un gasto al
 * que se le corrige la descripción no le mueve el saldo a nadie, y avisar de eso
 * es enseñarle a la gente a ignorar los avisos.
 */
export function elGastoMueveElSaldo(anterior, campos = {}) {
  if (!anterior) return true
  const cambia = (clave) => campos[clave] !== undefined
    && JSON.stringify(campos[clave]) !== JSON.stringify(
      clave === 'payers' || clave === 'participantIds' ? listaDe(anterior[clave]) : anterior[clave],
    )
  return ['amountCents', 'payers', 'participantIds', 'reparto'].some(cambia)
}

/** El aviso de un gasto, o `null` si a nadie le toca. */
export function avisoDeGasto(gasto, { personas = [], familias = [], moneda = 'EUR', autor = null } = {}) {
  const suyas = familiasDeUnGasto(gasto, personas)
  const personIds = personasDeLasFamilias(suyas, personas).filter((id) => id !== autor)
  if (!personIds.length) return null

  const quien = listaDe(gasto?.payers)
    .map((p) => familias.find((f) => f.id === p.familyId)?.name)
    .filter(Boolean)
  const nombre = String(gasto?.description || '').trim()
  return {
    clase: 'dinero',
    personIds,
    titulo: 'Gasto nuevo 💸',
    cuerpo: [
      nombre || 'Un gasto',
      ` de ${importe(gasto?.amountCents, moneda)}`,
      quien.length ? `, ${quien.length === 1 ? 'lo puso' : 'lo pusieron'} ${quien.join(', ')}` : '',
      '. Te mueve el saldo.',
    ].join(''),
    agrupa: `gasto:${gasto?.id}`,
  }
}

/** El aviso de una liquidación: se acaba de pagar lo que se debía. */
export function avisoDeLiquidacion(liq, { personas = [], familias = [], moneda = 'EUR', autor = null } = {}) {
  const nombre = (id) => familias.find((f) => f.id === id)?.name
  const suyas = [liq?.fromFamilyId, liq?.toFamilyId].filter(Boolean)
  const personIds = personasDeLasFamilias(suyas, personas).filter((id) => id !== autor)
  if (!personIds.length) return null

  const de = nombre(liq?.fromFamilyId)
  const a = nombre(liq?.toFamilyId)
  return {
    clase: 'dinero',
    personIds,
    titulo: 'Cuentas saldadas 🤝',
    cuerpo: de && a
      ? `${de} le ha pagado ${importe(liq?.amountCents, moneda)} a ${a}.`
      : `Se han pagado ${importe(liq?.amountCents, moneda)}.`,
    agrupa: `liquidacion:${liq?.id}`,
  }
}

/**
 * El aviso de un estado, si de verdad ha cambiado.
 *
 * Compara con lo que había: la app manda la fila entera de la persona al
 * corregir un apodo o cambiar el avatar, y sin esta comparación cada uno de esos
 * retoques sonaría en todos los teléfonos del grupo como si alguien hubiera
 * dicho algo.
 */
export function avisoDeEstado(persona, anterior, { autor = null } = {}) {
  const ahora = String(persona?.estado ?? '').trim()
  const antes = String(anterior?.estado ?? '').trim()
  if (!ahora || ahora === antes) return null
  if (persona?.id === autor) return null
  return {
    clase: 'estado',
    // Es del grupo entero: no se acota a nadie.
    personIds: null,
    titulo: `${persona?.name || 'Alguien'} anda en algo`,
    cuerpo: ahora,
    agrupa: `estado:${persona?.id}`,
  }
}
