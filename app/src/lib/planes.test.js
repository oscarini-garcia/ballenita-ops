import { describe, it, expect } from 'vitest'
import { ESTADO_SE_HACE, ESTADO_VOTANDO, quienFaltaPorVotar, seHace, votosDe } from './planes.js'

const gente = [
  { id: 'p1', name: 'Curro' },
  { id: 'p2', name: 'Ana' },
  { id: 'p3', name: 'Luis' },
  { id: 'p4', name: 'Marta' },
]

describe('votosDe', () => {
  it('cuenta los pulgares arriba y nada más', () => {
    expect(votosDe({ votos: { p1: '👍', p2: '🤷', p3: '👎', p4: '👍' } })).toBe(2)
  })

  it('un plan recién creado no tiene votos ni se rompe', () => {
    expect(votosDe({})).toBe(0)
    expect(votosDe(undefined)).toBe(0)
  })
})

describe('quienFaltaPorVotar', () => {
  it('con todos votados lo dice y no nombra a nadie', () => {
    const plan = { votos: { p1: '👍', p2: '👎', p3: '🤷', p4: '👍' } }
    expect(quienFaltaPorVotar(plan, gente)).toBe('han votado todos')
  })

  it('sin un solo voto no dice «faltan cuatro», dice que no hay ninguno', () => {
    expect(quienFaltaPorVotar({ votos: {} }, gente)).toBe('sin votos todavía')
  })

  it('nombra a quien falta cuando son uno o dos, que es cuando es accionable', () => {
    expect(quienFaltaPorVotar({ votos: { p1: '👍', p2: '👍', p3: '👍' } }, gente))
      .toBe('falta por votar Marta')
    expect(quienFaltaPorVotar({ votos: { p1: '👍', p2: '👍' } }, gente))
      .toBe('falta por votar Luis y Marta')
  })

  it('con tres o más cuenta en vez de listar: no caben y no dicen más', () => {
    expect(quienFaltaPorVotar({ votos: { p1: '👍' } }, gente)).toBe('faltan 3 por votar')
  })

  it('usa el apodo cuando lo hay, que es como se llama a la gente', () => {
    const conApodo = [{ id: 'p1', name: 'Francisco', apodo: 'el adolescente' }, { id: 'p2', name: 'Ana' }]
    expect(quienFaltaPorVotar({ votos: { p2: '👍' } }, conApodo)).toBe('falta por votar el adolescente')
  })
})

describe('se hace y punto (§14.59)', () => {
  it('solo «sehace» se hace: lo demás se vota, incluido lo que no tiene estado', () => {
    expect(seHace({ estado: ESTADO_SE_HACE })).toBe(true)
    expect(seHace({ estado: ESTADO_VOTANDO })).toBe(false)
    // Los planes de antes de esta versión no tienen la columna puesta, y no
    // pueden empezar a comportarse distinto por eso: la comprobación es por el
    // valor afirmativo, nunca por la ausencia del otro.
    expect(seHace({})).toBe(false)
    expect(seHace(null)).toBe(false)
    expect(seHace({ estado: 'confirmado' })).toBe(false)
  })

  it('los votos no se pierden al decidirlo: el estado y los votos son cosas distintas', () => {
    const plan = { estado: ESTADO_SE_HACE, votos: { p1: '👍', p2: '👎' } }
    // Lo que cambia es que no se enseñen, no que se borren — es lo que permite
    // tocar el interruptor sin que cambiar de opinión cueste nueve votos.
    expect(votosDe(plan)).toBe(1)
    expect(Object.keys(plan.votos)).toHaveLength(2)
  })
})
