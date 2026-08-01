import { describe, it, expect, afterEach } from 'vitest'
import { bloquearScrollDeFondo, liberarScrollDeFondo } from './scrollLock.js'

afterEach(() => {
  // Por si un test deja el contador a medias.
  for (let i = 0; i < 5; i += 1) liberarScrollDeFondo()
  document.body.removeAttribute('style')
  document.body.classList.remove('modal-abierto')
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

  it('marca el body para que el scroller de la app también se pare', () => {
    // Desde que el esqueleto es una columna de 100dvh, quien se desplaza es
    // `.body` (un div) y no el documento: fijar el body de la página no le hace
    // nada, y de eso se encarga la clase (ver theme.css).
    bloquearScrollDeFondo()
    expect(document.body.classList.contains('modal-abierto')).toBe(true)

    liberarScrollDeFondo()
    expect(document.body.classList.contains('modal-abierto')).toBe(false)
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
