import { describe, it, expect, beforeEach } from 'vitest'
import { TAMANOS, getTamano, setTamano, applyTamano } from './tamano.js'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-texto')
})

describe('tamaño del texto', () => {
  it('de fábrica es «grande» y no escribe atributo', () => {
    expect(getTamano()).toBe('grande')
    expect(applyTamano()).toBe('grande')
    // El valor de fábrica vive en el CSS y en un sitio solo: escribirlo aquí
    // también sería una segunda copia que solo puede discrepar.
    expect(document.documentElement.getAttribute('data-texto')).toBeNull()
  })

  it('guarda la talla elegida y la marca en el <html>', () => {
    setTamano('normal')
    expect(getTamano()).toBe('normal')
    applyTamano()
    expect(document.documentElement.getAttribute('data-texto')).toBe('normal')

    setTamano('enorme')
    applyTamano()
    expect(document.documentElement.getAttribute('data-texto')).toBe('enorme')

    setTamano('grande')
    applyTamano()
    expect(document.documentElement.getAttribute('data-texto')).toBeNull()
  })

  it('ignora una talla que no existe (p. ej. de una versión anterior)', () => {
    localStorage.setItem('ballena.tamano', 'gigantesco')
    expect(getTamano()).toBe('grande')
  })

  it('las tallas van de menor a mayor y arrancan en 1', () => {
    expect(TAMANOS[0].escala).toBe(1)
    const escalas = TAMANOS.map((t) => t.escala)
    expect([...escalas].sort((a, b) => a - b)).toEqual(escalas)
  })
})
