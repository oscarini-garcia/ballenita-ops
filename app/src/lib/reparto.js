// ─────────────────────────────────────────────────────────────────────────────
// Motor de reparto — el corazón de Ballena Ops (§3, §14.7 del spec).
//
// Regla de oro: se SINCRONIZAN los hechos (gastos + liquidaciones) y se CALCULAN
// los saldos en local. Estas funciones son puras y deterministas: mismos hechos
// → mismos saldos en todos los dispositivos.
//
// Convenciones:
//   - Todo en céntimos enteros.
//   - Un saldo de familia > 0 = le deben (acreedora); < 0 = debe (deudora).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reparte totalCents entre participantes ponderados, sin perder ni inventar céntimos.
 * Método del resto mayor: cada uno recibe su parte entera y los céntimos sueltos
 * se asignan a quienes tienen mayor resto (desempate por id) — §3.2 "reparto del sobrante".
 *
 * @param {number} totalCents
 * @param {{id:string, weight:number}[]} participants  weight = pesoReparto (p. ej. 1, 0.5)
 * @returns {Map<string, number>} id → céntimos
 */
export function splitCents(totalCents, participants) {
  const out = new Map(participants.map((p) => [p.id, 0]))
  // Peso a entero (×1000) para hacer aritmética exacta con 0,5 / 0,25…
  const ws = participants.map((p) => ({ id: p.id, w: Math.round((p.weight ?? 0) * 1000) }))
  const totalW = ws.reduce((s, p) => s + p.w, 0)
  if (totalW <= 0 || !totalCents) return out

  let assigned = 0
  const remainders = []
  for (const p of ws) {
    const num = totalCents * p.w
    const base = Math.trunc(num / totalW)
    out.set(p.id, base)
    assigned += base
    remainders.push({ id: p.id, r: num % totalW })
  }

  // Los céntimos que faltan (< nº de participantes) van a los mayores restos.
  let leftover = totalCents - assigned
  remainders.sort((a, b) => b.r - a.r || (a.id < b.id ? -1 : 1))
  for (let i = 0; i < leftover; i++) {
    const { id } = remainders[i]
    out.set(id, out.get(id) + 1)
  }
  return out
}

/**
 * Céntimos que le tocan a cada persona en un gasto (antes del rollup a familia).
 * @param {object} expense  { amountCents, participantIds[] }
 * @param {Record<string, {pesoReparto?:number}>} personsById
 */
export function expensePersonShares(expense, personsById) {
  const participants = (expense.participantIds ?? []).map((id) => ({
    id,
    weight: personsById[id]?.pesoReparto ?? 1,
  }))
  return splitCents(expense.amountCents ?? 0, participants)
}

/**
 * Saldos netos por familia a partir de todos los gastos y liquidaciones.
 * Devuelve Map<familyId, cents>. Cada gasto suma 0 (pagado − consumido);
 * cada liquidación mueve céntimos de deudora a acreedora.
 *
 * @param {object[]} expenses     { amountCents, payers:[{familyId, amountCents}], participantIds[] }
 * @param {object[]} settlements  { fromFamilyId, toFamilyId, amountCents }
 * @param {Record<string,{familyId:string, pesoReparto?:number}>} personsById
 */
export function computeFamilyBalances(expenses = [], settlements = [], personsById = {}) {
  const bal = new Map()
  const add = (fid, cents) => bal.set(fid, (bal.get(fid) ?? 0) + cents)

  for (const e of expenses) {
    for (const p of e.payers ?? []) add(p.familyId, p.amountCents)
    const shares = expensePersonShares(e, personsById)
    for (const [personId, cents] of shares) {
      // Persona sin familia → se trata como "familia de uno" (§3.3).
      const fid = personsById[personId]?.familyId ?? `solo:${personId}`
      add(fid, -cents)
    }
  }

  for (const s of settlements) {
    add(s.fromFamilyId, s.amountCents) // la deudora paga → sube su saldo hacia 0
    add(s.toFamilyId, -s.amountCents) // la acreedora cobra → baja su saldo hacia 0
  }

  return bal
}

/**
 * Liquidación simplificada (§3.4): minimiza el nº de transferencias entre familias.
 * Empareja de forma voraz a la mayor deudora con la mayor acreedora.
 * @param {Map<string,number>|Array<[string,number]>} balances
 * @returns {{fromFamilyId:string, toFamilyId:string, amountCents:number}[]}
 */
export function simplifyDebts(balances) {
  const entries = balances instanceof Map ? [...balances] : balances
  const creditors = []
  const debtors = []
  for (const [id, cents] of entries) {
    if (cents > 0) creditors.push({ id, amt: cents })
    else if (cents < 0) debtors.push({ id, amt: -cents })
  }
  creditors.sort((a, b) => b.amt - a.amt || (a.id < b.id ? -1 : 1))
  debtors.sort((a, b) => b.amt - a.amt || (a.id < b.id ? -1 : 1))

  const transfers = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]
    const x = Math.min(d.amt, c.amt)
    if (x > 0) transfers.push({ fromFamilyId: d.id, toFamilyId: c.id, amountCents: x })
    d.amt -= x
    c.amt -= x
    if (d.amt === 0) i++
    if (c.amt === 0) j++
  }
  return transfers
}
