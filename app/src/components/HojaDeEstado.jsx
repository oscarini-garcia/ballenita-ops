import { useState } from 'react'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import { estadoConGracia, estadosSugeridos, hayApi } from '../sync/api.js'
import { ESTADOS_DE_SIEMPRE, cincoAlAzar, partirEstado } from '../lib/estados.js'
import { TOPE_EMOJIS, cortarEmojis } from '../lib/emojis.js'

/**
 * Tu estado, en una capa centrada (`docs/diseño/estado.html` · M2 · I1 · I3).
 *
 * **Cinco estados enteros que se tocan**, y debajo los dos campos para
 * escribir el tuyo. Enteros y no «emoji por un lado, frase por otro» (M1)
 * porque un estado se lee de una pieza —«🍺 de resaca»— y porque la tanda de
 * la IA viene así: partirla en dos campos era inventar una figura para
 * deshacerla luego.
 *
 * Al abrir salen **cinco de los escritos a mano**, elegidos al azar de los
 * doce: la lista tiene que traer algo antes de que nadie llame a nadie. La IA
 * entra por **«Otras cinco»** (I1) y solo cuando se pulsa —llamar al abrir
 * sería gastar una credencial de pago sin pedirlo, que es lo que se descartó
 * para las ideas de plan—, y por **«Más gracioso»** (I3), que coge lo que has
 * escrito y lo devuelve mejor contado sin guardar nada.
 *
 * Trabaja sobre un **borrador**, como los elegidores del día (§14.31 · C2):
 * «Guardar» escribe, «Cancelar» y el fondo descartan.
 */
export default function HojaDeEstado({ eventId, persona, onGuardar, onCerrar }) {
  useBloqueoDeScroll()
  const inicial = partirEstado(persona?.estado ?? '')
  const [emoji, setEmoji] = useState(inicial.emoji)
  const [texto, setTexto] = useState(inicial.texto)
  const [lista, setLista] = useState(() => cincoAlAzar(ESTADOS_DE_SIEMPRE))
  const [pidiendo, setPidiendo] = useState(null)
  const [fallo, setFallo] = useState(null)
  // Lo que había antes de que la IA lo tocara, para poder volver: lo que
  // devuelve el modelo rellena el campo, no lo decide.
  const [deshacer, setDeshacer] = useState(null)

  const conIA = hayApi()

  async function otrasCinco() {
    tap()
    setPidiendo('tanda')
    setFallo(null)
    try {
      const nuevas = await estadosSugeridos({ eventId, hoy: new Date().toISOString().slice(0, 10) })
      if (nuevas.length) setLista(nuevas)
      else setFallo('La IA no ha traído ninguno. Puedes escribir el tuyo.')
    } catch (e) {
      setFallo(String(e.message ?? e))
    } finally {
      setPidiendo(null)
    }
  }

  async function masGracioso() {
    if (!texto.trim()) return
    tap()
    setPidiendo('gracia')
    setFallo(null)
    try {
      const mejor = await estadoConGracia({ emoji, texto })
      if (mejor) {
        setDeshacer({ emoji, texto })
        setEmoji(mejor.emoji)
        setTexto(mejor.texto)
      } else setFallo('La IA no ha sabido mejorarlo. Se queda el tuyo.')
    } catch (e) {
      setFallo(String(e.message ?? e))
    } finally {
      setPidiendo(null)
    }
  }

  function guardar() {
    tap()
    const limpio = texto.trim()
    onGuardar(limpio ? `${emoji || '🙂'} ${limpio}`.trim() : '')
  }

  return (
    <div className="modal-bg center" onClick={onCerrar}>
      <div className="modal center formulario" onClick={(e) => e.stopPropagation()}>
        <h2>Tu estado</h2>
        <div className="apunte">Toca uno, o escríbelo tú.</div>

        <div className="eleccion" style={{ marginTop: 8 }}>
          {lista.map((e) => (
            <button
              key={`${e.emoji}${e.texto}`}
              type="button"
              className="eleccion-op"
              aria-pressed={emoji === e.emoji && texto === e.texto}
              onClick={() => { tap(); setEmoji(e.emoji); setTexto(e.texto); setDeshacer(null) }}
            >
              <span className="et"><span className="est-emoji">{e.emoji}</span> {e.texto}</span>
            </button>
          ))}
        </div>

        {/* El botón de la IA con aire por delante: pegado a la lista se toca
            sin querer al elegir el último de los cinco. */}
        {conIA && (
          <div className="tras-lista">
            <button type="button" className="btn sm ghost" disabled={pidiendo} onClick={otrasCinco}>
              {pidiendo === 'tanda' ? 'Pensando…' : '✨ Otras cinco'}
            </button>
          </div>
        )}

        <label htmlFor="estado-texto">O el tuyo</label>
        <div className="estado-campos">
          <input
            type="text"
            className="estado-emoji"
            value={emoji}
            onChange={(e) => setEmoji(cortarEmojis(e.target.value, TOPE_EMOJIS))}
            placeholder="🙂"
            aria-label="El emoji de tu estado"
          />
          <input
            id="estado-texto"
            type="text"
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setDeshacer(null) }}
            maxLength={40}
            placeholder="a mi bola…"
          />
        </div>

        {conIA && (
          <div className="chips" style={{ marginTop: 8 }}>
            <button type="button" className="btn sm ghost" disabled={pidiendo || !texto.trim()} onClick={masGracioso}>
              {pidiendo === 'gracia' ? 'Pensando…' : '✨ Más gracioso'}
            </button>
            {deshacer && (
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => { tap(); setEmoji(deshacer.emoji); setTexto(deshacer.texto); setDeshacer(null) }}
              >
                Deshacer
              </button>
            )}
          </div>
        )}

        {fallo && <pre className="traza mal" role="status">{fallo}</pre>}

        <div className="salida">
          <button type="button" className="btn ghost" onClick={() => { tap(); onCerrar() }}>Cancelar</button>
          <button type="button" className="btn" onClick={guardar}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
