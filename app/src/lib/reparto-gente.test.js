import { describe, it, expect } from 'vitest'
import {
  mayoresDe, pequesDe, ATAJOS, genteDeAtajo, atajoDe, porFamilias,
  estadoDeFamilia, quienDeFamilia, buscarGente, comoSeReparte,
} from './reparto-gente.js'

// El grupo de verdad: tres familias, nueve personas, seis mayores y tres peques.
const FAMILIAS = [
  { id: 'perez', name: 'Pérez' },
  { id: 'garcia', name: 'García' },
  { id: 'solteros', name: 'Solteros' },
]
const mayor = (id, name, familyId) => ({ id, name, familyId, cuentaComoAdultoReparto: true, pesoReparto: 1 })
const peque = (id, name, familyId) => ({ id, name, familyId, cuentaComoAdultoReparto: false, pesoReparto: 0.6 })
const GENTE = [
  mayor('g1', 'Curro', 'garcia'), mayor('g2', 'Marta', 'garcia'), peque('g3', 'Pablo', 'garcia'),
  mayor('p1', 'Fran', 'perez'), mayor('p2', 'Ana', 'perez'), peque('p3', 'Luis', 'perez'),
  mayor('s1', 'Nacho', 'solteros'), mayor('s2', 'Bea', 'solteros'), peque('s3', 'Kike', 'solteros'),
]
const ids = (l) => l.map((p) => p.id)

describe('los cuatro atajos', () => {
  it('son cuatro, y «Peques» es el que no existía', () => {
    expect(ATAJOS.map((a) => a.id)).toEqual(['todos', 'mayores', 'peques', 'nadie'])
  })

  it('cada uno deja puesta a su gente', () => {
    expect(genteDeAtajo('todos', GENTE)).toHaveLength(9)
    expect(genteDeAtajo('mayores', GENTE)).toEqual(ids(mayoresDe(GENTE)))
    expect(genteDeAtajo('peques', GENTE)).toEqual(['g3', 'p3', 's3'])
    expect(genteDeAtajo('nadie', GENTE)).toEqual([])
  })

  it('los mayores y los peques se parten por el peso, no por la edad', () => {
    expect(mayoresDe(GENTE)).toHaveLength(6)
    expect(pequesDe(GENTE)).toHaveLength(3)
  })
})

describe('qué atajo describe lo que hay marcado', () => {
  it('se calcula y no se guarda, así que sigue al reparto', () => {
    expect(atajoDe(ids(GENTE), GENTE)).toBe('todos')
    expect(atajoDe(ids(mayoresDe(GENTE)), GENTE)).toBe('mayores')
    expect(atajoDe(['g3', 'p3', 's3'], GENTE)).toBe('peques')
    expect(atajoDe([], GENTE)).toBe('nadie')
  })

  it('y ninguno cuando el reparto ya no es ninguno de los cuatro', () => {
    // Si se guardara «mayores», quitar a Bea a mano dejaría el mando mintiendo.
    const sinBea = ids(mayoresDe(GENTE)).filter((id) => id !== 's2')
    expect(atajoDe(sinBea, GENTE)).toBe(null)
  })

  it('el orden en que llegan los ids da igual', () => {
    expect(atajoDe([...ids(GENTE)].reverse(), GENTE)).toBe('todos')
  })
})

describe('la gente por familias', () => {
  it('sale ordenada por nombre, y no en el orden en que caen los ids', () => {
    expect(porFamilias(GENTE, FAMILIAS).map((g) => g.nombre)).toEqual(['García', 'Pérez', 'Solteros'])
  })

  it('quien no tiene familia cae en «Sueltos», al final', () => {
    const conSuelto = [...GENTE, mayor('x1', 'Invitado', null)]
    const grupos = porFamilias(conSuelto, FAMILIAS)
    expect(grupos.at(-1)).toMatchObject({ id: null, nombre: 'Sueltos' })
    expect(grupos.at(-1).gente).toHaveLength(1)
  })

  it('una familia sin gente no ocupa sitio', () => {
    const grupos = porFamilias(GENTE, [...FAMILIAS, { id: 'vacia', name: 'Nadie' }])
    expect(grupos.map((g) => g.nombre)).not.toContain('Nadie')
  })
})

