import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  familiesOf, addFamily, removeFamily,
  bungasOf, addBunga, removeBunga,
  personsOf, addPerson, removePerson, updatePerson, olvidarTodo,
} from '../db.js'
import SyncDot, { estadoSync } from '../components/SyncDot.jsx'
import UpdateModal from '../components/UpdateModal.jsx'
import { useSkin, SKINS } from '../lib/skins.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { syncNow } from '../sync/engine.js'
import { gestionarCuenta, hayApi, listarCuentas } from '../sync/api.js'
import { borrarSesion, leerSesion, modoLocal, salirDeModoLocal } from '../auth/sesion.js'
import { tap } from '../lib/native.js'
import { forzarActualizacion, marcarPostActualizacion, veniaDeActualizar, limpiarMarcaActualizacion } from '../lib/pwa.js'

const COLORS = ['#E5544B', '#2E9E6B', '#1FA6D6', '#E7A33E', '#6E4C97', '#E5744B']

// Inyectada por Vite (define). Guarda por si el global no existe (p. ej. en tests).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

function EventoSection({ event, onChangeEvent }) {
  return (
    <>
      <div className="sec-h">Evento</div>
      <div className="card tight">
        <div className="row">
          <div className="av" style={{ background: 'var(--spout-deep)' }}>🐳</div>
          <div className="main">
            <div className="n">{event?.name || 'Evento'}</div>
            <div className="sub">{event?.lugar || 'Ballena Ops'}</div>
          </div>
          {onChangeEvent && <button className="btn sm ghost" onClick={onChangeEvent}>↔ Cambiar</button>}
        </div>
      </div>
    </>
  )
}

/**
 * Sincronización. Aquí es donde vive ahora el punto de estado: antes ocupaba
 * sitio en la cabecera para algo que se mira de uvas a peras, y la cabecera la
 * necesitábamos para el ⚙️.
 *
 * `sync` llega desde App (el motor real). Sin él —montando la pantalla suelta,
 * p. ej. en un test— se apaña detectando la API por su cuenta.
 */
function SyncSection({ sync }) {
  const [state, setState] = useState(null)
  // La configuración se lee en caliente de config.json, así que llega después
  // del primer pintado en vez de estar horneada en el bundle.
  const [detectada, setDetectada] = useState(false)
  useEffect(() => {
    if (sync) return undefined
    let vivo = true
    hayApi().then((si) => { if (vivo) setDetectada(si) })
    return () => { vivo = false }
  }, [sync])

  const estado = sync ?? { isConfigured: detectada, online: true, status: state?.status ?? 'idle' }
  const d = estadoSync(estado)
  // Hay grupo al otro lado, pero este móvil eligió seguir sin entrar.
  const enLocal = estado.isConfigured && modoLocal() && !leerSesion()

  async function run() {
    tap()
    if (sync?.recheck) { await sync.recheck(); return }
    setState({ status: 'syncing' })
    setState(await syncNow())
  }

  // La puerta se vuelve a abrir recargando: App decide qué pintar al arrancar y
  // así no hay dos sitios que recuerden si se entró o no.
  function volverAIntentarlo() {
    tap()
    salirDeModoLocal()
    window.location.reload()
  }

  return (
    <>
      <div className="sec-h">Sincronización</div>
      <div className="card tight">
        <div className="row">
          <SyncDot sync={estado} onClick={run} />
          <div className="main">
            <div className="n">{d.title}</div>
            <div className="sub">{d.detalle}</div>
          </div>
          {estado.isConfigured && <button className="btn sm ghost" onClick={run}>↻ Ahora</button>}
        </div>
      </div>
      {enLocal && (
        <>
          <div className="note">
            Estás usando Ballena Ops <b>sin entrar</b>: lo que apuntas se queda en este móvil,
            encolado. En cuanto consigas entrar con Apple sube todo de una vez —no hay que
            volver a teclear nada—.
          </div>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={volverAIntentarlo}>
            Probar a entrar con Apple
          </button>
        </>
      )}
      {!enLocal && (estado.isConfigured ? (
        <div className="note">Los cambios se sincronizan solos entre los móviles del grupo (al abrir, al volver la conexión y cada poco). Todo funciona sin cobertura y cuadra al reconectar.</div>
      ) : (
        <div className="note">Aquí Ballena Ops es <b>solo local</b>: todo funciona igual, pero se queda en este dispositivo. Compartir gastos con el grupo requiere la <b>app de iOS</b>, que es donde vive el acceso con Apple.</div>
      ))}
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

  if (!sesion) return null

  return (
    <>
      <div className="sec-h">Tu cuenta</div>
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
      <div className="sec-h">App</div>
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
        <div className="row">
          <div className="main">
            <div className="sub">¿No ves los últimos cambios? Trae la <b>más reciente</b> sin quitar y volver a añadir la app.</div>
          </div>
          <button className="btn sm" disabled={busy} onClick={actualizar}>🔄 Comprobar</button>
        </div>
      </div>
      {recienActualizada && (
        <div className="pill owed" style={{ display: 'inline-block' }}>✓ Recién actualizada a la v{APP_VERSION}</div>
      )}

      {busy && <UpdateModal paso={paso} version={APP_VERSION} />}
    </>
  )
}

function AspectoSection() {
  const { pref, current, choose, reroll } = useSkin()
  const currentName = SKINS.find((s) => s.id === current)?.name ?? current
  return (
    <>
      <div className="sec-h">Aspecto</div>
      <div className="chips">
        {SKINS.map((s) => (
          <button key={s.id} className={`chip${pref === s.id ? ' on' : ''}`} onClick={() => choose(s.id)}>
            {s.emoji} {s.name}
          </button>
        ))}
        <button className={`chip${pref === 'random' ? ' on' : ''}`} onClick={() => choose('random')}>🎲 Aleatorio</button>
      </div>
      {pref === 'random' ? (
        <div className="note">🎲 Modo aleatorio: hoy toca <b>{currentName}</b>. El sistema cambia de tema solo <b>cada día</b>.
          <div style={{ marginTop: 8 }}><button className="btn sm" onClick={reroll}>🎲 Tirar otra vez</button></div>
        </div>
      ) : (
        <div className="note">Elige el tema del grupo (se guarda en tu móvil). «Sistema» sigue el claro/oscuro; «Aleatorio» cambia de tema cada día.</div>
      )}
    </>
  )
}

export default function EventSettingsScreen({ eventId, event, onChangeEvent, sync }) {
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const famName = (id) => families.find((f) => f.id === id)?.name ?? '—'

  const [modal, setModal] = useState(null) // 'familia' | 'bunga' | 'persona'

  return (
    <div className="body">
      <EventoSection event={event} onChangeEvent={onChangeEvent} />
      <AspectoSection />
      <CuentaSection />
      <SyncSection sync={sync} />
      <AppSection />

      <div className="sec-h">Familias <button className="btn sm ghost" onClick={() => setModal('familia')}>+ añadir</button></div>
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

      <div className="sec-h">Bungalows <button className="btn sm ghost" onClick={() => setModal('bunga')}>+ añadir</button></div>
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

      <div className="sec-h">Gente <button className="btn sm ghost" onClick={() => setModal('persona')}>+ añadir</button></div>
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

      <div className="note">🐳 El <b>peso de reparto</b> define cuánto cuenta cada persona al dividir un gasto por cabezas (un bebé 0, un niño 0,5, un adulto 1).</div>

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
