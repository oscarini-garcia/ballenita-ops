// Quién eres, y tu perfil — dentro de **Grupo** desde §14.61.
//
// Vivía en un acordeón de Ajustes, y ahí dejó de tener sentido el día que el
// grupo salió a su propia pestaña: tu ficha es la primera de las nueve del
// censo, no un ajuste de la aplicación. Ahora abre la lista de familias, que es
// donde uno se busca.
//
// El emoji y el estado son hechos del grupo y sincronizan. La foto no: vive solo
// en este móvil (`lib/avatares.js`, SPECS §14.10).
import { useEffect, useRef, useState } from 'react'
import { updatePerson } from '../db.js'
import { useIdentidad } from '../lib/identidad.js'
import { TOPE_EMOJIS, contarEmojis, cortarEmojis } from '../lib/emojis.js'
import { comprimirFoto, guardarFoto, leerFoto } from '../lib/avatares.js'
import { tap } from '../lib/native.js'

// Estados de coña para tocar rápido (se puede escribir cualquiera igualmente).
const ESTADOS = [
  '🍺 de resaca', '🏖️ tirado en la toalla', '😴 echando la siesta',
  '🐳 avistando ballenas', '💸 sin blanca', '🍷 vino en mano',
  '🔥 a la parrilla', '🤿 buceando', '🫥 desaparecido en combate',
  '🍤 en modo gamba', '🚗 haciendo de chófer', '🧴 poniéndome crema',
]

// Emojis rápidos para el avatar (también se escribe a mano).
const AVATARES = ['🧑', '👩', '👨', '🧔', '👵', '👴', '🧒', '🐳', '🦑', '🦀', '🏄', '🕶️', '🍹', '🐙']

/**
 * Tu cara: la foto de este móvil si la hay, si no el emoji.
 *
 * `data-emojis` es cuántos dibujos lleva, para que la casilla los encoja en vez
 * de recortarlos (§14.47). Con foto no se pone: ahí manda la imagen.
 */
function Cara({ emoji, foto, className }) {
  return (
    <span className={className} data-emojis={foto ? undefined : contarEmojis(emoji || '🐳')}>
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
export default function QuienEresSection({ eventId, persons }) {
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
          <input type="text" value={avatar} onChange={(e) => setAvatar(cortarEmojis(e.target.value, TOPE_EMOJIS))} placeholder="🙂" aria-label="Emoji a mano" />

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