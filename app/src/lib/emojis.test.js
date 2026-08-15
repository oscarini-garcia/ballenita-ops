import { describe, it, expect } from 'vitest'
import { contarEmojis, cortarEmojis, racimos, TOPE_EMOJIS } from './emojis.js'

/**
 * Contar por dibujos y no por unidades (SPECS §14.47). El caso que lo motivó
 * está el primero: con `maxLength={4}` una familia —ocho unidades— no cabía, y
 * es el emoji que traen puestas las familias de fábrica.
 */
describe('contar emoji por dibujos', () => {
  it('una familia es UN dibujo, aunque sean ocho unidades', () => {
    expect('👨‍👩‍👧'.length).toBe(8)
    expect(contarEmojis('👨‍👩‍👧')).toBe(1)
  })

  it('una bandera es uno, y dos banderas son dos', () => {
    expect(contarEmojis('🇪🇸')).toBe(1)
    expect(contarEmojis('🇪🇸🇫🇷')).toBe(2)
  })

  it('el tono de piel va con su dibujo', () => {
    expect(contarEmojis('🏄🏽')).toBe(1)
    expect(racimos('🏄🏽🍺')).toEqual(['🏄🏽', '🍺'])
  })

  it('el selector de variante no cuenta aparte', () => {
    expect(contarEmojis('🕶️')).toBe(1)
  })

  it('las caritas sueltas se cuentan de una en una', () => {
    expect(contarEmojis('🙂🐳🦑')).toBe(3)
  })

  it('el vacío es cero, y lo raro no revienta', () => {
    expect(contarEmojis('')).toBe(0)
    expect(contarEmojis(null)).toBe(0)
    expect(contarEmojis(undefined)).toBe(0)
  })
})

describe('cortar a tres', () => {
  it('deja pasar tres y se come el cuarto', () => {
    expect(cortarEmojis('🙂🐳🦑🦀', TOPE_EMOJIS)).toBe('🙂🐳🦑')
  })

  it('no parte un dibujo por la mitad', () => {
    // Tres familias son 24 unidades y siguen siendo tres dibujos.
    expect(cortarEmojis('👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧', 3)).toBe('👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧')
    expect(cortarEmojis('👨‍👩‍👧🐳', 1)).toBe('👨‍👩‍👧')
  })

  it('lo que ya cabe se queda igual', () => {
    expect(cortarEmojis('🐳', 3)).toBe('🐳')
    expect(cortarEmojis('', 3)).toBe('')
  })
})
