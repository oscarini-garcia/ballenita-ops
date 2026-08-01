import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  familiesOf, addFamily, removeFamily,
  bungasOf, addBunga, removeBunga,
  personsOf, addPerson, removePerson, olvidarTodo,
  listEvents,
} from '../db.js'
import Acordeon from '../components/Acordeon.jsx'
import SyncDot, { estadoSync } from '../components/SyncDot.jsx'
import ProgresoModal from '../components/ProgresoModal.jsx'
import StatsScreen from './StatsScreen.jsx'
import { useSkin, SKINS, GRUPOS } from '../lib/skins.js'
import { useTamano, TAMANOS } from '../lib/tamano.js'
import { useIdentidad } from '../lib/identidad.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { gestionarCuenta, hayApi, listarCuentas } from '../sync/api.js'
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
  const { pref, current, choose, reroll } = useSkin()
  const { tamano, elegir } = useTamano()
  const currentName = SKINS.find((s) => s.id === current)?.name ?? current

  return (
    <>
      <label>Tamaño del texto</label>
      {/* Segmentado y no desplegable: es lo único de esta pantalla cuyo efecto se
          ve en el sitio, y una rueda de iOS encima taparía justo lo que hay que
          mirar para decidir. */}
      <div className="seg" role="group" aria-label="Tamaño del texto">
        {TAMANOS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tamano === t.id}
            onClick={() => { tap(); elegir(t.id) }}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="note">Se guarda en este móvil y mueve toda la app a la vez, no solo esta pantalla.</div>

      {GRUPOS.map((g) => (
        <div key={g.id}>
          <div className="sec-h">{g.label}</div>
          <div className="chips" style={{ marginTop: 8 }}>
            {SKINS.filter((s) => s.grupo === g.id).map((s) => (
              <button key={s.id} className={`chip${pref === s.id ? ' on' : ''}`} onClick={() => { tap(); choose(s.id) }}>
                {s.emoji} {s.name}
              </button>
            ))}
            {g.id === 'fiesta' && (
              <button className={`chip${pref === 'random' ? ' on' : ''}`} onClick={() => { tap(); choose('random') }}>🎲 Aleatorio</button>
            )}
          </div>
        </div>
      ))}

      {pref === 'random' ? (
        <div className="note">🎲 Modo aleatorio: hoy toca <b>{currentName}</b>, y cambia solo <b>cada día</b>. Los dos de máximo contraste se quedan fuera del bombo: se eligen para poder leer, no para que el dado te los quite mañana.
          <div style={{ marginTop: 8 }}><button className="btn sm" onClick={reroll}>🎲 Tirar otra vez</button></div>
        </div>
      ) : (
        <div className="note">«Para leer bien» son sosos a propósito: máximo contraste, sin degradados ni translúcidos. «Con guasa» son los del grupo. Se guarda en tu móvil.</div>
      )}
    </>
  )
}

/**
 * Quién eres, desde Ajustes.
 *
 * Es la misma identidad que el badge de la cabecera (`lib/identidad.js`), y está
 * aquí además de allí porque son dos preguntas distintas: arriba se toca para
 * editar tu perfil, y aquí se viene a **cambiar de persona** —el móvil que se
 * pasa de mano en mano en el bunga, que es exactamente lo que pasa.
 */
function QuienEresSection({ eventId, persons }) {
  const { me, elegir, salir } = useIdentidad(eventId, persons)

  return (
    <>
      <div className="card tight">
        <div className="row">
          <div className="av" style={{ background: 'var(--spout-deep)' }}>{me?.avatar || '🐳'}</div>
          <div className="main">
            <div className="n">{me ? me.name : 'Sin elegir'}</div>
            <div className="sub">{me ? (me.estado || 'Sin estado') : 'Nadie ha dicho quién es en este móvil'}</div>
          </div>
          {me && <button className="btn sm ghost" onClick={() => { tap(); salir() }}>Salir</button>}
        </div>
      </div>

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

      <div className="note">Quién eres se guarda <b>en este móvil</b> y no se sincroniza: cada uno elige la suya. Tu emoji y tu estado sí los ve el grupo, y se cambian tocando tu nombre en la cabecera.</div>
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
          <div className="av" style={{ background: 'var(--spout-deep)' }}>🐳</div>
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
                <span className="pe">🗓️</span>
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

  return (
    <>
      <div className="card tight">
        <div className="row">
          <div className="av" aria-hidden="true">🐳</div>
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
    </>
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
          <div className="av" style={{ background: 'var(--spout-deep)' }}>🐳</div>
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
 * La figura es la de `garciadoral-ops`: `<details>`/`<summary>` del navegador, y
 * **uno solo abierto**, Sincronización. Ajustes es una lista de cosas que casi
 * nunca se tocan; enseñarlas todas abiertas obliga a leerlas enteras para
 * encontrar la única que se venía a buscar. Y aquí se llega casi siempre por lo
 * mismo: algo no está como se esperaba.
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
  const { current } = useSkin()
  const sesion = leerSesion()

  return (
    <div className="body">
      <Acordeon titulo="Sincronización" emoji="🔄" abierta>
        <SyncSection sync={sync} onSincronizarTodo={onSincronizarTodo} />
      </Acordeon>

      <Acordeon titulo="Aspecto" emoji="🎨" nota={SKINS.find((s) => s.id === current)?.name}>
        <AspectoSection />
      </Acordeon>

      <Acordeon titulo="Quién eres" emoji="🙋" nota={me ? (me.apodo || me.name) : 'sin elegir'}>
        <QuienEresSection eventId={eventId} persons={persons} />
      </Acordeon>

      <Acordeon titulo="Evento" emoji="🗓️" nota={event?.name}>
        <EventoSection event={event} onPickEvent={onPickEvent} />
      </Acordeon>

      <Acordeon titulo="Estadísticas" emoji="📊">
        <StatsScreen eventId={eventId} event={event} suelto />
      </Acordeon>

      <Acordeon titulo="Familias" emoji="👨‍👩‍👧" nota={families.length || null}>
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

      <Acordeon titulo="Bungalows" emoji="🏠" nota={bungas.length || null}>
        <div className="card tight">
          {bungas.length === 0 && <div className="empty" style={{ padding: 14 }}>Sin bungas todavía.</div>}
          {bungas.map((b) => (
            <div className="row" key={b.id}>
              <div className="av" style={{ background: 'var(--spout-deep)' }}>🏠</div>
              <div className="main"><div className="n">{b.name}{b.alias ? ` · ${b.alias}` : ''}</div><div className="sub">{famName(b.familyId)}</div></div>
              <button className="btn sm danger" onClick={() => removeBunga(b.id)}>Borrar</button>
            </div>
          ))}
        </div>
        <button className="btn block" onClick={() => setModal('bunga')}>+ Añadir bunga</button>
      </Acordeon>

      <Acordeon titulo="Gente" emoji="🧑" nota={persons.length || null}>
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
        <Acordeon titulo="Tu cuenta" emoji="🍏" nota={sesion.cuenta?.nombre}>
          <CuentaSection />
        </Acordeon>
      )}

      <Acordeon titulo="La app" emoji="🐳" nota={`v${APP_VERSION}`}>
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
