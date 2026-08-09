import { describe, it, expect } from 'vitest'
import { lineasDeRevision, revisionDeAvisos } from '../scripts/revision-de-avisos.mjs'

/**
 * El fallo que costó cuatro vueltas no fue el `AppDelegate` sin el reenvío de
 * APNs: fue que eso se avisaba con un `console.warn` en medio de un log de
 * compilación, el script seguía y terminaba en verde. Un aviso que nadie lee y
 * un `exit 0` dicen lo mismo que no haber comprobado nada.
 */
const TODO = {
  appDelegate: 'func application(_ a: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken t: Data) {}',
  entitlements: '<key>aps-environment</key><string>development</string>',
  proyecto: 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;',
}

const estado = (extra) => revisionDeAvisos({ ...TODO, ...extra })
const falla = (r) => r.filter((x) => !x.bien).map((x) => x.que)

describe('la revisión de los avisos', () => {
  it('con las tres cosas puestas, no falta ninguna', () => {
    expect(falla(estado())).toEqual([])
  })

  it('sin el reenvío del AppDelegate lo dice, que es el que da silencio', () => {
    const rota = estado({ appDelegate: 'class AppDelegate {}' })
    expect(falla(rota)).toEqual(['AppDelegate reenvía las respuestas de APNs'])
    // Y dice qué hacer, con la trampa incluida: `npx cap sync ios` no lo pone.
    expect(rota[0].arreglo).toContain('npm run sync:ios')
    expect(rota[0].arreglo).toContain('npx cap sync ios')
  })

  it('un fichero que no existe cuenta como que falta, que es lo que es', () => {
    expect(falla(estado({ appDelegate: null, entitlements: null, proyecto: null }))).toHaveLength(3)
  })

  it('el entitlements sin firmar se cuenta aparte de no tenerlo', () => {
    // Existir y no firmarse es indistinguible de no existir, y encima el fichero
    // está ahí para desmentirlo: son dos renglones porque son dos arreglos.
    expect(falla(estado({ proyecto: 'PRODUCT_BUNDLE_IDENTIFIER = com.x;' })))
      .toEqual(['El proyecto firma ese fichero (CODE_SIGN_ENTITLEMENTS)'])
  })
})

describe('lo que se imprime', () => {
  it('cuando está todo, lo dice en una línea que se puede creer', () => {
    const texto = lineasDeRevision(estado()).join('\n')
    expect(texto).toContain('podrá pedir el identificador de APNs')
    expect(texto).not.toContain('❌')
  })

  it('cuando falta algo, grita y dice el arreglo debajo', () => {
    const texto = lineasDeRevision(estado({ appDelegate: null })).join('\n')
    expect(texto).toContain('ESTE BINARIO NO PODRÁ AVISAR')
    expect(texto).toContain('❌ AppDelegate reenvía las respuestas de APNs')
    expect(texto).toContain('→ corre «npm run sync:ios»')
  })

  it('solo se marca lo que falta: lo que está no lleva arreglo', () => {
    const texto = lineasDeRevision(estado({ appDelegate: null })).join('\n')
    expect(texto.match(/→/g)).toHaveLength(1)
  })
})
