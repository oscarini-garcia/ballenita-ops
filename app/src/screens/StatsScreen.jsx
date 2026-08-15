// Estadísticas del evento: el gasto, las cenas y los planes, contados.
//
// Las métricas con pique van detrás de un interruptor, porque nada aquí señala
// a nadie por defecto (SPECS §7).
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  expensesOf, personsOf, familiesOf, bungasOf, dinnersOf, plansOf, listDishes, registroDe,
} from '../db.js'
import { computeStats } from '../lib/stats.js'
import { formatCents } from '../lib/money.js'
import { CATEGORIES } from '../lib/categorias.js'
import { fmtDiaCorto, hoyISO } from '../lib/dias.js'
import { componerRecap, porDias } from '../lib/recap.js'
import { claseDe } from '../lib/registro.js'
import Icono from '../components/Icono.jsx'
import Alias from '../components/Alias.jsx'

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
  const apuntes = useLiveQuery(() => registroDe(eventId), [eventId], [])

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

  if (expenses.length === 0 && dinners.length === 0 && plans.length === 0 && apuntes.length === 0) {
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
            {/* Cada bunga se enseña **como en su selector** (§14.31 · B1): la
                familia manda, con su pastilla de dos letras, y el alias del
                bunga queda de seña en la línea de abajo. Aquí la pregunta es a
                quién le toca acoger, y a quién le toca es a una familia — «El
                del ruido» solo lo contesta si te sabes los motes. Un bunga sin
                familia dueña se queda con su alias, como en el selector.
                El icono es el mismo dibujo de línea que en el día; el 🏠 de
                antes era un emoji del cromo, que §14.13 no quiere. */}
            {s.hostBalance.map((h) => {
              const f = families.find((x) => x.id === h.familyId)
              return (
                <div className="row" key={h.bungaId}>
                  <div className="ico"><Icono nombre="casa" /></div>
                  <div className="main">
                    <div className="n">
                      {f ? <>{f.name}<Alias familia={f} /></> : h.name}
                    </div>
                    <div className="sub">
                      {f ? `${h.name} · ` : ''}mayores {h.mayores} · niños {h.ninos}
                    </div>
                  </div>
                  <div className="pill neutral">{h.total}</div>
                </div>
              )
            })}
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

      <Recap apuntes={apuntes} persons={persons} />
    </div>
  )
}

/**
 * El recap: qué ha hecho el grupo, apuntado según se hacía (SPECS §14.50).
 *
 * Va **al final de Números** y no en un área propia: es lo que se mira del
 * viaje, como el resto de esta pantalla, y una cuarta casilla en el mando de
 * Agenda deja las cuatro por debajo de los 77 pt. Al final porque durante el
 * viaje lo que se abre Números a mirar es el gasto; el recap se lee el domingo.
 *
 * La lista larga vive detrás de «ver todo» por la misma razón que el pique vive
 * detrás de su interruptor: en un viaje de una semana son cientos de renglones,
 * y ninguno de ellos es lo que vienes a ver cuando abres Números el martes.
 */
function Recap({ apuntes, persons }) {
  const [todo, setTodo] = useState(false)
  const r = componerRecap({ apuntes, persons })

  if (r.total === 0) {
    return (
      <>
        <div className="sec-h">El recap</div>
        <div className="note">
          🐳 Aquí se va a ir apuntando lo que hace el grupo —gastos, cenas, votos, la compra— para
          contarlo al final del viaje. Todavía no hay nada.
        </div>
      </>
    )
  }

  const nombre = (a) => a.nombre ?? 'Alguien'
  const dias = porDias(apuntes)
  const aLaVista = todo ? dias : dias.slice(0, 1)

  return (
    <>
      <div className="sec-h">
        El recap
        <button className="btn sm ghost" onClick={() => setTodo(!todo)}>{todo ? 'resumen' : 'ver todo'}</button>
      </div>

      <div className="grid2">
        <Tile v={r.total} l={r.total === 1 ? 'Cosa apuntada' : 'Cosas apuntadas'} />
        {r.masActivo && <Tile v={`${nombre(r.masActivo)} ×${r.masActivo.cuantas}`} l="Quién más ha andado" />}
        {r.diaMasMovido && (
          <Tile
            v={`${r.diaMasMovido.dias.map(fmtDiaCorto).join(' y ')} · ${r.diaMasMovido.cuantas}`}
            l={r.diaMasMovido.dias.length > 1 ? 'Los días más movidos' : 'El día más movido'}
          />
        )}
      </div>

      {/* Por clase: es el resumen de un vistazo —«ocho gastos, cuatro cenas,
          treinta y una de la compra»— y cabe en una tarjeta. */}
      <div className="card tight">
        {r.porClase.map((c) => (
          <div className="row" key={c.id}>
            <div className="ico" aria-hidden="true">{c.emoji}</div>
            <div className="main"><div className="n">{c.etiqueta}</div></div>
            <div className="pill neutral">{c.cuantas}</div>
          </div>
        ))}
      </div>

      {/* Y el diario, por días. Sin «ver todo» sale el último, que es lo que
          contesta «¿qué ha pasado desde que miré?». */}
      {aLaVista.map(({ dia, apuntes: delDia }) => (
        <div key={dia}>
          <div className="sec-h">{fmtDiaCorto(dia)}</div>
          <div className="card tight">
            {delDia.map((a) => {
              const clase = claseDe(a.clase)
              const quien = persons.find((p) => p.id === a.personId)
              return (
                <div className="row recap-linea" key={a.id}>
                  <div className="ico" aria-hidden="true">{clase?.emoji ?? '•'}</div>
                  <div className="main">
                    <div className="n">{quien?.name ?? 'Alguien'} {a.texto}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {!todo && dias.length > 1 && (
        <div className="note">🐳 Y {dias.length - 1} {dias.length - 1 === 1 ? 'día más' : 'días más'} detrás de «ver todo».</div>
      )}
    </>
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
