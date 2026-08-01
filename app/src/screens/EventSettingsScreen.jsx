import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  familiesOf, addFamily, removeFamily,
  bungasOf, addBunga, removeBunga,
  personsOf, addPerson, removePerson, updatePerson, olvidarTodo,
  listEvents,
} from '../db.js'
import Acordeon from '../components/Acordeon.jsx'
import Icono from '../components/Icono.jsx'
import SyncDot, { estadoSync } from '../components/SyncDot.jsx'
import ProgresoModal from '../components/ProgresoModal.jsx'
import StatsScreen from './StatsScreen.jsx'
import { useTema, TEMAS } from '../lib/tema.js'
import { useTamano, TAMANOS } from '../lib/tamano.js'
import { useIdentidad } from '../lib/identidad.js'
import { comprimirFoto, guardarFoto, leerFoto } from '../lib/avatares.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { eliminarMiCuenta, gestionarCuenta, hayApi, listarCuentas } from '../sync/api.js'
import { codigoDeAutorizacionDeApple } from '../auth/apple.js'
import { borrarSesion, leerSesion, modoLocal, salirDeModoLocal } from '../auth/sesion.js'
import { tap } from '../lib/native.js'
import { forzarActualizacion, marcarPostActualizacion, veniaDeActualizar, limpiarMarcaActualizacion, UPDATE_STEPS } from '../lib/pwa.js'

// El orden real del proceso (lib/pwa.js), para pintarlo como lista y que se vea
// por dónde va en vez de un solo rótulo que parpadea.
const PASOS_APP = ['checking', 'downloading', 'applying']

