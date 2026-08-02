import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  familiesOf, bungasOf, personsOf, updatePerson, olvidarTodo, listEvents,
  updateEvent, dinnersOf, plansOf, expensesOf, removeDinner, removePlan,
} from '../db.js'
import Acordeon from '../components/Acordeon.jsx'
import Icono from '../components/Icono.jsx'
import SyncDot, { estadoSync } from '../components/SyncDot.jsx'
import ProgresoModal, { ListaDePasos } from '../components/ProgresoModal.jsx'
import { formatearHace } from '../lib/hace.js'
import { comprobarAntesDeSalir, avisoDeSalida } from '../lib/salida.js'
import StatsScreen from './StatsScreen.jsx'
import GrupoSection from './GrupoSection.jsx'
import CuentasSection, { IASection, NotificacionesSection, useCuentas } from './CuentasSection.jsx'
import Hoja from '../components/Hoja.jsx'
import { loQueSeCaeFuera, enPalabras } from '../lib/evento.js'
import { finPara } from '../lib/fechas.js'
import { useTema, TEMAS } from '../lib/tema.js'
import { useTamano, TAMANOS } from '../lib/tamano.js'
import { useIdentidad } from '../lib/identidad.js'
import { comprimirFoto, guardarFoto, leerFoto } from '../lib/avatares.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { eliminarMiCuenta, gestionarCuenta, hayApi, listarCuentas } from '../sync/api.js'
import { codigoDeAutorizacionDeApple } from '../auth/apple.js'
import { borrarSesion, leerSesion, modoLocal, salirDeModoLocal } from '../auth/sesion.js'
import { tap } from '../lib/native.js'
import { avisosPara } from '../lib/avisos.js'
import { forzarActualizacion, marcarPostActualizacion, veniaDeActualizar, limpiarMarcaActualizacion, UPDATE_STEPS } from '../lib/pwa.js'

// El orden real del proceso (lib/pwa.js), para pintarlo como lista y que se vea
// por dónde va en vez de un solo rótulo que parpadea.
// Lo que el modal se queda en pantalla al acabar, para poder leerlo. Cinco
// segundos es el rato en que se lee «Ya está» sin que dé tiempo a impacientarse;
// el botón «Ok» lo salta.
const ESPERA_FINAL = 5000

const PASOS_APP = ['checking', 'downloading', 'applying']

// Inyectada por Vite (define). Guarda por si el global no existe (p. ej. en tests).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

/**
 * Sincronización, y es el apartado que se abre.
 *
 * Sigue siendo lo que se viene a mirar cuando algo no cuadra, y el botón hace lo
 * mismo que el punto de la cabecera: datos y app en una sola lista
 * (`lib/sincronizarTodo.js`). Tener dos botones que hacen media cosa cada uno
 * obligaba a acertar cuál era tu problema antes de dejarte mirar.
 */
/**
 * El apartado de Sincronización, con la figura de `garciadoral-ops`: el progreso
 * se pinta **aquí**, debajo del botón, y se queda. No es un modal porque lo que
 * ha ido pasando se lee después —para saber si aquello se subió o no— y una
 * ventana que se cierra no deja nada.
 *
 * El punto de la cabecera sigue abriendo el suyo, porque allí un toque sin
 * respuesta a la vista no diría nada; aquí, con el apartado abierto, la ventana
 * sobra.
 */
