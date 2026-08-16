/**
 * El bunga como **sitio** y no como fila de un evento (SPECS §14.56,
 * `docs/diseño/siete-encargos.html` · B2 · B4 · B5).
 *
 * El problema de partida: `bungas` lleva `eventId`, así que el «Bunga 12» de
 * 2025 y el «Bunga 12» de 2026 eran **dos filas sin nada que las una**. Una nota
 * escrita este agosto —«la nevera congela mucho, bájala al 2»— se iba con el
 * evento, y el histórico de qué familia durmió dónde no existía: no estaba
 * esperando a que lo pintáramos, había que crearlo.
 *
 * La solución es la figura de la casa por cuarta vez (`dishes` ↔ `dinners`,
 * `planIdeas` ↔ `plans`, y ahora `alojamientos` ↔ `bungas`): en el catálogo vive
 * lo que **no cambia de un año a otro** —cómo es el sitio— y en el bunga del
 * evento lo que es de este agosto —qué familia lo tiene—.
 *
 * **El histórico no se guarda, se calcula** (B5). Es la regla de oro del
 * proyecto: se sincronizan los hechos y lo demás sale de ellos. Guardar «los
 * Pérez estuvieron aquí en 2024» sería una tercera copia del mismo dato, que se
 * queda vieja en cuanto alguien corrija el evento.
 *
 * Puro y sin React: se prueba contando.
 */

/**
 * Quién ha dormido en este alojamiento, por años y de lo más nuevo a lo más
 * viejo.
 *
 * El año sale de `startDate` y no de `creadoEn`: un evento se crea en junio y es
 * de agosto, y en enero se planifica el de ese verano. Sin fechas, el evento
 * entra igual pero sin año — apartarlo lo dejaría invisible teniendo datos, que
 * es justo lo que §14.10-quater decidió no hacer con las cenas y los planes.
 */
export function historicoDe(alojamientoId, { eventos = [], bungas = [], familias = [] } = {}) {
  if (!alojamientoId) return []
  const eventoPorId = new Map(eventos.map((e) => [e.id, e]))
  const familiaPorId = new Map(familias.map((f) => [f.id, f]))

  return bungas
    .filter((b) => b.alojamientoId === alojamientoId)
    .map((b) => {
      const evento = eventoPorId.get(b.eventId) ?? null
      return {
        bungaId: b.id,
        evento,
        anio: evento?.startDate ? String(evento.startDate).slice(0, 4) : null,
        familia: familiaPorId.get(b.familyId) ?? null,
      }
    })
    // Sin año al final: no se sabe cuándo fue, pero se sabe que fue.
    .sort((a, b) => String(b.anio ?? '0000').localeCompare(String(a.anio ?? '0000')))
}

/**
 * Cómo se resume el histórico en una línea: «aquí desde 2024», «estrenan».
 *
 * Se cuentan los años **distintos**: dos eventos del mismo verano en el mismo
 * bunga son un año, no dos. Y el año en curso no cuenta como historia — quien
 * está ahí ahora mismo no ha «estado» ahí, está.
 */
export function resumenDelHistorico(historico = [], { salvoBungaId = null } = {}) {
  const antes = historico.filter((h) => h.bungaId !== salvoBungaId && h.anio)
  if (antes.length === 0) return 'estrenan'
  const anios = [...new Set(antes.map((h) => h.anio))].sort()
  if (anios.length === 1) return `ya estuvieron en ${anios[0]}`
  return `aquí desde ${anios[0]}`
}

/**
 * Alterna una pegatina. Devuelve **una lista nueva**, nunca la misma: quien
 * llama la escribe con `escribir()`, y una lista mutada en sitio no se distingue
 * de la que había, así que el cambio no subiría.
 */
export function conPegatina(pegatinas = [], id) {
  const puestas = Array.isArray(pegatinas) ? pegatinas : []
  return puestas.includes(id) ? puestas.filter((p) => p !== id) : [...puestas, id]
}

/**
 * Las pegatinas puestas, en el orden del catálogo y con su dibujo.
 *
 * En el orden del catálogo y no en el que se tocaron: dos bungas con las mismas
 * tres pegatinas tienen que verse iguales, y el orden de los toques es de cada
 * uno.
 */
export const pegatinasPuestas = (pegatinas = [], catalogo = []) =>
  catalogo.filter((p) => (pegatinas ?? []).includes(p.id))
