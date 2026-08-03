import { aliasDe } from '../lib/alias.js'

/**
 * El alias de una familia, en pastilla y con su color
 * (`docs/diseño/planes-ideas.html` · B3).
 *
 * Dos letras y no el nombre entero porque «García» no cabe al lado de un nombre
 * de persona y una fecha en una línea de 15,7 pt. Y en pastilla y no en texto
 * corrido porque «Curro GA» leído deprisa parece un apellido: lo que se busca es
 * que tres cosas de la misma familia se vean **sin leer ningún nombre**.
 *
 * El color de la familia solo tiñe el fondo; la letra se mezcla con la tinta del
 * tema, que es lo que hace que las dos letras se lean igual de bien en la cara
 * clara y en la oscura sin tener que elegir un color por cara.
 *
 * Vive en un componente porque lo usan dos pantallas —la firma de una idea y
 * quién ha votado un plan— y el `color-mix` a mano en dos sitios se desincroniza
 * en cuanto alguien toca uno.
 */
export default function Alias({ familia }) {
  if (!familia) return null
  return (
    <span
      className="alias"
      style={{
        background: `color-mix(in srgb, ${familia.color} 20%, transparent)`,
        color: `color-mix(in srgb, ${familia.color} 55%, var(--ink))`,
      }}
    >
      {aliasDe(familia)}
    </span>
  )
}
