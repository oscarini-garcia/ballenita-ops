// Puente con las capacidades nativas (Capacitor). TODO aquí es seguro en web:
// si no corremos dentro de la cáscara iOS, las funciones hacen no-op o usan el
// equivalente web (p. ej. navigator.share). Así la PWA y los tests no se rompen.
import { Capacitor } from '@capacitor/core'
import { cargarConfiguracion } from './config.js'

// URL del manifiesto OTA auto-alojado (GitHub Releases, ver .github/workflows/ota.yml
// y docs/IOS.md). `releases/latest/download/...` redirige siempre al último release.
//
// Se lee de `config.json` (clave `otaManifiesto`), que es configuración en caliente:
// así cambiar de dónde salen las actualizaciones **no exige publicar un OTA nuevo**
// —lo cual, tratándose del propio canal de actualización, sería tener que actualizar
// para poder actualizar—. La constante se queda de respaldo para cuando la clave no
// esté: sin ella, una configuración a medias dejaría a los móviles sin vía de
// actualizarse. Lo encontró el mapa del repositorio (§14.28): la clave llevaba desde
// julio declarada en `config.json` y sin que nadie la leyera, mientras `CLAUDE.md` la
// vendía como configuración en caliente.
const OTA_MANIFEST_POR_DEFECTO =
  'https://github.com/oscarini-garcia/ballenita-ops/releases/latest/download/latest.json'

export async function urlDelManifiestoOta() {
  try {
    const { otaManifiesto } = await cargarConfiguracion()
    if (typeof otaManifiesto === 'string' && otaManifiesto.trim()) return otaManifiesto.trim()
  } catch {
    /* sin configuración se usa el respaldo, que es lo que había antes */
  }
  return OTA_MANIFEST_POR_DEFECTO
}

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
    const res = await fetch(await urlDelManifiestoOta(), { cache: 'no-store' })
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
    // **`set()` no es lo que decía este comentario.** La documentación del
    // plugin es explícita: cambia el paquete y **recarga en el acto**,
    // destruyendo este contexto de JavaScript —«terminal operation»—. Aquí se
    // llamaba siempre, también en la comprobación de fondo de `initNative()`:
    // o sea que abrir la app con versión nueva la recargaba sola nada más
    // arrancar, y el `reload()` de la línea siguiente era código muerto porque
    // nunca llegaba a ejecutarse.
    //
    // Detrás del botón sí es lo que se quiere: quien lo toca ha venido a ver la
    // versión nueva ahora.
    if (aplicarYa) {
      await CapacitorUpdater.set(bundle)
      return { status: 'updated', version: manifest.version }
    }
    // En segundo plano no se interrumpe a nadie: `next()` lo deja armado para el
    // próximo arranque, que es lo que este código creía estar haciendo desde el
    // principio. `notifyAppReady()` (en `initNative`) confirma que arrancó bien
    // para que el plugin no lo devuelva.
    await CapacitorUpdater.next({ id: bundle.id })
    return { status: 'armed', version: manifest.version }
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

/**
 * Qué paquetes tiene el plugin y en qué estado, tal cual.
 *
 * Hasta ahora, cuando la app se quedaba en la versión de antes no había **nada**
 * que mirar: el manifiesto decía una cosa, el release estaba publicado, el
 * `bundle.zip` constaba descargado, y la pantalla seguía enseñando el número
 * viejo. Con eso no se puede decidir si el fallo está en la descarga, en
 * aplicarlo o en que el plugin lo ha devuelto.
 *
 * Y devolverlo es un caso real: capgo hace **rollback** al paquete anterior si
 * el nuevo no llama a `notifyAppReady()` a tiempo, y entonces se queda en
 * `error`. Eso, visto desde fuera, es exactamente «se descarga y no se queda».
 *
 * Se devuelve crudo a propósito —id, versión y estado de cada uno—: es un dato
 * para diagnosticar, no un rótulo, y resumirlo es lo que nos ha tenido a ciegas.
 */
