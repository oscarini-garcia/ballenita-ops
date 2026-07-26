import { UPDATE_STEPS } from '../lib/pwa.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'

// Orden real del proceso (`lib/pwa.js`). Se pinta como lista para que se vea
// **por dónde va**: antes era un solo rótulo que cambiaba y parecía un parpadeo.
const PASOS = ['checking', 'downloading', 'applying']

/**
 * Modal de actualización. No lleva cerrar a propósito: el proceso termina
 * siempre en una recarga, así que un botón de cancelar sería mentira.
 *
 * `paso` es la clave del paso en curso (`UPDATE_STEPS`). `version` es la que
 * está corriendo ahora mismo, que es el dato que se viene a comprobar aquí.
 */
export default function UpdateModal({ paso, version }) {
  useBloqueoDeScroll()
  const actual = PASOS.indexOf(paso)

  return (
    <div className="modal-bg center">
      <div className="modal center update-modal" role="status" aria-live="polite">
        <div className="whale" aria-hidden>🐳</div>
        <h2>Buscando la última versión</h2>

        <div className="version-caja">
          <span className="l">Versión en curso</span>
          <span className="v tnum">v{version}</span>
        </div>

        <ol className="pasos">
          {PASOS.map((p, i) => {
            const estado = i < actual ? 'hecho' : i === actual ? 'ahora' : 'pendiente'
            return (
              <li key={p} data-estado={estado} aria-current={estado === 'ahora' ? 'step' : undefined}>
                <span className="txt">{UPDATE_STEPS[p]}</span>
                <span className="marca" aria-hidden>{estado === 'hecho' ? '✓' : estado === 'ahora' ? '●' : ''}</span>
              </li>
            )
          })}
        </ol>

        <div className="prog"><i /></div>
        <div className="hint">No cierres la app: se recarga sola al terminar y volverás aquí, a Ajustes.</div>
      </div>
    </div>
  )
}
