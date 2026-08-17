import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { personsOf, ponerEstado, updatePerson } from '../db.js'
import { useIdentidad } from '../lib/identidad.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { comprimirFoto, guardarFoto, leerFoto } from '../lib/avatares.js'
import { TOPE_EMOJIS, contarEmojis, cortarEmojis } from '../lib/emojis.js'
import { tap } from '../lib/native.js'
import HojaDeEstado from './HojaDeEstado.jsx'

// Emojis rápidos para el avatar (también se escribe a mano).
const AVATARES = ['🧑', '👩', '👨', '🧔', '👵', '👴', '🧒', '🐳', '🦑', '🦀', '🏄', '🕶️', '🍹', '🐙']

/**
 * Tu cara: la foto de este móvil si la hay, si no el emoji.
 *
 * `data-emojis` es cuántos dibujos lleva, para que la casilla los encoja en vez
 * de recortarlos (§14.47). Con foto no se pone: ahí manda la imagen.
 */
export function Cara({ emoji, foto, className }) {
  return (
    <span className={className} data-emojis={foto ? undefined : contarEmojis(emoji || '🐳')}>
      {foto ? <img src={foto} alt="" className="ufoto" /> : (emoji || '🐳')}
    </span>
  )
}

/**
 * Tu perfil, detrás de tu emoji en la cabecera (SPECS §14.62).
 *
 * Vivía en **Ajustes → Quién eres**, y ese apartado nació de una pregunta que ya
 * no existe: «¿quién eres en este móvil?». Desde §14.42 lo dice la cuenta —quien
 * administra enlaza cada cuenta con su persona—, así que lo que quedaba dentro
 * no era una identidad que elegir sino **tu perfil**: tu emoji, tu foto y tu
 * estado. Y un perfil no es un ajuste: es tuyo, se toca a menudo y se mira desde
 * cualquier pantalla, que es justo lo contrario del sitio donde estaba —tres
 * toques, detrás de una rueda que ya solo guarda lo que casi nunca se cambia—.
 *
 * Va **antes del punto de sincronizar**, porque el orden de la cabecera es el de
 * lo que se toca: tú, el estado de los datos, y los ajustes al final.
 *
 * **Sin identidad no hay botón.** En la libreta local y en la demostración puede
 * no haber nadie elegido todavía, y un botón con la ballena de fábrica no dice
 * de quién es: ahí la lista de personas sale dentro del modal, que es la única
 * salida que §14.42 dejó abierta.
 */
