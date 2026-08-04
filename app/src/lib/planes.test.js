import { describe, it, expect } from 'vitest'
import { votosDe, quienFaltaPorVotar } from './planes.js'

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
