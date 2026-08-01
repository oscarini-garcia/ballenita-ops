import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { updatePerson } from '../db.js'
import { tap } from '../lib/native.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { comprimirFoto, guardarFoto, leerFoto } from '../lib/avatares.js'
import { useIdentidad } from '../lib/identidad.js'

// El "usuario" es una persona del evento (§ barra superior). Quién eres vive en
// `lib/identidad.js` porque ahora lo comparten dos sitios: este badge y el
// apartado «Quién eres» de Ajustes; elegirte en uno tiene que verse en el otro.
// Lo que sí es un hecho (y sincroniza) es tu emoji y tu estado, guardados en la
// propia persona. La foto es aparte: vive solo en este móvil (lib/avatares.js).
export { getMeId } from '../lib/identidad.js'

// Estados de coña para tocar rápido (editables a mano igualmente).
const ESTADOS = [
  '🍺 de resaca', '🏖️ tirado en la toalla', '😴 echando la siesta',
  '🐳 avistando ballenas', '💸 sin blanca', '🍷 vino en mano',
  '🔥 a la parrilla', '🤿 buceando', '🫥 desaparecido en combate',
  '🍤 en modo gamba', '🚗 haciendo de chófer', '🧴 poniéndome crema',
]

// Emojis rápidos para el avatar (se puede escribir cualquiera igualmente).
const AVATARES = ['🧑', '👩', '👨', '🧔', '👵', '👴', '🧒', '🐳', '🦑', '🦀', '🏄', '🕶️', '🍹', '🐙']

// Cara del usuario: la foto de este móvil si la hay, si no el emoji.
function Cara({ emoji, foto, className }) {
  return (
    <span className={className}>
      {foto ? <img src={foto} alt="" className="ufoto" /> : (emoji || '🐳')}
    </span>
  )
}

export default function UserBadge({ eventId, persons }) {
  const { meId, me, elegir, salir } = useIdentidad(eventId, persons)
  const [open, setOpen] = useState(false)
  const [foto, setFoto] = useState(null)

  useEffect(() => { setFoto(leerFoto(eventId, meId)) }, [eventId, meId])

  function aplicarFoto(dataUrl) {
    guardarFoto(eventId, meId, dataUrl)
    setFoto(dataUrl || null)
  }

  // Sin identidad el rótulo es corto a propósito: la cabecera ya va justa con
  // el nombre del evento y el ⚙️.
  const nombre = me ? (me.apodo || me.name) : 'Elígete'

  return (
    <>
      <button
        className="userbadge"
        onClick={() => { tap(); setOpen(true) }}
        title={me ? `${me.name} · toca para editar tu perfil` : 'Toca para decir quién eres'}
        aria-label={me ? `Usuario: ${me.name}` : 'Elegir usuario'}
      >
        <Cara className="uav" emoji={me?.avatar} foto={foto} />
        <span className="utxt">
          <span className="un">{nombre}</span>
          {me && me.estado && <span className="ust">{me.estado}</span>}
        </span>
      </button>
      {/* El sheet va a <body> por portal: la cabecera es `sticky` con z-index,
          o sea que crea contexto de apilamiento, y sin el portal el FAB de la
          pantalla se dibujaba por encima del modal. */}
      {open && createPortal(
        <UserSheet
          persons={persons}
          me={me}
          foto={foto}
          onFoto={aplicarFoto}
          onChoose={elegir}
          onSalir={salir}
          onClose={() => setOpen(false)}
        />,
        document.body,
      )}
    </>
  )
}

function UserSheet({ persons, me, foto, onFoto, onChoose, onSalir, onClose }) {
  const [estado, setEstado] = useState(me?.estado ?? '')
  const [avatar, setAvatar] = useState(me?.avatar ?? '🧑')
  // Borrador de la foto: `undefined` = sin tocar, `null` = quitarla, string = nueva.
  const [fotoNueva, setFotoNueva] = useState(undefined)
  const [aviso, setAviso] = useState(null)
  // Con identidad el sheet edita tu perfil; este flag abre la lista para cambiar.
  const [eligiendo, setEligiendo] = useState(!me)
  const archivo = useRef(null)

  useBloqueoDeScroll()

  // Al elegir persona (o cambiar de identidad) resembramos los campos con los
  // datos de esa persona y volvemos al modo edición.
  useEffect(() => {
    setEstado(me?.estado ?? '')
    setAvatar(me?.avatar ?? '🧑')
    setFotoNueva(undefined)
    setAviso(null)
    setEligiendo(!me)
  }, [me])

  const fotoActual = fotoNueva === undefined ? foto : fotoNueva

  // Volver al perfil aunque se re-elija a la misma persona (ahí `me` no cambia
  // y el efecto de arriba no se dispara).
  function elegir(id) { onChoose(id); setEligiendo(false) }

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
    if (me) {
      await updatePerson(me.id, { estado: estado.trim(), avatar: avatar || '🧑' })
      if (fotoNueva !== undefined) onFoto(fotoNueva)
    }
    onClose()
  }

  const listaPersonas = (
    <div className="lista-personas">
      {persons.length === 0 && <div className="empty" style={{ padding: 14 }}>Aún no hay gente en el evento. Añádela en Ajustes ⚙️.</div>}
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
  )

  return (
    <div className="modal-bg center" onClick={onClose}>
      <div className="modal center" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>

        {me && !eligiendo ? (
          <>
            <div className="perfil-cab">
              <Cara className="perfil-cara" emoji={avatar} foto={fotoActual} />
              <div className="perfil-txt">
                <h2>{me.name}</h2>
                <div className="perfil-sub">{me.apodo ? `«${me.apodo}»` : 'Tu perfil en este evento'}</div>
              </div>
            </div>

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
              {ESTADOS.map((s) => (
                <button key={s} className={`chip${estado === s ? ' on' : ''}`} onClick={() => { tap(); setEstado(s) }}>{s}</button>
              ))}
            </div>
            <input type="text" value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="a mi bola…" aria-label="Estado a mano" style={{ marginTop: 8 }} />

            {aviso && <div className="note" role="status" style={{ marginTop: 10 }}>{aviso}</div>}

            <div className="note" style={{ marginTop: 12 }}>El emoji y el estado los ve todo el grupo. «Salir de {me.apodo || me.name}» solo olvida quién eres en este móvil: no borra a nadie.</div>

            {/* Pegada abajo: con tanto chip, «Guardar» quedaba fuera de pantalla. */}
            <div className="perfil-acciones">
              <button className="btn block" onClick={guardar}>Guardar</button>
              <div className="perfil-secundarias">
                <button className="btn ghost" onClick={() => { tap(); setEligiendo(true) }}>↔ Cambiar</button>
                <button className="btn ghost danger-txt" onClick={() => { tap(); onSalir() }}>Salir de {me.apodo || me.name}</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2>Elige tu persona 🐳</h2>
            <div className="note">Se guarda en este móvil. Después podrás cambiar tu foto, tu emoji y tu estado.</div>
            {listaPersonas}
            {me && (
              <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => { tap(); setEligiendo(false) }}>
                Volver a tu perfil
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