export default function BotonDePerfil({ eventId }) {
  const personas = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const { me, deLaCuenta } = useIdentidad(eventId, personas)
  const [abierto, setAbierto] = useState(false)
  const [foto, setFoto] = useState(null)

  useEffect(() => { setFoto(leerFoto(eventId, me?.id)) }, [eventId, me?.id, abierto])

  // Con la cuenta enlazada y sin persona en este evento no hay perfil que
  // enseñar, pero sí hay que poder elegirse: ese es el caso que abre la lista.
  if (!me && deLaCuenta) return null

  return (
    <>
      <button
        type="button"
        className="iconbtn perfil"
        aria-label={me ? `Tu perfil, ${me.apodo || me.name}` : 'Di quién eres'}
        onClick={() => { tap(); setAbierto(true) }}
      >
        <Cara className="cara-barra" emoji={me?.avatar ?? '🙂'} foto={foto} />
      </button>

      {abierto && (
        <PerfilModal
          eventId={eventId}
          personas={personas}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

/**
 * El perfil, en capa centrada.
 *
 * Tres cosas y en este orden: **tu emoji**, **tu foto** y **tu estado**. Las dos
 * primeras se guardan con el botón; el estado abre su hoja, que ya existe y trae
 * los cinco de siempre, las otras cinco de la IA y el «más gracioso».
 *
 * La hoja del estado **sustituye** a esta capa en vez de montarse encima
 * (§14.31 · V2): capa sobre capa se lee como marco doble, y aquí además las dos
 * hablarían de lo mismo.
 *
 * **La lista de personas solo sale donde la cuenta no puede contestar** —libreta
 * local, demostración, o una persona enlazada que no es de este evento—, que es
 * exactamente la regla de §14.42. Con cuenta enlazada no aparece: quien
 * administra ya ha dicho quién eres, y ofrecerte cambiarlo sería ofrecer algo
 * que se deshace solo en el siguiente arranque.
 */
function PerfilModal({ eventId, personas, onCerrar }) {
  useBloqueoDeScroll()
  const { meId, me, elegir, salir, deLaCuenta } = useIdentidad(eventId, personas)
  const [avatar, setAvatar] = useState(me?.avatar ?? '🧑')
  const [foto, setFoto] = useState(null)
  // Borrador de la foto: `undefined` = sin tocar, `null` = quitarla, string = nueva.
  const [fotoNueva, setFotoNueva] = useState(undefined)
  const [aviso, setAviso] = useState(null)
  const [guardado, setGuardado] = useState(false)
  const [editandoEstado, setEditandoEstado] = useState(false)
  const archivo = useRef(null)

  useEffect(() => { setFoto(leerFoto(eventId, meId)) }, [eventId, meId])

  // Al cambiar de persona, resembrar los campos con los suyos.
  useEffect(() => {
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
    await updatePerson(me.id, { avatar: avatar || '🧑' })
    if (fotoNueva !== undefined) {
      guardarFoto(eventId, meId, fotoNueva)
      setFoto(fotoNueva)
      setFotoNueva(undefined)
    }
    setGuardado(true)
  }

  // La hoja del estado **en vez de** esta capa, no encima.
  if (editandoEstado && me) {
    return (
      <HojaDeEstado
        eventId={eventId}
        persona={me}
        onCerrar={() => setEditandoEstado(false)}
        onGuardar={async (nuevo) => {
          // El «cuándo» va con él (`ponerEstado`, en `db.js`): así la tira de
          // «Hoy» ordena por novedad desde el primer pintado.
          await ponerEstado(me.id, nuevo)
          setEditandoEstado(false)
        }}
      />
    )
  }

  return createPortal(
  // Por un portal al `body` (§14.55-ter): este modal lo abre el emoji de la
  // **cabecera**, y sin él cuelga de `.appbar` con su tinta y su apilado.
    <div className="modal-bg center" onClick={onCerrar}>
      <div className="modal center" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onCerrar} aria-label="Cerrar">×</button>
        <h2>{me ? (me.apodo || me.name) : 'Quién eres'}</h2>

        {me && (
          <>
            <div className="card tight">
              <div className="row">
                <Cara className="av" emoji={avatar} foto={fotoActual} />
                <div className="main">
                  <div className="n">{me.name}</div>
                  <div className="sub">{me.estado || 'Sin estado'}</div>
                </div>
                {/* El estado se toca aquí y se edita en su hoja, que es la misma
                    que abre la pastilla de la cabecera: una sola pieza para una
                    sola cosa. */}
                <button className="btn sm ghost" onClick={() => { tap(); setEditandoEstado(true) }}>
                  {me.estado ? 'Cambiar' : 'Ponerlo'}
                </button>
              </div>
            </div>

            <label>Tu emoji</label>
            <div className="chips">
              {AVATARES.map((a) => (
                <button key={a} className={`chip${avatar === a ? ' on' : ''}`} onClick={() => { tap(); setAvatar(a) }}>{a}</button>
              ))}
            </div>
            <input
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(cortarEmojis(e.target.value, TOPE_EMOJIS))}
              placeholder="🙂"
              aria-label="Emoji a mano"
            />

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

            {aviso && <div className="note" role="status">{aviso}</div>}

            <button className="btn block" onClick={guardar}>Guardar mi perfil</button>
            {guardado && <div className="pill owed" style={{ display: 'inline-block' }} role="status">✓ Guardado</div>}
          </>
        )}

        {!deLaCuenta && (
          <>
            <div className="sec-h">{me ? 'Cambiar de persona' : 'Elige quién eres'}</div>
            <div className="lista-personas">
              {personas.length === 0 && (
                <div className="empty" style={{ padding: 14 }}>Aún no hay gente en el evento. Añádela en «Grupo».</div>
              )}
              {personas.map((p) => (
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
            {/* «Salir» olvida la identidad de este móvil, y eso solo tiene
                sentido cuando se eligió aquí: con la cuenta enlazada volvería a
                ponerse sola en el acto (§14.42), o sea un botón que no hace
                nada. */}
            {me && (
              <button className="btn sm ghost" onClick={() => { tap(); salir(); onCerrar() }}>
                Dejar de ser {me.apodo || me.name}
              </button>
            )}
            <div className="note">
              Quién eres se guarda <b>en este móvil</b> y no se sincroniza: cada uno elige la suya.
              El emoji y el estado sí los ve el grupo.
            </div>
          </>
        )}

        {deLaCuenta && (
          <div className="note">
            🐳 Eres <b>{me.name}</b> porque tu cuenta está enlazada con esa persona: lo decide quien
            lleva el grupo, no este móvil. Tu emoji, tu foto y tu estado sí los cambias tú.
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
