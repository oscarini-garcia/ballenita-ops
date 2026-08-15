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
/**
 * ¿Hay versión nueva publicada? Pregunta y ya (SPECS §14.46).
 *
 * Es la mitad barata de `checkForOtaUpdate`: lee el manifiesto —un JSON de 204
 * bytes— y lo compara con el paquete instalado, **sin descargar** los 380 KB
 * del bundle. Por eso se puede preguntar cada minuto; bajar cada minuto no.
 *
 * En web devuelve que no hay nada: allí la versión la sirve el servidor al
 * recargar y de eso se encarga el service worker (`lib/pwa.js`).
 */
export async function hayOtaNueva() {
  if (!isNative()) return { hay: false }
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    const current = await CapacitorUpdater.current()
    const res = await fetch(await urlDelManifiestoOta(), { cache: 'no-store' })
    if (!res.ok) return { hay: false }
    const manifest = await res.json()
    const instalada = current?.bundle?.version
    if (!manifest?.version || !manifest?.url) return { hay: false }
    return manifest.version === instalada
      ? { hay: false, version: instalada }
      : { hay: true, version: manifest.version }
  } catch {
    // Sin red, o con el manifiesto caído, no hay noticia que dar: se vuelve a
    // preguntar al minuto siguiente y punto.
    return { hay: false }
  }
}

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
 * El plugin, o `SIN_PLUGIN` si este binario no lo trae. **Sin esperar nada.**
 *
 * **Se coge del puente y no se importa**, y esto costó cuatro intentos. El
 * `import()` dinámico del paquete se quedaba colgado dentro de la cáscara —en la
 * consola de Xcode se veía llegar el `Haptics` del toque y ninguna llamada más—.
 * Se le puso plazo, y con eso dejó de ser eterno; pero seguía siendo **la
 * respuesta equivocada esperada durante seis segundos**, que en pantalla es un
 * renglón en curso sin nada detrás. La cuarta vez el renglón lo dijo: se paraba
 * aquí, en el primer eslabón, y no en ninguno de los otros tres.
 *
 * Dentro de la cáscara **la ausencia es la respuesta**. La parte nativa de
 * Capacitor escribe `Capacitor.Plugins.<nombre>` para cada plugin registrado
 * antes de que corra una línea de esta aplicación (`JSExport.swift`, guiones de
 * usuario `atDocumentStart`). Si el objeto no está, el plugin no está en este
 * binario: es instantáneo, es cierto, y es justo lo que hay que decir —hace
 * falta instalar un binario nuevo, y eso no se arregla desde el teléfono ni con
 * un paquete OTA—.
 *
 * Lo que **no** vale para saber si el plugin está: ni el `import()` —el
 * JavaScript viaja dentro del paquete OTA, así que importarlo funciona igual, y
 * el objeto que devuelve llama a una parte nativa que no existe—, ni
 * `Capacitor.isPluginAvailable`, que devuelve `true` con que ese JavaScript se
 * haya registrado.
 */
function plugin() {
  const delPuente = Capacitor?.Plugins?.PushNotifications
  if (!delPuente) throw new Error(SIN_PLUGIN)
  return delPuente
}

/**
 * Qué se ve desde aquí, para el renglón que se copia.
 *
 * Cuando falta el plugin, «esta instalación no puede avisar» es la conclusión;
 * esto es en qué se basa. Los nombres de lo que **sí** trae el puente separan
 * las dos causas que se ven igual desde el móvil: si están `Haptics` y
 * `Share` pero no `PushNotifications`, el binario es anterior al plugin; si no
 * está ninguno, lo que falla es el puente entero y los avisos son lo de menos.
 */
