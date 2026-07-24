// Fuerza que la PWA cargue la última versión desplegada sin tener que quitar y
// volver a añadir a la pantalla de inicio. Útil en iOS en modo standalone, donde
// el service worker no siempre se actualiza solo aunque el registro sea autoUpdate.
//
// Clave (y el bug que corrige): antes se borraban las cachés y se recargaba de
// inmediato, sin esperar a que el SW nuevo terminara de instalarse. En iOS el
// worker nuevo suele estar aún en `installing` en ese instante, así que la recarga
// la servía el SW viejo (con su precache ya borrado por debajo) y no traía lo
// nuevo. Ahora esperamos a que el SW nuevo se **active** y solo entonces recargamos;
// Workbox (skipWaiting + clientsClaim + limpieza de precache) hace el resto.

// Pasos del proceso, para pintar progreso en la UI en vez de un rebote mudo.
export const UPDATE_STEPS = {
  checking: '🔎 Buscando actualización…',
  downloading: '⬇️ Descargando nueva versión…',
  applying: '♻️ Aplicando y recargando…',
}

// onStatus(clave) recibe cada paso (claves de UPDATE_STEPS). `reload` se inyecta
// para poder testearlo. Devuelve 'updated' | 'reloaded'.
export async function forzarActualizacion(onStatus = () => {}, { reload = () => window.location.reload() } = {}) {
  const say = (s) => { try { onStatus(s) } catch { /* la UI se cayó: da igual */ } }
  say('checking')

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.update().catch(() => {})
        const nuevo = reg.installing || reg.waiting
        if (nuevo) {
          say('downloading')
          await esperaActivado(nuevo)
          // Con skipWaiting el SW nuevo ya se activa solo; el mensaje es por si
          // acaso quedara uno en espera (belt-and-suspenders, no-op si no aplica).
          nuevo.postMessage?.({ type: 'SKIP_WAITING' })
          say('applying')
          reload()
          return 'updated'
        }
      }
    }
  } catch {
    // Da igual el motivo: caemos al último recurso.
  }

  // No apareció un worker nuevo (o no hay SW). Último recurso: limpiar cachés y
  // recargar para intentar traer lo último del servidor. iOS es caprichoso.
  say('applying')
  await limpiarCaches()
  reload()
  return 'reloaded'
}

// Resuelve cuando el worker llega a 'activated' (o queda 'redundant'). Con un
// tope de tiempo para no colgarnos si el evento no llega en iOS.
function esperaActivado(worker, timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (worker.state === 'activated') return resolve()
    let hecho = false
    const fin = () => {
      if (hecho) return
      hecho = true
      worker.removeEventListener?.('statechange', onChange)
      resolve()
    }
    const onChange = () => { if (worker.state === 'activated' || worker.state === 'redundant') fin() }
    worker.addEventListener?.('statechange', onChange)
    setTimeout(fin, timeoutMs)
  })
}

async function limpiarCaches() {
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    } catch {
      /* da igual: recargamos igualmente */
    }
  }
}
