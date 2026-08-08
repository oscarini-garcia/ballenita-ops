import { describe, it, expect } from 'vitest'
import { motivoDelOta, otaFueBien } from './EventSettingsScreen.jsx'

/**
 * Cuando el OTA no trae nada, se dice qué ha pasado (§14.9-bis).
 *
 * `checkForOtaUpdate` devuelve cuatro cosas además de «actualizado», y las
 * cuatro se tiraban: el botón seguía con el camino del service worker —que
 * dentro de la app de iOS no trae nada— y terminaba con su ✓. La pantalla decía
 * que sí y el teléfono se quedaba en la de antes, sin nada que mirar. «No ha
 * actualizado» sin motivo no se puede arreglar desde el móvil.
 */
describe('por qué no ha actualizado', () => {
  it('ya la tienes: lo dice con el número, que es lo que se venía a comprobar', () => {
    const m = motivoDelOta({ status: 'up-to-date', version: '0.16.1' })
    expect(m).toMatch(/v0\.16\.1/)
    // Y dice dónde mirar si esperabas otra: el release puede no estar publicado
    // todavía, que es lo que pasa si se mira justo al mergear.
    expect(m).toMatch(/ota-v/)
  })

  it('sin manifiesto se dice dónde estaba y cuáles son las dos causas', () => {
    const m = motivoDelOta({ status: 'no-manifest' })
    expect(m).toMatch(/latest\.json/)
    expect(m).toMatch(/red/)
  })

  it('armado para el próximo arranque no es un fallo, y dice cuándo se verá', () => {
    // Es lo que devuelve la comprobación de fondo: `next()` deja el paquete
    // puesto sin recargar encima de nadie. Antes aquí se llamaba a `set()`, que
    // recarga en el acto, así que abrir la app con versión nueva la reiniciaba
    // sola nada más arrancar.
    expect(motivoDelOta({ status: 'armed', version: '0.18.1' })).toMatch(/próximo arranque/)
  })

  it('en la web no hay paquete que traer, y no es un fallo', () => {
    expect(motivoDelOta({ status: 'skip' })).toMatch(/app de iOS/)
  })

  it('y un error se cuenta con sus palabras, no con un ✓', () => {
    expect(motivoDelOta({ status: 'error', error: 'Load failed' })).toMatch(/Load failed/)
    // Sin motivo tampoco se calla: callarlo es lo que se está arreglando.
    expect(motivoDelOta({ status: 'error' })).toMatch(/sin motivo/)
  })
})

/**
 * Y de qué color se dice.
 *
 * Los tres desenlaces normales se pintaban en rojo porque la variable que los
 * guardaba se llamaba `fallo`. «Ya tienes el último paquete» en rojo dice lo
 * contrario de lo que ha pasado, y gasta en la respuesta corriente del botón el
 * color que aquí es deuda y borrar. Los nombres de las pruebas de arriba ya
 * decían «no es un fallo» desde el primer día; lo que faltaba era el píxel.
 */
describe('si fue bien o no', () => {
  it('los tres desenlaces normales no son fallo', () => {
    expect(otaFueBien({ status: 'up-to-date', version: '0.31.0' })).toBe(true)
    expect(otaFueBien({ status: 'armed', version: '0.31.0' })).toBe(true)
    expect(otaFueBien({ status: 'skip' })).toBe(true)
  })

  it('y lo que no trajo el paquete, sí', () => {
    expect(otaFueBien({ status: 'no-manifest' })).toBe(false)
    expect(otaFueBien({ status: 'error', error: 'Load failed' })).toBe(false)
    expect(otaFueBien()).toBe(false)
  })
})
