import { describe, it, expect } from 'vitest'
import { motivoDelOta } from './EventSettingsScreen.jsx'

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

  it('en la web no hay paquete que traer, y no es un fallo', () => {
    expect(motivoDelOta({ status: 'skip' })).toMatch(/app de iOS/)
  })

  it('y un error se cuenta con sus palabras, no con un ✓', () => {
    expect(motivoDelOta({ status: 'error', error: 'Load failed' })).toMatch(/Load failed/)
    // Sin motivo tampoco se calla: callarlo es lo que se está arreglando.
    expect(motivoDelOta({ status: 'error' })).toMatch(/sin motivo/)
  })
})
