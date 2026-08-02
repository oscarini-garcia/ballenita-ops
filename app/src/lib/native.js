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
export async function checkForOtaUpdate({ aplicarYa = false } = {}) {
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
    // Con `aplicarYa` no se espera a ese próximo arranque: `reload()` cambia al
    // paquete nuevo en el acto. Es lo que hace falta detrás de un botón que se
    // llama «Forzar la última versión», porque quien lo toca ha venido a verla
    // ahora y no la próxima vez que le apetezca abrir la app.
    if (aplicarYa) await CapacitorUpdater.reload().catch(() => {})
    return { status: 'updated', version: manifest.version }
  } catch (e) {
    return { status: 'error', error: String(e?.message ?? e) }
  }
}

/**
 * La versión del paquete OTA que está aplicado, que dentro de la app es **la
 * que cuenta**: la de `package.json` es la que se horneó en el binario, y con un
 * OTA encima ya no es la que se está ejecutando.
 */
export async function versionInstalada() {
  if (!isNative()) return null
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    return (await CapacitorUpdater.current())?.bundle?.version ?? null
  } catch {
    return null
  }
}

// --- Registro de push ------------------------------------------------------
//
// **Hay push, y llega por APNs directo desde nuestro Worker.** Aquí estuvieron
// OneSignal y su SDK, y se fueron antes del primer envío a la App Store por tres
// motivos: era un SDK de terceros de los que Apple obliga a declarar con
// manifiesto de privacidad firmado, ensuciaba unas etiquetas de privacidad que
// podían decir «sin analítica, sin rastreo y sin SDK de nadie», y pedía el
// permiso de notificaciones sin nada detrás, que es la peor manera de gastarlo.
//
// Vuelve sin ninguna de las tres cosas: `@capacitor/push-notifications` es el
// plugin oficial —no manda nada a ningún tercero, solo habla con iOS— y quien
// empuja es `api/src/apns.js`, que firma un JWT y llama a Apple. Es el camino de
// `garciadoral-ops`.
//
// **El permiso se pide cuando hay algo que avisar, no al arrancar.** `initNative`
// ya no lo hace: se pide desde Ajustes → Notificaciones, donde al lado está
// escrito qué se avisa. Un permiso que se pide en el primer segundo se contesta
// que no.
//
// Devuelve el token de APNs, o null si no hay permiso o esto no es la app
// nativa. Si **falta el plugin** —binario viejo, construido antes de que la
// dependencia existiera— lanza `SIN_PLUGIN`, y no devuelve null como todo lo
// demás: es la única causa que no se arregla desde el teléfono, y confundirla
// con «te lo han denegado» deja a alguien tocando un botón que no hace nada.
export const SIN_PLUGIN = 'sin-plugin'

/**
 * El plugin, o `SIN_PLUGIN` si este binario no lo trae.
 *
 * **Nada de esto se puede saber preguntando, y costó dos intentos.** El
 * `import()` no vale: el JavaScript del plugin viaja **dentro del paquete OTA**,
 * así que importarlo funciona aunque el binario no lleve su parte nativa. Y
 * `Capacitor.isPluginAvailable` tampoco: devuelve `true` con que el JavaScript
 * se haya registrado, que es justo lo que acaba de pasar al importarlo.
 *
 * Lo único que distingue de verdad es que **la llamada no vuelve**: sin
 * implementación nativa registrada, la promesa no se resuelve ni se rechaza. De
 * ahí que la comprobación de verdad sea `conPlazo`, y que las dos preguntas se
 * queden igualmente: cuestan nada y en algún caso contestarán antes.
 */
async function plugin() {
  if (Capacitor?.isPluginAvailable?.('PushNotifications') === false) throw new Error(SIN_PLUGIN)
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    return PushNotifications
  } catch {
    throw new Error(SIN_PLUGIN)
  }
}

/**
 * Una llamada nativa con plazo. Pasado el plazo, se da por no implementada.
 *
 * **Todas las llamadas al puente llevan uno**, incluida la que abre la hoja de
 * permiso de iOS. Esa la contesta una persona y por eso su plazo es largo, pero
 * no puede no tenerlo: si la hoja no llega a aparecer —que es lo que pasa cuando
 * falta la parte nativa— la promesa no vuelve nunca y la pantalla se queda en
 * «Pidiendo…» hasta que alguien mata la app. Un botón que puede colgarse para
 * siempre es peor que uno que se rinde y lo cuenta.
 */
async function conPlazo(promesa, ms = 6000) {
  let reloj
  try {
    return await Promise.race([
      promesa,
      new Promise((_, no) => { reloj = setTimeout(() => no(new Error(SIN_PLUGIN)), ms) }),
    ])
  } finally { clearTimeout(reloj) }
}

export async function registerPush() {
  if (!isNative()) return null
  const PushNotifications = await plugin()
  const estado = await conPlazo(PushNotifications.checkPermissions())
  try {
    // Quince segundos: la hoja de iOS aparece en el acto o no aparece nunca, y
    // contestarla son dos toques. Si se agota, el diagnóstico es el mismo que el
    // de `plugin()` —falta la parte nativa— y por eso `conPlazo` lanza
    // `SIN_PLUGIN`. Y si alguien tardó de verdad más de quince segundos, el
    // permiso queda concedido igual y la pantalla se corrige sola al volver.
    const permiso = estado.receive === 'granted'
      ? estado
      : await conPlazo(PushNotifications.requestPermissions(), 15000)
    if (permiso.receive !== 'granted') return null

    // El token no vuelve de `register()`: llega por un evento, y puede tardar.
    const token = await new Promise((resolve) => {
      const fin = setTimeout(() => resolve(null), 8000)
      PushNotifications.addListener('registration', ({ value }) => {
        clearTimeout(fin)
        resolve(value)
      })
      PushNotifications.addListener('registrationError', () => {
        clearTimeout(fin)
        resolve(null)
      })
      PushNotifications.register()
    })
    return token
  } catch (e) {
    // `SIN_PLUGIN` **sube**: es el único fallo que no se arregla desde el
    // teléfono y el que la pantalla tiene que contar. Tragárselo aquí lo
    // convertía en un «avisos apagados» cualquiera, que es mentira.
    if (e?.message === SIN_PLUGIN) throw e
    return null
  }
}

/**
 * ¿Puede este aparato recibir avisos, y los quiere? Sin pedir nada.
 *
 * `sin-plugin` es el caso que importa distinguir: la app es la nativa, pero el
 * binario se construyó antes de que existiera la dependencia, así que no hay
 * plugin que preguntar. Eso **no se arregla desde el teléfono** —hace falta
 * reinstalar—, y es justo lo que hay que decir en vez de callarlo.
 */
export async function estadoDePush() {
  if (!isNative()) return 'no-aplica'
  try {
    const PushNotifications = await plugin()
    const { receive } = await conPlazo(PushNotifications.checkPermissions())
    return receive // 'granted' · 'denied' · 'prompt' · 'prompt-with-rationale'
  } catch (e) {
    return e?.message === SIN_PLUGIN ? SIN_PLUGIN : 'no-aplica'
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
  // El permiso de avisos **no** se pide aquí: se pide en Ajustes → Notificaciones,
  // donde al lado está dicho qué se avisa (ver `registerPush`).
}
