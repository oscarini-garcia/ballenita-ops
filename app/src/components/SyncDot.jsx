import { isNative, tap } from '../lib/native.js'

// Punto de estado de la sincronización: color + ayuda + si conviene animar.
//
// Los rótulos son cortos a propósito: el punto vive en la cabecera y su título
// se pinta también como el nombre de una fila en Ajustes, donde «Solo local (sin
// sincronización)» no cabía y se cortaba. Lo largo va en `detalle`, que sí tiene
// sitio para dos renglones.
// 🟢 al día · 🟡 conectado con cambios encolados · 🔴 sin red · ⚪ solo local.
//
// Los colores salen de las variables del tema (no hex sueltos) para que el
// punto se recoloree con la skin como todo lo demás.
export function estadoSync(sync = {}) {
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
      detalle: 'Se guarda aquí y subirá cuando entres con Apple.',
      checking: false,
    }
  }
  if (!sync.online || sync.status === 'offline') {
    return { color: 'var(--owe)', title: 'Sin conexión', detalle: 'Se subirá todo al recuperar la red.', checking: false }
  }
  if (sync.status === 'sesion-caducada') {
    return { color: 'var(--owe)', title: 'Sesión caducada', detalle: 'Vuelve a entrar con Apple.', checking: false }
  }
  if (sync.status === 'syncing' || sync.status === 'busy') {
    return { color: 'var(--gold)', title: 'Sincronizando…', detalle: 'Un momento.', checking: true }
  }
  if (sync.status === 'error') {
    return { color: 'var(--gold)', title: 'Error al sincronizar', detalle: 'Toca para reintentar.', checking: false }
  }
  if (sync.dirty) {
    return { color: 'var(--gold)', title: 'Cambios sin subir', detalle: 'Toca para subirlos ahora.', checking: false }
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
    </button>
  )
}
