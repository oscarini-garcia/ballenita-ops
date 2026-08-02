import { describe, it, expect } from 'vitest'
import { conAvisosDeRegistro, MARCA } from '../scripts/appdelegate.mjs'

/**
 * El silencio de APNs tiene una causa que no se ve: `register()` no habla con
 * Apple, llama a `registerForRemoteNotifications()`, y la respuesta la recibe el
 * AppDelegate. Si no la reenvía, el permiso se concede, la llamada devuelve bien
 * y no llega **ni token ni error, nunca**.
 */
const PLANTILLA = `import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func applicationDidBecomeActive(_ application: UIApplication) {
    }
}
`

describe('el AppDelegate reenvía lo que contesta APNs', () => {
  it('pone los dos métodos dentro de la clase', () => {
    const { fuente, cambiado } = conAvisosDeRegistro(PLANTILLA)
    expect(cambiado).toBe(true)
    expect(fuente).toContain('didRegisterForRemoteNotificationsWithDeviceToken')
    expect(fuente).toContain('didFailToRegisterForRemoteNotificationsWithError')
    // Dentro de la clase, no detrás: la última llave sigue siendo la última.
    expect(fuente.trimEnd().endsWith('}')).toBe(true)
    expect(fuente.indexOf(MARCA)).toBeLessThan(fuente.lastIndexOf('}'))
  })

  it('no los duplica al pasar otra vez, que esto corre en cada sync', () => {
    const una = conAvisosDeRegistro(PLANTILLA).fuente
    const otra = conAvisosDeRegistro(una)
    expect(otra.cambiado).toBe(false)
    expect(otra.yaEstaba).toBe(true)
    expect(otra.fuente).toBe(una)
  })

  it('un fichero sin llaves se deja como está en vez de romperlo', () => {
    // Un Swift que no compila es peor que un aviso: para el build entero y el
    // motivo no se parece en nada a los avisos.
    const raro = 'import UIKit\n'
    expect(conAvisosDeRegistro(raro)).toEqual({ fuente: raro, cambiado: false, yaEstaba: false })
  })
})
