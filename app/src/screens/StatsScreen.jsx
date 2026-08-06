// Estadísticas del evento: el gasto, las cenas y los planes, contados.
//
// Las métricas con pique van detrás de un interruptor, porque nada aquí señala
// a nadie por defecto (SPECS §7).
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  expensesOf, personsOf, familiesOf, bungasOf, dinnersOf, plansOf, listDishes,
} from '../db.js'
import { computeStats } from '../lib/stats.js'
import { formatCents } from '../lib/money.js'
import { CATEGORIES } from '../lib/categorias.js'

const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id

// `suelto` la pinta sin el `.body` (que es el contenedor que hace scroll): así
// cabe dentro de un apartado de Ajustes sin arrastrar su relleno ni su scroll.
export default function StatsScreen({ eventId, event, suelto = false }) {
  const expenses = useLiveQuery(() => expensesOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const dinners = useLiveQuery(() => dinnersOf(eventId), [eventId], [])
  const plans = useLiveQuery(() => plansOf(eventId), [eventId], [])
  const dishes = useLiveQuery(() => listDishes(event), [event?.id, event?.esDemo], [])

  const key = `ballena.picante.${eventId}`
  const [picante, setPicante] = useState(() => localStorage.getItem(key) === '1')
  function togglePicante() {
    const v = !picante
    setPicante(v)
    localStorage.setItem(key, v ? '1' : '0')
  }

  const s = computeStats({ expenses, persons, families, bungas, dinners, plans, dishes })
  const famName = (id) => families.find((f) => f.id === id)?.name ?? '—'
  const personName = (id) => persons.find((p) => p.id === id)?.name ?? '—'
  const cur = event.currency

  if (expenses.length === 0 && dinners.length === 0 && plans.length === 0) {
    return <div className={suelto ? 'pila' : 'body'}><div className="empty">
      <span className="e">📊</span>Aún no hay nada que contar.<br />
      Añade gastos, cenas o planes.<br />
      Un viaje sin datos es solo un viaje, que tampoco está mal.
    </div></div>
  }

  return (
    <div className={suelto ? 'pila' : 'body'}>
      <div className="grid2">
        <Tile v={formatCents(s.totalCents, cur)} l="Gasto total" />
        <Tile v={formatCents(s.perPersonAvgCents, cur)} l="Por persona (media)" />
        <Tile v={s.byCategory[0] ? catLabel(s.byCategory[0].category) : '—'} l="Categoría más cara" />
        <Tile v={s.byPayerFamily[0] ? famName(s.byPayerFamily[0].familyId) : '—'} l="Quién más adelanta" />
        {s.topDish && <Tile v={`${s.topDish.name} ×${s.topDish.count}`} l="Plato estrella" />}
        <Tile v={`${s.plansConfirmed}/${s.plansProposed}`} l="Planes confirmados" />
      </div>

      {s.hostBalance.some((h) => h.total > 0) && (
        <>
          <div className="sec-h">Balance de anfitrión (cenas)</div>
          <div className="card tight">
            {s.hostBalance.map((h) => (
              <div className="row" key={h.bungaId}>
                <div className="av" style={{ background: 'var(--spout-deep)' }}>🏠</div>
                <div className="main"><div className="n">{h.name}</div><div className="sub">mayores {h.mayores} · niños {h.ninos}</div></div>
                <div className="pill neutral">{h.total}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sec-h">
        Con pique 🌶️
        <button className="btn sm ghost" onClick={togglePicante}>{picante ? 'ocultar' : 'activar'}</button>
      </div>
      {picante ? (
        <div className="card">
          {s.topNoVoter
            ? <div className="note" style={{ border: 'none', background: 'transparent', padding: 0 }}>🙅 <b>{personName(s.topNoVoter.personId)}</b> es quien más vota 👎 ({s.topNoVoter.count} planes). La ballenita lo tiene fichado.</div>
            : <div className="note" style={{ border: 'none', background: 'transparent', padding: 0 }}>Nadie ha votado que no todavía. Grupo ejemplar.</div>}
        </div>
      ) : (
        <div className="note">Las métricas que <b>señalan a alguien</b> están desactivadas para no montar dramas. Actívalas si el grupo aguanta bromas (§7).</div>
      )}
    </div>
  )
}

function Tile({ v, l }) {
  return (
    <div className="card tight" style={{ padding: 12 }}>
      <div className="tnum cifra sm">{v}</div>
      <div className="cifra-l bajo">{l}</div>
    </div>
  )
}
