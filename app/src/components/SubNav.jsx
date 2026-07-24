import { tap } from '../lib/native.js'

// Control segmentado que vive bajo la cabecera, dentro de una pestaña, para
// dividir una sección en dos (p. ej. Dinero → Gastos / Saldos). Es el patrón
// que hace posible bajar la barra inferior a 5 destinos (Opción A de UX).
//
// options: [{ id, label }]  ·  value/onChange controlan la selección.
export default function SubNav({ value, onChange, options }) {
  return (
    <div className="subnav-wrap">
      <div className="subnav" role="tablist">
        {options.map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={value === o.id}
            className={value === o.id ? 'on' : ''}
            onClick={() => { tap(); onChange(o.id) }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
