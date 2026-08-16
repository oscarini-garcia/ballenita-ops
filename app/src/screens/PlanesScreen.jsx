// Planes: lo que se propone para este viaje, y a qué se apunta cada uno.
//
// Aquí solo se vota; el día se pone en Agenda y un plan solo nace de una idea
// del catálogo (SPECS §14.19).
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { plansOf, updatePlan, personsOf, familiesOf, devolverPlanAIdea, anclaDe, comentariosDelEvento } from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { useIdentidad } from '../lib/identidad.js'
import { puedeOrganizar } from '../lib/personas.js'
import { porDia } from '../lib/evento.js'
import { ESTADO_SE_HACE, ESTADO_VOTANDO, quienFaltaPorVotar, seHace, votosDe } from '../lib/planes.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import Alias from '../components/Alias.jsx'
import Comentarios from '../components/Comentarios.jsx'
import { sinLeer } from '../lib/comentarios.js'

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
export default function PlanesScreen({ eventId, event, abrir, onAbierta }) {
  const plans = useLiveQuery(() => plansOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const { meId: me, me: yo } = useIdentidad(eventId, persons)
  const [abierto, setAbierto] = useState(null)
  // Todos los del evento de una vez: el globo de cada fila se cuenta en memoria,
  // que es más barato que una consulta por plan y no parpadea al abrir la lista.
  const comentarios = useLiveQuery(() => comentariosDelEvento(eventId), [eventId], [])

  // Llegar desde un aviso abre el plan del que hablaba (§14.60 · R2). Se espera
  // a que los planes estén: con la app recién arrancada el toque llega antes que
  // la instantánea, y abrir un plan que aún no está sería no abrir nada.
  useEffect(() => {
    if (!abrir || !plans.length) return
    if (plans.some((p) => p.id === abrir)) { setAbierto(abrir); onAbierta?.() }
  }, [abrir, plans.length])

  // **Devolver un plan al catálogo lo hacen los adultos** (SPECS §14.43-bis).
  // Estaba en `esAdministrador`, que es el cerrojo del **grupo** —quién entra,
  // quién es quién, las fechas del evento— y aquí no pintaba nada: devolver una
  // propuesta es organizar el viaje, lo mismo que proponerla, y proponer ya iba
  // por `puedeOrganizar` desde §14.43. Con dos reglas para los dos sentidos del
  // mismo movimiento, cualquier adulto podía traer una idea al viaje y **nadie
  // más que el administrador** podía deshacerlo.
  const organiza = puedeOrganizar(yo)

  // Lo que se cayó fuera de las fechas sigue apartado (§14.10-quater): un plan en
  // un día que el viaje ya no tiene no es un plan elegido.
  const { dentro, fuera } = porDia(plans, event)
  // **Tres grupos, y el primero es nuevo** (§14.59). Antes eran «Elegidos» —los
  // que tenían día— y «Disponibles»; ahora manda el estado, porque «esto se
  // hace» y «esto tiene día» son dos cosas distintas y muchas veces se decide
  // la primera antes que la segunda: «a los kayaks vamos fijo, ya veremos
  // cuándo». Un plan que se hace y aún no tiene día sale arriba, diciendo que
  // le falta el día.
  const seHacen = dentro.filter(seHace)
    .sort((a, b) => (a.dia || '9999').localeCompare(b.dia || '9999')
      || (a.titulo || '').localeCompare(b.titulo || '', 'es'))
  const elegidos = dentro.filter((p) => !seHace(p) && p.dia)
  const disponibles = dentro.filter((p) => !seHace(p) && !p.dia)
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
    //
    // **Lo que se hace no cuenta votos ni quién falta** (§14.59): ya está
    // decidido, y lo único pendiente es el día. Su icono va ámbar mientras le
    // falte —el ámbar es «pendiente» en esta app desde §14.32— y verde cuando
    // lo tiene.
    const decidido = seHace(plan)
    const suyos = comentarios.filter((c) => c.ancla === anclaDe('plan', plan.id))
    const conComentarios = suyos.length
    const nuevos = sinLeer(suyos, { eventId, ancla: anclaDe('plan', plan.id), meId: me })
    const detalle = decidido
      ? (plan.dia ? fmtDay(plan.dia) : 'falta el día')
      : (elegido ? fmtDay(plan.dia) : quienFaltaPorVotar(plan, persons))
    return (
      <button className="row fila-plan" onClick={() => { tap(); setAbierto(plan.id) }}>
        <div className={`ico${(decidido && plan.dia) || elegido ? ' verde' : ''}${decidido && !plan.dia ? ' ambar' : ''}`}>
          <Icono nombre="plan" />
        </div>
        <div className="main">
          <div className="n">{plan.titulo}</div>
          <div className="sub">{detalle}</div>
        </div>
        {/* **La fila lo dice sin abrir nada** (K4): el globo con cuántos hay y
            un punto cuando alguno no lo has visto tú. Cuesta 0 pt de alto —va
            donde ya va el recuento— y es lo que hace que un hilo se lea, igual
            que «faltan Ana y Luis» hace que se vote. */}
        {conComentarios > 0 && (
          <span className={`globo${nuevos > 0 ? ' nuevo' : ''}`} aria-label={`${conComentarios} comentarios${nuevos ? `, ${nuevos} sin leer` : ''}`}>
            💬 {conComentarios}
          </span>
        )}
        {decidido
          ? <span className="pill owed">se hace</span>
          : <span className={`pill ${elegido ? 'owed' : 'neutral'} tnum`}>{votosDe(plan)}</span>}
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

      {seHacen.length > 0 && (
        <>
          <div className="sec-h"><span>Se hacen · {seHacen.length}</span><span>sin votación</span></div>
          <div className="card tight">
            {seHacen.map((p) => <Fila key={p.id} plan={p} />)}
          </div>
        </>
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
          <div className="sec-h"><span>A votación · {disponibles.length}</span><span>por votos</span></div>
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
          // Marcar «se hace» y devolverlo al catálogo son las dos cosas de esta
          // capa que organizan el viaje, y llevan la misma guarda (§14.43,
          // §14.43-bis): un solo predicado sobre la edad, calculado una vez.
          organiza={organiza}
          onClose={() => setAbierto(null)}
        />
      )}
    </div>
  )
}

/**
 * El plan abierto: se vota, se ve quién ha votado qué, y los adultos pueden
 * devolverlo al catálogo (§14.43-bis).
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
function PlanAbierto({ plan, persons, families, me, evento, organiza, onClose }) {
  useBloqueoDeScroll()
  const [confirmando, setConfirmando] = useState(false)

  const votos = plan.votos ?? {}
  const mio = votos[me]
  const conVoto = (v) => persons.filter((p) => votos[p.id] === v)
  const decidido = seHace(plan)
  const votosGuardados = Object.keys(votos).length

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

        {/* **Lo que se hace no enseña votos** (§14.59). No es que se escondan:
            es que no significan nada cuando la decisión ya está tomada, y
            enseñarlos era exactamente la queja — un plan decidido con «faltan
            Ana y Luis» debajo dice que aún se está decidiendo. Se guardan por
            si vuelve a votación. */}
        {decidido ? (
          <div className="note">
            🐳 Esto <b>se hace y punto</b>: no hay que votarlo.
            {votosGuardados > 0 && ` Los ${votosGuardados} votos de antes se quedan guardados por si vuelve a votación.`}
          </div>
        ) : (
          <>
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
          </>
        )}

        {/* El interruptor (P3). Solo para quien organiza, y **sin borrar los
            votos**: es lo que permite tocarlo sin pensárselo. */}
        {organiza && (
          <div className="seg" role="group" aria-label="Cómo se decide este plan" style={{ marginTop: 12 }}>
            <button
              type="button"
              className={decidido ? '' : 'on'}
              aria-pressed={!decidido}
              onClick={() => { tap(); updatePlan(plan.id, { estado: ESTADO_VOTANDO }) }}
            >
              Se vota
            </button>
            <button
              type="button"
              className={decidido ? 'on' : ''}
              aria-pressed={decidido}
              onClick={() => { tap(); updatePlan(plan.id, { estado: ESTADO_SE_HACE }) }}
            >
              Se hace y punto
            </button>
          </div>
        )}

        {/* El hilo, con la misma pieza que en un gasto y en un día (§14.55). */}
        <Comentarios eventId={plan.eventId} ancla={anclaDe('plan', plan.id)} />

        <div className="note" style={{ marginTop: 12 }}>
          El día se pone en <b>Agenda</b>, tocando el día del viaje.
          {decidido ? '' : ' Aquí solo se vota.'}
        </div>

        {organiza && (
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
