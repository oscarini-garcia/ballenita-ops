/**
 * El puente entre APNs y el plugin de avisos, que vive en `AppDelegate.swift`.
 *
 * `PushNotifications.register()` no habla con Apple: llama a
 * `UIApplication.registerForRemoteNotifications()`, y **la respuesta la recibe el
 * AppDelegate**, no el plugin. El plugin se entera solo si el AppDelegate
 * reenvía las dos respuestas por `NotificationCenter`:
 *
 * - `didRegisterForRemoteNotificationsWithDeviceToken` → el identificador.
 * - `didFailToRegisterForRemoteNotificationsWithError` → el motivo del rechazo.
 *
 * Si faltan, no pasa nada malo de forma visible: el permiso se concede, la
 * llamada devuelve bien, y **no llega ni token ni error, nunca**. En pantalla es
 * «Permiso dado, y Apple no contesta ni con identificador ni con error», que se
 * confunde con un problema de red y no lo es.
 *
 * La plantilla de Capacitor las trae, pero `ios/` no se versiona —lo regenera
 * `cap add ios`— y quien haya tocado ese fichero a mano, o venga de una plantilla
 * vieja, se queda sin ellas y sin aviso. Se repone en cada `sync:ios`, igual que
 * `aps-environment`.
 */

export const MARCA = 'capacitorDidRegisterForRemoteNotifications'

const METODOS = `
    // Añadido por app/scripts/patch-ios.mjs — sin esto, el plugin de avisos no
    // recibe nunca el identificador de APNs ni el motivo del rechazo.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
`

/**
 * Devuelve `{ fuente, cambiado }` con los dos métodos puestos.
 *
 * Se cuelan **antes de la última llave**, que es la que cierra la clase. Si el
 * fichero no tiene ninguna, se devuelve tal cual y `cambiado` en `false`: mejor
 * no tocarlo y que el script lo diga que dejar un Swift que no compila.
 */
export function conAvisosDeRegistro(fuente) {
  if (fuente.includes(MARCA)) return { fuente, cambiado: false, yaEstaba: true }
  const cierre = fuente.lastIndexOf('}')
  if (cierre === -1) return { fuente, cambiado: false, yaEstaba: false }
  return {
    fuente: `${fuente.slice(0, cierre)}${METODOS}${fuente.slice(cierre)}`,
    cambiado: true,
    yaEstaba: false,
  }
}
