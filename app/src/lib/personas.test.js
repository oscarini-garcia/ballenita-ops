import { describe, it, expect } from 'vitest'
import { EDADES, EMOJIS_PERSONA, pesoDe } from './personas.js'

describe('pesos por edad', () => {
  it('son dos y solo dos: adulto 1, niño 0,6', () => {
    expect(EDADES.map((e) => [e.id, e.peso])).toEqual([['adulto', 1], ['niño', 0.6]])
  })
  it('pesoDe cae en 1 ante cualquier cosa rara', () => {
    expect(pesoDe('adulto')).toBe(1)
    expect(pesoDe('niño')).toBe(0.6)
    expect(pesoDe(undefined)).toBe(1)
    expect(pesoDe('bebé')).toBe(1)
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