function SyncSection({ sync, onSincronizarTodo }) {
  const [pasos, setPasos] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState(null)
  // La configuración se lee en caliente de config.json, así que llega después
  // del primer pintado en vez de estar horneada en el bundle.
  const [detectada, setDetectada] = useState(false)
  useEffect(() => {
    if (sync) return undefined
    let vivo = true
    hayApi().then((si) => { if (vivo) setDetectada(si) })
    return () => { vivo = false }
  }, [sync])

  const estado = sync ?? { isConfigured: detectada, online: true, status: 'idle' }
  const d = estadoSync(estado)
  const ultima = estado.ultima ?? null

  // El botón hace el ciclo entero y lo va contando aquí mismo. Lo que ya está
  // escrito se conserva: sin eso, cada fase borraría el relato de la anterior.
  async function comprobarAhora() {
    if (ocupado) return
    tap()
    setOcupado(true)
    setAviso(null)
    setPasos([])
    await onSincronizarTodo?.({ alAvanzar: setPasos })
    setOcupado(false)
  }
  // Hay grupo al otro lado, pero este móvil eligió seguir sin entrar.
  const enLocal = estado.isConfigured && modoLocal() && !leerSesion()

  // La puerta se vuelve a abrir recargando: App decide qué pintar al arrancar y
  // así no hay dos sitios que recuerden si se entró o no.
  function volverAIntentarlo() {
    tap()
    salirDeModoLocal()
    window.location.reload()
  }

  return (
    <>
      <div className="card tight">
        <div className="row">
          <SyncDot sync={estado} onClick={onSincronizarTodo} />
          <div className="main">
            <div className="n">{d.title}</div>
            <div className="sub">{d.detalle}</div>
          </div>
        </div>
      </div>
      {/* En palabras y no en cifras: es un dato que se lee para tranquilizarse,
          y «hoy a las 14:03» tranquiliza de un vistazo. */}
      <div className="pista">
        {ultima
          ? `Última actualización: ${formatearHace(ultima)}.`
          : 'Todavía no se ha podido actualizar.'}
      </div>

      <button className="btn block" disabled={ocupado} onClick={comprobarAhora}>
        {ocupado ? 'Comprobando…' : '↻ Sincronizar todo'}
      </button>

      {pasos && <ListaDePasos pasos={pasos} onCopiado={setAviso} />}
      {aviso && <div className="note" role="status">{aviso}</div>}
      {enLocal && (
        <>
          <div className="note">
            Estás usando Ballena Ops <b>sin entrar</b>: lo que apuntas se queda en este móvil,
            encolado. En cuanto consigas entrar con Apple sube todo de una vez —no hay que
            volver a teclear nada—.
          </div>
          <button className="btn sm" onClick={volverAIntentarlo}>
            Probar a entrar con Apple
          </button>
        </>
      )}
      {!enLocal && (estado.isConfigured ? (
        <div className="note">Un toque sube lo pendiente, trae la última copia del grupo y de paso mira si hay versión nueva de la app. Lo hace solo al abrir, al volver la conexión y cada poco: esto es para cuando tengas prisa.</div>
      ) : (
        <div className="note">Aquí Ballena Ops es <b>solo local</b>: todo funciona igual, pero se queda en este dispositivo. Compartir gastos con el grupo requiere la <b>app de iOS</b>, que es donde vive el acceso con Apple.</div>
      ))}
    </>
  )
}

/**
 * Aspecto: el tamaño del texto primero y el tema después.
 *
 * Ese orden y no el contrario. El tamaño es el ajuste que arregla un problema
 * —no se lee— y el tema es el que se viene a curiosear; el que arregla algo va
 * antes que el que entretiene.
 */
function AspectoSection() {
  const { tema, elegir: elegirTema } = useTema()
  const { tamano, elegir } = useTamano()

  return (
    <>
      <label>Tamaño del texto</label>
      {/* Segmentado y no desplegable: es lo único de esta pantalla cuyo efecto se
          ve en el sitio, y una rueda de iOS encima taparía justo lo que hay que
          mirar para decidir. */}
      <div className="seg" role="group" aria-label="Tamaño del texto">
        {TAMANOS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tamano === t.id} onClick={() => { tap(); elegir(t.id) }}>
            {t.name}
          </button>
        ))}
      </div>

      <label>Claro u oscuro</label>
      <div className="seg" role="group" aria-label="Claro u oscuro">
        {TEMAS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tema === t.id} onClick={() => { tap(); elegirTema(t.id) }}>
            {t.name}
          </button>
        ))}
      </div>

      <div className="note">Las dos cosas se guardan <b>en este móvil</b> y mueven la app entera, no solo esta pantalla. «Automático» sigue al claro/oscuro del sistema.</div>
    </>
  )
}

