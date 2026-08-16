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
 * Tuvo una cabecera de dos verbos —«Cancelar» y «Listo» arriba, el patrón de
 * hoja modal de iOS— durante una versión, y se retiró: en una app donde todas
 * las demás pantallas confirman **abajo y en azul**, los 61,9 pt que ahorraba
 * costaban más de lo que valían. Quien necesite confirmar pone sus dos botones
 * al final, con `.salida`.
 */
export default function Hoja({ titulo, onCerrar, children }) {
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
        <h2>{titulo}</h2>
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
 * libre es un callejón que obliga a cerrar, buscar otra lista y volver. Admite
 * **una o varias**: elegir de una lista y corregir lo que hay son dos salidas
 * distintas y las dos se buscan aquí (§14.48).
 *
 * `pista` es la pregunta, cuando el título es **el sujeto y no la pregunta**:
 * al proponer una idea el título es su nombre —«Kayaks en la cala»— y lo que se
 * decide es otra cosa (§14.59). Sin ella habría que meter la pregunta dentro
 * del título, que entonces se parte en dos líneas y deja de nombrar la cosa.
 */
export function HojaDeEleccion({ titulo, pista, opciones, valor, onElegir, onCerrar, extra, notaDebajo = false }) {
  const salidas = extra ? (Array.isArray(extra) ? extra : [extra]) : []
  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      {pista && <div className="pista">{pista}</div>}
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
        {salidas.map((s) => (
          <button
            key={s.etiqueta}
            type="button"
            className="eleccion-op nueva"
            onClick={() => { tap(); s.onClick() }}
          >
            <span className="et">{s.etiqueta}</span>
          </button>
        ))}
      </div>
    </Hoja>
  )
}

/*
 * Aquí vivió `HojaDeMarcar` (`agenda-dia.html · F1`), la hoja para marcar
 * varias. Su único consumidor era el día de Agenda, y sus elegidores pasaron a
 * la capa centrada con borrador (`elegidores.html` · C2 · V2): se fue con
 * ellos. Si vuelve a hacer falta marcar varias desde una hoja, está en la
 * historia de git.
 */
