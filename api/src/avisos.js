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
  {
    // **Clase propia y no dentro de «dinero»** (§14.58 · L2). Si fuera dentro,
    // quien lleva las cuentas y se harta de los gastos ajenos perdería al
    // apagarla **también los suyos**, y entonces no se enteraría de nada. Como
    // solo la reciben los marcados, para los demás es como si no existiera.
    id: 'gastoTodos',
    titulo: 'Todos los gastos',
    pista: 'Si llevas las cuentas: todos los gastos del viaje, te toquen o no, y los que se borren.',
  },
  {
    id: 'comentario',
    titulo: 'Comentarios',
    pista: 'Cuando alguien comenta en algo que te toca, o en un hilo donde ya has escrito.',
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

/** Quién lleva las cuentas: se entera de todos los gastos (§14.58 · L1). */
export const contables = (personas = []) => personas.filter((p) => p.llevaLasCuentas)

/** Cómo se nombra un gasto en un aviso: su descripción, o su importe. */
function comoSeLlama(gasto, moneda) {
  const puesto = String(gasto?.description || '').trim()
  return puesto
    ? `${puesto} de ${importe(gasto?.amountCents, moneda)}`
    : `Un gasto de ${importe(gasto?.amountCents, moneda)}`
}

/** Quién lo puso, dicho por familias: «, lo pusieron García, Pérez». */
function quienLoPuso(gasto, familias) {
  const quien = listaDe(gasto?.payers)
    .map((p) => familias.find((f) => f.id === p.familyId)?.name)
    .filter(Boolean)
  if (!quien.length) return ''
  return `, ${quien.length === 1 ? 'lo puso' : 'lo pusieron'} ${quien.join(', ')}`
}

/**
 * Los avisos de un gasto: **hasta dos sobres, y nunca dos avisos a la misma
 * persona** (§14.58 · L4).
 *
 * Uno va a quien le mueve el saldo, que es lo de siempre. El otro va a quien
 * lleva las cuentas **y no estaba ya en el primero**, porque a esos el gasto ya
 * les llega — y dos notificaciones del mismo hecho en el mismo teléfono es de
 * las cosas que hacen que se apaguen los avisos enteros. El descarte se hace
 * aquí y no en APNs: `apns-collapse-id` sustituye una por la otra en la pantalla
 * de bloqueo, pero **las dos suenan**.
 *
 * El segundo lleva la coletilla de **por qué le llega** (L3). Sin ella, ver un
 * gasto de una familia con la que no compartes nada se lee como un fallo de la
 * app y no como el encargo que uno aceptó.
 */
export function avisosDeGasto(gasto, { personas = [], familias = [], moneda = 'EUR', autor = null } = {}) {
  const cola = `${comoSeLlama(gasto, moneda)}${quienLoPuso(gasto, familias)}`
  const suyas = familiasDeUnGasto(gasto, personas)
  const tocados = personasDeLasFamilias(suyas, personas).filter((id) => id !== autor)
  const sobres = []

  if (tocados.length) {
    sobres.push({
      clase: 'dinero',
      personIds: tocados,
      titulo: 'Gasto nuevo 💸',
      cuerpo: `${cola}. Te mueve el saldo.`,
      agrupa: `gasto:${gasto?.id}`,
    })
  }

  const yaAvisados = new Set(tocados)
  const alTanto = contables(personas)
    .map((p) => p.id)
    .filter((id) => id !== autor && !yaAvisados.has(id))
  if (alTanto.length) {
    sobres.push({
      clase: 'gastoTodos',
      personIds: alTanto,
      titulo: 'Gasto nuevo 💸',
      cuerpo: `${cola}. Te llega porque llevas las cuentas.`,
      agrupa: `gasto:${gasto?.id}`,
    })
  }

  return sobres
}

/**
 * Un gasto **borrado** (§14.58 · L6), solo para quien lleva las cuentas.
 *
 * Es la única parte del encargo que toca la maquinaria y no la periferia: hasta
 * hoy un borrado no avisaba a nadie, porque la regla era «se avisa de lo que
 * mueve el saldo» y un gasto borrado lo mueve **hacia atrás** — visto desde la
 * pantalla, un número que baja solo. A los demás se les sigue sin avisar a
 * propósito: enterarse de que ya no debes algo no es urgente. A quien lleva las
 * cuentas sí, porque es justo lo que le impide cuadrarlas.
 */
export function avisoDeGastoBorrado(gasto, { personas = [], moneda = 'EUR', autor = null } = {}) {
  const personIds = contables(personas).map((p) => p.id).filter((id) => id !== autor)
  if (!personIds.length) return null
  return {
    clase: 'gastoTodos',
    personIds,
    titulo: 'Gasto borrado 🗑️',
    cuerpo: `${comoSeLlama(gasto, moneda)} ya no está. Te llega porque llevas las cuentas.`,
    agrupa: `gasto:${gasto?.id}`,
  }
}

/**
 * El sobre de siempre: el de quien le mueve el saldo. Se conserva con su nombre
 * porque es lo que prueban los tests de §14.39 y lo que espera quien no necesita
 * los dos; el Worker llama a `avisosDeGasto`.
 */
export function avisoDeGasto(gasto, opciones = {}) {
  return avisosDeGasto(gasto, opciones).find((s) => s.clase === 'dinero') ?? null
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

// ── Comentarios (§14.55) ──

/** De qué es un hilo: `'plan:abc'` → `{ tipo: 'plan', id: 'abc' }`. */
export function deQueEs(ancla) {
  const crudo = String(ancla ?? '')
  const corte = crudo.indexOf(':')
  if (corte < 1) return { tipo: '', id: '' }
  return { tipo: crudo.slice(0, corte), id: crudo.slice(corte + 1) }
}

/**
 * A quién le importa un comentario: **los involucrados y los del hilo**
 * (§14.55 · N1 ∪ N2).
 *
 * Los involucrados los define cada cosa, y no son los mismos:
 *
 *  · **un plan** — quien lo ha votado. Quien no votó no ha dicho que le
 *    interese, y despertarlo por un chiste es lo que apaga los avisos.
 *  · **un gasto** — a quien le mueve el saldo, que ya lo calcula
 *    `familiasDeUnGasto` y es el mismo criterio que el aviso del gasto.
 *  · **un día** — todos: un día del viaje es de todos por definición.
 *
 * Y **los del hilo** son los que ya escribieron ahí. Sin ellos, contestarle a
 * alguien que no votó el plan no le llega — que es lo primero que rompe una
 * conversación. Nunca a quien escribe, como en todos los avisos de la casa.
 */
export function avisoDeComentario(comentario, {
  personas = [], planes = [], gastos = [], bungas = [], hilo = [], autor = null,
} = {}) {
  const { tipo, id } = deQueEs(comentario?.ancla)

  let involucrados = []
  if (tipo === 'plan') {
    const plan = planes.find((p) => p.id === id)
    let votos = plan?.votos ?? {}
    if (typeof votos === 'string') {
      try { votos = JSON.parse(votos) || {} } catch { votos = {} }
    }
    involucrados = Object.keys(votos)
  } else if (tipo === 'gasto') {
    const gasto = gastos.find((g) => g.id === id)
    involucrados = gasto ? personasDeLasFamilias(familiasDeUnGasto(gasto, personas), personas) : []
  } else if (tipo === 'dia') {
    involucrados = personas.map((p) => p.id)
  } else if (tipo === 'bunga') {
    // **Un bunga: la familia que duerme ahí** (§14.66). Es el mismo criterio que
    // el gasto —a quién le toca— y no «todos» como el día: «¿os importa
    // cambiarlo?» le interesa a quien está dentro, y despertar a las otras ocho
    // casas por eso es lo que hace que se apaguen los avisos.
    const bunga = bungas.find((b) => b.id === id)
    involucrados = bunga?.familyId ? personasDeLasFamilias([bunga.familyId], personas) : []
  }

  const enElHilo = hilo
    .filter((c) => c.ancla === comentario?.ancla && c.id !== comentario?.id)
    .map((c) => c.autorId)
    .filter(Boolean)

  const personIds = [...new Set([...involucrados, ...enElHilo])].filter((x) => x && x !== autor)
  if (!personIds.length) return null

  const quien = personas.find((p) => p.id === comentario?.autorId)
  const nombre = quien?.apodo || quien?.name || 'Alguien'
  const sobreQue = {
    plan: planes.find((p) => p.id === id)?.titulo,
    gasto: gastos.find((g) => g.id === id)?.description,
    dia: id,
    bunga: bungas.find((b) => b.id === id)?.name,
  }[tipo];

  return {
    clase: 'comentario',
    personIds,
    titulo: sobreQue ? `${nombre} ha comentado en «${sobreQue}»` : `${nombre} ha comentado`,
    cuerpo: String(comentario?.texto ?? '').slice(0, 180),
    // Por hilo y no por comentario: un ida y vuelta de seis mensajes deja **un**
    // aviso en la pantalla de bloqueo, con el último. Sin esto son seis.
    agrupa: `comentario:${comentario?.ancla}`,
    // Y el destino, que es lo que hace que tocarlo abra el sitio y no la app
    // por donde se dejó (§14.60).
    ir: destinoDeAncla(comentario?.ancla),
  }
}

/**
 * A dónde lleva tocar el aviso de un hilo (§14.60 · R2).
 *
 * `pestaña/área/fila`, que es el formato que entiende `lib/destino.js` en la
 * app. Un ancla que no se reconozca lleva a «Hoy», que es donde no se miente:
 * mejor la portada que una pantalla vacía.
 */
export function destinoDeAncla(ancla) {
  const { tipo, id } = deQueEs(ancla)
  if (tipo === 'plan') return `planes/planes/${id}`
  if (tipo === 'gasto') return `dinero/gastos/${id}`
  if (tipo === 'dia') return `agenda/dias/${id}`
  if (tipo === 'bunga') return `grupo/bungas/${id}`
  return 'hoy'
}

