import { tap } from '../lib/native.js'

/**
 * El botón de crear, con la palabra puesta.
 *
 * Era un «+» a secas, y un «+» no dice si va a apuntar un gasto, una cena o un
 * plan: había que acordarse de en qué pestaña estabas. Ahora lo dice, y cambia
 * con la pestaña. Mismo sitio y mismo gesto que antes — cambia la forma, no el
 * sistema.
 */
export default function Fab({ label, onClick }) {
  return (
    <button className="fab" aria-label={`Añadir ${label.toLowerCase()}`} onClick={() => { tap(); onClick() }}>
      <span className="mas" aria-hidden>+</span>
      <span className="que">{label}</span>
    </button>
  )
}