const COLORS = ['#E5544B', '#2E9E6B', '#1FA6D6', '#E7A33E', '#6E4C97', '#E5744B']

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
function SyncSection({ sync, onSincronizarTodo }) {
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
      <button className="btn block" onClick={onSincronizarTodo}>↻ Sincronizar todo</button>
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

  return (
    <>
      <div className="card tight">
        <div className="row">
          <div className="ico"><Icono nombre="evento" /></div>
          <div className="main">
            <div className="n">{event?.name || 'Evento'}</div>
            <div className="sub">{event?.lugar || 'Ballena Ops'}</div>
          </div>
          <span className="pill neutral">en curso</span>
        </div>
      </div>

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

/**
 * Sesión y, para quien administre el grupo, el alta de gente nueva.
 *
 * La incorporación es por invitación: alguien que ya está dentro pega aquí el
 * código que le ha pasado el aspirante. Sin esto haría falta entrar en la base
 * de datos a mano para dejar entrar a nadie.
 */
function CuentaSection() {
  const sesion = leerSesion()
  const [cuentas, setCuentas] = useState(null)
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [aviso, setAviso] = useState(null)
  // Cuenta que se está renombrando: { id, nombre } o null.
  const [editando, setEditando] = useState(null)
  // Baja de la cuenta: null en reposo · 'confirmando' · 'yendo' · el resultado.
  const [baja, setBaja] = useState(null)

  const esAdmin = sesion?.cuenta?.rol === 'administrador'

  async function cargar() {
    try {
      setCuentas((await listarCuentas()).cuentas)
    } catch (e) {
      setAviso(String(e.message ?? e))
    }
  }

  useEffect(() => { if (esAdmin) cargar() }, [esAdmin])

  async function invitar() {
    if (!codigo.trim()) return
    tap()
    setAviso(null)
    try {
      await gestionarCuenta({ accion: 'invitar', identificador: codigo.trim(), nombre: nombre.trim() })
      setCodigo('')
      setNombre('')
      setAviso('Listo. Que entre con Apple y ya tendrá acceso.')
      cargar()
    } catch (e) {
      setAviso(String(e.message ?? e))
    }
  }

  async function alternar(cuenta) {
    tap()
    try {
      await gestionarCuenta({ accion: cuenta.activa ? 'desactivar' : 'activar', id: cuenta.id })
      cargar()
    } catch (e) {
      setAviso(String(e.message ?? e))
    }
  }

  async function renombrar() {
    tap()
    try {
      await gestionarCuenta({ accion: 'renombrar', id: editando.id, nombre: editando.nombre })
      setEditando(null)
      cargar()
    } catch (e) {
      setAviso(String(e.message ?? e))
    }
  }

  async function salir() {
    tap()
    // Los datos del grupo se van con la sesión: no tiene sentido dejarlos en un
    // móvil que ya no va a poder actualizarlos.
    borrarSesion()
    await olvidarTodo()
    window.location.reload()
  }

  /**
   * Eliminar la cuenta. Lo exige la directriz 5.1.1(v) de la App Store: quien
   * puede crear una cuenta tiene que poder eliminarla desde dentro de la app,
   * sin escribirle a nadie.
   *
   * Se vuelve a pasar por la hoja de Apple antes, y no por ceremonia: de ahí
   * sale el código con el que el Worker le dice a Apple que este vínculo se
   * acabó. Si esa hoja se cancela o falla, la baja **sigue adelante** sin ella
   * (`codigoDeAutorizacionDeApple` devuelve null): lo que no puede pasar es que
   * alguien no pueda irse porque Apple no contestó.
   */
  async function eliminarCuenta() {
    tap()
    setBaja('yendo')
    try {
      const resultado = await eliminarMiCuenta(await codigoDeAutorizacionDeApple())
      borrarSesion()
      await olvidarTodo()
      setBaja(resultado)
    } catch (e) {
      setBaja(null)
      setAviso(`No se pudo eliminar la cuenta: ${String(e.message ?? e)}`)
    }
  }

  return (
    <>
      <div className="card tight">
        <div className="row">
          <div className="ico"><Icono nombre="llave" /></div>
          <div className="main">
            <div className="n">{sesion.cuenta?.nombre || 'Cuenta de Apple'}</div>
            <div className="sub">{esAdmin ? 'Administras el grupo' : 'Miembro del grupo'}</div>
          </div>
          <button className="btn sm ghost" onClick={salir}>Salir</button>
        </div>
      </div>

      {esAdmin && (
        <>
          <div className="sec-h">Quién tiene acceso</div>
          <div className="card tight">
            {cuentas === null && <div className="empty" style={{ padding: 14 }}>Cargando…</div>}
            {cuentas?.map((c) => (
              <div className="cuenta-fila" key={c.id} data-activa={c.activa ? 'si' : 'no'}>
                {editando?.id === c.id ? (
                  <>
                    <input
                      className="main"
                      type="text"
                      value={editando.nombre}
                      onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') renombrar() }}
                      aria-label="Nombre de la cuenta"
                      autoFocus
                    />
                    <button className="btn sm" onClick={renombrar}>Guardar</button>
                    <button className="btn sm ghost" onClick={() => setEditando(null)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <div className="main">
                      <div className="n">{c.nombre || c.email || 'Sin nombre'}</div>
                      <div className="sub">
                        {c.rol}
                        {c.ultimoAcceso ? ` · última vez ${new Date(c.ultimoAcceso).toLocaleDateString('es-ES')}` : ' · aún no ha entrado'}
                      </div>
                    </div>
                    <button
                      className="btn sm ghost"
                      onClick={() => { tap(); setEditando({ id: c.id, nombre: c.nombre || '' }) }}
                      aria-label={`Renombrar a ${c.nombre || 'esta cuenta'}`}
                    >
                      ✏️
                    </button>
                    <button className="btn sm ghost" onClick={() => alternar(c)}>
                      {c.activa ? 'Quitar' : 'Devolver'}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="note">Para dar de alta a alguien: que intente entrar con Apple, te pase el código que le sale y lo pegues aquí.</div>
          <label htmlFor="cuenta-codigo">Código de Apple</label>
          <input id="cuenta-codigo" type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="000123.abc…" />
          <label htmlFor="cuenta-nombre">Nombre (para reconocerlo en la lista)</label>
          <input id="cuenta-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Curro" />
          <button className="btn sm" style={{ marginTop: 8 }} onClick={invitar}>Dar acceso</button>
        </>
      )}

      {aviso && <div className="note" role="status">{aviso}</div>}

      {/* Eliminar la cuenta va al final y en rojo, lejos de «Salir», con la que
          se confunde a la primera mirada: una deja de sincronizar en este móvil
          y la otra deshace el acceso al grupo para siempre. */}
      <div className="sec-h">Eliminar mi cuenta</div>
      <div className="note">
        Deshace el vínculo entre tu Apple ID y el grupo, y se lo dice a Apple para
        que Ballena Ops desaparezca de «Apps que usan tu Apple ID». Los gastos,
        cenas y planes que apuntaste se quedan: son del grupo, y borrarlos
        descuadraría los saldos de todos los demás. Para volver a entrar haría
        falta que alguien te diera de alta otra vez.
      </div>
      <button className="btn sm danger" style={{ marginTop: 8 }} onClick={() => { tap(); setBaja('confirmando') }}>
        Eliminar mi cuenta
      </button>

      {baja && <BajaModal estado={baja} onCancelar={() => setBaja(null)} onConfirmar={eliminarCuenta} />}
    </>
  )
}

/**
 * Confirmación de la baja, y después su resultado.
 *
 * El resultado no se despacha con un «listo»: dice si se pudo avisar a Apple.
 * Si no se pudo —sin clave en el Worker, o la hoja de Apple cancelada—, la
 * cuenta está eliminada igual pero la aplicación sigue figurando en la lista del
 * Apple ID, y eso solo lo puede quitar su titular desde los ajustes de iOS.
 * Callárselo sería dejar a alguien creyendo que se fue del todo.
 */
function BajaModal({ estado, onCancelar, onConfirmar }) {
  useBloqueoDeScroll()
  const hecha = typeof estado === 'object' && estado !== null
  const yendo = estado === 'yendo'

  return (
    <div className="modal-bg" onClick={hecha ? undefined : onCancelar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{hecha ? 'Cuenta eliminada' : '¿Eliminar tu cuenta?'}</h2>

        {hecha ? (
          <>
            <p className="note">
              Tu acceso al grupo ya no existe y este móvil se ha quedado vacío.
            </p>
            <p className="note">
              {estado.revocado_en_apple
                ? 'También se lo hemos dicho a Apple: Ballena Ops ya no figura entre las apps que usan tu Apple ID.'
                : 'No hemos podido avisar a Apple, así que Ballena Ops puede seguir apareciendo en Ajustes de iOS → tu nombre → Inicio de sesión y seguridad → Iniciar sesión con Apple. Ahí puedes quitarla.'}
            </p>
            {estado.administradores_restantes === 0 && (
              <p className="note">
                Eras la última cuenta que administraba el grupo: ya no queda nadie
                que pueda dar de alta a otros desde la app.
              </p>
            )}
            <div style={{ marginTop: 16 }}>
              <button className="btn block" onClick={() => window.location.reload()}>Cerrar</button>
            </div>
          </>
        ) : (
          <>
            <p className="note">
              Se elimina tu cuenta y los dispositivos desde los que sincronizabas.
              No se puede deshacer: para volver, alguien del grupo tendría que
              darte de alta otra vez.
            </p>
            <p className="note">
              Apple te va a pedir que te identifiques una vez más. Es de donde
              sale el permiso para avisarle de que te vas.
            </p>
            <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
              <button className="btn block danger" disabled={yendo} onClick={onConfirmar}>
                {yendo ? 'Eliminando…' : 'Sí, eliminar mi cuenta'}
              </button>
              <button className="btn block ghost" disabled={yendo} onClick={onCancelar}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AppSection() {
  // null = en reposo · si no, la clave del paso actual (UPDATE_STEPS).
  const [paso, setPaso] = useState(null)
  const busy = paso !== null
  // Si venimos de recargar por una actualización, enseñamos el ✓ y limpiamos la marca.
  const [recienActualizada] = useState(veniaDeActualizar)
  useEffect(() => { if (recienActualizada) limpiarMarcaActualizacion() }, [recienActualizada])

  function actualizar() {
    if (busy) return
    marcarPostActualizacion() // al re-arrancar, la app vuelve aquí en vez de a Hoy
    setPaso('checking') // abre el modal ya, sin esperar al primer aviso
    const inicio = Date.now()
    forzarActualizacion(setPaso, {
      // La recarga es inevitable (hay que cargar el JS nuevo), pero la retrasamos
      // un poco para que el progreso se vea de verdad y no sea un parpadeo.
      reload: async () => {
        const resto = 1600 - (Date.now() - inicio)
        if (resto > 0) await new Promise((r) => setTimeout(r, resto))
        window.location.reload()
      },
    })
  }

  return (
    <>
      <div className="card tight">
        {/* La versión en curso, grande: es lo que se viene a mirar aquí. */}
        <div className="row">
          <div className="ico"><Icono nombre="ballena" /></div>
          <div className="main">
            <div className="n">Ballena Ops</div>
            <div className="sub">Versión en curso</div>
          </div>
          <div className="version-grande tnum">v{APP_VERSION}</div>
        </div>
      </div>
      <button className="btn block" disabled={busy} onClick={actualizar}>🔄 Forzar la última versión</button>
      <div className="note">El punto de la cabecera ya comprueba la versión cada vez que sincronizas. Esto es el martillo: borra las cachés y recarga aunque el sistema diga que ya estás al día.</div>
      {recienActualizada && (
        <div className="pill owed" style={{ display: 'inline-block' }}>✓ Recién actualizada a la v{APP_VERSION}</div>
      )}

      {busy && (
        <ProgresoModal
          titulo="Buscando la última versión"
          version={APP_VERSION}
          pasos={PASOS_APP.map((p, i) => ({
            texto: UPDATE_STEPS[p],
            estado: i < PASOS_APP.indexOf(paso) ? 'hecho' : i === PASOS_APP.indexOf(paso) ? 'curso' : 'pendiente',
          }))}
          pista="No cierres la app: se recarga sola al terminar y volverás aquí, a Ajustes."
        />
      )}
    </>
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
  const famName = (id) => families.find((f) => f.id === id)?.name ?? '—'

  const [modal, setModal] = useState(null) // 'familia' | 'bunga' | 'persona'
  const { me } = useIdentidad(eventId, persons)
  const { tema: temaPuesto } = useTema()
  const sesion = leerSesion()

  return (
    <div className="body">
      <Acordeon titulo="Sincronización" icono="sincronizar">
        <SyncSection sync={sync} onSincronizarTodo={onSincronizarTodo} />
      </Acordeon>

      <Acordeon titulo="Aspecto" icono="aspecto" nota={TEMAS.find((t) => t.id === temaPuesto)?.name}>
        <AspectoSection />
      </Acordeon>

      <Acordeon titulo="Quién eres" icono="persona" nota={me ? (me.apodo || me.name) : 'sin elegir'}>
        <QuienEresSection eventId={eventId} persons={persons} />
      </Acordeon>

      <Acordeon titulo="Evento" icono="evento" nota={event?.name}>
        <EventoSection event={event} onPickEvent={onPickEvent} />
      </Acordeon>

      <Acordeon titulo="Estadísticas" icono="grafico">
        <StatsScreen eventId={eventId} event={event} suelto />
      </Acordeon>

      <Acordeon titulo="Familias" icono="familia" nota={families.length || null}>
        <div className="card tight">
          {families.length === 0 && <div className="empty" style={{ padding: 14 }}>Sin familias todavía.</div>}
          {families.map((f) => (
            <div className="row" key={f.id}>
              <div className="av" style={{ background: f.color }}>{f.avatar}</div>
              <div className="main"><div className="n">{f.name}</div><div className="sub">{f.estado || '—'}</div></div>
              <button className="btn sm danger" onClick={() => removeFamily(f.id)}>Borrar</button>
            </div>
          ))}
        </div>
        <button className="btn block" onClick={() => setModal('familia')}>+ Añadir familia</button>
      </Acordeon>

      <Acordeon titulo="Bungalows" icono="casa" nota={bungas.length || null}>
        <div className="card tight">
          {bungas.length === 0 && <div className="empty" style={{ padding: 14 }}>Sin bungas todavía.</div>}
          {bungas.map((b) => (
            <div className="row" key={b.id}>
              <div className="ico"><Icono nombre="casa" /></div>
              <div className="main"><div className="n">{b.name}{b.alias ? ` · ${b.alias}` : ''}</div><div className="sub">{famName(b.familyId)}</div></div>
              <button className="btn sm danger" onClick={() => removeBunga(b.id)}>Borrar</button>
            </div>
          ))}
        </div>
        <button className="btn block" onClick={() => setModal('bunga')}>+ Añadir bunga</button>
      </Acordeon>

      <Acordeon titulo="Gente" icono="persona" nota={persons.length || null}>
        <div className="card tight">
          {persons.length === 0 && <div className="empty" style={{ padding: 14 }}>Sin gente todavía.</div>}
          {persons.map((p) => (
            <div className="row" key={p.id}>
              <div className="av" style={{ background: families.find((f) => f.id === p.familyId)?.color || 'var(--ink-faint)' }}>{p.avatar}</div>
              <div className="main">
                <div className="n">{p.name}{p.apodo ? ` · «${p.apodo}»` : ''}</div>
                <div className="sub">{famName(p.familyId)} · {p.edad} · peso {p.pesoReparto}</div>
              </div>
              <button className="btn sm danger" onClick={() => removePerson(p.id)}>Borrar</button>
            </div>
          ))}
        </div>
        <button className="btn block" onClick={() => setModal('persona')}>+ Añadir persona</button>
        <div className="note">🐳 El <b>peso de reparto</b> define cuánto cuenta cada persona al dividir un gasto por cabezas (un bebé 0, un niño 0,5, un adulto 1).</div>
      </Acordeon>

      {sesion && (
        <Acordeon titulo="Tu cuenta" icono="llave" nota={sesion.cuenta?.nombre}>
          <CuentaSection />
        </Acordeon>
      )}

      <Acordeon titulo="La app" icono="ballena" nota={`v${APP_VERSION}`}>
        <AppSection />
      </Acordeon>

      {modal === 'familia' && <FamiliaModal eventId={eventId} onClose={() => setModal(null)} />}
      {modal === 'bunga' && <BungaModal eventId={eventId} families={families} onClose={() => setModal(null)} />}
      {modal === 'persona' && <PersonaModal eventId={eventId} families={families} onClose={() => setModal(null)} />}
    </div>
  )
}

function Modal({ title, onClose, children, onSave }) {
  useBloqueoDeScroll()
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>×</button>
        <h2>{title}</h2>
        {children}
        <div style={{ marginTop: 16 }}><button className="btn block" onClick={onSave}>Guardar</button></div>
      </div>
    </div>
  )
}

function FamiliaModal({ eventId, onClose }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [avatar, setAvatar] = useState('👨‍👩‍👧')
  const [estado, setEstado] = useState('')
  return (
    <Modal title="Nueva familia" onClose={onClose} onSave={async () => {
      if (!name.trim()) return
      await addFamily(eventId, { name: name.trim(), color, avatar: avatar || '👨‍👩‍👧', estado: estado.trim() })
      onClose()
    }}>
      <label>Nombre</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="García" autoFocus />
      <div className="grid2">
        <div><label>Emoji</label><input type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} maxLength={4} /></div>
        <div><label>Estado</label><input type="text" value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="modo playa" /></div>
      </div>
      <label>Color</label>
      <div className="chips">
        {COLORS.map((c) => (
          <button key={c} className="chip" onClick={() => setColor(c)} style={{ background: color === c ? c : 'var(--foam-2)', width: 38, height: 30 }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: c, display: 'inline-block' }} />
          </button>
        ))}
      </div>
    </Modal>
  )
}

function BungaModal({ eventId, families, onClose }) {
  const [name, setName] = useState('')
  const [alias, setAlias] = useState('')
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')
  return (
    <Modal title="Nuevo bunga" onClose={onClose} onSave={async () => {
      if (!name.trim()) return
      await addBunga(eventId, { name: name.trim(), alias: alias.trim(), familyId: familyId || null })
      onClose()
    }}>
      <label>Nombre</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bunga 1" autoFocus />
      <label>Alias (opcional)</label>
      <input type="text" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="El de la piscina" />
      <label>Familia</label>
      <select value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
        <option value="">— sin asignar —</option>
        {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </Modal>
  )
}

function PersonaModal({ eventId, families, onClose }) {
  const [name, setName] = useState('')
  const [apodo, setApodo] = useState('')
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')
  const [edad, setEdad] = useState('adulto')
  const [peso, setPeso] = useState(1)
  return (
    <Modal title="Nueva persona" onClose={onClose} onSave={async () => {
      if (!name.trim()) return
      await addPerson(eventId, {
        name: name.trim(), apodo: apodo.trim(), familyId: familyId || null,
        edad, pesoReparto: Number(peso),
      })
      onClose()
    }}>
      <label>Nombre</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Curro" autoFocus />
      <label>Apodo (opcional)</label>
      <input type="text" value={apodo} onChange={(e) => setApodo(e.target.value)} />
      <label>Familia</label>
      <select value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
        <option value="">— sin familia —</option>
        {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      <div className="grid2">
        <div>
          <label>Edad</label>
          <select value={edad} onChange={(e) => { setEdad(e.target.value); setPeso(e.target.value === 'adulto' ? 1 : 0.5) }}>
            <option value="adulto">Adulto</option>
            <option value="niño">Niño</option>
          </select>
        </div>
        <div><label>Peso de reparto</label><input type="number" step="0.5" min="0" value={peso} onChange={(e) => setPeso(e.target.value)} /></div>
      </div>
    </Modal>
  )
}
