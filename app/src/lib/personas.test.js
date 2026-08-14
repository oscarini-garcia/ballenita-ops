import { describe, it, expect } from 'vitest'
import { EDADES, EMOJIS_PERSONA, pesoDe, puedeOrganizar } from './personas.js'

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
