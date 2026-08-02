/**
 * Los dibujos de la app, en una sola tabla.
 *
 * Sustituyen a los emoji del cromo, que traían su propia paleta puesta, medían
 * distinto en iOS y en el navegador y no se recoloreaban con el tema. Los emoji
 * que **eliges tú** —tu avatar, tu estado, el de una familia— se quedan: ahí el
 * emoji es contenido y no cromo.
 *
 * Todos van sobre rejilla de 24 con trazo de 1,8, que es el que ya usaba la
 * barra de abajo. El color lo pone quien los coloca (`currentColor`), así que un
 * icono no sabe de qué color es: lo decide la clase `.ico` y su `data-cat`.
 *
 * Ver `docs/diseño/iconos.html`, opción I4.
 */
const DIBUJOS = {
  // ── Categorías de gasto ──
  bebida: <><path d="M4.8 6.6h9.4v11.6A1.8 1.8 0 0 1 12.4 20H6.6a1.8 1.8 0 0 1-1.8-1.8z" /><path d="M14.2 9.4h2.4a2.5 2.5 0 0 1 0 5h-2.4" /><path d="M4.8 10.4h9.4" /></>,
  compra: <><path d="M3 5h2l2.2 9.6a2 2 0 0 0 2 1.4h7.2a2 2 0 0 0 2-1.5L20 8H6" /><circle cx="10" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></>,
  comida: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.6" /></>,
  restaurante: <><path d="M7 3.5v6a2.5 2.5 0 0 0 2.5 2.5v8" /><path d="M7 3.5v5.5M11 3.5v5.5" /><path d="M16.8 3.5c-1.4 2.2-1.4 6 0 8.2v8.3" /></>,
  varios: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M4 11.6h16M12 7v13" /></>,

  // ── Cromo: los apartados de Ajustes y los verbos de una fila ──
  sincronizar: <><path d="M20 11a8 8 0 0 0-13.7-5.3L3 9" /><path d="M4 13a8 8 0 0 0 13.7 5.3L21 15" /><path d="M3 4v5h5M21 20v-5h-5" /></>,
  aspecto: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18" fill="currentColor" stroke="none" opacity=".22" /></>,
  persona: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  evento: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4" /></>,
  grafico: <><path d="M4 20V11M10 20V4M16 20v-6M21.5 20h-19" /></>,
  familia: <><circle cx="8.5" cy="8" r="3.2" /><path d="M3 20a5.5 5.5 0 0 1 11 0" /><path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M16 14.8A5.5 5.5 0 0 1 21 20" /></>,
  casa: <><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9.6V19a1.4 1.4 0 0 0 1.4 1.4h9.2A1.4 1.4 0 0 0 18 19V9.6" /><path d="M10 20.4v-5.2h4v5.2" /></>,
  llave: <><circle cx="8" cy="14" r="4" /><path d="M11 11.2 19 3.5M16.5 6l2.2 2.2M14.5 8l2.2 2.2" /></>,
  // Cuerpo cerrado, cola y chorro. Tres trazos sueltos no se leían a 30 px:
  // hacía falta una silueta, no un esquema.
  ballena: <>
    <path d="M2.9 12.9c0-3.1 3.2-5.3 7.2-5.3 4.5 0 7.6 2.6 9 5.3-1.4 2.7-4.5 5.3-9 5.3-4 0-7.2-2.2-7.2-5.3z" />
    <path d="M19.1 12.9c.9-.7 2-1 3.1-.9-.5 1.2-.5 2.4 0 3.6-1.2 0-2.3-.5-3.1-1.4" />
    <path d="M9.6 7.4c0-1.2.5-2.2 1.5-2.9" />
    <circle cx="7.3" cy="11.7" r=".85" fill="currentColor" stroke="none" />
  </>,
  lapiz: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M14.5 6 18 9.5" /></>,
  papelera: <><path d="M4 6.5h16M9.5 6.5V4h5v2.5" /><path d="M6.5 6.5 7.6 20a1.5 1.5 0 0 0 1.5 1.4h5.8a1.5 1.5 0 0 0 1.5-1.4l1.1-13.5" /><path d="M10.5 10.5v7M13.5 10.5v7" /></>,
  visto: <><path d="M4.8 12.6 9.6 17.4 19.2 6.6" /></>,
}

export default function Icono({ nombre, className = '' }) {
  const d = DIBUJOS[nombre]
  if (!d) return null
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {d}
    </svg>
  )
}

/** Los nombres que existen, para que un test pueda comprobarlos todos. */
export const NOMBRES = Object.keys(DIBUJOS)
