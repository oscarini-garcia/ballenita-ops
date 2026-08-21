import { describe, it, expect } from 'vitest'
import {
  ESTADO_SE_HACE, ESTADO_VOTANDO, porPasar, quienFaltaPorVotar, seHace, votosDe, yaPaso,
} from './planes.js'

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

/**
 * **A quien no está no se le espera** (SPECS §14.78): un plan del jueves con
 * «faltan 3 por votar» que son los tres que se volvieron el martes no se cierra
 * nunca.
 */
describe('quién falta por votar, con gente fuera', () => {
  const GENTE = [
    { id: 'a', name: 'Ana' },
    { id: 'b', name: 'Bea' },
    { id: 'c', name: 'Curro', ausente: 1 },
  ]

  it('no cuenta a quien se ha ido', () => {
    expect(quienFaltaPorVotar({ votos: { a: '👍', b: '👍' } }, GENTE)).toBe('han votado todos')
  })

  it('y su voto, si lo dejó puesto, sigue contando', () => {
    // Votar es una cosa y estar es otra: `votosDe` no mira la ausencia, así que
    // el 👍 que dejó Curro antes de irse no se pierde.
    expect(votosDe({ votos: { c: '👍' } })).toBe(1)
    // Pero no se le espera: falta Bea, que sí está.
    expect(quienFaltaPorVotar({ votos: { a: '👍', c: '👍' } }, GENTE)).toBe('falta por votar Bea')
  })

  it('«sin votos todavía» mira solo a los que están', () => {
    // Los dos que quedan no han votado, así que el plan está en blanco por más
    // que Curro dejara el suyo puesto.
    expect(quienFaltaPorVotar({ votos: { c: '👍' } }, GENTE)).toBe('sin votos todavía')
  })
})

/**
 * Lo que ya pasó (SPECS §14.80).
 *
 * Se decide con el calendario y no con un estado guardado: un dato así se
 * quedaría viejo en el momento en que nadie abriera la app, y aquí la respuesta
 * la da la fecha sola.
 */
describe('un plan que ya pasó', () => {
  const HOY = '2026-08-18'

  it('el de ayer sí, el de mañana no', () => {
    expect(yaPaso({ dia: '2026-08-17' }, HOY)).toBe(true)
    expect(yaPaso({ dia: '2026-08-19' }, HOY)).toBe(false)
  })

  it('el de hoy **no ha pasado**: la tarde es de esta tarde', () => {
    // Bajarlo al grupo de lo hecho a las 00:01 sería decirle a quien abre la app
    // por la mañana que el plan de la tarde ya está.
    expect(yaPaso({ dia: HOY }, HOY)).toBe(false)
  })

  it('sin día no pasa nunca, aunque el viaje entero haya terminado', () => {
    // Un plan que nadie llegó a poner en un día no se hizo: se quedó sin hacer,
    // y ese sigue a votación, que es lo que dice la verdad de él.
    expect(yaPaso({ titulo: 'Kayaks' }, HOY)).toBe(false)
    expect(yaPaso({ dia: null }, HOY)).toBe(false)
    expect(yaPaso(null, HOY)).toBe(false)
  })

  it('parte la lista en dos y conserva el orden de cada lado', () => {
    const planes = [
      { id: 'a', dia: '2026-08-16' },
      { id: 'b', dia: '2026-08-20' },
      { id: 'c' },
      { id: 'd', dia: '2026-08-17' },
      { id: 'e', dia: HOY },
    ]
    const { quedan, hechos } = porPasar(planes, HOY)
    expect(hechos.map((p) => p.id)).toEqual(['a', 'd'])
    expect(quedan.map((p) => p.id)).toEqual(['b', 'c', 'e'])
  })
})
