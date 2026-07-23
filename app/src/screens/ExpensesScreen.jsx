import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { expensesOf, familiesOf, personsOf, addExpense, removeExpense } from '../db.js'
import { eurosToCents, formatCents } from '../lib/money.js'
import { now } from '../lib/ids.js'

export const CATEGORIES = [
  { id: 'compra_general', label: 'Compra general', icon: '🛒' },
  { id: 'comida', label: 'Comida', icon: '🍔' },
  { id: 'bebida', label: 'Bebida', icon: '🍷' },
  { id: 'restaurante', label: 'Restaurante', icon: '🍽️' },
  { id: 'varios', label: 'Varios', icon: '📦' },
]
const catOf = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[4]

export default function ExpensesScreen({ eventId, event }) {
  const expenses = useLiveQuery(() => expensesOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const [open, setOpen] = useState(false)
  const famName = (id) => families.find((f) => f.id === id)?.name ?? '—'

  const total = expenses.reduce((s, e) => s + (e.amountCents ?? 0), 0)

  return (
    <div className="body">
      <div className="card tight" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div className="sub" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Gasto total del evento</div>
          <div className="tnum" style={{ fontSize: 22, fontWeight: 850 }}>{formatCents(total, event.currency)}</div></div>
        <div className="pill neutral">{expenses.length} gastos</div>
      </div>

      {expenses.length === 0 && (
        <div className="empty"><span className="e">💸</span>Ningún gasto todavía.<br />Añade el primero con el botón +.</div>
      )}

      <div className="card tight">
        {expenses.map((e) => {
          const c = catOf(e.category)
          return (
            <div className="row" key={e.id}>
              <div className="av" style={{ background: 'color-mix(in srgb, var(--spout) 20%, transparent)', fontSize: 18 }}>{c.icon}</div>
              <div className="main">
                <div className="n">{e.description}</div>
                <div className="sub">
                  Pagó {e.payers?.map((p) => famName(p.familyId)).join(', ')}
                  {e.currency && e.currency !== event.currency && <> · <span className="pill fx">{e.amountOriginal} {e.currency}</span></>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="amt tnum">{formatCents(e.amountCents, event.currency)}</div>
                <button className="btn sm ghost" style={{ marginTop: 4, padding: '2px 8px', fontSize: 11 }} onClick={() => removeExpense(e.id)}>borrar</button>
              </div>
            </div>
          )
        })}
      </div>

      <button className="fab" aria-label="Añadir gasto" onClick={() => setOpen(true)}>+</button>

      {open && (
        <AddExpenseModal
          event={event} eventId={eventId} families={families} persons={persons}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function AddExpenseModal({ event, eventId, families, persons, onClose }) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(event.currency)
  const [rate, setRate] = useState(1)
  const [category, setCategory] = useState('compra_general')
  const [payerFamily, setPayerFamily] = useState(families[0]?.id ?? '')
  const [participants, setParticipants] = useState(() => new Set(persons.map((p) => p.id)))

  const differsCurrency = currency !== event.currency
  function toggle(id) {
    const s = new Set(participants)
    s.has(id) ? s.delete(id) : s.add(id)
    setParticipants(s)
  }
  function onlyAdults() {
    setParticipants(new Set(persons.filter((p) => p.cuentaComoAdultoReparto).map((p) => p.id)))
  }

  async function submit() {
    const amt = Number(amount)
    if (!description.trim() || !amt || !payerFamily || participants.size === 0) return
    const amountCents = eurosToCents(amt * (differsCurrency ? Number(rate) : 1))
    await addExpense(eventId, {
      description: description.trim(),
      amountCents,
      currency,
      amountOriginal: amt,
      rate: differsCurrency ? Number(rate) : 1,
      category,
      dateISO: now(),
      payers: [{ familyId: payerFamily, amountCents }],
      participantIds: [...participants],
    })
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>×</button>
        <h2>Nuevo gasto</h2>

        <label>Descripción</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Compra grande Mercadona" autoFocus />

        <div className="grid2">
          <div><label>Importe</label><input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
          <div><label>Moneda</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="EUR">€ EUR</option><option value="GBP">£ GBP</option><option value="USD">$ USD</option>
            </select>
          </div>
        </div>
        {differsCurrency && (
          <>
            <label>Tipo de cambio a {event.currency} (se congela en el gasto)</label>
            <input type="number" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} />
          </>
        )}

        <label>Categoría</label>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`chip${category === c.id ? ' on' : ''}`} onClick={() => setCategory(c.id)}>{c.icon} {c.label}</button>
          ))}
        </div>

        <label>Quién paga</label>
        <select value={payerFamily} onChange={(e) => setPayerFamily(e.target.value)}>
          {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Entre quién se divide
          <button className="btn sm ghost" onClick={onlyAdults}>solo mayores 🍷</button>
        </label>
        <div className="chips">
          {persons.map((p) => (
            <button key={p.id} className={`chip${participants.has(p.id) ? ' on' : ''}`} onClick={() => toggle(p.id)}>
              {p.name} <span style={{ opacity: .7, fontSize: 11 }}>×{p.pesoReparto}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}><button className="btn block" onClick={submit}>Guardar gasto</button></div>
        <div className="note" style={{ marginTop: 10 }}>Se reparte por el <b>peso</b> de cada persona y el saldo se suma a su familia (§3).</div>
      </div>
    </div>
  )
}
