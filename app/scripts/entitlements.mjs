/**
 * El permiso de avisos del binario, que son **dos** cosas y no una.
 *
 * 1. `aps-environment` en `App.entitlements`. Sin él, iOS ni siquiera pide un
 *    identificador y Apple contesta «no valid 'aps-environment' entitlement
 *    string found in application's signature».
 * 2. `CODE_SIGN_ENTITLEMENTS` en el proyecto de Xcode. Un fichero de
 *    entitlements que existe en disco y **no está declarado en el target no se
 *    firma**, y entonces es exactamente como si no existiera: mismo silencio,
 *    misma respuesta de Apple, y encima el fichero está ahí para desmentirlo.
 *
 * Xcode escribe las dos al marcar la capacidad «Push Notifications» a mano.
 * Pero `ios/` no se versiona —lo regenera `cap add ios`— y entonces no las
 * escribe nadie. Aquí se reponen en cada `sync:ios`, como el reenvío del
 * AppDelegate (`appdelegate.mjs`), y por el mismo motivo: el fallo que producen
 * llega tarde, se parece a un problema de red y no lo es.
 *
 * Es la figura de `garciadoral-ops`, donde este módulo ya estaba resuelto; aquí
 * se avisaba por consola y se seguía, que en la primera pasada tras un `cap add
 * ios` —justo la que no tiene el fichero— es dejar los avisos apagados hasta
 * que alguien se acuerde de leer la consola.
 */

// `development` es el valor de lo que se instala desde Xcode. Al archivar para
// TestFlight o la App Store, la firma lo sustituye por `production`, y entonces
// el Worker tiene que hablar con el APNs de producción: es lo que decide
// `APNS_ENTORNO` en `api/wrangler.toml`. Los tokens de un entorno no valen en el
// otro, y el síntoma es `BadDeviceToken` sin más explicación.
export const APS_ENVIRONMENT = 'development'

export const ENTITLEMENTS_NUEVO = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>${APS_ENVIRONMENT}</string>
</dict>
</plist>
`

/** El `App.entitlements` con `aps-environment` puesto. */
export function conPermisoDeAvisos(plist) {
  if (plist.includes('aps-environment')) return { fuente: plist, cambiado: false, yaEstaba: true }
  const cierre = plist.lastIndexOf('</dict>')
  // Un plist que no reconocemos se deja como está: escribir a ciegas en el
  // fichero que gobierna la firma se paga en un build que no arranca.
  if (cierre === -1) return { fuente: plist, cambiado: false, yaEstaba: false }
  const declaracion = `\t<key>aps-environment</key>\n\t<string>${APS_ENVIRONMENT}</string>\n`
  return { fuente: plist.slice(0, cierre) + declaracion + plist.slice(cierre), cambiado: true, yaEstaba: false }
}

/**
 * El `.pbxproj` con la ruta del fichero de entitlements declarada.
 *
 * Va **junto a `PRODUCT_BUNDLE_IDENTIFIER`**, que aparece exactamente en las
 * configuraciones del target de la aplicación —Debug y Release— y en ninguna
 * otra. No hace falta añadir el fichero a ningún grupo del proyecto: esto es una
 * ruta de ajuste, no un fuente que se compile.
 */
export function conEntitlementEnProyecto(pbx) {
  if (pbx.includes('CODE_SIGN_ENTITLEMENTS')) return { fuente: pbx, cambiado: false, yaEstaba: true }
  const fuente = pbx.replace(
    /(\n(\s*)PRODUCT_BUNDLE_IDENTIFIER = [^;]+;\n)/g,
    (_, linea, sangria) => `${linea}${sangria}CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n`,
  )
  return { fuente, cambiado: fuente !== pbx, yaEstaba: false }
}
