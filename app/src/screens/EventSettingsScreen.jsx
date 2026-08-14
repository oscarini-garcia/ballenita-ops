import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  familiesOf, bungasOf, personsOf, updatePerson, olvidarTodo, listEvents,
  updateEvent, dinnersOf, plansOf, expensesOf, removeDinner, removePlan,
  listMejoras,
} from '../db.js'
import MejorasSection from './MejorasSection.jsx'
import Acordeon from '../components/Acordeon.jsx'
import Icono from '../components/Icono.jsx'
import SyncDot, { estadoSync } from '../components/SyncDot.jsx'
import { ListaDePasos } from '../components/ProgresoModal.jsx'
import { formatearHace } from '../lib/hace.js'
import { NOTAS } from '../lib/notas.js'
import { COCINA_DE_ORIGEN } from '../lib/cocina.js'
import { comprobarAntesDeSalir, avisoDeSalida } from '../lib/salida.js'
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
import { aplicarSiguienteMigracion, eliminarMiCuenta, gestionarCuenta, hayApi, leerMigraciones, listarCuentas } from '../sync/api.js'
import { codigoDeAutorizacionDeApple } from '../auth/apple.js'
import { borrarSesion, leerSesion, modoLocal, salirDeModoLocal } from '../auth/sesion.js'
import { esAdministrador } from '../lib/admin.js'
import { tap } from '../lib/native.js'
import { avisosPara } from '../lib/avisos.js'
import { forzarActualizacion, marcarPostActualizacion, veniaDeActualizar, limpiarMarcaActualizacion, UPDATE_STEPS } from '../lib/pwa.js'
import { checkForOtaUpdate, estadoDelPaquete, isNative, versionInstalada } from '../lib/native.js'

// Lo que la lista terminada se queda en pantalla antes de recargar, para poder
// leerla. Cinco segundos es el rato en que se lee «instalada» sin que dé tiempo
// a impacientarse.
const ESPERA_FINAL = 5000

// El orden real del proceso (lib/pwa.js), para pintarlo como lista y que se vea
// por dónde va en vez de un solo rótulo que parpadea.
const PASOS_APP = ['checking', 'downloading', 'applying']

// Inyectada por Vite (define). Guarda por si el global no existe (p. ej. en tests).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

/**
 * Qué ha contestado el paquete OTA, en palabras y con qué hacer al respecto.
 *
 * `checkForOtaUpdate` devuelve cuatro cosas además de «actualizado», y las
 * cuatro acababan en la basura: el botón seguía con el camino del service
 * worker —que dentro de la app de iOS no trae nada— y terminaba con su ✓. La
 * pantalla decía que sí y el teléfono se quedaba en la de antes.
 *
 * Cada motivo dice **dónde** está el problema, porque están en sitios
 * distintos: en el manifiesto, en la red, o en que ya la tienes.
 */
export function motivoDelOta(ota = {}) {
  if (ota.status === 'up-to-date') {
    return `Ya tienes el último paquete${ota.version ? ` (v${ota.version})` : ''}. Si esperabas otro, es que todavía no se ha publicado: mira si el release ota-v… existe.`
  }
  if (ota.status === 'no-manifest') {
    return 'No se ha podido leer el manifiesto (releases/latest/download/latest.json). O no hay red, o todavía no hay ningún release publicado.'
  }
  if (ota.status === 'armed') {
    return `El paquete v${ota.version} queda puesto para el próximo arranque.`
  }
  if (ota.status === 'skip') {
    return 'Aquí no hay paquete que traer: los OTA son de la app de iOS.'
  }
  return `No se ha podido traer el paquete: ${ota.error || 'sin motivo'}`
}

/**
 * De los cinco desenlaces, **tres no son un fallo**: ya la tienes, queda puesta
 * para el próximo arranque, o esto es la web y aquí no hay paquete que traer.
 *
 * La traza los pintaba los cinco en rojo, porque la variable que los guardaba se
 * llamaba `fallo` y el rojo venía detrás del nombre. Leer en rojo «ya tienes el
 * último paquete» dice lo contrario de lo que ha pasado, y el rojo en esta app
 * es deuda y borrar: gastarlo en la respuesta normal del botón lo deja sin
 * significar nada el día que sí falle algo. Los nombres de las pruebas de
 * `Actualizar.test.jsx` ya decían «no es un fallo» desde que se escribieron.
 */
