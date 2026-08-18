// Estadísticas del evento (§7). Función pura sobre los hechos → testeable.
// Nada aquí "señala" por defecto; las métricas con pique se filtran en la UI (opt-in).
// Las fichas nuevas se decidieron en `docs/diseño/numeros.html` (T1–T4, T7, T8).
import { isoLocal, diasDe, diasEntre } from './dias.js'
import { anfitrionPorBunga } from './anfitrion.js'
import { seHace } from './planes.js'

export function computeStats({
  expenses = [],
  persons = [],
  families = [],
  bungas = [],
  dinners = [],
  plans = [],
  dishes = [],
  event = null,
  hoy = null,
} = {}) {
  const totalCents = expenses.reduce((s, e) => s + (e.amountCents ?? 0), 0)
  const perPersonAvgCents = persons.length ? Math.round(totalCents / persons.length) : 0

  // Gasto por categoría (desc).
  const catMap = new Map()
  for (const e of expenses) catMap.set(e.category, (catMap.get(e.category) ?? 0) + (e.amountCents ?? 0))
  const byCategory = [...catMap.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents)

  // Quién ha adelantado más dinero (por familia pagadora).
  const payMap = new Map()
  for (const e of expenses) for (const p of e.payers ?? []) payMap.set(p.familyId, (payMap.get(p.familyId) ?? 0) + p.amountCents)
  const byPayerFamily = [...payMap.entries()].map(([familyId, cents]) => ({ familyId, cents })).sort((a, b) => b.cents - a.cents)

  // Plato más repetido entre las cenas.
  const dishName = Object.fromEntries(dishes.map((d) => [d.id, d.name]))
  const dishCount = new Map()
  for (const c of dinners) for (const id of c.platoIds ?? []) dishCount.set(id, (dishCount.get(id) ?? 0) + 1)
  let topDish = null
  for (const [id, count] of dishCount) if (!topDish || count > topDish.count) topDish = { id, name: dishName[id] ?? '—', count }

  // Balance de anfitrión: cuántas veces cada bunga acogió mayores / niños (§6.4).
  // Lleva su **familia dueña**: el balance se lee como el selector del bunga
  // —la familia manda y el alias queda de seña (§14.31 · B1)—, y quién acoge es
  // una casa, pero a quién le toca es una familia.
  const host = new Map(bungas.map((b) => [b.id, {
    bungaId: b.id, name: b.alias || b.name, familyId: b.familyId ?? null, mayores: 0, ninos: 0,
  }]))
  // La cuenta la hace `anfitrionPorBunga` y no este bucle: la lee también el
  // elegidor de bunga de un día (§14.72), y dos copias de la misma cuenta acaban
  // dando números distintos para la misma pregunta.
  for (const [bungaId, veces] of anfitrionPorBunga(dinners)) {
    if (!host.has(bungaId)) continue
    host.get(bungaId).mayores = veces.mayores
    host.get(bungaId).ninos = veces.ninos
  }
  const hostBalance = [...host.values()].map((h) => ({ ...h, total: h.mayores + h.ninos }))

  // Planes.
  // `'confirmado'` es de antes de §14.59 y no lo escribe nadie: la ficha decía
  // 0 de N en todos los eventos menos el Demo (§14.74).
  const plansConfirmed = plans.filter(seHace).length
  const noCount = new Map()
  for (const p of plans) for (const [personId, v] of Object.entries(p.votos ?? {})) if (v === '👎') noCount.set(personId, (noCount.get(personId) ?? 0) + 1)
  let topNoVoter = null
  for (const [personId, count] of noCount) if (!topNoVoter || count > topNoVoter.count) topNoVoter = { personId, count }

  // El día más caro (T1): los gastos agrupados por su **día local** — `dateISO`
  // viaja en UTC y un gasto de la 1:30 de la madrugada caería en el día de
  // Greenwich, que es el de ayer. Es el mismo mordisco de `isoLocal` (§14.10).
  const porDia = new Map()
  for (const e of expenses) {
    if (!e.dateISO) continue
    const dia = isoLocal(new Date(e.dateISO))
    porDia.set(dia, (porDia.get(dia) ?? 0) + (e.amountCents ?? 0))
  }
  let topDay = null
  for (const [dia, cents] of porDia) if (!topDay || cents > topDay.cents) topDay = { dia, cents }

  // «Así vais a acabar» (T2): el gasto proyectado al cierre. Solo existe
  // durante el viaje — antes no hay días transcurridos y después ya no es un
  // pronóstico—, y el susto del primer día es el chiste: se corrige solo.
  let forecastCents = null
  const inicio = event?.startDate
  const fin = event?.endDate || event?.startDate
  if (inicio && hoy && hoy >= inicio && hoy <= fin && totalCents > 0) {
    const transcurridos = diasEntre(inicio, hoy) + 1
    const totales = diasEntre(inicio, fin) + 1
    forecastCents = Math.round((totalCents / transcurridos) * totales)
  }

  // Días con plan, de los del evento (T3).
  const diasEvento = diasDe(event ?? {})
  const conPlan = new Set(plans.map((p) => p.dia).filter((d) => d && diasEvento.includes(d)))
  const daysWithPlan = { con: conPlan.size, total: diasEvento.length }

  // La racha de cenas (T4): la tirada más larga de noches seguidas con cena.
  const conCena = [...new Set(dinners.map((c) => c.dia).filter(Boolean))].sort()
  let dinnerStreak = 0
  let racha = 0
  let anterior = null
  for (const dia of conCena) {
    racha = anterior && diasEntre(anterior, dia) === 1 ? racha + 1 : 1
    if (racha > dinnerStreak) dinnerStreak = racha
    anterior = dia
  }

  // Los dos retratos del pique (T7 · T8), con los empates dichos: «Ana y
  // Pablo, empatados» es mejor chiste que elegir a uno por orden de mapa.
  const retratoDeVoto = (emoji) => {
    const m = new Map()
    for (const p of plans) {
      for (const [personId, v] of Object.entries(p.votos ?? {})) {
        if (v === emoji) m.set(personId, (m.get(personId) ?? 0) + 1)
      }
    }
    let top = 0
    for (const c of m.values()) if (c > top) top = c
    if (!top) return null
    return { count: top, personIds: [...m.entries()].filter(([, c]) => c === top).map(([id]) => id) }
  }
  const topYesVoter = retratoDeVoto('👍')
  const topShrugVoter = retratoDeVoto('🤷')

  return {
    totalCents,
    perPersonAvgCents,
    countExpenses: expenses.length,
    byCategory,
    byPayerFamily,
    dinnersCount: dinners.length,
    topDish,
    hostBalance,
    plansProposed: plans.length,
    plansConfirmed,
    topNoVoter,
    topDay,
    forecastCents,
    daysWithPlan,
    dinnerStreak,
    topYesVoter,
    topShrugVoter,
  }
}