export function informeDelPuente() {
  try {
    const puente = Capacitor?.Plugins
    return [
      `plataforma: ${Capacitor?.getPlatform?.() ?? '?'}`,
      `nativo: ${isNative()}`,
      `PushNotifications en el puente: ${Boolean(puente?.PushNotifications)}`,
      `plugins del puente: ${puente ? Object.keys(puente).sort().join(', ') || '(ninguno)' : '(no hay puente)'}`,
    ].join('\n')
  } catch (e) {
    return `no se ha podido mirar el puente: ${e?.message ?? e}`
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
  // Lo que se le da a un aviso para cruzar Apple y volver. Va holgado a
  // propósito: aquí no se está diagnosticando el aparato sino la entrega, y APNs
  // no promete cuándo.
  aviso: 12000,
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

/**
 * Los cuatro eslabones del registro, en el orden en que se recorren. La pantalla
 * los pinta con estas claves (`screens/CuentasSection.jsx`): «se ha colgado» sin
 * decir dónde no se puede arreglar, y son cuatro sitios distintos con cuatro
 * arreglos distintos. `servidor` no es de aquí —lo añade `lib/push.js`—, pero se
 * nombra en el mismo sitio para que el orden esté escrito una sola vez.
 */
export const PASOS_DE_PUSH = ['plugin', 'permiso', 'apple', 'servidor']

/**
 * Qué significa que Apple no conteste **nada**, que es distinto de que conteste
 * que no.
 *
 * Las dos pantallas que lo enseñaban decían cosas distintas y las dos
 * adivinaban: una, «suele ser que al binario le falta el permiso de avisos»; la
 * otra, «suele ser que no hay red». La primera es directamente falsa y por eso
 * está escrito aquí una sola vez: **un `aps-environment` que falta no da
 * silencio, da un `registrationError` con palabras** —«no valid 'aps-environment'
 * entitlement string found in application's signature»—, y ese camino ya se
 * cuenta entero.
 *
 * El silencio tiene otras causas, y la primera es la que más veces es: el
 * `AppDelegate` del binario instalado no reenvía la respuesta de APNs. Es lo que
 * repone `scripts/appdelegate.mjs` en cada `sync:ios`, y no viaja por OTA.
 */
/**
 * Que Apple lo acepte y que el teléfono lo reciba son **dos cosas**, y hasta
 * ahora la prueba solo sabía la primera: «mandado» es un 200 del servidor de
 * APNs y nada más. El tramo de después no se miraba, y ahí está la causa que más
 * veces es —el entorno—, que además no da ningún error: APNs contesta que sí y
 * tira el aviso.
 */
export const SIN_ENTREGA = [
  'Apple lo aceptó y no ha llegado a este móvil en doce segundos.',
  'Lo primero a mirar es el entorno: un binario instalado desde Xcode firma «development» y el Worker tiene que hablar con el APNs de pruebas (APNS_ENTORNO), mientras que uno de TestFlight o la App Store firma «production».',
  'Si no coinciden, Apple acepta el envío y no entrega nada.',
  'Después, el modo concentración y los avisos de la app en los Ajustes de iOS.',
].join(' ')

export const SIN_TOKEN_PORQUE = [
  'Permiso dado, y Apple no ha contestado ni con identificador ni con error en ocho segundos.',
  'No es un permiso que le falte al binario: eso llega con mensaje, no con silencio.',
  'Suele ser que el AppDelegate del binario instalado no reenvía la respuesta de APNs —se repone con «npm run sync:ios» y hay que volver a instalar desde Xcode—.',
  'También calla un móvil sin red, y el simulador de iOS, que no da identificador.',
].join(' ')

/**
 * El identificador de APNs de este aparato, o `null`.
 *
 * `alPaso` recibe la clave de cada eslabón **al empezarlo**, para que quien
 * llame pueda enseñar en qué va. No devuelve nada y nunca se espera: si quien
 * escucha rompe, eso no es asunto del registro.
 */
export async function registerPush({ alPaso } = {}) {
  if (!isNative()) return null
  const paso = (clave) => { try { alPaso?.(clave) } catch { /* pintar no puede romper esto */ } }

  paso('plugin')
  const PushNotifications = plugin()

  paso('permiso')
  const estado = await conPlazo(PushNotifications.checkPermissions())
  // Denegado se contesta aquí y no se vuelve a preguntar. iOS enseña su hoja una
  // sola vez en la vida de la instalación: `requestPermissions()` con el permiso
  // ya denegado devuelve «denied» sin abrir nada, y pedirlo otra vez solo sirve
  // para que el paso parezca que espera algo que nunca va a pasar.
  if (estado.receive === 'denied') return null
  // Quince segundos: la hoja de iOS aparece en el acto o no aparece nunca, y
  // contestarla son dos toques. Si se agota, el diagnóstico es el mismo que el
  // de `plugin()` —falta la parte nativa— y por eso `conPlazo` lanza
  // `SIN_PLUGIN`. Y si alguien tardó de verdad más de quince segundos, el
  // permiso queda concedido igual y la pantalla se corrige sola al volver.
  const permiso = estado.receive === 'granted'
    ? estado
    : await conPlazo(PushNotifications.requestPermissions(), PLAZOS.permiso)
  if (permiso.receive !== 'granted') return null

  paso('apple')

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
  // **Con plazo, como todo lo que cruza el puente.** `addListener` es una
  // llamada nativa más, y un `await` sin carrera sobre una llamada nativa es la
  // única forma que tiene este módulo de quedarse quieto para siempre.
  const asas = await conPlazo(Promise.all([
    PushNotifications.addListener('registration', ({ value }) => dar(value)),
    // Lo que dice Apple aquí es el diagnóstico entero —«no valid
    // 'aps-environment' entitlement string found in application's signature» es
    // literalmente la respuesta a por qué no llega ningún aviso—, y hasta ahora
    // se tiraba a la basura para devolver `null`.
    PushNotifications.addListener('registrationError', (e) => {
      fallar(new Error(`Apple rechazó el registro: ${e?.error || e?.message || 'sin motivo'}`))
    }),
  ]))
  let reloj
  try {
    const plazo = new Promise((acaba) => { reloj = setTimeout(() => acaba(null), PLAZOS.registro) })
    // **`register()` no se espera**, y esta línea es la corrección: estaba
    // `await` justo delante de la carrera, así que el reloj corría y no lo miraba
    // nadie —si la llamada no volvía, no se llegaba nunca al `Promise.race` y la
    // pantalla se quedaba «Pidiendo…» sin final—. Lo que interesa de `register()`
    // no es cuándo vuelve, que es en el acto y sin dato, sino lo que llega
    // después por el evento; y si rompe, rompe por el mismo sitio que un
    // `registrationError`. Es la figura de `garciadoral-ops`, donde una sola
    // promesa se contesta desde donde llegue la respuesta: token, error o reloj.
    Promise.resolve(PushNotifications.register()).catch((e) => {
      fallar(new Error(`No se pudo pedir el registro a Apple: ${e?.message ?? e}`))
    })
    return await Promise.race([llegada, plazo])
  } finally {
    clearTimeout(reloj)
    for (const asa of asas) await asa?.remove?.()
  }
}

/**
 * Un oído puesto a que llegue un aviso, que es el eslabón que faltaba por mirar.
 *
 * «Mandado» era todo lo que sabía decir la prueba, y eso es solo que **Apple lo
 * aceptó**: un 200 del servidor de APNs. Entre eso y que el teléfono lo enseñe
 * hay un tramo entero que no se estaba mirando, y en el que cabe justo lo que
 * pasaba —el aviso llega y **con la aplicación abierta iOS no pinta nada**, a
 * menos que se declaren `presentationOptions` en `capacitor.config.json`, cosa
 * que es del binario y no viaja por OTA—. Sin esto, «ha llegado y no se ve» y
 * «no ha llegado» son la misma pantalla, y se arreglan en sitios distintos.
 *
 * Se devuelve el oído **antes** de mandar y no una espera después, porque el
 * aviso puede volver antes que la respuesta del servidor: ponerlo después es la
 * misma carrera perdida que ya costó el token de APNs.
 */
export async function escucharUnAviso(ms = PLAZOS.aviso) {
  const sordo = { llegada: Promise.resolve(null), soltar: async () => {} }
  if (!isNative()) return sordo
  let PushNotifications
  try {
    PushNotifications = plugin()
  } catch {
    return sordo
  }
  let dar
  const visto = new Promise((cumplir) => { dar = cumplir })
  let asa
  try {
    asa = await conPlazo(Promise.resolve(
      PushNotifications.addListener('pushNotificationReceived', (n) => dar(n ?? true)),
    ))
  } catch {
    return sordo
  }
  let reloj
  const plazo = new Promise((acaba) => { reloj = setTimeout(() => acaba(null), ms) })
  return {
    llegada: Promise.race([visto, plazo]),
    // Se suelta siempre: un escucha por cada prueba es una fuga con forma de
    // aviso contado dos veces.
    soltar: async () => { clearTimeout(reloj); await asa?.remove?.() },
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
    const PushNotifications = plugin()
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
