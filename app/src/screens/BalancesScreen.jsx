import { useLiveQuery } from 'dexie-react-hooks'
import { expensesOf, familiesOf, personsOf, settlementsOf, addSettlement } from '../db.js'
import { computeFamilyBalances, simplifyDebts } from '../lib/reparto.js'
import { formatCents } from '../lib/money.js'

export default function BalancesScreen({ eventId, event }) {
  const expenses = useLiveQuery(() => expensesOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const settlements = useLiveQuery(() => settlementsOf(eventId), [eventId], [])

  const personsById = Object.fromEntries(persons.map((p) => [p.id, p]))
  const famById = Object.fromEntries(families.map((f) => [f.id, f]))
  const famName = (id) => famById[id]?.name ?? (id.startsWith('solo:') ? 'Sin familia' : '—')

  const balances = computeFamilyBalances(expenses, settlements, personsById)
  const transfers = simplifyDebts(balances)
  const rows = [...balances.entries()].filter(([, c]) => c !== 0).sort((a, b) => b[1] - a[1])

  const anySettled = settlements.length > 0

  return (
    <div className="body">
      {expenses.length === 0 ? (
        <div className="empty"><span className="e">📊</span>Sin gastos, sin cuentas.<br />Añade gastos y aquí verás quién debe a quién.</div>
      ) : (
        <>
          <div className="sec-h">Saldo por familia</div>
          <div className="card tight">
            {rows.length === 0 && <div className="empty" style={{ padding: 14 }}>Todo cuadrado 🎉</div>}
            {rows.map(([fid, cents]) => (
              <div className="row" key={fid}>
                <div className="av" style={{ background: famById[fid]?.color || 'var(--ink-faint)' }}>{famById[fid]?.avatar ?? '👥'}</div>
                <div className="main"><div className="n">{famName(fid)}</div>
                  <div className="sub">{cents > 0 ? 'le deben' : 'debe'}</div></div>
                <div className={`amt tnum ${cents > 0 ? 'owed' : 'owe'}`}>{cents > 0 ? '+' : ''}{formatCents(cents, event.currency)}</div>
              </div>
            ))}
          </div>

          <div className="sec-h">Cómo saldar (menos transferencias)</div>
          {transfers.length === 0 ? (
            <div className="note">🐳 No hay nada pendiente. La ballenita está satisfecha.</div>
          ) : (
            <div className="card tight">
              {transfers.map((t, i) => (
                <div className="row" key={i}>
                  <div className="av" style={{ background: famById[t.fromFamilyId]?.color || 'var(--ink-faint)' }}>{famById[t.fromFamilyId]?.avatar ?? '👥'}</div>
                  <div className="main">
                    <div className="n">{famName(t.fromFamilyId)} → {famName(t.toFamilyId)}</div>
                    <div className="sub">transferencia pendiente</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="amt tnum">{formatCents(t.amountCents, event.currency)}</div>
                    <button className="btn sm" style={{ marginTop: 4 }} onClick={() => addSettlement(eventId, t)}>marcar pagado</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="note">La app <b>lleva la cuenta</b>, no mueve dinero: haces el Bizum fuera y aquí marcas «pagado» (§3.4).</div>

          {anySettled && (
            <>
              <div className="sec-h">Pagos apuntados</div>
              <div className="card tight">
                {settlements.map((s) => (
                  <div className="row" key={s.id}>
                    <div className="av" style={{ background: 'var(--owed)' }}>✓</div>
                    <div className="main"><div className="n">{famName(s.fromFamilyId)} → {famName(s.toFamilyId)}</div>
                      <div className="sub">{new Date(s.dateISO).toLocaleDateString('es-ES')}</div></div>
                    <div className="amt tnum owed">{formatCents(s.amountCents, event.currency)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
