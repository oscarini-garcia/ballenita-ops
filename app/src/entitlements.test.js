import { describe, it, expect } from 'vitest'
import {
  APS_ENVIRONMENT,
  ENTITLEMENTS_NUEVO,
  conEntitlementEnProyecto,
  conPermisoDeAvisos,
} from '../scripts/entitlements.mjs'

/**
 * El permiso de avisos son dos cosas, y la segunda es la que se olvida: un
 * `App.entitlements` que no está declarado en el target **no se firma**, así que
 * el binario sale sin `aps-environment` y Apple contesta lo mismo que si el
 * fichero no existiera. Como `ios/` no se versiona, esto se repone en cada
 * `sync:ios` y por eso tiene que ser idempotente.
 */
const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
\t<key>com.apple.developer.applesignin</key>
\t<array><string>Default</string></array>
</dict>
</plist>
`

const PBX = `
\t\t\t\tINFOPLIST_FILE = App/Info.plist;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.garciadoral.ballenitaops;
\t\t\t\tSWIFT_VERSION = 5.0;
`

describe('el permiso de avisos en los entitlements', () => {
  it('lo añade sin tocar lo que ya hubiera', () => {
    const { fuente, cambiado } = conPermisoDeAvisos(PLIST)
    expect(cambiado).toBe(true)
    expect(fuente).toContain(`<key>aps-environment</key>`)
    expect(fuente).toContain(`<string>${APS_ENVIRONMENT}</string>`)
    // Sign in with Apple sigue ahí: se declaran los dos en el mismo fichero.
    expect(fuente).toContain('com.apple.developer.applesignin')
    expect(fuente.trimEnd().endsWith('</plist>')).toBe(true)
  })

  it('no lo duplica al pasar otra vez, que esto corre en cada sync', () => {
    const una = conPermisoDeAvisos(PLIST).fuente
    const otra = conPermisoDeAvisos(una)
    expect(otra).toEqual({ fuente: una, cambiado: false, yaEstaba: true })
  })

  it('un plist que no reconoce lo deja como está', () => {
    // Escribir a ciegas en el fichero que gobierna la firma se paga en un build
    // que no arranca, y el motivo no se parece en nada a los avisos.
    const raro = 'no soy un plist\n'
    expect(conPermisoDeAvisos(raro)).toEqual({ fuente: raro, cambiado: false, yaEstaba: false })
  })

  it('el fichero que se escribe de cero ya lo trae', () => {
    expect(conPermisoDeAvisos(ENTITLEMENTS_NUEVO).yaEstaba).toBe(true)
  })
})

describe('la declaración en el proyecto de Xcode', () => {
  it('va junto al identificador del paquete, que es donde está el target', () => {
    const { fuente, cambiado } = conEntitlementEnProyecto(PBX)
    expect(cambiado).toBe(true)
    expect(fuente).toContain('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;')
    // Con la misma sangría que su vecina: un .pbxproj se lee y se toca a mano.
    expect(fuente).toContain('\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;')
  })

  it('lo pone en todas las configuraciones del target, no solo en la primera', () => {
    const dos = `${PBX}${PBX}`
    const { fuente } = conEntitlementEnProyecto(dos)
    expect(fuente.split('CODE_SIGN_ENTITLEMENTS').length - 1).toBe(2)
  })

  it('si ya estaba —marcado a mano en Xcode— no lo toca', () => {
    const puesto = conEntitlementEnProyecto(PBX).fuente
    expect(conEntitlementEnProyecto(puesto)).toEqual({ fuente: puesto, cambiado: false, yaEstaba: true })
  })

  it('un proyecto donde no encuentra dónde ponerlo se queda igual y lo dice', () => {
    const raro = 'no soy un pbxproj\n'
    expect(conEntitlementEnProyecto(raro)).toEqual({ fuente: raro, cambiado: false, yaEstaba: false })
  })
})
