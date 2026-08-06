// Planes: lo que se propone para este viaje, y a qué se apunta cada uno.
//
// Aquí solo se vota; el día se pone en Agenda y un plan solo nace de una idea
// del catálogo (SPECS §14.19).
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { plansOf, updatePlan, personsOf, familiesOf, devolverPlanAIdea } from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { useIdentidad } from '../lib/identidad.js'
import { esAdministrador } from '../lib/admin.js'
import { leerSesion } from '../auth/sesion.js'
import { porDia } from '../lib/evento.js'
import { votosDe, quienFaltaPorVotar } from '../lib/planes.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import Alias from '../components/Alias.jsx'

const VOTES = ['👍', '🤷', '👎']
const fmtDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * Planes: **aquí solo se vota**.
 *
 * La pantalla hacía tres trabajos a la vez —votar, poner fecha y administrar— y
 * se le notaba. Medido en el navegador: cada plan era una tarjeta de **299,9 pt**
 * en un cuerpo de 633,6 —cabían 2,1— con **siete botones**, un selector de fecha
 * nativo que traía su propio dibujo y su propia alineación, y **ocho colores**
 * contando el verde de la pastilla, el rojo de «borrar», el azul del enlace y los
 * tres emoji de voto.
 *
 * Ahora cada plan es una fila de **70,7 pt** —caben ocho—, el día se pone en
 * **Agenda**, que es donde está el calendario, y lo de administrar vive dentro
 * del plan abierto. Decidido en `docs/diseño/planes-votar.html`.
 *
 * **Dos grupos y un orden que significa algo**: primero los elegidos —los que ya
 * tienen día—, después los disponibles por votos. El orden de creación no decía
 * nada.
 *
 * **Y un plan no se crea aquí: sale de proponer una idea.** Había un «+ Plan» que
 * abría su propio formulario, y con él un plan podía nacer por dos caminos: desde
 * el catálogo, quedando enlazado a su idea, o suelto, sin idea detrás. El segundo
 * se lleva por delante media razón de ser del catálogo —lo que se apunta a mano
 * este agosto no está el que viene— y duplicaba un formulario que ya existe. Ahora
 * hay un solo camino, y la pantalla **lo dice** en vez de dejar buscando el botón:
 * apúntalo en Ideas y dale a «Proponer».
 */
