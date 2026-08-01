import { describe, it, expect } from 'vitest'
import { codigoDeApple, explicarFalloDeApple } from './apple.js'

// El caso real que motivó todo esto: un iPhone del grupo con la app instalada,
// «Entrar con Apple» y un 1001 seco. El mensaje de antes culpaba a Xcode, que
// es solo una de las causas posibles —y la única que no se arregla desde el
// móvil—, así que mandaba a buscar donde no era.
const ERROR_1001 = new Error(
  "The operation couldn't be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)",
)

describe('codigoDeApple', () => {
  it('lee el código del NSError aplanado en el mensaje', () => {
    expect(codigoDeApple(ERROR_1001)).toBe(1001)
  })

  it('prefiere el código suelto cuando el puente lo entrega', () => {
    expect(codigoDeApple({ code: 1004, message: 'lo que sea' })).toBe(1004)
  })

  it('sin código reconocible devuelve null en vez de inventarse uno', () => {
    expect(codigoDeApple(new Error('se cayó la red'))).toBe(null)
    expect(codigoDeApple(undefined)).toBe(null)
  })

  it('no confunde un número cualquiera del mensaje con un código', () => {
    expect(codigoDeApple(new Error('reintento 3 de 5'))).toBe(null)
  })
})

describe('explicarFalloDeApple', () => {
  it('1001 es «cancelado», y se reparte por lo que se vio en pantalla', () => {
    const mensaje = explicarFalloDeApple(ERROR_1001)
    expect(mensaje).toMatch(/1001/)
    // Las tres cosas que pueden haber pasado con la hoja, cada una con su arreglo.
    expect(mensaje).toMatch(/Registro no completado/i)
    expect(mensaje).toMatch(/no llegó a salir/i)
    expect(mensaje).toMatch(/cerraste/i)
  })

  it('el caso «Registro no completado» manda a la cuenta, no a Xcode', () => {
    const mensaje = explicarFalloDeApple(ERROR_1001)
    // Lo que de verdad lo desatasca y se hace desde el propio iPhone.
    expect(mensaje).toMatch(/developer\.apple\.com/)
    expect(mensaje).toMatch(/contrato/i)
    expect(mensaje).toMatch(/Inicio de sesión y seguridad/i)
  })

  it('la rama de «ni salió la hoja» conserva lo que se toca en Ajustes', () => {
    const mensaje = explicarFalloDeApple(ERROR_1001)
    expect(mensaje).toMatch(/iCloud/)
    expect(mensaje).toMatch(/dos pasos/i)
    expect(mensaje).toMatch(/Tiempo de uso/i)
    // La compilación nueva, que es lo caro y pide Mac, solo como último caso.
    expect(mensaje).toMatch(/compilación nueva/i)
  })

  it('1001 recuerda que se puede seguir en local mientras tanto', () => {
    expect(explicarFalloDeApple(ERROR_1001)).toMatch(/sin entrar/i)
  })

  it('un cancelado sin código también se explica como tal', () => {
    expect(explicarFalloDeApple(new Error('The user canceled the request'))).toMatch(/1001/)
  })

  it('otros fallos siguen apuntando a la capacidad de Xcode', () => {
    const mensaje = explicarFalloDeApple({ code: 1004, message: 'authorization failed' })
    expect(mensaje).toMatch(/Sign in with Apple/)
    expect(mensaje).toMatch(/authorization failed/)
  })
})
