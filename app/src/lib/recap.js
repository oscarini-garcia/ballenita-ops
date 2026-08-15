// ─────────────────────────────────────────────────────────────────────────────
// El recap del viaje, sacado del registro (SPECS §14.50).
//
// Puro: entran los renglones que ha ido dejando `db.js` y salen los recuentos.
// Nada de esto se guarda —como los saldos— porque se puede calcular, y un
// recuento guardado es un recuento que se queda viejo en cuanto llega una
// instantánea con dos renglones más.
//
// Lo que **no** hace, a propósito: ordenar a la gente de mejor a peor. El podio
// es de «quién ha estado más encima», no de quién se ha portado bien; en un
// grupo de amigos las dos lecturas caben, y por eso el recap dice cuántas cosas
// y no quién gana. El pique tiene su propio interruptor desde §7 y ahí sigue.
// ─────────────────────────────────────────────────────────────────────────────

import { CLASES } from './registro.js'

/** El día (sin hora) de un renglón: `cuando` es un ISO completo. */
export const diaDe = (apunte) => String(apunte?.cuando ?? '').slice(0, 10)

/**
 * Los recuentos del recap.
 *
 * `apuntes` son los renglones del evento, en cualquier orden. `persons` sirve
 * para poner nombre a los ids y para que quien ya no está en el grupo no salga
 * con un hueco.
 */
export function componerRecap({ apuntes = [], persons = [] } = {}) {
  const vivos = apuntes.filter((a) => a && a.texto)

  const cuentaPorPersona = new Map()
  const cuentaPorClase = new Map()
  const cuentaPorDia = new Map()

  for (const a of vivos) {
    const quien = a.personId ?? null
    cuentaPorPersona.set(quien, (cuentaPorPersona.get(quien) ?? 0) + 1)
    cuentaPorClase.set(a.clase, (cuentaPorClase.get(a.clase) ?? 0) + 1)
    const dia = diaDe(a)
    if (dia) cuentaPorDia.set(dia, (cuentaPorDia.get(dia) ?? 0) + 1)
  }

  const nombre = (id) => persons.find((p) => p.id === id)?.name ?? null

  // Empatados van por nombre, que es lo único estable: los ids son aleatorios
  // (`lib/ids.js`) y con ellos el podio cambia de orden entre dos móviles con
  // exactamente los mismos datos.
  const porPersona = [...cuentaPorPersona.entries()]
    .map(([personId, cuantas]) => ({ personId, nombre: nombre(personId), cuantas }))
    .sort((a, b) => b.cuantas - a.cuantas
      || (a.nombre ?? 'zzz').localeCompare(b.nombre ?? 'zzz', 'es'))

  const porClase = CLASES
    .map((c) => ({ ...c, cuantas: cuentaPorClase.get(c.id) ?? 0 }))
    .filter((c) => c.cuantas > 0)

  const porDia = [...cuentaPorDia.entries()]
    .map(([dia, cuantas]) => ({ dia, cuantas }))
    .sort((a, b) => a.dia.localeCompare(b.dia))

  // El día más movido, con los empates dichos — como el resto de Números. Con
  // un solo día no hay «el más»: sería el único día, contándose a sí mismo.
  const tope = porDia.reduce((m, d) => Math.max(m, d.cuantas), 0)
  const diasTop = porDia.length > 1 ? porDia.filter((d) => d.cuantas === tope && tope > 0) : []

  return {
    total: vivos.length,
    porPersona,
    porClase,
    porDia,
    diaMasMovido: diasTop.length ? { dias: diasTop.map((d) => d.dia), cuantas: tope } : null,
    // Quién ha andado en más cosas. Solo cuenta si hay más de uno con nombre:
    // un «podio» de una persona es la propia persona leyendo su nombre.
    masActivo: porPersona.filter((p) => p.personId).length > 1
      ? porPersona.find((p) => p.personId) ?? null
      : null,
  }
}

/**
 * Los renglones tal cual, del más nuevo al más viejo y agrupados por día.
 *
 * Es lo que se lee de verdad al final del viaje —«¿qué hicimos el jueves?»— y
 * por eso va por días y no en una lista seguida de doscientas líneas.
 */
export function porDias(apuntes = []) {
  const dias = new Map()
  for (const a of apuntes) {
    const dia = diaDe(a)
    if (!dia) continue
    if (!dias.has(dia)) dias.set(dia, [])
    dias.get(dia).push(a)
  }
  return [...dias.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dia, lista]) => ({
      dia,
      apuntes: [...lista].sort((x, y) => String(y.cuando).localeCompare(String(x.cuando))),
    }))
}
