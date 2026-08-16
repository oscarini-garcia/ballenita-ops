import { describe, it, expect } from 'vitest'
import {
  cuantosHanVotado, loQueVoto, puedeVotar, quienesPuedenVotar, ranking, votar, votosDeCacharro,
} from './cacharros.js'

const GENTE = [
  { id: 'curro', familyId: 'garcia' },
  { id: 'marta', familyId: 'garcia' },
  { id: 'ana', familyId: 'perez' },
  { id: 'pablo', familyId: 'solteros' },
]
const nevera = { id: 'c1', familyId: 'perez', texto: 'Nevera de 12 V', votos: { curro: '🏆', marta: '🏆' } }
const proyector = { id: 'c2', familyId: 'solteros', texto: 'Proyector', votos: { ana: '🏆' } }
const plancha = { id: 'c3', familyId: 'garcia', texto: 'Plancha de gas', votos: {} }
const TODOS = [nevera, proyector, plancha]

describe('el cacharro del año (§14.57)', () => {
  it('cuenta los votos y ordena por ellos', () => {
    expect(votosDeCacharro(nevera)).toBe(2)
    expect(ranking(TODOS).map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('a igualdad desempata por texto y no por id, que es aleatorio', () => {
    const a = { id: 'zz', texto: 'Altavoz', votos: {} }
    const b = { id: 'aa', texto: 'Ventilador', votos: {} }
    // Con el id, el orden cambiaría en cada pintado y la lista parecería moverse.
    expect(ranking([b, a]).map((c) => c.texto)).toEqual(['Altavoz', 'Ventilador'])
  })

  it('nadie vota el de su familia', () => {
    expect(puedeVotar(nevera, GENTE[2])).toBe(false)   // Ana es de los Pérez
    expect(puedeVotar(nevera, GENTE[0])).toBe(true)
    // Quien no tiene familia puede votarlos todos: ninguno es «el suyo».
    expect(puedeVotar(nevera, { id: 'x', familyId: null })).toBe(true)
    expect(puedeVotar(nevera, null)).toBe(false)
  })

  it('votar es elegir uno: el voto anterior se va con el nuevo', () => {
    const cambios = votar(TODOS, 'curro', 'c2')
    // Dos filas y no tres: se escribe lo justo, o el recap se llena de renglones.
    expect(cambios).toHaveLength(2)
    const porId = Object.fromEntries(cambios.map((c) => [c.id, c.votos]))
    expect(porId.c1.curro).toBeUndefined()
    expect(porId.c2.curro).toBe('🏆')
    expect(porId.c3).toBeUndefined()
  })

  it('tocar el que ya tenías lo quita, como en los planes', () => {
    const cambios = votar(TODOS, 'curro', 'c1')
    expect(cambios).toHaveLength(1)
    expect(cambios[0].votos.curro).toBeUndefined()
  })

  it('sin identidad no se vota nada', () => {
    expect(votar(TODOS, null, 'c1')).toEqual([])
  })

  it('dice qué has votado tú, mirando todos', () => {
    expect(loQueVoto(TODOS, 'curro')).toBe('c1')
    expect(loQueVoto(TODOS, 'pablo')).toBe(null)
    expect(loQueVoto(TODOS, null)).toBe(null)
  })

  it('el denominador son los que pueden votar algo, no toda la gente', () => {
    // Los cuatro pueden: cada uno tiene al menos un cacharro que no es el suyo.
    expect(quienesPuedenVotar(TODOS, GENTE)).toHaveLength(4)
    expect(cuantosHanVotado(TODOS, GENTE)).toBe(3)

    // Con un solo cacharro, los de esa familia no cuentan: si contaran, el
    // recuento no llegaría nunca al total.
    expect(quienesPuedenVotar([nevera], GENTE).map((p) => p.id)).toEqual(['curro', 'marta', 'pablo'])
  })
})