export async function estadoDelPaquete() {
  if (!isNative()) return null
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    const [actual, lista] = await Promise.all([
      CapacitorUpdater.current().catch((e) => ({ error: String(e?.message ?? e) })),
      CapacitorUpdater.list().catch((e) => ({ error: String(e?.message ?? e) })),
    ])
    return {
      actual: actual?.bundle
        ? { version: actual.bundle.version, estado: actual.bundle.status, id: actual.bundle.id }
        : null,
      nativa: actual?.native ?? null,
      bundles: (lista?.bundles ?? []).map((b) => ({ version: b.version, estado: b.status, id: b.id })),
      error: actual?.error || lista?.error || null,
    }
  } catch (e) {
    return { error: String(e?.message ?? e) }
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
 * **Se coge del puente y no se importa**, y esto costó tres intentos. El
 * `import()` dinámico del paquete se quedaba colgado dentro de la cáscara —en la
 * consola de Xcode se veía llegar el `Haptics` del toque y ninguna llamada más—,
 * y era el único punto del camino sin plazo, así que la pantalla se quedaba en
 * «Pidiendo…» para siempre.
 *
 * `Capacitor.Plugins` ya tiene el objeto: lo registra la parte nativa al
 * arrancar, es exactamente el mismo que devolvería el paquete, y consultarlo no
 * pide ningún fichero a nadie. El `import()` se queda solo como reserva para la
 * web, y con plazo, porque ninguna llamada de este módulo puede no acabarse.
 *
 * Lo que **no** vale para saber si el plugin está: ni el `import()` —el
 * JavaScript viaja dentro del paquete OTA, así que importarlo funciona igual—,
 * ni `Capacitor.isPluginAvailable`, que devuelve `true` con que ese JavaScript
 * se haya registrado.
 */
async function plugin() {
  const delPuente = Capacitor?.Plugins?.PushNotifications
  if (delPuente) return delPuente
  try {
    const { PushNotifications } = await conPlazo(import('@capacitor/push-notifications'))
    return PushNotifications
  } catch {
    throw new Error(SIN_PLUGIN)
  }
}

export const PLAZOS = {
  // Lo que se le da al puente para contestar. Son objeto y no constantes para
  // que las pruebas puedan bajarlos a milisegundos: un plazo que solo se puede
  // probar esperando seis segundos de verdad no se prueba.
  puente: 6000,
  permiso: 15000,
  // Lo que se espera al identificador de APNs. Llega en menos de un segundo con
  // red; si no llega, es que no va a llegar.
  registro: 8000,
}

async function conPlazo(promesa, ms = PLAZOS.puente) {
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
  // Quince segundos: la hoja de iOS aparece en el acto o no aparece nunca, y
  // contestarla son dos toques. Si se agota, el diagnóstico es el mismo que el
  // de `plugin()` —falta la parte nativa— y por eso `conPlazo` lanza
  // `SIN_PLUGIN`. Y si alguien tardó de verdad más de quince segundos, el
  // permiso queda concedido igual y la pantalla se corrige sola al volver.
  const permiso = estado.receive === 'granted'
    ? estado
    : await conPlazo(PushNotifications.requestPermissions(), PLAZOS.permiso)
  if (permiso.receive !== 'granted') return null

  // El token no vuelve de `register()`: llega por un evento, y puede tardar.
  //
  // Los dos escuchas se **esperan** antes de pedir el registro. `addListener`
  // es asíncrono —devuelve el asa por promesa, cruzando el puente—, así que
  // llamar a `register()` sin esperarla deja abierta la carrera a que iOS
  // conteste antes de que su escucha exista. Perdido el evento, la pantalla
  // decía «Apple no devuelve identificador»: verdad, y sin ninguna utilidad.
  //
  // Y las asas se sueltan al acabar: esto corre en **cada arranque**
  // (`lib/push.js`), y unos escuchas que se acumulan son una fuga con forma de
  // token registrado dos veces.
  //
  // **Lo que falla, sube.** Aquí había un `catch` que devolvía `null` para todo
  // menos `SIN_PLUGIN`, y ese `null` es el que llegaba a la pantalla como «Apple
  // no devuelve identificador» sin decir por qué, teniendo el porqué escrito en
  // el evento de error. Un fallo con nombre es lo único que distingue «al
  // binario le falta el permiso de avisos» de «no hay red» (SPECS §14.9-bis).
  let dar
  let fallar
  const llegada = new Promise((resolve, reject) => { dar = resolve; fallar = reject })
  const asas = await Promise.all([
    PushNotifications.addListener('registration', ({ value }) => dar(value)),
    // Lo que dice Apple aquí es el diagnóstico entero —«no valid
    // 'aps-environment' entitlement string found in application's signature» es
    // literalmente la respuesta a por qué no llega ningún aviso—, y hasta ahora
    // se tiraba a la basura para devolver `null`.
    PushNotifications.addListener('registrationError', (e) => {
      fallar(new Error(`Apple rechazó el registro: ${e?.error || e?.message || 'sin motivo'}`))
    }),
  ])
  let reloj
  try {
    const plazo = new Promise((acaba) => { reloj = setTimeout(() => acaba(null), PLAZOS.registro) })
    await PushNotifications.register()
    return await Promise.race([llegada, plazo])
  } finally {
    clearTimeout(reloj)
    for (const asa of asas) await asa?.remove?.()
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
