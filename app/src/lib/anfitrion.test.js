import { describe, it, expect } from 'vitest'
import { anfitrionPorBunga, vecesEnLetra } from './anfitrion.js'

/**
 * El balance de anfitrión (§6.4, §14.72).
 *
 * Lo leen dos pantallas —Números y el elegidor de bunga de un día—, así que la
 * cuenta vive en un solo sitio: dos copias acaban dando números distintos para
 * la misma pregunta.
 */
const CENAS = [
  { dia: '2026-08-09', bungaMayoresId: 'ruido', bungaNinosId: 'fondo' },
  { dia: '2026-08-10', bungaMayoresId: 'ruido', bungaNinosId: 'ruido' },
  { dia: '2026-08-11', bungaMayoresId: 'fondo' },
]

describe('cuántas veces ha acogido cada bunga', () => {
  it('suma mayores y niños por separado, y el total', () => {
    const c = anfitrionPorBunga(CENAS)
    expect(c.get('ruido')).toEqual({ mayores: 2, ninos: 1, total: 3 })
    expect(c.get('fondo')).toEqual({ mayores: 1, ninos: 1, total: 2 })
  })

  // Son dos mesas que montar y dos que recoger, así que cuentan dos.
  it('una noche en la que acoge a las dos mesas cuenta dos', () => {
    const c = anfitrionPorBunga([CENAS[1]])
    expect(c.get('ruido').total).toBe(2)
  })

  /** §14.70-bis: los bungas no se borran al salir, así que hay que saltarlas. */
  it('una noche que se cena fuera no la acoge nadie', () => {
    const c = anfitrionPorBunga([
      ...CENAS,
      { dia: '2026-08-12', bungaMayoresId: 'ruido', fuera: 1, donde: 'El chiringuito' },
    ])
    expect(c.get('ruido').total).toBe(3)
  })

  /**
   * Al reabrir el bunga de una noche ya repartida, contarla inflaría a quien
   * está puesto: la cuenta dejaría de contestar a quién le toca **aparte de
   * esta**, que es lo que se le pregunta.
   */
  it('se puede dejar fuera el día que se está decidiendo', () => {
    const c = anfitrionPorBunga(CENAS, { excepto: '2026-08-10' })
    expect(c.get('ruido').total).toBe(1)
    expect(c.get('fondo').total).toBe(2)
  })

  it('un bunga que no ha acogido nunca no está en el mapa', () => {
    expect(anfitrionPorBunga(CENAS).get('piscina')).toBeUndefined()
  })

  it('sin cenas no revienta', () => {
    expect(anfitrionPorBunga().size).toBe(0)
    expect(anfitrionPorBunga([{}, null]).size).toBe(0)
  })
})

describe('cómo se dice esa cuenta', () => {
  it('en singular, en plural, y el cero **sí** se dice', () => {
    expect(vecesEnLetra(0)).toBe('aún ninguna')
    expect(vecesEnLetra(1)).toBe('1 vez')
    expect(vecesEnLetra(4)).toBe('4 veces')
    // El cero es la respuesta que se busca, no un dato que falte: al contrario
    // que en §14.38, aquí callarlo escondería justo al que toca.
    expect(vecesEnLetra()).toBe('aún ninguna')
  })
})
