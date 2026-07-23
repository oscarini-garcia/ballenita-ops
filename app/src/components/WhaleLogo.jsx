// Ballena propia y original (§11): cabezota sonriente, dentona y con chorro.
// Guiño al espíritu del Camping La Ballena Alegre, SIN copiar su logo (marca
// registrada). El color sale de --whale, que cada tema (skin) define, así se adapta.
export default function WhaleLogo({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 72 72" fill="none" role="img" aria-label="Ballena Ops" style={{ color: 'var(--whale, #38c6e8)' }}>
      <defs>
        <clipPath id="whaleGrin"><path d="M9 31 Q24 40 38 33 Q24 46 9 31 Z" /></clipPath>
      </defs>
      {/* cola rizada */}
      <path d="M34 40 C41 45 42 52 44 58 C49 55 55 56 60 54 C55 60 49 62 43 61 C45 65 41 67 38 64 C34 58 32 51 31 45 Z" fill="currentColor" />
      {/* cabezota */}
      <ellipse cx="26" cy="28" rx="19" ry="17" fill="currentColor" />
      {/* aletita del lomo */}
      <path d="M43 30 C49 28 53 29 55 27 C52 33 48 35 44 34 Z" fill="currentColor" />
      {/* chorro de 3 surtidores */}
      <g fill="currentColor">
        <path d="M20.5 13 C18.5 9 16.5 5.5 15 2.5 C16.8 5 18.8 8.5 22.5 13 Z" />
        <path d="M22.8 13 C22.6 8 23.2 4 24.6 1 C26.2 4 26.4 8 26.3 13 Z" />
        <path d="M26.5 13 C30.2 8.5 32.2 5 34 2.5 C32.5 5.5 30.5 9 28.5 13 Z" />
      </g>
      {/* ojo saltón */}
      <circle cx="33" cy="21" r="3.3" fill="#fff" />
      <circle cx="33.7" cy="21.4" r="1.55" fill="#04121a" />
      {/* sonrisa dentona */}
      <path d="M9 31 Q24 40 38 33 Q24 46 9 31 Z" fill="#fff" />
      <g clipPath="url(#whaleGrin)" stroke="currentColor" strokeWidth="1.3">
        <path d="M13 30 L15 47" />
        <path d="M18 31 L20 48" />
        <path d="M23 32 L24 48" />
        <path d="M28 32 L28.5 47" />
        <path d="M33 31 L33 45" />
      </g>
      <path d="M9 31 Q24 40 38 33" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
