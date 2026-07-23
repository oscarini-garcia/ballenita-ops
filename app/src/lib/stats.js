// Estadísticas del evento (§7). Función pura sobre los hechos → testeable.
// Nada aquí "señala" por defecto; las métricas con pique se filtran en la UI (opt-in).

export function computeStats({
  expenses = [],
  persons = [],
  families = [],
  bungas = [],
  dinners = [],
  plans = [],
  dishes = [],
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
  const host = new Map(bungas.map((b) => [b.id, { bungaId: b.id, name: b.alias || b.name, mayores: 0, ninos: 0 }]))
  for (const c of dinners) {
    if (c.bungaMayoresId && host.has(c.bungaMayoresId)) host.get(c.bungaMayoresId).mayores++
    if (c.bungaNinosId && host.has(c.bungaNinosId)) host.get(c.bungaNinosId).ninos++
  }
  const hostBalance = [...host.values()].map((h) => ({ ...h, total: h.mayores + h.ninos }))

  // Planes.
  const plansConfirmed = plans.filter((p) => p.estado === 'confirmado').length
  const noCount = new Map()
  for (const p of plans) for (const [personId, v] of Object.entries(p.votos ?? {})) if (v === '👎') noCount.set(personId, (noCount.get(personId) ?? 0) + 1)
  let topNoVoter = null
  for (const [personId, count] of noCount) if (!topNoVoter || count > topNoVoter.count) topNoVoter = { personId, count }

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
  }
}
