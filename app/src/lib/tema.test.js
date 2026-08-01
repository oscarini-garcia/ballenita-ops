import { describe, it, expect, beforeEach } from 'vitest'
import { TEMAS, getTema, setTema, applyTema } from './tema.js'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-tema')
})

describe('tema', () => {
  it('de fábrica es «auto» y no escribe atributo', () => {
    // Sin atributo manda la consulta de medios, que es lo que quiere decir
    // «automático»: seguir al claro/oscuro del sistema.
    expect(getTema()).toBe('auto')
    expect(applyTema()).toBe('auto')
    expect(document.documentElement.getAttribute('data-tema')).toBeNull()
  })

  it('claro y oscuro se marcan en el <html> para ganarle a la consulta de medios', () => {
    setTema('claro')
    applyTema()
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro')

    setTema('oscuro')
    applyTema()
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro')

    setTema('auto')
    applyTema()
    expect(document.documentElement.getAttribute('data-tema')).toBeNull()
  })

  it('ignora un tema que no existe (p. ej. un skin de la versión anterior)', () => {
    localStorage.setItem('ballena.tema', 'abisal')
    expect(getTema()).toBe('auto')
  })

  it('son tres y solo tres', () => {
    expect(TEMAS.map((t) => t.id)).toEqual(['auto', 'claro', 'oscuro'])
  })
})
