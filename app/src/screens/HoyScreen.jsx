import { useLiveQuery } from 'dexie-react-hooks'
import { dinnersOf, plansOf, bungasOf, listDishes } from '../db.js'
import Icono from '../components/Icono.jsx'
import {
  diasDe, diaQueEnsenaHoy, rotuloDelDia, titularDeCena, fmtDiaCorto,
} from '../lib/dias.js'

/**
 * «Hoy»: qué pasa hoy, contestado sin que haya que leer.
 *
 * Opción **E1** de `docs/diseño/navegacion.html`: el titular de la cena y los
 * planes del día, y nada más. Ni el dinero, ni la compra, ni lo que hay que
 * decidir — todo eso tiene su sección y aquí solo competiría con la pregunta con
 * la que se abre la app.
 *
 * Y opción **F3** para los otros trescientos cincuenta y siete días del año: si
 * hoy no cae dentro del evento, enseña el día más próximo **diciendo lo que es**
 * («el primer día, dentro de 6 días»). Antes decía «la agenda está vacía», que
 * era mentira y hacía que alguien volviera a apuntar lo que ya estaba.
 */
export default function HoyScreen({ eventId, event, onGoTab }) {
  const cenas = useLiveQuery(() => dinnersOf(eventId), [eventId], [])
  const planes = useLiveQuery(() => plansOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const platos = useLiveQuery(listDishes, [], [])

  const dias = diasDe(event, [...cenas.map((c) => c.dia), ...planes.map((p) => p.dia)])
  const cual = diaQueEnsenaHoy(dias)

  if (!cual) {
    return (
      <div className="body">
        <div className="empty">
          <span className="e">🗓️</span>
          Este evento todavía no tiene fechas.<br />
          Ponlas en Ajustes → Evento y aquí verás el día a día.
        </div>
      </div>
    )
  }

  const cena = cenas.find((c) => c.dia === cual.dia)
  const delDia = planes.filter((p) => p.dia === cual.dia)
  const porId = Object.fromEntries(platos.map((p) => [p.id, p]))
  const susPlatos = (cena?.platoIds ?? []).map((id) => porId[id]).filter(Boolean)
  const nombreBunga = (id) => { const b = bungas.find((x) => x.id === id); return b ? (b.alias || b.name) : null }

  const mayores = nombreBunga(cena?.bungaMayoresId)
  const ninos = nombreBunga(cena?.bungaNinosId)

  return (
    <div className="body">
      {/* El titular. Es lo único grande de la pantalla: si compite con otra
          tarjeta deja de ser un titular y hay que leer para saber qué pasa. */}
      <div className="titular">
        <div className="l">{rotuloDelDia(cual, { hayCena: !!cena })}</div>
        <div className="g">{titularDeCena(cena, susPlatos)}</div>
        <div className="p">
          {cena
            ? [mayores && `Mayores en ${mayores}`, ninos && `niños en ${ninos}`].filter(Boolean).join(' · ')
              || 'Sin bungas repartidas todavía'
            : 'Nadie ha dicho dónde se cena'}
        </div>
      </div>

      <div className="sec-h">{cual.estado === 'hoy' ? 'Planes de hoy' : `Planes del ${fmtDiaCorto(cual.dia)}`}</div>
      <div className="card tight">
        {delDia.length === 0 ? (
          <div className="row">
            <div className="ico"><Icono nombre="plan" /></div>
            <div className="main">
              <div className="n">Nada apuntado</div>
              <div className="sub">un día libre, que también hace falta</div>
            </div>
          </div>
        ) : delDia.map((p) => (
          <button key={p.id} className="row fila-boton" onClick={() => onGoTab?.('planes')}>
            <div className="ico"><Icono nombre="plan" /></div>
            <div className="main">
              <div className="n">{p.titulo}</div>
              <div className="sub">
                {p.estado === 'confirmado' ? 'Confirmado' : 'A votación'}
                {p.ubicacion ? ` · ${p.ubicacion}` : ''}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
