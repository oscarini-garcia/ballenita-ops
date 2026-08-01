// Puente con las capacidades nativas (Capacitor). TODO aquí es seguro en web:
// si no corremos dentro de la cáscara iOS, las funciones hacen no-op o usan el
// equivalente web (p. ej. navigator.share). Así la PWA y los tests no se rompen.
import { Capacitor } from '@capacitor/core'

// URL del manifiesto OTA auto-alojado (GitHub Releases, ver .github/workflows/ota.yml
// y docs/IOS.md). `releases/latest/download/...` redirige siempre al último release.
const OTA_MANIFEST_URL =
  'https://github.com/oscarini-garcia/ballenita-ops/releases/latest/download/latest.json'

// Endpoint propio para avisar al grupo. Hoy no hay ninguno declarado, así que
// `notifyGroup` es un no-op; ver el comentario de `registerPush`.
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

// --- Registro de push ------------------------------------------------------
//
// **Hoy no hay push, y es una decisión, no un olvido.** Aquí estaban OneSignal y
// `@capacitor/push-notifications`, los dos con código nativo y los dos inertes:
// sin `VITE_ONESIGNAL_APP_ID` no se inicializaba nada y no había servidor que
// enviara ningún aviso. Se retiraron antes del primer envío a la App Store por
// tres motivos, en orden de peso:
//
//   1. OneSignal es un SDK de terceros de los que Apple obliga a declarar —con
//      su manifiesto de privacidad firmado— desde 2024, y las etiquetas de
//      privacidad de la ficha tendrían que recoger lo que recopila. Todo eso por
//      una función que nadie estaba usando.
//   2. Sin él, la ficha puede decir la verdad más limpia posible: sin analítica,
//      sin rastreo y sin SDK de nadie dentro del binario.
//   3. Un plugin de avisos en el binario invita a iOS a pedir el permiso de
//      notificaciones sin nada detrás, que es la peor manera de gastarlo.
//
// Volver a ponerlo es `npm install`, reponer esta función, `npm run sync:ios` y
// **un binario nuevo con su revisión**: los plugins nativos no viajan por OTA.
// El día que se haga, el camino corto es el de garciadoral-ops —APNs directo
// desde el Worker, sin intermediario—, que evita el SDK de terceros entero.
export async function registerPush() {
  return null
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