const OTA_SIN_FALLO = new Set(['up-to-date', 'armed', 'skip'])
export const otaFueBien = (ota = {}) => OTA_SIN_FALLO.has(ota.status)

/**
 * Los paquetes OTA que hay en el móvil, tal como los ve el plugin.
 *
 * Es un dato para diagnosticar y por eso va crudo: versión, estado y nada más.
 * Un paquete en **`error`** es el plugin **devolviéndolo** —hace rollback si el
 * nuevo no llama a `notifyAppReady()` a tiempo—, y visto desde fuera eso es
 * idéntico a «no se ha descargado»: el release publicado, el zip con sus
 * descargas, y la pantalla con el número de siempre.
 *
 * Se toca para copiarlo, como el informe de sincronización (§14.9-bis): esto se
 * lee para contarlo en otro sitio, no para arreglarlo aquí.
 */
function ListaDePaquetes({ paquetes }) {
  const [aviso, setAviso] = useState(null)
  if (!paquetes) return null

  const linea = (b) => `v${b.version} · ${b.estado}`
  const informe = [
    `actual: ${paquetes.actual ? linea(paquetes.actual) : 'ninguno'}`,
    `binario: v${paquetes.nativa || '?'}`,
    ...(paquetes.bundles || []).map((b) => `bajado: ${linea(b)}`),
    paquetes.error ? `error: ${paquetes.error}` : '',
  ].filter(Boolean).join('\n')

  async function copiar() {
    tap()
    try {
      await navigator.clipboard.writeText(informe)
      setAviso('Copiado')
    } catch {
      setAviso('No se ha podido copiar')
    }
  }

  return (
    <>
      <div className="pista">Paquetes en este móvil (tócalo para copiarlo):</div>
      <pre
        className={`traza${paquetes.error || (paquetes.bundles || []).some((b) => b.estado === 'error') ? ' mal' : ' bien'}`}
        onClick={copiar}
      >{informe}</pre>
      {aviso && <div className="note" role="status">{aviso}</div>}
    </>
  )
}

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
  const { meId, me, elegir, salir, deLaCuenta } = useIdentidad(eventId, persons)
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
          {/* «Salir» olvida la identidad de este móvil, y eso solo tiene sentido
              cuando se eligió aquí: con la cuenta enlazada volvería a ponerse
              sola en el acto (§14.42), o sea un botón que no hace nada. */}
          {me && !deLaCuenta && <button className="btn sm ghost" onClick={() => { tap(); salir() }}>Salir</button>}
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

      {/* Quién eres lo dice el enlace de tu cuenta, y por eso no se elige aquí
          (pedido expreso, SPECS §14.42). La lista solo sale donde no hay cuenta
          que lo diga —libreta local y demostración— o cuando la persona
          enlazada no es de este evento, que es su única salida. */}
      {!deLaCuenta && (<>
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
      </>)}

      {deLaCuenta ? (
        <div className="note">
          🐳 Eres <b>{me.name}</b> porque tu cuenta está enlazada con esa persona: lo decide quien
          lleva el grupo, no este móvil. Tu emoji y tu estado sí los cambias tú, y los ve el grupo.
        </div>
      ) : (
        <div className="note">Quién eres se guarda <b>en este móvil</b> y no se sincroniza: cada uno elige la suya. El emoji y el estado sí los ve el grupo. «Salir» solo olvida la identidad aquí: no borra a nadie.</div>
      )}
    </>
  )
}

