import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { expensesOf, familiesOf, personsOf, addExpense, updateExpense, removeExpense } from '../db.js'
import { centsToEuros, eurosToCents, formatCents } from '../lib/money.js'
import { now } from '../lib/ids.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import Deslizable from '../components/Deslizable.jsx'
import Fab from '../components/Fab.jsx'
import Recado from '../components/Recado.jsx'
import Icono from '../components/Icono.jsx'

// `icon` es el nombre de un dibujo de components/Icono.jsx y `tono` el que le
// toca de la paleta de categorías (theme.css). Los dos son cromo: el emoji que
// había traía su propio naranja, que no estaba en ninguna paleta.
export const CATEGORIES = [
  { id: 'compra_general', label: 'Compra general', icon: 'compra', tono: 'compra' },
  { id: 'comida', label: 'Comida', icon: 'comida', tono: 'comida' },
  { id: 'bebida', label: 'Bebida', icon: 'bebida', tono: 'bebida' },
  { id: 'restaurante', label: 'Restaurante', icon: 'restaurante', tono: 'restaurante' },
  { id: 'varios', label: 'Varios', icon: 'varios', tono: 'varios' },
]
const catOf = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[4]

export default function ExpensesScreen({ eventId, event }) {
  const expenses = useLiveQuery(() => expensesOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  // null = cerrado · 'nuevo' = alta · un gasto = edición de ese gasto.
  const [ficha, setFicha] = useState(null)
  const famName = (id) => families.find((f) => f.id === id)?.name ?? '—'

  const total = expenses.reduce((s, e) => s + (e.amountCents ?? 0), 0)

  return (
    <div className="body">
      <div className="card tight" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div className="cifra-l">Gasto total del evento</div>
          <div className="tnum cifra">{formatCents(total, event.currency)}</div></div>
        <div className="pill neutral">{expenses.length} gastos</div>
      </div>

      {expenses.length === 0 && (
        <div className="empty">
          <span className="e">💸</span>Ni un gasto todavía.<br />
          Apunta el primero con «+ Gasto».<br />
          O no habéis salido de la bunga, o alguien está pagando en secreto.
        </div>
      )}

      {/* Una tarjeta por gasto y cada una con su gesto: se desliza a la izquierda
          para editarlo o borrarlo. El botón «borrar» que llevaba cada fila se
          comía justo el hueco del importe, que es a lo que se entra aquí. */}
      <div className="lista-deslizable">
        {expenses.map((e) => {
          const c = catOf(e.category)
          return (
            <Deslizable
              key={e.id}
              verbos={
                <>
                  <button className="verbo editar" onClick={() => setFicha(e)}>
<Icono nombre="lapiz" className="g" />Editar
                  </button>
                  <button className="verbo borrar" onClick={() => removeExpense(e.id)}>
<Icono nombre="papelera" className="g" />Borrar
                  </button>
                </>
              }
            >
              <div className="row">
                <div className="ico" data-cat={c.tono}><Icono nombre={c.icon} /></div>
                <div className="main">
                  <div className="n">{e.description}</div>
                  <div className="sub">
                    Pagó {e.payers?.map((p) => famName(p.familyId)).join(', ')}
                    {e.currency && e.currency !== event.currency && <> · <span className="pill fx">{e.amountOriginal} {e.currency}</span></>}
                  </div>
                </div>
                <div className="amt tnum">{formatCents(e.amountCents, event.currency)}</div>
              </div>
            </Deslizable>
          )
        })}
      </div>

      {/* El recado del viaje, al final del scroll (SPECS §14.24). */}
      <Recado evento={event} />

      <Fab label="Gasto" onClick={() => setFicha('nuevo')} />

      {ficha && (
        <ExpenseModal
          event={event} eventId={eventId} families={families} persons={persons}
          gasto={ficha === 'nuevo' ? null : ficha}
          onClose={() => setFicha(null)}
        />
      )}
    </div>
  )
}

/**
 * La ficha de un gasto: la misma para apuntarlo y para corregirlo.
 *
 * Corregir no existía —había que borrar y volver a teclearlo entero, con su
 * reparto—, y es lo que se venía a hacer la mitad de las veces que se abría un
 * gasto: un 24,60 € que eran 26,40. Con `gasto` puesto, los campos arrancan con
 * lo que ya había y al guardar se actualiza en vez de crear.
 */
function ExpenseModal({ event, eventId, families, persons, gasto, onClose }) {
  useBloqueoDeScroll()
  const editando = Boolean(gasto)
  const [description, setDescription] = useState(gasto?.description ?? '')
  // El importe se enseña en su moneda original, que es como se tecleó.
  const [amount, setAmount] = useState(
    gasto ? String(gasto.amountOriginal ?? centsToEuros(gasto.amountCents)) : '',
  )
  const [currency, setCurrency] = useState(gasto?.currency ?? event.currency)
  const [rate, setRate] = useState(gasto?.rate ?? 1)
  const [category, setCategory] = useState(gasto?.category ?? 'compra_general')
  const [payerFamily, setPayerFamily] = useState(gasto?.payers?.[0]?.familyId ?? families[0]?.id ?? '')
  const [participants, setParticipants] = useState(
    () => new Set(gasto?.participantIds ?? persons.map((p) => p.id)),
  )

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
    const datos = {
      description: description.trim(),
      amountCents,
      currency,
      amountOriginal: amt,
      rate: differsCurrency ? Number(rate) : 1,
      category,
      payers: [{ familyId: payerFamily, amountCents }],
      participantIds: [...participants],
    }
    // Al corregir se conserva la fecha original: es cuándo se gastó, no cuándo
    // se cayó en la cuenta de que estaba mal apuntado.
    if (editando) await updateExpense(gasto.id, datos)
    else await addExpense(eventId, { ...datos, dateISO: now() })
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>×</button>
        <h2>{editando ? 'Corregir gasto' : 'Nuevo gasto'}</h2>

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
            <button key={c.id} className={`chip${category === c.id ? ' on' : ''}`} onClick={() => setCategory(c.id)}>
              <span className="chip-ico" data-cat={c.tono}><Icono nombre={c.icon} /></span>{c.label}
            </button>
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
              {p.name} <span className="apunte dentro">×{p.pesoReparto}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}><button className="btn block" onClick={submit}>{editando ? 'Guardar los cambios' : 'Guardar gasto'}</button></div>
        <div className="note" style={{ marginTop: 10 }}>Se reparte por el <b>peso</b> de cada persona y el saldo se suma a su familia (§3).</div>
      </div>
    </div>
  )
}
