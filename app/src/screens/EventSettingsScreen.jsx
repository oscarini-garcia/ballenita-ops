import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  familiesOf, addFamily, removeFamily,
  bungasOf, addBunga, removeBunga,
  personsOf, addPerson, removePerson, updatePerson,
} from '../db.js'
import { useSkin, SKINS } from '../lib/skins.js'
import { syncNow } from '../sync/engine.js'
import { isConfigured } from '../sync/jsonbin.js'
import { forzarActualizacion, UPDATE_STEPS, marcarPostActualizacion, veniaDeActualizar, limpiarMarcaActualizacion } from '../lib/pwa.js'

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

function SyncSection() {
  const [state, setState] = useState(null)
  const configured = isConfigured()
  async function run() {
    setState({ status: 'syncing' })
    setState(await syncNow())
  }
  return (
    <>
      <div className="sec-h">Sincronización</div>
      {configured ? (
        <>
          <div className="note">Los cambios se sincronizan solos entre los móviles del grupo (al abrir, al volver la conexión y cada poco). Todo funciona sin cobertura y cuadra al reconectar.</div>
          <div style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={run}>↻ Sincronizar ahora</button>
            {state && <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--ink-faint)' }}>
              {state.status === 'syncing' ? 'sincronizando…' : state.status === 'synced' ? '✓ al día' : state.status}
            </span>}
          </div>
        </>
      ) : (
        <div className="note">Ahora mismo la app es <b>solo local</b> (este móvil). Para sincronizar con el grupo, configura <code>VITE_JSONBIN_ID</code> y <code>VITE_JSONBIN_KEY</code> (ver <code>app/.env.example</code>). Sin eso, todo funciona igual pero no se comparte.</div>
      )}
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
    const inicio = Date.now()
    forzarActualizacion(setPaso, {
      // La recarga es inevitable (hay que cargar el JS nuevo), pero la retrasamos
      // un poco para que el overlay de progreso se vea de verdad y no sea un parpadeo.
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
      <div className="note">¿No ves los últimos cambios? Fuerza que la ballena traiga la <b>versión más reciente</b> sin tener que quitarla y volver a añadirla a la pantalla de inicio.
        <div style={{ marginTop: 8 }}>
          <button className="btn sm" disabled={busy} onClick={actualizar}>🔄 Buscar actualización y recargar</button>
        </div>
        {recienActualizada && (
          <div className="pill owed" style={{ marginTop: 10, display: 'inline-block' }}>✓ Actualizada · v{APP_VERSION}</div>
        )}
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-faint)' }}>Versión {APP_VERSION}</div>
      </div>

      {busy && (
        <div className="update-overlay" role="status" aria-live="polite">
          <div className="box">
            <div className="whale" aria-hidden>🐳</div>
            <div className="step">{UPDATE_STEPS[paso] ?? 'Actualizando…'}</div>
            <div className="prog"><i /></div>
            <div className="hint">No cierres la app, tarda un momento…</div>
          </div>
        </div>
      )}
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

export default function EventSettingsScreen({ eventId, event, onChangeEvent }) {
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const famName = (id) => families.find((f) => f.id === id)?.name ?? '—'

  const [modal, setModal] = useState(null) // 'familia' | 'bunga' | 'persona'

  return (
    <div className="body">
      <EventoSection event={event} onChangeEvent={onChangeEvent} />
      <AspectoSection />
      <SyncSection />
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
