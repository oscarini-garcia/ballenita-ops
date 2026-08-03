import { describe, it, expect } from 'vitest'
import { aliasSugerido, aliasDe, aliasSigueAlNombre } from './alias.js'

/**
 * El alias de familia (`docs/diseño/planes-ideas.html` · D3).
 *
 * Lo que se prueba aquí es lo que evita el único fallo que rompe la firma de una
 * idea —que el alias esté vacío— sin quitar la posibilidad de corregirlo.
 */
describe('aliasSugerido', () => {
  it('son las dos primeras letras, en mayúsculas', () => {
    expect(aliasSugerido('García')).toBe('GA')
    expect(aliasSugerido('Pérez')).toBe('PE')
    expect(aliasSugerido('Solteros')).toBe('SO')
  })

  it('se lleva los acentos: en mayúsculas se pierden igual', () => {
    expect(aliasSugerido('Álvarez')).toBe('AL')
    expect(aliasSugerido('Ñoño')).toBe('NO')
  })

  it('salta espacios y signos, que no son letras de nadie', () => {
    expect(aliasSugerido('  de la Torre')).toBe('DE')
    expect(aliasSugerido('O’Connor')).toBe('OC')
  })

  it('sin nombre no inventa nada', () => {
    expect(aliasSugerido('')).toBe('')
    expect(aliasSugerido()).toBe('')
  })
})

describe('aliasDe', () => {
  it('manda el que se ha escrito a mano', () => {
    expect(aliasDe({ name: 'Solteros', alias: 'SL' })).toBe('SL')
  })

  it('sin alias cae al del nombre, que es lo que salva a las familias de antes', () => {
    expect(aliasDe({ name: 'García' })).toBe('GA')
    expect(aliasDe({ name: 'García', alias: '   ' })).toBe('GA')
  })

  it('sin familia, nada', () => {
    expect(aliasDe(null)).toBe('')
  })
})

describe('aliasSigueAlNombre', () => {
  it('sigue mientras nadie lo haya tocado', () => {
    expect(aliasSigueAlNombre('', '')).toBe(true)
    expect(aliasSigueAlNombre('GA', 'García')).toBe(true)
  })

  it('deja de seguir en cuanto se corrige', () => {
    expect(aliasSigueAlNombre('SL', 'Solteros')).toBe(false)
  })
})
