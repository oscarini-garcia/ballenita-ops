import { useLiveQuery } from 'dexie-react-hooks'
import { dinnersOf, plansOf, bungasOf, listDishes } from '../db.js'
import Icono from '../components/Icono.jsx'
import PieDeVersion from '../components/PieDeVersion.jsx'
import Recado from '../components/Recado.jsx'
import {
  diasDe, diaQueEnsenaHoy, rotuloDelDia, titularDeHoy, fmtDiaCorto,
} from '../lib/dias.js'

/**
 * «Hoy»: qué pasa hoy, contestado sin que haya que leer.
 *
 * Opción **E1** de `docs/diseño/navegacion.html`: un solo titular grande y los
 * planes del día, y nada más. Ni el dinero, ni la compra, ni lo que hay que
 * decidir — todo eso tiene su sección y aquí solo competiría con la pregunta con
 * la que se abre la app.
 *
 * El titular **titula lo que hay** (`docs/diseño/dia-abierto.html` · P2,
 * `titularDeHoy`): antes era siempre la cena, y el día de la playa confirmada
 * abría con «Sin cena montada» — el plan de verdad quedaba 127 pt más abajo, en
 * letra de fila, mientras la lista de Días titulaba ese mismo día «Playa de la
 * Cala».
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
  const platos = useLiveQuery(() => listDishes(event), [event?.id, event?.esDemo], [])

  const dias = diasDe(event, [...cenas.map((c) => c.dia), ...planes.map((p) => p.dia)])
  const cual = diaQueEnsenaHoy(dias)

  if (!cual) {
    return (
      <div className="body">
        <div className="empty">
          <span className="e">🗓️</span>
          Este evento todavía no tiene fechas.<br />
          Ponlas en Ajustes → Evento y aquí verás el día a día.<br />
          Sin fechas no hay cuenta atrás, y sin cuenta atrás no hay prisa.
        </div>
      </div>
    )
  }

  const cena = cenas.find((c) => c.dia === cual.dia)
  const delDia = planes.filter((p) => p.dia === cual.dia)
  const porId = Object.fromEntries(platos.map((p) => [p.id, p]))
  const susPlatos = (cena?.platoIds ?? []).map((id) => porId[id]).filter(Boolean)
  const nombreBunga = (id) => { const b = bungas.find((x) => x.id === id); return b ? (b.alias || b.name) : null }

  const { grande, pequeno } = titularDeHoy({
    cena,
    platos: susPlatos,
    planes: delDia,
    bungaMayores: nombreBunga(cena?.bungaMayoresId),
    bungaNinos: nombreBunga(cena?.bungaNinosId),
  })

  return (
    <div className="body">
      {/* El titular. Es lo único grande de la pantalla: si compite con otra
          tarjeta deja de ser un titular y hay que leer para saber qué pasa. */}
      <div className="titular">
        <div className="l">{rotuloDelDia(cual, { hayCena: !!cena })}</div>
        <div className="g">{grande}</div>
        <div className="p">{pequeno}</div>
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

      {/* El recado del día, encima de la versión (SPECS §14.25). */}
      <Recado evento={event} />

      <PieDeVersion />
    </div>
  )
}
