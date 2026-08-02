import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'

const MARCAS = { hecho: '✓', curso: '●', fallo: '×', aviso: '!' }

/**
 * La lista de pasos, suelta. Es la pieza que garciadoral-ops pinta **en su
 * sitio** —dentro del apartado de Sincronización, debajo del botón— en vez de
 * encima de la pantalla: lo que ha ido pasando se queda ahí y se puede releer.
 *
 * Un paso con `informe` se toca para llevárselo al portapapeles. Un mensaje de
 * TLS o un número de la API no se transcriben a mano desde un teléfono, y son
 * justo lo que hay que enseñarle a quien pueda arreglarlo.
 */
export function ListaDePasos({ pasos = [], onCopiado }) {
  async function copiar(texto) {
    tap()
    try {
      await navigator.clipboard.writeText(texto)
      onCopiado?.('Copiado')
    } catch {
      onCopiado?.('No se ha podido copiar')
    }
  }

  return (
    <ol className="pasos">
      {pasos.map((p, i) => {
        const copiable = Boolean(p.informe)
        return (
          <li
            key={`${i}-${p.texto}`}
            data-estado={p.estado}
            data-copiable={copiable ? 'si' : undefined}
            aria-current={p.estado === 'curso' ? 'step' : undefined}
            onClick={copiable ? () => copiar(p.informe) : undefined}
            title={copiable ? 'Tócalo para copiarlo' : undefined}
          >
            <span className="txt">{p.texto}</span>
            <span className="marca" aria-hidden>{MARCAS[p.estado] ?? ''}</span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Lo que está pasando, en una lista que se lee de arriba abajo.
 *
 * Lo pintan los dos procesos largos que tiene la app —sincronizar todo desde el
 * punto de la cabecera, y comprobar la versión desde Ajustes—, porque son el
 * mismo gesto contado a capas distintas y merecen la misma figura.
 *
 * `pasos` es `[{ texto, estado }]` con estado `curso | hecho | fallo | aviso`.
 * Mientras quede alguno en curso no hay salida dibujada: el proceso o termina o
 * recarga, y un «Cancelar» ahí sería mentira.
 */
export default function ProgresoModal({ titulo, version, pasos = [], terminado = false, onCerrar, etiquetaCerrar = 'Cerrar', pista }) {
  useBloqueoDeScroll()

  return (
    <div className="modal-bg center">
      <div className="modal center progreso-modal" role="status" aria-live="polite">
        <div className="whale" aria-hidden>🐳</div>
        <h2>{titulo}</h2>

        {version && (
          <div className="version-caja">
            <span className="l">Versión en curso</span>
            <span className="v tnum">v{version}</span>
          </div>
        )}

        <ListaDePasos pasos={pasos} />

        {!terminado && <div className="prog"><i /></div>}
        {pista && <div className="hint">{pista}</div>}

        {terminado && onCerrar && (
          <button className="btn block" style={{ marginTop: 14 }} onClick={onCerrar}>{etiquetaCerrar}</button>
        )}
      </div>
    </div>
  )
}