export default function PlanesScreen({ eventId, event }) {
  const plans = useLiveQuery(() => plansOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const { meId: me } = useIdentidad(eventId, persons)
  const [abierto, setAbierto] = useState(null)

  const esAdmin = esAdministrador(leerSesion())

  // Lo que se cayó fuera de las fechas sigue apartado (§14.10-quater): un plan en
  // un día que el viaje ya no tiene no es un plan elegido.
  const { dentro, fuera } = porDia(plans, event)
  const elegidos = dentro.filter((p) => p.dia)
  const disponibles = dentro.filter((p) => !p.dia)
    .sort((a, b) => votosDe(b) - votosDe(a) || (a.titulo || '').localeCompare(b.titulo || '', 'es'))

  /**
   * La fila cerrada dice **quién falta por votar** (`planes-votar.html` · V5).
   * Es lo accionable —a esos hay que darles un toque— y cabe en el subtítulo que
   * ya existe, sin gastar un sitio nuevo.
   */
  function Fila({ plan, elegido }) {
    // Quién falta lo dice `lib/planes.js`, que es de donde lo saca también la
    // hoja de planes libres de Agenda: dos sitios contando lo mismo con palabras
    // distintas se leen como dos cosas distintas.
    const detalle = elegido ? fmtDay(plan.dia) : quienFaltaPorVotar(plan, persons)
    return (
      <button className="row fila-plan" onClick={() => { tap(); setAbierto(plan.id) }}>
        <div className={`ico${elegido ? ' verde' : ''}`}><Icono nombre="plan" /></div>
        <div className="main">
          <div className="n">{plan.titulo}</div>
          <div className="sub">{detalle}</div>
        </div>
        <span className={`pill ${elegido ? 'owed' : 'neutral'} tnum`}>{votosDe(plan)}</span>
      </button>
    )
  }

  const plan = plans.find((p) => p.id === abierto) ?? null

  return (
    <div className="body">
      {!me && persons.length > 0 && (
        <div className="note">
          Para votar hace falta saber quién eres: dilo en <b>Ajustes → Quién eres</b>.
        </div>
      )}

      {plans.length === 0 && (
        <div className="empty">
          <span className="e">🗺️</span>Ningún plan todavía.<br />
          Los planes salen de <b>Ideas</b>: apunta la idea ahí y dale a <b>Proponer</b>.<br />
          Un viaje sin planes también es un plan, pero avisa.
        </div>
      )}

      {elegidos.length > 0 && (
        <>
          <div className="sec-h"><span>Elegidos · {elegidos.length}</span></div>
          <div className="card tight">
            {elegidos.map((p) => <Fila key={p.id} plan={p} elegido />)}
          </div>
        </>
      )}

      {disponibles.length > 0 && (
        <>
          <div className="sec-h"><span>Disponibles · {disponibles.length}</span><span>por votos</span></div>
          <div className="card tight">
            {disponibles.map((p) => <Fila key={p.id} plan={p} />)}
          </div>
        </>
      )}

      {fuera.length > 0 && (
        <>
          <div className="sec-h">Fuera de las fechas del viaje</div>
          <div className="note">
            {fuera.length === 1 ? 'Este plan cae' : 'Estos planes caen'} en un día que el evento ya no
            tiene, así que no {fuera.length === 1 ? 'sale' : 'salen'} en Agenda. Corrige el día desde
            Agenda, o las fechas en <b>Ajustes → Evento</b>.
          </div>
          <div className="card tight">
            {fuera.map((p) => <Fila key={p.id} plan={p} />)}
          </div>
        </>
      )}

      {/* Va al final y en voz baja, que es donde aparece la pregunta: se recorre
          la lista, no está lo que uno buscaba, y entonces —y solo entonces— hace
          falta saber por dónde entra un plan nuevo. */}
      {plans.length > 0 && (
        <div className="note">
          ¿Falta algo? Un plan sale de <b>proponer una idea</b>: apúntala en
          <b> Ideas</b> y dale a <b>Proponer</b>. Así queda guardada para los
          próximos viajes.
        </div>
      )}

      {plan && (
        <PlanAbierto
          plan={plan}
          persons={persons}
          families={families}
          me={me}
          evento={event}
          esAdmin={esAdmin}
          onClose={() => setAbierto(null)}
        />
      )}
    </div>
  )
}

/**
 * El plan abierto: se vota, se ve quién ha votado qué, y quien administra puede
 * devolverlo al catálogo.
 *
 * **Se ve como una capa** (`docs/diseño/plan-voto.html` · P1 · F1+F4 · V2):
 * centrado, con el papel de las tarjetas, borde y sombra, y el velo un punto más
 * oscuro. Antes se plantaba abajo y con el papel del color del fondo —1,0 : 1—,
 * así que en la cara oscura no se veía dónde acababa la pantalla y empezaba el
 * modal. Centrarlo cuesta 200,3 pt de distancia al pulgar para los chips de
 * voto, que es el precio medido de que se lea como lo que es.
 *
 * **Cada voto dice cuántos son**, en columna y con cifras tabulares: el recuento
 * se compara de arriba abajo sin leer un solo nombre, que es lo que se hace al
 * abrir un plan —¿va ganando o no?—; los nombres contestan la segunda pregunta,
 * que es quién.
 *
 * Los votos se enseñan **con los nombres**, una línea por voto, y cada nombre
 * lleva delante **su avatar** y detrás **el alias de su familia** en pastilla de
 * su color (`components/Alias.jsx`). Los avatares solos no valían —seis emoji en
 * gris a 17,9 pt son seis manchas, y quien no eligió el suyo sale con la carita
 * de fábrica, así que dos personas se pintan igual—, pero al lado del nombre sí:
 * el nombre identifica y el dibujo es lo que se reconoce de un vistazo. El alias
 * añade lo que no dice ninguno de los dos, que es **de qué familia va el voto**,
 * y eso es lo que se mira cuando hay que saber si una casa entera está a favor.
 *
 * **Y no se listan los que faltan por votar.** Esa pregunta ya la contesta la
 * fila cerrada, en el subtítulo —«falta por votar Luis»—, que es donde sirve:
 * ahí es donde se decide a quién dar un toque, sin abrir nada. Repetirlo dentro
 * gastaba 34 pt en decir lo mismo dos pantallas seguidas.
 */
function PlanAbierto({ plan, persons, families, me, evento, esAdmin, onClose }) {
  useBloqueoDeScroll()
  const [confirmando, setConfirmando] = useState(false)

  const votos = plan.votos ?? {}
  const mio = votos[me]
  const conVoto = (v) => persons.filter((p) => votos[p.id] === v)

  function votar(emoji) {
    if (!me) return
    tap()
    const nuevos = { ...votos }
    if (nuevos[me] === emoji) delete nuevos[me]
    else nuevos[me] = emoji
    updatePlan(plan.id, { votos: nuevos })
  }

  async function devolver() {
    tap()
    await devolverPlanAIdea(plan, evento)
    onClose()
  }

  return (
    <div className="modal-bg center" onClick={onClose}>
      <div className="modal center" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>{plan.titulo}</h2>
        {plan.dia && <div className="pista">{fmtDay(plan.dia)}</div>}
        {plan.descripcion && <p className="note">{plan.descripcion}</p>}
        {plan.enlace && (
          <p className="pista"><a href={plan.enlace} target="_blank" rel="noreferrer">{plan.enlace}</a></p>
        )}

        <label>Tu voto</label>
        <div className="chips">
          {VOTES.map((v) => (
            <button
              key={v}
              className={`chip${mio === v ? ' on' : ''}`}
              aria-pressed={mio === v}
              aria-label={`Votar ${v}`}
              onClick={() => votar(v)}
              disabled={!me}
            >{v}</button>
          ))}
        </div>

        <label>Quién ha votado</label>
        <div className="votantes">
          {VOTES.map((v) => (
            <div className="votantes-fila" key={v}>
              <span className="votantes-voto" aria-hidden>{v}</span>
              <span
                className={`votantes-cuenta tnum${conVoto(v).length === 0 ? ' cero' : ''}`}
                aria-label={`${conVoto(v).length} ${conVoto(v).length === 1 ? 'voto' : 'votos'}`}
              >
                {conVoto(v).length}
              </span>
              <span className="votantes-nombres">
                {conVoto(v).length === 0
                  ? <span className="pista">nadie</span>
                  : conVoto(v).map((p) => (
                    <span className="votante" key={p.id}>
                      <span className="cara" aria-hidden>{p.avatar || '🙂'}</span>
                      {p.apodo || p.name}
                      <Alias familia={families.find((f) => f.id === p.familyId)} />
                    </span>
                  ))}
              </span>
            </div>
          ))}
        </div>

        <div className="note" style={{ marginTop: 12 }}>
          El día se pone en <b>Agenda</b>, tocando el día del viaje. Aquí solo se vota.
        </div>

        {esAdmin && (
          <div style={{ marginTop: 10 }}>
            {confirmando ? (
              <>
                <div className="note">
                  Sale de este viaje y <b>vuelve al catálogo de ideas</b>, con sus votos borrados.
                  Podrás volver a proponerlo cuando quieras.
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  <button className="btn sm danger" onClick={devolver}>Sí, devolverlo</button>
                  <button className="btn sm ghost" onClick={() => setConfirmando(false)}>Dejarlo</button>
                </div>
              </>
            ) : (
              <button className="btn sm ghost block" onClick={() => { tap(); setConfirmando(true) }}>
                Devolver a ideas
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
