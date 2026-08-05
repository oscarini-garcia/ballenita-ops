import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import Icono from './Icono.jsx'

/**
 * Una hoja que sube desde el borde de abajo (`docs/diseño/gente-editar.html · F2`).
 *
 * Es la figura elegida para editar **y** para elegir, y por eso vive en un
 * componente y no en cada pantalla: la misma hoja que corrige el nombre de una
 * familia es la que enseña los bungas libres, así que se escribe una vez.
 *
 * Sube desde abajo por dos razones que no son de gusto: el pulgar llega, y el
 * teclado sale de ese mismo borde, así que al aparecer no descoloca la hoja como
 * hace con un modal centrado. Detrás se sigue viendo la ficha de la que has
 * salido, que es justo lo que un modal centrado tapa.
 *
 * El fondo cierra al tocarlo, `useBloqueoDeScroll` sujeta lo de detrás y el asa
 * de arriba no es un botón: es la marca de que esto se cierra hacia abajo.
 *
 * `acciones` —`{ onCancelar, onListo }`— cambia el título por una **cabecera de
 * dos verbos** (`docs/diseño/gasto-entre.html` · E2): «Cancelar» a la izquierda,
 * el título en medio y «Listo» a la derecha. Es el patrón de hoja modal de iOS y
 * **sustituye** al `h2` en vez de sumarse a él, así que una hoja que necesita
 * confirmar y descartar cuesta 61,9 pt menos que con dos botones abajo — medido.
 * Sin `acciones`, la hoja se queda como estaba: título y a cerrar por el fondo.
 */
export default function Hoja({ titulo, onCerrar, acciones, children }) {
  useBloqueoDeScroll()
  return (
    <div className="modal-bg" onClick={onCerrar}>
      <div
        className="modal hoja"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="hoja-asa" aria-hidden="true" />
        {acciones ? (
          <div className="cab-verbos">
            <button type="button" className="can" onClick={() => { tap(); acciones.onCancelar() }}>Cancelar</button>
            <h2>{titulo}</h2>
            <button type="button" className="lis" onClick={() => { tap(); acciones.onListo() }}>Listo</button>
          </div>
        ) : <h2>{titulo}</h2>}
        {children}
      </div>
    </div>
  )
}

/**
 * La hoja de elección (`docs/diseño/gente-editar.html · A3` y `N4`).
 *
 * `opciones`: `[{ id, etiqueta, nota, tomada }]`. Lo que ya tiene dueño **se
 * enseña apagado en vez de esconderse**: si el bunga que buscas no está, quieres
 * saber que lo tienen los García, no quedarte mirando una lista corta sin
 * entender por qué.
 *
 * `extra` es la salida de N4 —«+ Bunga nuevo…»—: sin ella, quedarse sin nada
 * libre es un callejón que obliga a cerrar, buscar otra lista y volver.
 */
export function HojaDeEleccion({ titulo, opciones, valor, onElegir, onCerrar, extra, notaDebajo = false }) {
  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      {/* `notaDebajo` cuando la nota es una frase y no un dato de dos palabras:
          «0 👍 · faltan 5 por votar» a la derecha parte el título en dos líneas y
          estrecha a los dos. Medido en el navegador con la hoja de planes. */}
      <div className={`eleccion${notaDebajo ? ' nota-debajo' : ''}`}>
        {opciones.map((o) => (
          <button
            key={o.id ?? 'ninguno'}
            type="button"
            className={`eleccion-op${o.tomada ? ' tomada' : ''}`}
            disabled={o.tomada}
            onClick={() => { tap(); onElegir(o.id) }}
          >
            <span className="et">{o.etiqueta}</span>
            {o.nota && <span className="no">{o.nota}</span>}
            {(o.id ?? null) === (valor ?? null) && (
              <span className="tic"><Icono nombre="visto" /></span>
            )}
          </button>
        ))}
        {extra && (
          <button type="button" className="eleccion-op nueva" onClick={() => { tap(); extra.onClick() }}>
            <span className="et">{extra.etiqueta}</span>
          </button>
        )}
      </div>
    </Hoja>
  )
}

/**
 * La misma hoja, pero para marcar **varias** (`docs/diseño/agenda-dia.html · F1`).
 *
 * Elegir un bunga es elegir uno; elegir los platos de una cena es marcar seis de
 * catorce. Es el mismo mueble —la lista sube desde abajo, el fondo cierra— con
 * la única diferencia de que aquí las filas no se cierran al tocarlas y llevan
 * `aria-pressed` en vez de un tic decorativo.
 *
 * `opciones`: `[{ id, etiqueta, nota }]`. `marcados` es un `Set` de ids.
 */
export function HojaDeMarcar({ titulo, opciones, marcados, onAlternar, onCerrar, vacio, pie }) {
  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      {opciones.length === 0 && vacio && <div className="note">{vacio}</div>}
      {opciones.length > 0 && (
        <div className="eleccion">
          {opciones.map((o) => {
            const puesto = marcados.has(o.id)
            return (
              <button
                key={o.id}
                type="button"
                className="eleccion-op"
                aria-pressed={puesto}
                onClick={() => { tap(); onAlternar(o.id) }}
              >
                <span className="et">{o.etiqueta}</span>
                {o.nota && <span className="no">{o.nota}</span>}
                {puesto && <span className="tic"><Icono nombre="visto" /></span>}
              </button>
            )
          })}
        </div>
      )}
      {pie && <div className="apunte" style={{ marginTop: 10 }}>{pie}</div>}
      {/* Elegir uno cierra la hoja solo; marcar varios no sabe cuándo has
          terminado, así que la salida tiene que estar escrita. */}
      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn block" onClick={() => { tap(); onCerrar() }}>Listo</button>
      </div>
    </Hoja>
  )
}