/** El evento en curso, y la lista para saltar a otro sin pasar por la portada. */
function EventoSection({ event, onPickEvent }) {
  const events = useLiveQuery(listEvents, [], [])
  const [editando, setEditando] = useState(false)
  // El evento lo edita quien administra (SPECS §14.43): sus fechas mueven las
  // cenas y los planes de todo el grupo —lo que cae fuera se aparta (§14.10-quater)—,
  // así que no es una corrección personal. Sin sesión —libreta local,
  // demostración— no se capa: ahí el evento es de quien tiene el móvil.
  const sesion = leerSesion()
  const puedeEditar = !sesion || esAdministrador(sesion)

  const ficha = (
    <>
      <span className="ico"><Icono nombre="evento" /></span>
      <span className="main">
        <span className="n">{event?.name || 'Evento'}</span>
        <span className="sub">{[event?.lugar, fechasEnPalabras(event)].filter(Boolean).join(' · ') || 'Ballena Ops'}</span>
      </span>
    </>
  )

  return (
    <>
      {/* El de en curso se toca y se edita, como una familia en El grupo
          (§14.14 · E1 + F2): era la única ficha de Ajustes que se miraba sin
          poder corregirla, y las fechas del viaje cambian más que ninguna otra
          cosa del evento. */}
      <div className="card tight">
        <div className="row">
          {puedeEditar ? (
            <button type="button" className="row-quien" onClick={() => { tap(); setEditando(true) }}>
              {ficha}
            </button>
          ) : (
            <span className="row-quien">{ficha}</span>
          )}
          <span className="pill neutral">en curso</span>
        </div>
      </div>

      {!puedeEditar && (
        <div className="note">
          🐳 El viaje —su nombre, el sitio y las fechas— lo lleva quien administra el grupo. Cambiar
          las fechas aparta cenas y planes de todos, y por eso no es cosa de un móvil.
        </div>
      )}

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
export function EditorEvento({ event, onCerrar }) {
  const [name, setName] = useState(event.name ?? '')
  const [lugar, setLugar] = useState(event.lugar ?? '')
  const [cocina, setCocina] = useState(event.cocina ?? '')
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
      name: name.trim(), lugar: lugar.trim(), cocina: cocina.trim(), startDate, endDate,
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

      {/* Qué se puede cocinar, para la IA y **solo** para la IA (§14.20-quater).
          Texto libre y no una lista de casillas: lo que hay que contarle es la
          frase entera —«en el bungaló se puede hacer algo en sartén, pero poco:
          da mucho calor»—, y eso ninguna casilla lo dice. */}
      <label htmlFor="ev-cocina">Qué se puede cocinar</label>
      {/* Seis renglones y no tres: el texto en gris es lo que se va a mandar, y
          medido en el navegador ocupa seis líneas a 390 pt. En tres se cortaba a
          media palabra —«En el bungaló se pue…»—, que es no enseñarlo. */}
      <textarea
        id="ev-cocina"
        rows={6}
        value={cocina}
        onChange={(e) => setCocina(e.target.value)}
        placeholder={COCINA_DE_ORIGEN}
      />
      <div className="pista">
        Solo lo lee la IA, para que lo que proponga se pueda cocinar. Vacío va lo
        que pone en gris.
      </div>
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
/**
 * La base de datos, al día desde el móvil (SPECS §14.23).
 *
 * Las migraciones siguen sin lanzarse solas, pero ya no exigen un portátil:
 * si administras y la base va por detrás del código, aquí sale cuántas le
 * faltan y un botón que las aplica **una a una**, contando el progreso en su
 * sitio con la lista de pasos —la figura de Sincronización—. El SQL no viaja
 * desde el móvil: vive dentro del Worker, y de aquí solo sale «aplica la
 * siguiente».
 *
 * **Y siempre dice en cuál de los cuatro estados está**, que es la corrección de
 * §14.37-bis. El bloque tenía tres formas distintas de no pintar nada —no
 * administras, todavía no ha contestado, o la base ya está al día— y una cuarta
 * que tampoco pintaba nada porque se tragaba su error. Desde el móvil las cuatro
 * se ven igual: no se ve nada. Y quien entra justo a lanzar una migración se
 * queda mirando el hueco donde debería estar el botón sin poder saber cuál de
 * las cuatro le ha tocado. Ahora cada una tiene su renglón; el único silencio
 * que queda es el del primer instante, antes de que conteste la API.
 */
function MigracionesBloque({ esAdmin = false }) {
  // null = todavía no se sabe (o no hay API): no se pinta nada.
  const [pendientes, setPendientes] = useState(null)
  const [pasos, setPasos] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  // Por qué no se sabe. La consulta se tragaba su error y el bloque no aparecía:
  // desde el móvil, «la base está al día» y «no he podido preguntarlo» se ven
  // exactamente igual —no se ve nada—, y quien viene justo a lanzar una
  // migración se queda buscando un botón que no existe. Es el mismo principio
  // del informe de sincronización (§14.9-bis) en el sitio donde faltaba.
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!esAdmin) return undefined
    let vivo = true
    leerMigraciones()
      .then((r) => { if (vivo) setPendientes(r.migraciones.filter((m) => m.pendiente).map((m) => m.id)) })
      .catch((e) => { if (vivo) setError(String(e.message ?? e)) })
    return () => { vivo = false }
  }, [esAdmin])

  async function ponerAlDia() {
    if (ocupado) return
    tap()
    setOcupado(true)
    const lista = pendientes.map((id) => ({ texto: id, estado: 'pendiente' }))
    const pinta = () => setPasos([...lista])
    pinta()

    for (let i = 0; i < lista.length; i += 1) {
      lista[i].estado = 'curso'
      pinta()
      try {
        const r = await aplicarSiguienteMigracion()
        lista[i].estado = 'hecho'
        // Media migración ya estaba (aplicada a mano, a medias): se dice, no se
        // esconde — un «✓» que ejecutó cero cosas se leería como que las hizo.
        if (r.aplicada?.saltadas) lista[i].texto = `${lista[i].texto} · ${r.aplicada.saltadas} ya estaban`
      } catch (e) {
        // El fallo con su estado HTTP, y el renglón se toca para copiarlo
        // (§14.9-bis): un error de SQL no se transcribe a mano desde un móvil.
        lista[i].estado = 'fallo'
        lista[i].informe = String(e.message ?? e)
        pinta()
        setOcupado(false)
        return
      }
      pinta()
    }
    setPendientes([])
    setOcupado(false)
  }

  // Quien no administra no ve un botón que le iba a devolver un 403 al pulsarlo,
  // pero sí ve **por qué** no lo ve: si no, buscar el botón que le han dicho que
  // está aquí es una búsqueda sin final.
  if (!esAdmin) {
    return <div className="pista">La base de datos la pone al día quien administra el grupo.</div>
  }
  if (error) {
    return (
      <pre className="traza mal" role="status">
        {`No se ha podido preguntar por las migraciones: ${error}`}
      </pre>
    )
  }
  if (pendientes === null) return null

  return (
    <>
      <div className="pista">
        {pendientes.length
          ? `La base de datos va ${pendientes.length === 1 ? '1 migración' : `${pendientes.length} migraciones`} por detrás del código (${pendientes.join(', ')}).`
          : 'La base de datos está al día.'}
      </div>
      {pendientes.length > 0 && (
        <button className="btn ghost block" disabled={ocupado} onClick={ponerAlDia}>
          {ocupado ? 'Aplicando…' : 'Poner la base al día'}
        </button>
      )}
      {pasos && <ListaDePasos pasos={pasos} />}
    </>
  )
}

