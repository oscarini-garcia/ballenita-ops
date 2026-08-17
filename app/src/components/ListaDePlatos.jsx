import { porOrdenDeCarta, etiquetaCategoria, categoriaDe } from '../lib/carta.js'

/**
 * Los platos de una cena, **en el orden en que se comen y diciendo de qué es
 * cada uno** (`docs/diseño/hoy-el-dia.html` · L2).
 *
 * Antes una cena se enseñaba con el plato que manda y «y dos cosas más»: de tres
 * platos se nombraba uno. Y los que se nombraban salían en el orden en que
 * alguien los fue marcando, así que el postre podía ir primero.
 *
 * La categoría va a la derecha y apagada: es lo que hace que la lista se lea
 * como una carta y no como una lista de la compra. Un plato sin categoría no
 * dice nada — no se inventa un rótulo para él.
 */
export default function ListaDePlatos({ platos = [] }) {
  if (platos.length === 0) return null
  return (
    <ul className="lista-platos">
      {porOrdenDeCarta(platos).map((p) => (
        <li key={p.id ?? p.name}>
          <span className="n">{p.name}</span>
          {categoriaDe(p) && <span className="tipo">{etiquetaCategoria(categoriaDe(p))}</span>}
        </li>
      ))}
    </ul>
  )
}
