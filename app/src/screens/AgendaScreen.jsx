import { useLiveQuery } from 'dexie-react-hooks'
import { dinnersOf, plansOf, bungasOf } from '../db.js'

function eachDay(start, end) {
  if (!start) return []
  const days = []
  const d = new Date(start + 'T00:00:00')
  const last = new Date((end || start) + 'T00:00:00')
  let guard = 0
  while (d <= last && guard++ < 60) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}
const today = () => new Date().toISOString().slice(0, 10)
const fmtDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })

export default function AgendaScreen({ eventId, event, onGoTab }) {
  const dinners = useLiveQuery(() => dinnersOf(eventId), [eventId], [])
  const plans = useLiveQuery(() => plansOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const bungaName = (id) => { const b = bungas.find((x) => x.id === id); return b ? (b.alias || b.name) : '—' }

  // Días del evento; si no hay fechas, usar los días que tengan algo.
  let days = eachDay(event.startDate, event.endDate)
  if (days.length === 0) {
    days = [...new Set([...dinners.map((d) => d.dia), ...plans.map((p) => p.dia)].filter(Boolean))].sort()
  }
  const dinnerOf = (day) => dinners.find((c) => c.dia === day)
  const plansOfDay = (day) => plans.filter((p) => p.dia === day)
  const sinDia = plans.filter((p) => !p.dia)
  const t = today()

  const nothing = days.every((d) => !dinnerOf(d) && plansOfDay(d).length === 0) && sinDia.length === 0

  return (
    <div className="body">
      {nothing && (
        <div className="empty"><span className="e">🗓️</span>La agenda está vacía.<br />Añade cenas y planes y aquí verás el día a día.</div>
      )}

      {days.map((day) => {
        const cena = dinnerOf(day)
        const dayPlans = plansOfDay(day)
        if (!cena && dayPlans.length === 0) return null
        return (
          <div key={day}>
            <div className="sec-h" style={{ textTransform: 'capitalize' }}>
              {fmtDay(day)} {day === t && <span className="pill neutral">hoy</span>}
            </div>
            <div className="card tight">
              {dayPlans.map((p) => (
                <div className="row" key={p.id}>
                  <div className="av" style={{ background: 'color-mix(in srgb, var(--spout) 22%, transparent)', color: 'var(--spout-deep)' }}>🗺️</div>
                  <div className="main"><div className="n">{p.titulo}</div><div className="sub">Plan · {p.estado}</div></div>
                </div>
              ))}
              {cena && (
                <div className="row">
                  <div className="av" style={{ background: 'color-mix(in srgb, var(--gold) 30%, transparent)', color: 'var(--gold)' }}>🍳</div>
                  <div className="main">
                    <div className="n">Cena{cena.platoIds?.length ? ` · ${cena.platoIds.length} platos` : ''}</div>
                    <div className="sub">Mayores → {bungaName(cena.bungaMayoresId)} · Niños → {bungaName(cena.bungaNinosId)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {sinDia.length > 0 && (
        <>
          <div className="sec-h">Planes sin día — a decidir</div>
          <div className="card tight">
            {sinDia.map((p) => (
              <button key={p.id} className="row" style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', borderTop: '1px solid var(--line-soft)' }} onClick={() => onGoTab?.('planes')}>
                <div className="av" style={{ background: 'var(--ink-faint)' }}>🗺️</div>
                <div className="main"><div className="n">{p.titulo}</div><div className="sub">ponle día en Planes →</div></div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
