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
import { fmtDiaCorto, hoyISO } from '../lib/dias.js'

const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id

// Vivió dentro de un apartado de Ajustes (con un modo `suelto` sin `.body`);
// desde que es la tercera área de Agenda es una pantalla como las demás.
export default function StatsScreen({ eventId, event }) {
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

  const s = computeStats({ expenses, persons, families, bungas, dinners, plans, dishes, event, hoy: hoyISO() })
  const famName = (id) => families.find((f) => f.id === id)?.name ?? '—'
  const personName = (id) => persons.find((p) => p.id === id)?.name ?? '—'
  const nombres = (t) => t.personIds.map(personName).join(' y ')
  const cur = event.currency

  if (expenses.length === 0 && dinners.length === 0 && plans.length === 0) {
    return <div className="body"><div className="empty">
      <span className="e">📊</span>Aún no hay nada que contar.<br />
      Añade gastos, cenas o planes.<br />
      Un viaje sin datos es solo un viaje, que tampoco está mal.
    </div></div>
  }

  return (
    <div className="body">
      {/* El balance primero (numeros.html · decidido 3): es la cuenta que evita
          discusiones —quién ha acogido ya y a quién le toca— y estaba debajo de
          la media por persona. */}
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

      <div className="grid2">
        <Tile v={formatCents(s.totalCents, cur)} l="Gasto total" />
        <Tile v={formatCents(s.perPersonAvgCents, cur)} l="Por persona (media)" />
        <Tile v={s.byCategory[0] ? catLabel(s.byCategory[0].category) : '—'} l="Categoría más cara" />
        <Tile v={s.byPayerFamily[0] ? famName(s.byPayerFamily[0].familyId) : '—'} l="Quién más adelanta" />
        {s.topDish && <Tile v={`${s.topDish.name} ×${s.topDish.count}`} l="Plato estrella" />}
        <Tile v={`${s.plansConfirmed}/${s.plansProposed}`} l="Planes confirmados" />
        {/* Las cuatro de numeros.html (T1–T4): ninguna señala a nadie. */}
        {s.topDay && <Tile v={`${formatCents(s.topDay.cents, cur)} · ${fmtDiaCorto(s.topDay.dia)}`} l="El día más caro" />}
        {s.forecastCents != null && <Tile v={`~${formatCents(s.forecastCents, cur)}`} l="Así vais a acabar" />}
        {s.daysWithPlan.total > 0 && <Tile v={`${s.daysWithPlan.con} de ${s.daysWithPlan.total}`} l="Días con plan" />}
        {s.dinnersCount > 0 && <Tile v={`${s.dinnerStreak} ${s.dinnerStreak === 1 ? 'noche' : 'noches'}`} l="Racha de cenas" />}
      </div>

      <div className="sec-h">
        Con pique 🌶️
        <button className="btn sm ghost" onClick={togglePicante}>{picante ? 'ocultar' : 'activar'}</button>
      </div>
      {picante ? (
        <div className="card">
          {/* El trío del pique (numeros.html · T7 · T8 y el 👎 de siempre):
              señalan —para bien, para regular y para mal—, así que los tres
              viven detrás del interruptor. Los empates se dicen. */}
          {s.topYesVoter && (
            <div className="note" style={{ border: 'none', background: 'transparent', padding: 0 }}>
              🏆 <b>{nombres(s.topYesVoter)}</b>{' '}
              {s.topYesVoter.personIds.length > 1 ? 'son los que más 👍 reparten' : 'es quien más 👍 reparte'}
              {' '}({s.topYesVoter.count} {s.topYesVoter.count === 1 ? 'plan' : 'planes'}).
              {s.topYesVoter.personIds.length > 1 ? ' Entusiasmo empatado.' : ' Un entusiasta.'}
            </div>
          )}
          {s.topShrugVoter && (
            <div className="note" style={{ border: 'none', background: 'transparent', padding: 0, marginTop: 8 }}>
              🤷 <b>{nombres(s.topShrugVoter)}</b>{' '}
              {s.topShrugVoter.personIds.length > 1
                ? `van empatados a encogimientos de hombros (${s.topShrugVoter.count}).`
                : `es quien más se encoge de hombros (${s.topShrugVoter.count}).`}
            </div>
          )}
          {s.topNoVoter
            ? <div className="note" style={{ border: 'none', background: 'transparent', padding: 0, marginTop: 8 }}>🙅 <b>{personName(s.topNoVoter.personId)}</b> es quien más vota 👎 ({s.topNoVoter.count} planes). La ballenita lo tiene fichado.</div>
            : <div className="note" style={{ border: 'none', background: 'transparent', padding: 0, marginTop: 8 }}>Nadie ha votado que no todavía. Grupo ejemplar.</div>}
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
