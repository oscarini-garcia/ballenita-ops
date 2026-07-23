// Icono de Ballena Ops: "B" de Ballena como marca de agua + emoji de ballena
// con chorro delante. En dispositivos Apple el emoji se pinta con Apple Color
// Emoji automáticamente. Mismo dibujo que el favicon/icono de la app.
export default function WhaleLogo({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 96 96" role="img" aria-label="Ballena Ops">
      <rect width="96" height="96" rx="22" fill="#08202c" />
      <text x="48" y="50" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="92" textAnchor="middle" dominantBaseline="central" fill="#173a54">B</text>
      <text x="48" y="54" fontFamily="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" fontSize="60" textAnchor="middle" dominantBaseline="central">🐳</text>
    </svg>
  )
}