// Estados de coña para tocar rápido (se puede escribir cualquiera igualmente).
const ESTADOS = [
  '🍺 de resaca', '🏖️ tirado en la toalla', '😴 echando la siesta',
  '🐳 avistando ballenas', '💸 sin blanca', '🍷 vino en mano',
  '🔥 a la parrilla', '🤿 buceando', '🫥 desaparecido en combate',
  '🍤 en modo gamba', '🚗 haciendo de chófer', '🧴 poniéndome crema',
]

// Emojis rápidos para el avatar (también se escribe a mano).
const AVATARES = ['🧑', '👩', '👨', '🧔', '👵', '👴', '🧒', '🐳', '🦑', '🦀', '🏄', '🕶️', '🍹', '🐙']

/** Tu cara: la foto de este móvil si la hay, si no el emoji. */
function Cara({ emoji, foto, className }) {
  return (
    <span className={className}>
      {foto ? <img src={foto} alt="" className="ufoto" /> : (emoji || '🐳')}
    </span>
  )
}

/**
 * Quién eres, y tu perfil.
 *
 * Aquí vivía solo el «cambiar de persona»; el resto —emoji, estado y foto— se
 * editaba tocando tu nombre en la cabecera. Ese badge se ha retirado: en un
 * móvil que es tuyo, recordarte quién eres cien veces al día es gastar el sitio
 * de la cabecera en una pregunta que ya sabes. Así que el perfil baja aquí
 * entero, y de paso deja de ser un modal: dentro de un apartado que ya está
 * abierto, un modal encima era una ventana de más.
 *
 * El emoji y el estado son hechos del grupo y sincronizan. La foto no: vive solo
 * en este móvil (`lib/avatares.js`, SPECS §14.10).
 */
