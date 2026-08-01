import { useBloqueoDeScroll } from '../lib/scrollLock.js'

const MARCAS = { hecho: '✓', curso: '●', fallo: '×', aviso: '!' }

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
export default function ProgresoModal({ titulo, version, pasos = [], terminado = false, onCerrar, pista }) {
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

        <ol className="pasos">
          {pasos.map((p, i) => (
            <li
              key={`${i}-${p.texto}`}
              data-estado={p.estado}
              aria-current={p.estado === 'curso' ? 'step' : undefined}
            >
              <span className="txt">{p.texto}</span>
              <span className="marca" aria-hidden>{MARCAS[p.estado] ?? ''}</span>
            </li>
          ))}
        </ol>

        {!terminado && <div className="prog"><i /></div>}
        {pista && <div className="hint">{pista}</div>}

        {terminado && onCerrar && (
          <button className="btn block" style={{ marginTop: 14 }} onClick={onCerrar}>Cerrar</button>
        )}
      </div>
    </div>
  )
}
