import { describe, it, expect, afterEach } from 'vitest'
import { bloquearScrollDeFondo, liberarScrollDeFondo } from './scrollLock.js'

afterEach(() => {
  // Por si un test deja el contador a medias.
  for (let i = 0; i < 5; i += 1) liberarScrollDeFondo()
  document.body.removeAttribute('style')
})

describe('bloqueo de scroll del fondo', () => {
  it('fija el body mientras el modal está abierto y lo devuelve al cerrar', () => {
    window.scrollY = 240

    bloquearScrollDeFondo()
    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.top).toBe('-240px')
    expect(document.body.style.overflow).toBe('hidden')

    liberarScrollDeFondo()
    expect(document.body.style.position).toBe('')
    expect(document.body.style.top).toBe('')
  })

  it('con modales anidados solo libera el último en cerrarse', () => {
    bloquearScrollDeFondo()
    bloquearScrollDeFondo()

    liberarScrollDeFondo()
    expect(document.body.style.position).toBe('fixed')

    liberarScrollDeFondo()
    expect(document.body.style.position).toBe('')
  })

  it('liberar de más no toca el body', () => {
    liberarScrollDeFondo()
    document.body.style.color = 'red'
    liberarScrollDeFondo()
    expect(document.body.style.color).toBe('red')
  })
})
