// Puente con las capacidades nativas (Capacitor). TODO aquí es seguro en web:
// si no corremos dentro de la cáscara iOS, las funciones hacen no-op o usan el
// equivalente web (p. ej. navigator.share). Así la PWA y los tests no se rompen.
import { Capacitor } from '@capacitor/core'

// URL del manifiesto OTA auto-alojado (GitHub Releases, ver .github/workflows/ota.yml
// y docs/IOS.md). `releases/latest/download/...` redirige siempre al último release.
const OTA_MANIFEST_URL =
  'https://github.com/oscarini-garcia/ballenita-ops/releases/latest/download/latest.json'

// Push vía OneSignal. La App ID es pública (segura en el cliente). El envío se hace
// desde el panel de OneSignal (manual) o desde un endpoint serverless propio que
// guarde la REST key (VITE_PUSH_ENDPOINT); NUNCA se incrusta la REST key aquí. Sin
// VITE_ONESIGNAL_APP_ID, la app funciona igual pero sin push (como el modo local).
const ONESIGNAL_APP_ID = import.meta.env?.VITE_ONESIGNAL_APP_ID
const PUSH_ENDPOINT = import.meta.env?.VITE_PUSH_ENDPOINT

export function isNative() {
  try {
    return Capacitor?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

// --- Háptica ---------------------------------------------------------------
// Vibración sutil al tocar. En web usa la Vibration API si existe; si no, nada.
export async function tap(style = 'light') {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
    await Haptics.impact({ style: map[style] ?? ImpactStyle.Light })
  } catch {
    /* dispositivo sin háptica: no pasa nada */
  }
}

// --- Compartir -------------------------------------------------------------
// Hoja nativa de iOS; en web cae a navigator.share cuando está disponible.
// Devuelve true si se compartió, false si no se pudo o el usuario canceló.
export async function share({ title, text, url, dialogTitle } = {}) {
  try {
    const { Share } = await import('@capacitor/share')
    const can = await Share.canShare()
    if (!can?.value) throw new Error('share no disponible')
    await Share.share({ title, text, url, dialogTitle })
    return true
  } catch {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text, url })
        return true
      }
    } catch {
      /* cancelado o sin soporte */
    }
    return false
  }
}

// --- OTA (updates de JS sin pasar por Apple) -------------------------------
// Flujo manual auto-alojado: leemos latest.json (versión + url del zip + checksum),
// y si es más nuevo que el bundle instalado, lo descargamos y aplicamos. Solo en
// nativo; en web/PWA el service worker ya se encarga de actualizar.
export async function checkForOtaUpdate() {
  if (!isNative()) return { status: 'skip' }
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    const current = await CapacitorUpdater.current()
    const res = await fetch(OTA_MANIFEST_URL, { cache: 'no-store' })
    if (!res.ok) return { status: 'no-manifest' }
    const manifest = await res.json() // { version, url, checksum }
    const installed = current?.bundle?.version
    if (!manifest?.version || !manifest?.url || manifest.version === installed) {
      return { status: 'up-to-date', version: installed }
    }
    const bundle = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
      checksum: manifest.checksum,
    })
    // Se aplica en la próxima carga/apertura; notifyAppReady() (en initNative)
    // confirma que arrancó bien para que el plugin no haga rollback.
    await CapacitorUpdater.set(bundle)
    return { status: 'updated', version: manifest.version }
  } catch (e) {
    return { status: 'error', error: String(e?.message ?? e) }
  }
}

// --- Registro de push (OneSignal) ------------------------------------------
// Inicializa OneSignal y suscribe el dispositivo. Con esto ya puedes enviar
// avisos a mano desde el panel de OneSignal. El envío automático es fase aparte
// (ver notifyGroup + docs/IOS.md). Devuelve 'onesignal' | 'apns' | null.
export async function registerPush() {
  if (!isNative()) return null
  // Camino recomendado: OneSignal (gestiona APNs por ti).
  if (ONESIGNAL_APP_ID) {
    try {
      const OneSignal = (await import('onesignal-cordova-plugin')).default
      OneSignal.initialize(ONESIGNAL_APP_ID)
      await OneSignal.Notifications.requestPermission(true)
      return 'onesignal'
    } catch {
      /* cae al registro APNs crudo */
    }
  }
  // Fallback sin OneSignal: registro APNs crudo (solo obtiene el token).
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return null
    await PushNotifications.register()
    return 'apns'
  } catch {
    return null
  }
}

// --- Aviso al grupo (envío automático, opcional) ---------------------------
// Pide a TU endpoint serverless (que guarda la REST key de OneSignal) que mande
// un push al grupo. No-op si no hay VITE_PUSH_ENDPOINT configurado. Así la REST
// key nunca vive en el cliente público. Pensado para llamarlo tras sincronizar
// un hecho nuevo (p. ej. un gasto). Devuelve true si se aceptó el envío.
export async function notifyGroup({ title, message, url } = {}) {
  if (!PUSH_ENDPOINT) return false
  try {
    const res = await fetch(PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, url }),
    })
    return res.ok
  } catch {
    return false
  }
}

// --- Arranque nativo -------------------------------------------------------
// Llamar una vez al iniciar la app. En web no hace nada.
export async function initNative() {
  if (!isNative()) return
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    await CapacitorUpdater.notifyAppReady() // evita rollback del bundle OTA
  } catch {
    /* plugin no disponible */
  }
  checkForOtaUpdate() // en segundo plano
  registerPush() // permiso + token (envío = fase posterior)
}
