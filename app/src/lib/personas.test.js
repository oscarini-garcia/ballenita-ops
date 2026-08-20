import { describe, it, expect } from 'vitest'
import { EDADES, EMOJIS_PERSONA, pesoDe, puedeOrganizar, estaAqui, losQueEstan } from './personas.js'

describe('pesos por edad', () => {
  it('son tres: adulto 1, adolescente 1 y niño 0,6', () => {
    expect(EDADES.map((e) => [e.id, e.peso]))
      .toEqual([['adulto', 1], ['adolescente', 1], ['niño', 0.6]])
  })
  it('pesoDe cae en 1 ante cualquier cosa rara', () => {
    expect(pesoDe('adulto')).toBe(1)
    expect(pesoDe('adolescente')).toBe(1)
    expect(pesoDe('niño')).toBe(0.6)
    expect(pesoDe(undefined)).toBe(1)
    expect(pesoDe('bebé')).toBe(1)
  })
})

describe('quién toca Dinero (§14.41)', () => {
  it('el adulto sí; el adolescente y el niño, no', () => {
    expect(puedeOrganizar({ edad: 'adulto' })).toBe(true)
    expect(puedeOrganizar({ edad: 'adolescente' })).toBe(false)
    expect(puedeOrganizar({ edad: 'niño' })).toBe(false)
  })
  it('sin identidad no se capa, y una edad desconocida tampoco', () => {
    expect(puedeOrganizar(null)).toBe(true)
    expect(puedeOrganizar({ edad: 'bebé' })).toBe(true)
  })
})

describe('emoji para elegir', () => {
  it('hay de sobra y no se repite ninguno', () => {
    expect(EMOJIS_PERSONA.length).toBeGreaterThanOrEqual(16)
    expect(new Set(EMOJIS_PERSONA).size).toBe(EMOJIS_PERSONA.length)
  })
  it('el de fábrica está entre ellos, para que salga marcado al abrir', () => {
    expect(EMOJIS_PERSONA).toContain('🧑')
  })
})

/**
 * **Quien se va unos días no cuenta** (SPECS §14.78).
 *
 * Las tres cuentas que se hacían mal cuando la única forma de quitar a alguien
 * era borrarlo —que se lleva por delante todo lo apuntado a su nombre—: el
 * reparto de un gasto nuevo, la compra y quién falta por votar.
 */
describe('quién está estos días', () => {
  it('sin la columna se está: las filas de antes de la migración no cambian', () => {
    expect(estaAqui({ name: 'Curro' })).toBe(true)
    expect(estaAqui({ name: 'Curro', ausente: 0 })).toBe(true)
    expect(estaAqui({ name: 'Curro', ausente: null })).toBe(true)
    expect(estaAqui({ name: 'Curro', ausente: 1 })).toBe(false)
  })

  it('sin persona no se inventa que está', () => {
    expect(estaAqui(null)).toBe(true)
  })

  it('los que están son los que cuentan', () => {
    const gente = [
      { id: 'a', ausente: 0 }, { id: 'b', ausente: 1 }, { id: 'c' },
    ]
    expect(losQueEstan(gente).map((p) => p.id)).toEqual(['a', 'c'])
    expect(losQueEstan()).toEqual([])
  })
})