function QuienEresSection({ eventId, persons }) {
  const { meId, me, elegir, salir } = useIdentidad(eventId, persons)
  const [foto, setFoto] = useState(null)
  const [estado, setEstado] = useState('')
  const [avatar, setAvatar] = useState('🧑')
  // Borrador de la foto: `undefined` = sin tocar, `null` = quitarla, string = nueva.
  const [fotoNueva, setFotoNueva] = useState(undefined)
  const [aviso, setAviso] = useState(null)
  const [guardado, setGuardado] = useState(false)
  const archivo = useRef(null)

  useEffect(() => { setFoto(leerFoto(eventId, meId)) }, [eventId, meId])

  // Al cambiar de persona, resembrar los campos con los suyos.
  useEffect(() => {
    setEstado(me?.estado ?? '')
    setAvatar(me?.avatar ?? '🧑')
    setFotoNueva(undefined)
    setAviso(null)
    setGuardado(false)
  }, [me])

  const fotoActual = fotoNueva === undefined ? foto : fotoNueva

  async function elegirFoto(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir la misma foto
    if (!file) return
    setAviso(null)
    try {
      setFotoNueva(await comprimirFoto(file))
    } catch (error) {
      setAviso(String(error?.message ?? error))
    }
  }

  async function guardar() {
    tap()
    await updatePerson(me.id, { estado: estado.trim(), avatar: avatar || '🧑' })
    if (fotoNueva !== undefined) {
      guardarFoto(eventId, meId, fotoNueva)
      setFoto(fotoNueva)
      setFotoNueva(undefined)
    }
    setGuardado(true)
  }

  return (
    <>
      <div className="card tight">
        <div className="row">
          <Cara className="av" emoji={avatar} foto={fotoActual} />
          <div className="main">
            <div className="n">{me ? me.name : 'Sin elegir'}</div>
            <div className="sub">{me ? (me.estado || 'Sin estado') : 'Nadie ha dicho quién es en este móvil'}</div>
          </div>
          {me && <button className="btn sm ghost" onClick={() => { tap(); salir() }}>Salir</button>}
        </div>
      </div>

      {me && (
        <>
          <label>Tu foto <span className="solo-movil">(solo en este móvil)</span></label>
          <div className="chips">
            <button className="chip" onClick={() => { tap(); archivo.current?.click() }}>📷 {fotoActual ? 'Cambiar foto' : 'Poner foto'}</button>
            {fotoActual && <button className="chip" onClick={() => { tap(); setFotoNueva(null) }}>🗑️ Quitar foto</button>}
          </div>
          <input
            ref={archivo}
            type="file"
            accept="image/*"
            onChange={elegirFoto}
            className="oculto"
            aria-label="Elegir foto de avatar"
          />

          <label>Tu emoji</label>
          <div className="chips">
            {AVATARES.map((a) => (
              <button key={a} className={`chip${avatar === a ? ' on' : ''}`} onClick={() => { tap(); setAvatar(a) }}>{a}</button>
            ))}
          </div>
          <input type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} maxLength={4} placeholder="🙂" aria-label="Emoji a mano" />

          <label>Tu estado</label>
          <div className="chips">
            {ESTADOS.map((x) => (
              <button key={x} className={`chip${estado === x ? ' on' : ''}`} onClick={() => { tap(); setEstado(x) }}>{x}</button>
            ))}
          </div>
          <input type="text" value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="a mi bola…" aria-label="Estado a mano" />

          {aviso && <div className="note" role="status">{aviso}</div>}

          <button className="btn block" onClick={guardar}>Guardar mi perfil</button>
          {guardado && <div className="pill owed" style={{ display: 'inline-block' }} role="status">✓ Guardado</div>}
        </>
      )}

      <div className="sec-h">{me ? 'Cambiar de persona' : 'Elige quién eres'}</div>
      <div className="lista-personas">
        {persons.length === 0 && <div className="empty" style={{ padding: 14 }}>Aún no hay gente en el evento. Añádela en «Gente».</div>}
        {persons.map((p) => (
          <button
            key={p.id}
            className={`persona-opcion btn ghost${p.id === me?.id ? ' on' : ''}`}
            onClick={() => { tap(); elegir(p.id) }}
          >
            <span className="pe">{p.avatar}</span>
            <span>{p.name}{p.apodo ? ` · «${p.apodo}»` : ''}</span>
          </button>
        ))}
      </div>

      <div className="note">Quién eres se guarda <b>en este móvil</b> y no se sincroniza: cada uno elige la suya. El emoji y el estado sí los ve el grupo. «Salir» solo olvida la identidad aquí: no borra a nadie.</div>
    </>
  )
}

