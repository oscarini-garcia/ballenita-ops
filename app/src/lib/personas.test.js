import { describe, it, expect } from 'vitest'
import {
  EDADES, EMOJIS_PERSONA, pesoDe, puedeOrganizar, estaAqui, losQueEstan,
  comoEstaLaCasa, cuantosEnLaCasa,
} from './personas.js'

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

/**
 * El interruptor de toda una casa (§14.79).
 *
 * Lo que se prueba aquí es que el estado **a medias** —el que deja marcar uno a
 * uno— tenga salida por los dos lados: una pulsación vacía la casa y la
 * siguiente la llena. Un botón que solo supiera «se han ido» dejaría media casa
 * sin forma de volver entera.
 */
const aqui = (name) => ({ name })
const fuera = (name) => ({ name, ausente: 1 })

describe('cómo está una casa', () => {
  it('con todos dentro, el botón se los lleva', () => {
    const casa = comoEstaLaCasa([aqui('Curro'), aqui('Ana')])
    expect(casa).toMatchObject({ estan: 2, fuera: 0, marcar: true, verbo: 'Se han ido unos días' })
  })

  it('con la casa vacía, los devuelve', () => {
    const casa = comoEstaLaCasa([fuera('Curro'), fuera('Ana')])
    expect(casa).toMatchObject({ estan: 0, fuera: 2, marcar: false, verbo: 'Han vuelto' })
  })

  it('a medias se los lleva a todos, y la siguiente los trae', () => {
    const media = [aqui('Curro'), fuera('Ana')]
    expect(comoEstaLaCasa(media).marcar).toBe(true)
    // Tras esa pulsación no queda nadie, y entonces el botón cambia de verbo.
    expect(comoEstaLaCasa(media.map((p) => ({ ...p, ausente: 1 }))).verbo).toBe('Han vuelto')
  })

  it('una casa vacía de gente no rompe la cuenta', () => {
    expect(comoEstaLaCasa([])).toMatchObject({ estan: 0, fuera: 0, marcar: false })
  })

  it('el recuento dice los que están y aparte los que no', () => {
    expect(cuantosEnLaCasa([aqui('Curro')])).toBe('1 persona')
    expect(cuantosEnLaCasa([aqui('Curro'), aqui('Ana')])).toBe('2 personas')
    expect(cuantosEnLaCasa([aqui('Curro'), fuera('Ana'), fuera('Pablo')])).toBe('1 persona · 2 fuera')
  })

  it('con la casa entera fuera no dice «0 personas»', () => {
    // El cero delante de un número que sí importa se lee como una avería.
    expect(cuantosEnLaCasa([fuera('Curro'), fuera('Ana'), fuera('Pablo')])).toBe('3 fuera')
    expect(cuantosEnLaCasa([fuera('Curro')])).toBe('1 fuera')
  })
})
