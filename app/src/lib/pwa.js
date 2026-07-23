// Fuerza que la PWA cargue la última versión desplegada sin tener que quitar y
// volver a añadir a la pantalla de inicio. Útil en iOS en modo standalone, donde
// el service worker no siempre se actualiza solo aunque el registro sea autoUpdate.
//
// Qué hace: busca una versión nueva del service worker y la activa saltando la
// espera, borra las cachés (precache de Workbox incluida) y recarga desde el
// servidor. El `reload` se inyecta para poder testearlo.
export async function forzarActualizacion(reload = () => window.location.reload()) {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.update().catch(() => {})))
      regs.forEach((r) => r.waiting?.postMessage?.({ type: 'SKIP_WAITING' }))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    // Da igual el motivo: recargamos igualmente para intentar traer lo último.
  } finally {
    reload()
  }
}