function AppSection({ esAdmin = false }) {
  // null = en reposo · si no, la clave del paso actual (UPDATE_STEPS).
  const [paso, setPaso] = useState(null)
  const busy = paso !== null
  // Si venimos de recargar por una actualización, enseñamos el ✓ y limpiamos la marca.
  const [recienActualizada] = useState(veniaDeActualizar)
  // Cuando la búsqueda acaba, el modal se queda unos segundos con su «Ok»: la
  // recarga se lo llevaba por delante en cuanto terminaba, y lo único que se
  // veía era la pantalla parpadeando sin decir en qué había quedado.
  const [terminado, setTerminado] = useState(false)
  // Lo que contestó el paquete OTA cuando no fue «actualizado». Se enseña en vez
  // de tirarse: «no ha actualizado» sin motivo no se puede arreglar desde aquí.
  // Lleva **si fue bien**, que es lo que decide el color: tres de los cinco
  // desenlaces son normales y salían en rojo.
  const [respuesta, setRespuesta] = useState(null)
  // La versión del **paquete que se está ejecutando**, que dentro de la app es la
  // que cuenta: la de `package.json` es la que se horneó en el binario.
  const [enCurso, setEnCurso] = useState(null)
  // Y lo que el plugin tiene de verdad, que es donde está la respuesta cuando la
  // app se queda en la versión de antes.
  const [paquetes, setPaquetes] = useState(null)
  useEffect(() => {
    versionInstalada().then(setEnCurso).catch(() => {})
    estadoDelPaquete().then(setPaquetes).catch(() => {})
  }, [])
  const caja = useRef(null)
  useEffect(() => {
    if (!recienActualizada) return
    limpiarMarcaActualizacion()
    // El apartado se reabre solo (Acordeon recuerda su solapa), pero la recarga
    // deja la pantalla arriba del todo: sin esto acabas mirando «Aspecto» sin
    // saber si la actualización llegó a pasar.
    caja.current?.scrollIntoView({ block: 'center' })
  }, [recienActualizada])

  async function actualizar() {
    if (busy) return
    tap()
    marcarPostActualizacion() // al re-arrancar, la app vuelve aquí en vez de a Hoy
    setTerminado(false)
    setRespuesta(null)
    setPaso('checking') // empieza a contar ya, sin esperar al primer aviso
    const inicio = Date.now()

    // En la app de iOS la versión nueva **no** llega por el service worker: llega
    // en un paquete OTA que hasta ahora solo se miraba al arrancar. Un botón que
    // se llama «Forzar la última versión» y no lo miraba dejaba al teléfono en la
    // de antes por mucho que se tocara.
    if (isNative()) {
      setPaso('downloading')
      const ota = await checkForOtaUpdate({ aplicarYa: true })
      // Si se aplicó, la webview ya se está recargando con el paquete nuevo.
      if (ota.status === 'updated') return
      // Y si no, **se dice por qué** (§14.9-bis). Antes esta respuesta se tiraba:
      // el botón seguía con el camino del service worker —que dentro de la app
      // de iOS no trae nada— y terminaba con su ✓. La pantalla decía que había
      // actualizado y el teléfono se quedaba en la de antes, sin nada que mirar.
      setPaso(null)
      setRespuesta({ texto: motivoDelOta(ota), bien: otaFueBien(ota) })
      return
    }

    forzarActualizacion(setPaso, {
      // La recarga es inevitable (hay que cargar el JS nuevo), pero la retrasamos
      // un poco para que el progreso se vea de verdad y no sea un parpadeo.
      reload: async () => {
        const resto = 1200 - (Date.now() - inicio)
        if (resto > 0) await new Promise((r) => setTimeout(r, resto))
        setTerminado(true)
        await new Promise((r) => setTimeout(r, ESPERA_FINAL))
        window.location.reload()
      },
    })
  }

  return (
    <div ref={caja}>
      {/* Dos renglones, un botón y lo que va pasando debajo, como en
          `garciadoral-ops`. Antes esto era una ficha con dibujo de ballena, un
          rótulo, la versión en grande y **un modal encima de la pantalla**: el
          modal tapaba justo lo que se venía a mirar, obligaba a un «Ok» para
          seguir y se llevaba por delante lo que había contado en cuanto se
          cerraba. Contado en su sitio se queda ahí y se puede releer. */}
      <div className="pista">
        Versión en curso: <b className="tnum">v{APP_VERSION}</b>.
        {/* Dentro de la app hay dos números y no siempre coinciden: el que se
            horneó en el binario y el del paquete OTA que está puesto encima.
            Cuando difieren, decirlo es la diferencia entre «no ha actualizado» y
            saber cuál de los dos se ha quedado atrás. */}
        {enCurso && enCurso !== APP_VERSION ? ` Paquete puesto: v${enCurso}.` : ''}
        {recienActualizada ? ' Recién actualizada ✓' : ''}
      </div>
      <div className="pista">
        {isNative()
          ? 'El paquete nuevo se descarga aquí y se aplica al volver a abrir la app.'
          : 'Estás en la versión web, que se actualiza sola al recargar.'}
      </div>

      {/* Qué cambió, una tarjeta por versión y de lado (SPECS §14.34, la
          figura de `meeting-ops-air`): la que llevas puesta y las tres de
          antes. La prosa vive en `lib/notas.js`, escrita a mano en cada vuelta
          y atada a la versión por su test — así esta pantalla contesta «¿qué
          me trajo la actualización?» y no solo «¿cuál tengo puesta?». */}
      <div className="relnotas" aria-label="Qué cambió, por versión">
        {NOTAS.slice(0, 4).map((n) => (
          <div className="relnota" key={n.version}>
            <div className="rn-meta tnum">v{n.version} · {n.fecha}</div>
            <div className="rn-titulo">{n.titulo}</div>
            {n.lineas.map((l, i) => <p className="rn-linea" key={i}>{l}</p>)}
          </div>
        ))}
      </div>

      <button className="btn ghost block" disabled={busy} onClick={actualizar}>
        {busy ? 'Comprobando…' : 'Comprobar ahora'}
      </button>

      {busy && (
        <>
          <ListaDePasos
            pasos={PASOS_APP.map((p, i) => ({
              texto: UPDATE_STEPS[p],
              estado: terminado || i < PASOS_APP.indexOf(paso) ? 'hecho'
                : i === PASOS_APP.indexOf(paso) ? 'curso' : 'pendiente',
            }))}
          />
          <div className="pista">
            {terminado
              ? `Se recarga sola en ${ESPERA_FINAL / 1000} segundos y volverás aquí, a Ajustes.`
              : 'No cierres la app: se recarga sola al terminar y volverás aquí, a Ajustes.'}
          </div>
        </>
      )}

      {respuesta && (
        <pre className={`traza ${respuesta.bien ? 'bien' : 'mal'}`} role="status">{respuesta.texto}</pre>
      )}

      {/* Los paquetes que hay bajados y en qué estado. Cuando la app se queda en
          la versión de antes no había **nada** que mirar: el manifiesto decía
          una cosa, el release estaba publicado, el zip constaba descargado, y la
          pantalla seguía con el número viejo. Un paquete en `error` es el plugin
          devolviéndolo —hace rollback si el nuevo no llama a `notifyAppReady()`
          a tiempo—, y eso desde fuera se ve igual que «no se ha bajado». */}
      {paquetes && <ListaDePaquetes paquetes={paquetes} />}

      <MigracionesBloque esAdmin={esAdmin} />
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
  // Las mejoras se leen aquí y no dentro del apartado: el rótulo lleva las que
  // faltan, y una mejora se marca sin cerrar la solapa — el número tiene que
  // moverse con ella (figura de garciadoral-ops, `docs/diseño/mejoras.html` · A1).
  const mejoras = useLiveQuery(() => listMejoras(event), [event?.id, event?.esDemo], [])
  const mejorasQueFaltan = mejoras.filter((m) => !m.hecho).length
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

      {/* Penúltimo y pegado a «La app» a propósito: las dos hablan de la
          app, no del viaje, y una mejora se apunta menos veces que todo lo
          demás (`docs/diseño/mejoras.html` · A1). */}
      <Acordeon titulo="Mejoras" icono="mejora" nota={mejorasQueFaltan ? `${mejorasQueFaltan} sin hacer` : null}>
        <MejorasSection
          evento={event}
          mejoras={mejoras}
          persons={persons}
          families={families}
          meId={me?.id ?? null}
        />
      </Acordeon>

      {/* «Sincronización» y «Actualizar» eran dos acordeones contando la misma
          operación por mitades — el punto de la cabecera ya hace las dos cosas
          en una pasada (datos + versión, §14.10)—, así que aquí van juntas y el
          apartado se llama por lo que es: la app (SPECS §14.41). */}
      <Acordeon titulo="La app" icono="sincronizar" nota={`v${APP_VERSION}`}>
        <SyncSection sync={sync} onSincronizarTodo={onSincronizarTodo} />
        <AppSection esAdmin={esAdmin} />
      </Acordeon>

    </div>
  )
}
