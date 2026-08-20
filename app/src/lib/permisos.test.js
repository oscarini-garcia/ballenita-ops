import { describe, it, expect } from 'vitest'
import {
  esAdultoDelGrupo, hayCerrojos, mandaEnTodo, porQueNoPuedes,
  puedeEditarBungas, puedeEditarCacharro, puedeEditarFamilia, puedeMoverDeFamilia,
  puedeMarcarAusencias,
} from './permisos.js'

const ADMIN = { cuenta: { rol: 'administrador' } }
const MIEMBRO = { cuenta: { rol: 'miembro' } }
const curro = { id: 'curro', familyId: 'garcia', edad: 'adulto' }
const ana = { id: 'ana', familyId: 'perez', edad: 'adulto' }
const fran = { id: 'fran', familyId: 'garcia', edad: 'adolescente' }
const nino = { id: 'nino', familyId: 'garcia', edad: 'niño' }

describe('quién toca qué del grupo (§14.63)', () => {
  it('sin sesión no se capa nada: la libreta local y la demostración son de quien tiene el móvil', () => {
    expect(mandaEnTodo(null)).toBe(true)
    expect(puedeEditarFamilia(null, null, 'garcia')).toBe(true)
    expect(puedeEditarBungas(null, null)).toBe(true)
    expect(puedeMoverDeFamilia(null)).toBe(true)
    expect(hayCerrojos(null)).toBe(false)
    expect(porQueNoPuedes(null, null)).toBe(null)
  })

  it('quien administra puede todo, incluida la familia de otros', () => {
    expect(puedeEditarFamilia(ADMIN, curro, 'perez')).toBe(true)
    expect(puedeMoverDeFamilia(ADMIN)).toBe(true)
    expect(hayCerrojos(ADMIN)).toBe(false)
  })

  it('un adulto edita **su** familia y no la de al lado', () => {
    expect(puedeEditarFamilia(MIEMBRO, curro, 'garcia')).toBe(true)
    expect(puedeEditarFamilia(MIEMBRO, curro, 'perez')).toBe(false)
    expect(puedeEditarFamilia(MIEMBRO, ana, 'perez')).toBe(true)
  })

  it('y los bungas los toca cualquier adulto, también los de otras casas', () => {
    // Colocar a las familias lo hace quien llega primero al camping, y las notas
    // del sitio las escribe quien ha dormido en él.
    expect(puedeEditarBungas(MIEMBRO, curro)).toBe(true)
    expect(puedeEditarBungas(MIEMBRO, ana)).toBe(true)
  })

  it('un adolescente y un niño solo miran', () => {
    expect(esAdultoDelGrupo(fran)).toBe(false)
    expect(esAdultoDelGrupo(nino)).toBe(false)
    expect(puedeEditarFamilia(MIEMBRO, fran, 'garcia')).toBe(false)
    expect(puedeEditarBungas(MIEMBRO, fran)).toBe(false)
  })

  it('sin identidad puesta, un miembro no edita nada: «lo tuyo» no significa nada', () => {
    expect(puedeEditarFamilia(MIEMBRO, null, 'garcia')).toBe(false)
    expect(puedeEditarBungas(MIEMBRO, null)).toBe(false)
  })

  it('mover gente entre familias y crear o borrar una es solo de quien administra', () => {
    // Son las dos cosas que redistribuyen el reparto de todos los demás.
    expect(puedeMoverDeFamilia(MIEMBRO)).toBe(false)
    expect(puedeMoverDeFamilia(ADMIN)).toBe(true)
  })

  it('el cacharro es de su familia, como su ficha', () => {
    expect(puedeEditarCacharro(MIEMBRO, curro, 'garcia')).toBe(true)
    expect(puedeEditarCacharro(MIEMBRO, curro, 'solteros')).toBe(false)
  })

  it('a quien no puede se le dice por qué, y con la razón que le toca', () => {
    // Una pantalla que no reacciona y no dice por qué es peor que una que capa.
    expect(porQueNoPuedes(MIEMBRO, fran)).toMatch(/adultos del grupo/)
    expect(porQueNoPuedes(MIEMBRO, curro)).toMatch(/tu familia y lo de los bungas/)
  })
})

/**
 * Quién dice que alguien se ha ido unos días (§14.79).
 *
 * La misma excepción que los bungas y por la misma razón: quién está hoy en el
 * camping no es un dato privado de una casa, es de lo que cuelgan la compra y el
 * reparto de cada gasto nuevo. Y **no arrastra la ficha**: seguir editando el
 * nombre y la edad de otra casa sigue prohibido.
 */
describe('quién marca las ausencias', () => {
  it('cualquier adulto, y de cualquier casa', () => {
    expect(puedeMarcarAusencias(MIEMBRO, curro)).toBe(true)
    expect(puedeMarcarAusencias(MIEMBRO, ana)).toBe(true)
    expect(puedeMarcarAusencias(ADMIN, curro)).toBe(true)
    expect(puedeMarcarAusencias(null, null)).toBe(true)
  })

  it('un adolescente y un niño no', () => {
    expect(puedeMarcarAusencias(MIEMBRO, fran)).toBe(false)
    expect(puedeMarcarAusencias(MIEMBRO, nino)).toBe(false)
  })

  it('sin identidad puesta tampoco: «cualquier adulto» exige saber que lo eres', () => {
    expect(puedeMarcarAusencias(MIEMBRO, null)).toBe(false)
  })

  it('y no abre la ficha de la casa de al lado', () => {
    expect(puedeMarcarAusencias(MIEMBRO, curro)).toBe(true)
    expect(puedeEditarFamilia(MIEMBRO, curro, 'perez')).toBe(false)
  })
})
