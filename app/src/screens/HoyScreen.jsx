import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { dinnersOf, plansOf, bungasOf, personsOf, familiesOf, listDishes, ponerEstado } from '../db.js'
import Icono from '../components/Icono.jsx'
import PieDeVersion from '../components/PieDeVersion.jsx'
import Recado from '../components/Recado.jsx'
import Alias from '../components/Alias.jsx'
import HojaDeEstado from '../components/HojaDeEstado.jsx'
import { useIdentidad } from '../lib/identidad.js'
import { tap } from '../lib/native.js'
import { estadoEnUnaLinea, partirEstado, quienTieneEstado } from '../lib/estados.js'
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
  const personas = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const familias = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  // Los dos hooks del estado van **antes** del retorno temprano de abajo: un
  // hook detrás de un `return` se salta unas veces sí y otras no, y React
  // exige que el orden no cambie entre pintados.
  const { me } = useIdentidad(eventId, personas)
  const [poniendoEstado, setPoniendoEstado] = useState(false)

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
  const conEstado = quienTieneEstado(personas)
  // Si tienes identidad en este móvil y **no has dicho nada**, la tira te abre
  // con la invitación (§14.45). La pastilla de la cabecera ya invitaba, pero
  // ahí es un renglón de 15 pt sobre el cielo que se lee como parte del rótulo
  // del evento: el sitio donde se ve lo que dicen los demás es donde apetece
  // decir lo tuyo. En cuanto hay estado, el botón desaparece — la pastilla
  // sigue estando para cambiarlo, y dos invitaciones a la vez son ruido.
  const invita = Boolean(me) && !String(me.estado ?? '').trim()

  const { grande, pequeno } = titularDeHoy({
    cena,
    platos: susPlatos,
    planes: delDia,
    bungaMayores: nombreBunga(cena?.bungaMayoresId),
    bungaNinos: nombreBunga(cena?.bungaNinosId),
  })

  return (
    <div className="body">
      {/* El recado, **bajo el selector** y no al final del scroll
          (SPECS §14.44): al final no lo lee nadie — en una lista larga
          hay que llegar hasta abajo, y en Gastos eso es todo el viaje. */}
      <Recado evento={event} />

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

      {/* Quién anda en qué (§14.36 · G3): la tira de caras con su estado, bajo
          los planes. Es lo que convierte el campo en algo que se usa — hasta
          ahora el estado sincronizaba a los nueve móviles y no se pintaba en
          ninguna pantalla. Solo salen los que han dicho algo: una tira de nueve
          caras mudas no cuenta nada, y esta pantalla es para lo que **hay**.
          Cada nombre lleva **el acrónimo de su familia** en su pastilla
          (`Alias.jsx`, la de Ideas y la de los votantes): con dos Marías en el
          grupo, el nombre solo no dice de qué casa es. Y van **por novedad**,
          lo último puesto primero. */}
      {(conEstado.length > 0 || invita) && (
        <>
          <div className="sec-h">Quién anda en qué</div>
          <div className="tira-estados">
            {invita && (
              <button
                type="button"
                className="est invita"
                onClick={() => { tap(); setPoniendoEstado(true) }}
              >
                <span className="cara" aria-hidden>{me.avatar || '🙂'}</span>
                <span className="quien">
                  <span className="n">Tú<Alias familia={familias.find((f) => f.id === me.familyId)} /></span>
                  <span className="q">+ di en qué andas</span>
                </span>
              </button>
            )}
            {conEstado.map((p) => {
              const { emoji, texto } = partirEstado(p.estado)
              return (
                <div className="est" key={p.id}>
                  <span className="cara" aria-hidden>{emoji || p.avatar || '🙂'}</span>
                  <span className="quien">
                    <span className="n">
                      {p.apodo || p.name}
                      <Alias familia={familias.find((f) => f.id === p.familyId)} />
                    </span>
                    <span className="q">{texto || estadoEnUnaLinea({ emoji, texto })}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}


      <PieDeVersion />

      {/* La misma hoja que abre la pastilla de la cabecera, y el mismo escritor
          (`ponerEstado`): dos sitios para lo mismo, una sola regla. */}
      {poniendoEstado && me && (
        <HojaDeEstado
          eventId={eventId}
          persona={me}
          onCerrar={() => setPoniendoEstado(false)}
          onGuardar={async (nuevo) => {
            await ponerEstado(me.id, nuevo)
            setPoniendoEstado(false)
          }}
        />
      )}
    </div>
  )
}
