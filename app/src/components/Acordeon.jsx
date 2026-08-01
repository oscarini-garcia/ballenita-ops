import { tap } from '../lib/native.js'

/**
 * Un apartado plegable, con `<details>` y `<summary>` del propio navegador.
 *
 * Sin JavaScript por debajo a propósito (idea tomada de `garciadoral-ops`): el
 * elemento ya se abre al tocarlo y con Enter, ya se anuncia como plegado o
 * desplegado a quien no ve, y el buscador del navegador abre por su cuenta el
 * apartado donde encuentra algo. Nada de eso saldría gratis con un `div`.
 *
 * `nota` es lo que el apartado sigue diciendo con la solapa bajada —«v0.2.0»,
 * «4 familias»—: ahorra desplegarlo solo para verlo.
 */
export default function Acordeon({ titulo, emoji, nota, abierta = false, children }) {
  return (
    <details className="acordeon" open={abierta}>
      <summary onClick={() => tap()}>
        {emoji && <span className="acordeon-moneda" aria-hidden>{emoji}</span>}
        <span className="acordeon-titulo">{titulo}</span>
        {nota != null && nota !== '' && <span className="acordeon-nota">{nota}</span>}
      </summary>
      <div className="acordeon-cuerpo">{children}</div>
    </details>
  )
}
