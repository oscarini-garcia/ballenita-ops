import { isNative, tap } from '../lib/native.js'

// Punto de estado de la sincronización: color + ayuda + si conviene animar.
//
// **Sin red dice cuántos cambios esperan**, y no solo que los hay. La cola sin
// cobertura crece —una comida, tres gastos, un plan— y «cambios sin subir» dice
// lo mismo con uno que con veinte; el número es lo que hace esperar a tener
// cobertura en vez de dar por perdido lo apuntado y volver a teclearlo. Va en el
// punto, en su rótulo y en su renglón, porque el punto es lo único que se ve sin
// entrar en Ajustes.
//
// Los rótulos son cortos a propósito: el punto vive en la cabecera y su título
// se pinta también como el nombre de una fila en Ajustes, donde «Solo local (sin
// sincronización)» no cabía y se cortaba. Lo largo va en `detalle`, que sí tiene
// sitio para dos renglones.
// 🟢 al día · 🟡 conectado con cambios encolados · 🔴 sin red · ⚪ solo local.
//
// Los colores salen de las variables del tema (no hex sueltos) para que el
// punto se recoloree con la skin como todo lo demás.

/** «1 cambio» · «14 cambios». En cifras porque es una cantidad que se compara. */
export function enCambios(n) {
  return `${n} ${n === 1 ? 'cambio' : 'cambios'}`
}

export function estadoSync(sync = {}) {
  // `pendientes` puede no venir —tests, y la ficha de Ajustes cuando todavía no
  // hay motor—, y entonces solo se sabe si hay algo, que es lo de siempre.
  const n = Number.isFinite(sync.pendientes) ? sync.pendientes : null
  if (!sync.isConfigured) {
    return {
      color: 'var(--ink-faint)',
      title: 'Solo local',
      detalle: isNative()
        ? 'Los datos se quedan en este dispositivo.'
        : 'Los datos se quedan en este dispositivo: el grupo se sincroniza desde la app de iOS.',
      checking: false,
    }
  }
  // Hay API, pero este móvil todavía no ha entrado (modo local en iOS). Decir
  // «conectado y al día» aquí sería mentir: no sube nada a ningún sitio.
  if (sync.status === 'sin-sesion') {
    return {
      color: 'var(--ink-faint)',
      title: 'Modo local (sin entrar)',
      detalle: n
        ? `${enCambios(n)} esperando. Subirán cuando entres con Apple.`
        : 'Se guarda aquí y subirá cuando entres con Apple.',
      checking: false,
      cuenta: n || 0,
    }
  }
  if (!sync.online || sync.status === 'offline') {
    return {
      color: 'var(--owe)',
      title: n ? `Sin conexión · ${enCambios(n)}` : 'Sin conexión',
      detalle: n
        ? `${enCambios(n)} esperando a que vuelva la red. No se pierde ninguno.`
        : 'Nada pendiente: se sincronizará al recuperar la red.',
      checking: false,
      cuenta: n || 0,
    }
  }
  if (sync.status === 'sesion-caducada') {
    return {
      color: 'var(--owe)',
      title: 'Sesión caducada',
      detalle: n ? `${enCambios(n)} esperando. Vuelve a entrar con Apple.` : 'Vuelve a entrar con Apple.',
      checking: false,
      cuenta: n || 0,
    }
  }
  if (sync.status === 'syncing' || sync.status === 'busy') {
    return { color: 'var(--gold)', title: 'Sincronizando…', detalle: 'Un momento.', checking: true }
  }
  if (sync.status === 'error') {
    return {
      color: 'var(--gold)',
      title: 'Error al sincronizar',
      detalle: n ? `${enCambios(n)} sin subir. Toca para reintentar.` : 'Toca para reintentar.',
      checking: false,
      cuenta: n || 0,
    }
  }
  if (sync.dirty) {
    return {
      color: 'var(--gold)',
      title: n ? enCambios(n) + ' sin subir' : 'Cambios sin subir',
      detalle: 'Toca para subirlos ahora.',
      checking: false,
      cuenta: n || 0,
    }
  }
  return { color: 'var(--owed)', title: 'Al día', detalle: 'Nada pendiente de subir.', checking: false }
}

export default function SyncDot({ sync, onClick }) {
  const d = estadoSync(sync)
  return (
    <button
      className={`sync-dot${d.checking ? ' checking' : ''}`}
      title={`${d.title}. ${d.detalle}`}
      aria-label={d.title}
      onClick={() => { tap(); onClick?.() }}
    >
      <span className="d" style={{ background: d.color }} />
      {/* El número al lado del punto: es lo único de la sincronización que se ve
          sin entrar en Ajustes, y sin él «hay cosas sin subir» y «hay quince
          cosas sin subir» se ven exactamente igual. */}
      {d.cuenta > 0 && (
        // Tope en 99: el punto vive en una cabecera de 390 pt y un número de
        // cuatro cifras la empujaría. Pasado ese punto la cantidad exacta ya no
        // decide nada —son muchos, y hay que buscar cobertura igual—.
        <span className="cuenta tnum" style={{ color: d.color }}>{d.cuenta > 99 ? '99+' : d.cuenta}</span>
      )}
    </button>
  )
}