describe('el estado de una familia', () => {
  const garcia = GENTE.filter((p) => p.familyId === 'garcia')

  it('tiene tres, y el de en medio es el que hay que dibujar', () => {
    expect(estadoDeFamilia(garcia, new Set(['g1', 'g2', 'g3']))).toBe('todo')
    expect(estadoDeFamilia(garcia, new Set(['g1', 'g2']))).toBe('parte')
    expect(estadoDeFamilia(garcia, new Set())).toBe('nada')
  })
})

describe('el renglón de una familia', () => {
  const garcia = GENTE.filter((p) => p.familyId === 'garcia')

  it('dice quién está dentro mientras quepa', () => {
    expect(quienDeFamilia(garcia, new Set(['g1', 'g2', 'g3']))).toBe('Curro · Marta · Pablo')
    expect(quienDeFamilia(garcia, new Set(['p1', 'g1']))).toBe('Curro')
  })

  it('y «n de m» cuando los nombres no caben', () => {
    const largos = [mayor('a', 'Maximiliano', 'x'), mayor('b', 'Inmaculada', 'x'), mayor('c', 'Bartolomé', 'x')]
    expect(quienDeFamilia(largos, new Set(['a', 'b', 'c']))).toBe('3 de 3')
  })

  it('y «nadie» cuando no hay nadie, que es lo que un cero no dice', () => {
    expect(quienDeFamilia(garcia, new Set())).toBe('nadie')
  })
})

describe('el buscador', () => {
  it('no distingue mayúsculas ni tildes', () => {
    const conTilde = [...GENTE, mayor('x', 'Ánabel', 'perez')]
    expect(buscarGente(conTilde, 'anabel').map((p) => p.name)).toEqual(['Ánabel'])
    expect(buscarGente(conTilde, 'ÁNA').map((p) => p.name)).toEqual(['Ana', 'Ánabel'])
  })

  it('busca también por el apodo', () => {
    const conApodo = [{ id: 'z', name: 'Ignacio', apodo: 'Nacho', cuentaComoAdultoReparto: true }]
    expect(buscarGente(conApodo, 'nacho')).toHaveLength(1)
  })

  it('sin nada escrito no devuelve a nadie: la lista no se pinta hasta que buscas', () => {
    expect(buscarGente(GENTE, '')).toEqual([])
    expect(buscarGente(GENTE, '   ')).toEqual([])
  })
})

describe('cómo se reparte, dicho en dos palabras', () => {
  it('lo normal no se anuncia', () => {
    expect(comoSeReparte({ participantIds: ids(GENTE) }, GENTE)).toBe('')
  })

  it('los dos repartos con nombre propio', () => {
    expect(comoSeReparte({ participantIds: ids(mayoresDe(GENTE)) }, GENTE)).toBe('sin los niños')
    expect(comoSeReparte({ participantIds: ['g3', 'p3', 's3'] }, GENTE)).toBe('solo los peques')
  })

  it('el reparto fino manda sobre quién entra', () => {
    expect(comoSeReparte({ participantIds: ids(GENTE), reparto: { modo: 'partes' } }, GENTE)).toBe('a partes')
    expect(comoSeReparte({ participantIds: ids(GENTE), reparto: { modo: 'importes' } }, GENTE)).toBe('por importes')
  })

  it('y quedarse sin nadie se dice, porque así no se puede guardar', () => {
    expect(comoSeReparte({ participantIds: [] }, GENTE)).toBe('nadie todavía')
  })

  it('cualquier otra cosa, por su número', () => {
    expect(comoSeReparte({ participantIds: ['g1', 'p1'] }, GENTE)).toBe('entre 2')
  })
})
