// Ballena propia y original (§11): sonriente, con chorro. NO es el logo del
// Camping La Ballena Alegre (marca registrada) — solo evoca el espíritu.
// El color sale de --whale, que cada tema (skin) define, así se adapta al aspecto.
export default function WhaleLogo({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" role="img" aria-label="Ballena Ops" style={{ color: 'var(--whale, #3cbdea)' }}>
      <g>
        <circle cx="22" cy="11" r="2" fill="currentColor" opacity=".7" />
        <circle cx="18.5" cy="7" r="1.4" fill="currentColor" opacity=".7" />
        <circle cx="25.5" cy="6.5" r="1.4" fill="currentColor" opacity=".7" />
      </g>
      <g transform="rotate(15 32 32)">
        <path
          d="M9 34c0-11 10-19 23-19 13 0 24 6 27 17 .5 2-1 3-3 2-4-2-8-3-8-3s3 6 2 10c-.3 1.6-2 2-3 .7l-4-5c-5 3-11 4-16 3C13 48 9 42 9 34Z"
          fill="currentColor"
        />
        <circle cx="21" cy="27.5" r="2.4" fill="#fff" />
        <circle cx="21.7" cy="27.9" r="1.15" fill="#04121a" />
        <path d="M10.5 32.4C13 40 22 40.4 25 33.4 20 36 15 36 10.5 32.4Z" fill="#fff" opacity=".9" />
      </g>
    </svg>
  )
}