/** El evento en curso, y la lista para saltar a otro sin pasar por la portada. */
function EventoSection({ event, onPickEvent }) {
  const events = useLiveQuery(listEvents, [], [])
  const [editando, setEditando] = useState(false)

  return (
    <>
      {/* El de en curso se toca y se edita, como una familia en El grupo
          (§14.14 · E1 + F2): era la única ficha de Ajustes que se miraba sin
          poder corregirla, y las fechas del viaje cambian más que ninguna otra
          cosa del evento. */}
      <div className="card tight">
        <div className="row">
          <button type="button" className="row-quien" onClick={() => { tap(); setEditando(true) }}>
            <span className="ico"><Icono nombre="evento" /></span>
            <span className="main">
              <span className="n">{event?.name || 'Evento'}</span>
              <span className="sub">{[event?.lugar, fechasEnPalabras(event)].filter(Boolean).join(' · ') || 'Ballena Ops'}</span>
            </span>
          </button>
          <span className="pill neutral">en curso</span>
        </div>
      </div>

      {editando && event && <EditorEvento event={event} onCerrar={() => setEditando(false)} />}

      {events.filter((e) => e.id !== event?.id).length > 0 && (
        <>
          <div className="sec-h">Cambiar a</div>
          <div className="lista-personas">
            {events.filter((e) => e.id !== event?.id).map((e) => (
              <button
                key={e.id}
                className="persona-opcion btn ghost"
                onClick={() => { tap(); onPickEvent?.(e.id) }}
              >
                <span className="ico pe"><Icono nombre="evento" /></span>
                <span>{e.name}{e.lugar ? ` · ${e.lugar}` : ''}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <button className="btn ghost block" onClick={() => { tap(); onPickEvent?.(null) }}>↔ Ver todos los eventos</button>
    </>
  )
}

/** «8 – 15 de agosto», para la segunda línea de la ficha del evento. */
function fechasEnPalabras(event) {
  if (!event?.startDate) return ''
  const dia = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  if (!event.endDate || event.endDate === event.startDate) return dia(event.startDate)
  return `${dia(event.startDate)} – ${dia(event.endDate)}`
}

/**
 * Editar el evento en curso, con la misma figura que El grupo: una hoja que
 * sube desde abajo, guardar arriba y el aviso de lo que se lleva por delante.
 *
 * Aquí el aviso no es por borrar, es por **acortar**: una cena o un plan viven
 * en un día concreto, y si ese día deja de existir se quedan fuera del
 * calendario pero dentro de las estadísticas. Se dicen y se borran al confirmar.
 * Los gastos se cuentan y **no se tocan** — la compra grande es del día antes de
 * salir, y borrar dinero por mover una fecha cambiaría los saldos de todos.
 */
function EditorEvento({ event, onCerrar }) {
  const [name, setName] = useState(event.name ?? '')
  const [lugar, setLugar] = useState(event.lugar ?? '')
  const [startDate, setStart] = useState(event.startDate ?? '')
  const [endDate, setEnd] = useState(event.endDate ?? '')
  const [fuera, setFuera] = useState(null)

  const dinners = useLiveQuery(() => dinnersOf(event.id), [event.id], [])
  const plans = useLiveQuery(() => plansOf(event.id), [event.id], [])
  const expenses = useLiveQuery(() => expensesOf(event.id), [event.id], [])

  const guardar = async () => {
    if (!name.trim()) return
    const fechas = { startDate, endDate }
    const cae = loQueSeCaeFuera(fechas, { dinners, plans, expenses })
    // Primero se avisa; el guardado de verdad va en `confirmar`.
    if ((cae.cenas.length || cae.planes.length) && !fuera) { setFuera(cae); return }
    await confirmar(cae)
  }

  const confirmar = async (cae) => {
    for (const c of cae.cenas) await removeDinner(c.id)
    for (const p of cae.planes) await removePlan(p.id)
    await updateEvent(event.id, {
      name: name.trim(), lugar: lugar.trim(), startDate, endDate,
    })
    onCerrar()
  }

  const gastosFuera = loQueSeCaeFuera({ startDate, endDate }, { expenses }).gastos.length

  return (
    <Hoja titulo="Editar evento" onCerrar={onCerrar}>
      <label htmlFor="ev-nombre">Nombre</label>
      <input id="ev-nombre" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ballenita 2026" autoFocus />
      <label htmlFor="ev-lugar">Lugar</label>
      <input id="ev-lugar" type="text" value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Camping La Ballena Alegre" />
      {/* Una bajo la otra y no en dos columnas: el control de fecha nativo mide
          más que media pantalla y sacaba la hoja de lado en un móvil de verdad. */}
      <label htmlFor="ev-desde">Desde</label>
      <input
        id="ev-desde" type="date" value={startDate}
        onChange={(e) => { setStart(e.target.value); setEnd(finPara(e.target.value, endDate)); setFuera(null) }}
      />
      <label htmlFor="ev-hasta">Hasta</label>
      {/* `min` es la mitad de la regla: el fin se propone solo al elegir el
          inicio, y aquí el propio campo impide dejarlo antes. */}
      <input
        id="ev-hasta" type="date" value={endDate} min={startDate || undefined}
        onChange={(e) => { setEnd(e.target.value); setFuera(null) }}
      />

      {gastosFuera > 0 && (
        <div className="note">
          🐳 {gastosFuera === 1 ? 'Hay 1 gasto' : `Hay ${gastosFuera} gastos`} con fecha fuera del viaje.
          No se tocan: siguen contando en los saldos.
        </div>
      )}

      <div className="editor-pie">
        <button className="btn ghost" onClick={onCerrar}>Cancelar</button>
        <button className="btn" onClick={guardar}>Guardar</button>
      </div>

      {fuera && (
        <div className="confirmar">
          <div className="que-se-lleva">
            Con esas fechas se quedan fuera <b>{enPalabras(fuera)}</b>, y se borran al guardar.
          </div>
          <div className="grid2">
            <button className="btn ghost" onClick={() => setFuera(null)}>Dejarlo</button>
            <button className="btn danger" onClick={() => confirmar(fuera)}>Guardar y borrar</button>
          </div>
        </div>
      )}
    </Hoja>
  )
}

/**
 * Sesión y, para quien administre el grupo, el alta de gente nueva.
 *
 * La incorporación es por invitación: alguien que ya está dentro pega aquí el
 * código que le ha pasado el aspirante. Sin esto haría falta entrar en la base
 * de datos a mano para dejar entrar a nadie.
 */
function AppSection() {
  // null = en reposo · si no, la clave del paso actual (UPDATE_STEPS).
  const [paso, setPaso] = useState(null)
  const busy = paso !== null
  // Si venimos de recargar por una actualización, enseñamos el ✓ y limpiamos la marca.
  const [recienActualizada] = useState(veniaDeActualizar)
  // Cuando la búsqueda acaba, el modal se queda unos segundos con su «Ok»: la
  // recarga se lo llevaba por delante en cuanto terminaba, y lo único que se
  // veía era la pantalla parpadeando sin decir en qué había quedado.
  const [terminado, setTerminado] = useState(false)
  const seguir = useRef(null)
  const caja = useRef(null)
  useEffect(() => {
    if (!recienActualizada) return
    limpiarMarcaActualizacion()
    // El apartado se reabre solo (Acordeon recuerda su solapa), pero la recarga
    // deja la pantalla arriba del todo: sin esto acabas mirando «Aspecto» sin
    // saber si la actualización llegó a pasar.
    caja.current?.scrollIntoView({ block: 'center' })
  }, [recienActualizada])

  function actualizar() {
    if (busy) return
    marcarPostActualizacion() // al re-arrancar, la app vuelve aquí en vez de a Hoy
    setTerminado(false)
    setPaso('checking') // abre el modal ya, sin esperar al primer aviso
    const inicio = Date.now()
    forzarActualizacion(setPaso, {
      // La recarga es inevitable (hay que cargar el JS nuevo), pero la retrasamos
      // un poco para que el progreso se vea de verdad y no sea un parpadeo.
      reload: async () => {
        const resto = 1200 - (Date.now() - inicio)
        if (resto > 0) await new Promise((r) => setTimeout(r, resto))
        setTerminado(true)
        await new Promise((r) => { seguir.current = r; setTimeout(r, ESPERA_FINAL) })
        window.location.reload()
      },
    })
  }

  return (
    <div ref={caja}>
      {/* Aquí solo se actualiza. La versión la lleva puesta el rótulo del
          acordeón —«La app · v0.7.0»—, así que la tarjeta que la repetía en
          grande decía por tercera vez lo que ya ponía dos líneas más arriba, y
          la nota de cuatro renglones explicaba fontanería: en qué se diferencia
          este botón del punto de la cabecera. Quien abre esto no viene a
          comparar mecanismos, viene a actualizar. */}
      <button className="btn block" disabled={busy} onClick={actualizar}>
        {busy ? 'Buscando…' : 'Actualizar la app'}
      </button>
      <div className="pista">Borra las cachés y recarga, aunque el sistema diga que ya estás al día.</div>
      {recienActualizada && (
        <div className="pill owed" style={{ display: 'inline-block' }}>✓ Recién actualizada</div>
      )}

      {busy && (
        <ProgresoModal
          titulo={terminado ? 'Ya está' : 'Buscando la última versión'}
          version={APP_VERSION}
          pasos={PASOS_APP.map((p, i) => ({
            texto: UPDATE_STEPS[p],
            estado: terminado || i < PASOS_APP.indexOf(paso) ? 'hecho'
              : i === PASOS_APP.indexOf(paso) ? 'curso' : 'pendiente',
          }))}
          terminado={terminado}
          onCerrar={() => { tap(); seguir.current?.() }}
          etiquetaCerrar="Ok"
          pista={terminado
            ? `Se recarga sola en ${ESPERA_FINAL / 1000} segundos y volverás aquí, a Ajustes.`
            : 'No cierres la app: se recarga sola al terminar y volverás aquí, a Ajustes.'}
        />
      )}
    </div>
  )
}

/**
 * Ajustes, en apartados plegables.
 *
 * La figura es la de `garciadoral-ops`: `<details>`/`<summary>` del navegador,
 * y **todos plegados**. Ajustes es una lista de cosas que casi nunca se tocan;
 * dejar una abierta obliga a pasarle por encima para llegar a las demás. Con las
 * diez plegadas la pantalla entera se lee de un vistazo y se toca la que se venía
 * a buscar: un gesto en vez de un desplazamiento. Cada rótulo lleva su nota
 * —«v0.2.0», «6», el tema puesto—, así que plegado no quiere decir mudo.
 *
 * Se ha comido lo que antes era «Más»: las estadísticas eran media pestaña de la
 * barra inferior para algo que se mira al volver del viaje, y ahora son un
 * apartado como los demás.
 */
export default function EventSettingsScreen({ eventId, event, onPickEvent, sync, onSincronizarTodo }) {
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const { me } = useIdentidad(eventId, persons)
  // Las cuentas y sus avisos: los pinta «Notificaciones» y los cuenta el rótulo.
  const { esAdmin, cuentas } = useCuentas()
  const pendientes = avisosPara({ cuentas: cuentas ?? [], esAdmin }).length
  const { tema: temaPuesto } = useTema()
  const sesion = leerSesion()

  return (
    <div className="body">
      {/* El orden es el de lo que se toca, no el del cableado: primero lo del
          viaje —cómo se ve, qué evento es, quién viene y quién eres tú— y al
          final la fontanería, que se abre cuando algo falla. */}
      <Acordeon titulo="Aspecto" icono="aspecto" nota={TEMAS.find((t) => t.id === temaPuesto)?.name}>
        <AspectoSection />
      </Acordeon>

      <Acordeon titulo="Evento" icono="evento" nota={event?.name}>
        <EventoSection event={event} onPickEvent={onPickEvent} />
      </Acordeon>

      <Acordeon titulo="El grupo" icono="familia" nota={`${families.length} · ${bungas.length} · ${persons.length}`}>
        <GrupoSection eventId={eventId} />
      </Acordeon>

      <Acordeon titulo="Quién eres" icono="persona" nota={me ? (me.apodo || me.name) : 'sin elegir'}>
        <QuienEresSection eventId={eventId} persons={persons} />
      </Acordeon>

      <Acordeon titulo="Estadísticas" icono="grafico">
        <StatsScreen eventId={eventId} event={event} suelto />
      </Acordeon>

      <Acordeon titulo="Sincronización" icono="sincronizar">
        <SyncSection sync={sync} onSincronizarTodo={onSincronizarTodo} />
      </Acordeon>

      <Acordeon titulo="Notificaciones" icono="aviso" nota={pendientes || null}>
        <NotificacionesSection />
      </Acordeon>

      {sesion && (
        <Acordeon titulo="Cuentas" icono="llave" nota={cuentas ? cuentas.length : null}>
          {/* `sincronizar` es lo que deja subir la cola antes de borrarla al
              salir (§14.9-ter): sin él, salir con cambios sin subir los perdía. */}
          <CuentasSection eventId={eventId} sincronizar={sync?.recheck} />
        </Acordeon>
      )}

      {esAdmin && (
        <Acordeon titulo="IA" icono="ballena">
          <IASection />
        </Acordeon>
      )}

      <Acordeon titulo="La app" icono="ballena" nota={`v${APP_VERSION}`}>
        <AppSection />
      </Acordeon>

    </div>
  )
}
