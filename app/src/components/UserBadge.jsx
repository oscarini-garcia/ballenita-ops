import { useEffect, useState } from 'react'
import { updatePerson } from '../db.js'
import { tap } from '../lib/native.js'

// El "usuario" es una persona del evento (§ barra superior). Quién eres se guarda
// por dispositivo (localStorage), NO se sincroniza — cada móvil elige su identidad.
// Lo que sí es un hecho (y sincroniza) es tu icono y tu estado, guardados en la
// propia persona.
function meKey(eventId) { return `ballena.me:${eventId}` }
export function getMeId(eventId) {
  try { return localStorage.getItem(meKey(eventId)) } catch { return null }
}
function setMeId(eventId, id) {
  try {
    if (id) localStorage.setItem(meKey(eventId), id)
    else localStorage.removeItem(meKey(eventId))
  } catch { /* almacenamiento no disponible */ }
}

// Estados de coña para tocar rápido (editables a mano igualmente).
const ESTADOS = [
  '🍺 de resaca', '🏖️ tirado en la toalla', '😴 echando la siesta',
  '🐋 avistando ballenas', '💸 sin blanca', '🍷 vino en mano',
  '🔥 a la parrilla', '🤿 buceando', '🫥 desaparecido en combate',
  '🍤 en modo gamba', '🚗 haciendo de chófer', '🧴 poniéndome crema',
]

// Iconos rápidos para el avatar (se puede escribir cualquier emoji igualmente).
const AVATARES = ['🧑', '👩', '👨', '🧔', '👵', '👴', '🧒', '🐋', '🦑', '🦀', '🏄', '🕶️', '🍹', '🐙']

export default function UserBadge({ eventId, persons }) {
  const [meId, setMe] = useState(() => getMeId(eventId))
  const [open, setOpen] = useState(false)

  // Al cambiar de evento, releer la identidad guardada para ese evento.
  useEffect(() => { setMe(getMeId(eventId)) }, [eventId])

  const me = persons.find((p) => p.id === meId) || null

  // Si la persona guardada ya no existe (borrada / evento distinto), olvidarla.
  useEffect(() => {
    if (meId && persons.length && !me) { setMeId(eventId, null); setMe(null) }
  }, [meId, persons, me, eventId])

  function choose(id) { setMeId(eventId, id); setMe(id) }
  function salir() { setMeId(eventId, null); setMe(null) }

  return (
    <>
      <button
        className="userbadge"
        onClick={() => { tap(); setOpen(true) }}
        title={me ? `Eres ${me.name}` : '¿Quién eres?'}
        aria-label={me ? `Usuario: ${me.name}` : 'Elegir quién eres'}
      >
        <span className="uav">{me ? me.avatar : '🐋'}</span>
        <span className="un">{me ? (me.apodo || me.name) : '¿Quién eres?'}</span>
      </button>
      {open && (
        <UserSheet
          persons={persons}
          me={me}
          onChoose={choose}
          onSalir={() => { salir() }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function UserSheet({ persons, me, onChoose, onSalir, onClose }) {
  const [estado, setEstado] = useState(me?.estado ?? '')
  const [avatar, setAvatar] = useState(me?.avatar ?? '🧑')

  // Al elegir persona (o cambiar de identidad) el sheet pasa a modo edición:
  // resembramos los campos con los datos de esa persona.
  useEffect(() => {
    setEstado(me?.estado ?? '')
    setAvatar(me?.avatar ?? '🧑')
  }, [me])

  async function guardar() {
    if (me) await updatePerson(me.id, { estado: estado.trim(), avatar: avatar || '🧑' })
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>×</button>
        {me ? (
          <>
            <h2>Eres {me.name} 🐋</h2>
            <div className="note">Cambia tu icono y tu estado (se ven en todo el grupo). «Salir» olvida quién eres en este móvil para cambiar de persona.</div>

            <label>Tu icono</label>
            <div className="chips">
              {AVATARES.map((a) => (
                <button key={a} className={`chip${avatar === a ? ' on' : ''}`} onClick={() => { tap(); setAvatar(a) }}>{a}</button>
              ))}
            </div>
            <input type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} maxLength={4} style={{ marginTop: 8 }} />

            <label>Tu estado</label>
            <div className="chips">
              {ESTADOS.map((s) => (
                <button key={s} className={`chip${estado === s ? ' on' : ''}`} onClick={() => { tap(); setEstado(s) }}>{s}</button>
              ))}
            </div>
            <input type="text" value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="a mi bola…" style={{ marginTop: 8 }} />

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button className="btn block" onClick={guardar}>Guardar</button>
              <button className="btn ghost" onClick={() => { tap(); onSalir() }} style={{ flex: 'none' }}>Salir</button>
            </div>
          </>
        ) : (
          <>
            <h2>¿Quién eres? 🐋</h2>
            <div className="note">Elige quién eres en este evento (se guarda en tu móvil). Luego podrás cambiar tu estado y tu icono.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {persons.length === 0 && <div className="empty" style={{ padding: 14 }}>Aún no hay gente en el evento. Añádela en Ajustes ⚙️.</div>}
              {persons.map((p) => (
                <button
                  key={p.id}
                  className="btn ghost"
                  onClick={() => { tap(); onChoose(p.id) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start' }}
                >
                  <span style={{ fontSize: 18 }}>{p.avatar}</span>
                  <span>{p.name}{p.apodo ? ` · «${p.apodo}»` : ''}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
