import { useRef } from 'react'
import { tap } from '../lib/native.js'
import Icono from './Icono.jsx'

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
 *
 * **Lo único que sí lleva JavaScript es acordarse de si estaba abierto.** Forzar
 * la última versión recarga la app, y la recarga devolvía todos los apartados
 * plegados: acababas de tocar «actualizar» dentro de «La app» y volvías a una
 * lista de solapas cerradas. Se guarda por rótulo en `localStorage`, que es de
 * este móvil y no viaja en la sincronización — dónde tienes abierta una solapa
 * no es un hecho del grupo.
 */
const CLAVE = 'ballena.acordeon.'

const leer = (titulo, porDefecto) => {
  try {
    const v = localStorage.getItem(CLAVE + titulo)
    return v === null ? porDefecto : v === '1'
  } catch { return porDefecto }
}
const guardar = (titulo, abierto) => {
  try { localStorage.setItem(CLAVE + titulo, abierto ? '1' : '0') } catch { /* modo privado */ }
}

export default function Acordeon({ titulo, icono, nota, abierta = false, children }) {
  // Solo el valor de arranque: `<details>` se gobierna solo a partir de ahí, y
  // volver a pasarle `open` en cada render pelearía con el propio elemento.
  const inicial = useRef(leer(titulo, abierta)).current
  return (
    <details className="acordeon" open={inicial} onToggle={(e) => guardar(titulo, e.currentTarget.open)}>
      <summary onClick={() => tap()}>
        {icono && <span className="acordeon-moneda ico"><Icono nombre={icono} /></span>}
        <span className="acordeon-titulo">{titulo}</span>
        {nota != null && nota !== '' && <span className="acordeon-nota">{nota}</span>}
      </summary>
      <div className="acordeon-cuerpo">{children}</div>
    </details>
  )
}
