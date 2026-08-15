import { describe, it, expect } from 'vitest'
import { componerRecap, porDias, diaDe } from './recap.js'

// El recap del viaje (SPECS §14.50): recuentos que se calculan y no se guardan,
// como los saldos.

const GENTE = [
  { id: 'p1', name: 'Curro' },
  { id: 'p2', name: 'Marta' },
  { id: 'p3', name: 'Ana' },
]

const a = (id, personId, clase, cuando, texto = 'hizo algo') =>
  ({ id, personId, clase, cuando, texto })

const APUNTES = [
  a('r1', 'p1', 'gasto', '2026-08-15T10:00:00.000Z', 'apuntó «Hielo»'),
  a('r2', 'p1', 'gasto', '2026-08-15T11:00:00.000Z', 'apuntó «Birras»'),
  a('r3', 'p1', 'compra', '2026-08-15T12:00:00.000Z', 'tachó «Pan»'),
  a('r4', 'p2', 'voto', '2026-08-16T09:00:00.000Z', 'votó «Playa»'),
  a('r5', 'p2', 'cena', '2026-08-16T20:00:00.000Z', 'montó la cena'),
  a('r6', null, 'plan', '2026-08-17T09:00:00.000Z', 'propuso «Kayak»'),
]

describe('los recuentos', () => {
  it('cuenta todo, por persona y por clase', () => {
    const r = componerRecap({ apuntes: APUNTES, persons: GENTE })
    expect(r.total).toBe(6)
    expect(r.porPersona[0]).toMatchObject({ personId: 'p1', nombre: 'Curro', cuantas: 3 })
    expect(r.porClase.map((c) => [c.id, c.cuantas]))
      .toEqual([['gasto', 2], ['cena', 1], ['compra', 1], ['plan', 1], ['voto', 1]])
  })

  it('las clases salen en el orden del recap, no por cuántas hay', () => {
    // Primero lo que mueve dinero y al final lo de la propia app: es lo que hace
    // que dos viajes distintos se lean con la misma forma.
    const r = componerRecap({ apuntes: APUNTES, persons: GENTE })
    expect(r.porClase.map((c) => c.id)).toEqual(['gasto', 'cena', 'compra', 'plan', 'voto'])
    // Y las que no han pasado no ocupan sitio.
    expect(r.porClase.map((c) => c.id)).not.toContain('mejora')
  })

  it('quien no tiene nombre no se inventa uno', () => {
    const r = componerRecap({ apuntes: APUNTES, persons: GENTE })
    expect(r.porPersona.find((p) => p.personId === null)).toMatchObject({ nombre: null, cuantas: 1 })
  })

  it('el día más movido, con los empates dichos', () => {
    const r = componerRecap({ apuntes: APUNTES, persons: GENTE })
    expect(r.diaMasMovido).toEqual({ dias: ['2026-08-15'], cuantas: 3 })

    const empate = componerRecap({
      apuntes: [a('x', 'p1', 'gasto', '2026-08-15T10:00:00.000Z'), a('y', 'p2', 'cena', '2026-08-16T10:00:00.000Z')],
      persons: GENTE,
    })
    expect(empate.diaMasMovido.dias).toEqual(['2026-08-15', '2026-08-16'])
  })

  it('con un solo día no hay «el más movido»: sería el único, contándose solo', () => {
    const r = componerRecap({
      apuntes: [a('x', 'p1', 'gasto', '2026-08-15T10:00:00.000Z'), a('y', 'p2', 'cena', '2026-08-15T12:00:00.000Z')],
      persons: GENTE,
    })
    expect(r.diaMasMovido).toBe(null)
    expect(r.porDia).toHaveLength(1)
  })

  it('un podio de uno no es un podio', () => {
    // «Quién más ha andado» con una sola persona es esa persona leyendo su
    // nombre, así que no sale: es la misma regla que los empates de Números.
    const r = componerRecap({ apuntes: [a('x', 'p1', 'gasto', '2026-08-15T10:00:00.000Z')], persons: GENTE })
    expect(r.masActivo).toBe(null)

    expect(componerRecap({ apuntes: APUNTES, persons: GENTE }).masActivo)
      .toMatchObject({ personId: 'p1', cuantas: 3 })
  })

  it('sin nada, cero y ni un hueco', () => {
    const r = componerRecap({})
    expect(r).toMatchObject({ total: 0, porPersona: [], porClase: [], porDia: [], diaMasMovido: null, masActivo: null })
  })

  it('los empates entre personas se deshacen por nombre, no por id', () => {
    // Los ids son aleatorios (`lib/ids.js`): sin esto el podio sale en un orden
    // en un móvil y en otro en el de al lado, con los mismos datos.
    const empatados = [
      a('x', 'p3', 'gasto', '2026-08-15T10:00:00.000Z'),
      a('y', 'p2', 'gasto', '2026-08-15T11:00:00.000Z'),
    ]
    const r = componerRecap({ apuntes: empatados, persons: GENTE })
    expect(r.porPersona.map((p) => p.nombre)).toEqual(['Ana', 'Marta'])
  })
})

describe('el diario, por días', () => {
  it('los días del más nuevo al más viejo, y dentro también', () => {
    const dias = porDias(APUNTES)
    expect(dias.map((d) => d.dia)).toEqual(['2026-08-17', '2026-08-16', '2026-08-15'])
    expect(dias[2].apuntes.map((x) => x.id)).toEqual(['r3', 'r2', 'r1'])
  })

  it('un renglón sin fecha no rompe la lista: se queda fuera', () => {
    expect(porDias([...APUNTES, { id: 'roto', clase: 'gasto', texto: 'algo' }]).length).toBe(3)
  })

  it('el día de un apunte es su fecha sin la hora', () => {
    expect(diaDe({ cuando: '2026-08-15T22:30:00.000Z' })).toBe('2026-08-15')
    expect(diaDe(null)).toBe('')
  })
})
