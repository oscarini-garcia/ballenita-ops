import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SyncDot, { estadoSync, enCambios } from './SyncDot.jsx'

/**
 * Sin red, el punto dice **cuántos** cambios esperan.
 *
 * La cola sin cobertura crece —una comida, tres gastos, un plan— y «cambios sin
 * subir» dice lo mismo con uno que con veinte. El número es lo que hace esperar
 * a tener cobertura en vez de dar por perdido lo apuntado y volver a teclearlo.
 */
const CONECTADA = { isConfigured: true, online: true }

describe('sin conexión', () => {
  it('dice cuántos cambios esperan, en el rótulo y en el renglón', () => {
    const d = estadoSync({ ...CONECTADA, online: false, pendientes: 14 })
    expect(d.title).toBe('Sin conexión · 14 cambios')
    expect(d.detalle).toMatch(/14 cambios esperando a que vuelva la red/)
    expect(d.cuenta).toBe(14)
  })

  it('uno es «1 cambio», no «1 cambios»', () => {
    expect(enCambios(1)).toBe('1 cambio')
    expect(enCambios(2)).toBe('2 cambios')
    expect(estadoSync({ ...CONECTADA, online: false, pendientes: 1 }).title).toBe('Sin conexión · 1 cambio')
  })

  it('sin nada esperando no se inventa un número', () => {
    const d = estadoSync({ ...CONECTADA, online: false, pendientes: 0 })
    expect(d.title).toBe('Sin conexión')
    expect(d.cuenta).toBe(0)
  })

  it('y si nadie ha contado, se dice lo de siempre', () => {
    // La ficha de Ajustes se pinta antes de que haya motor: ahí no hay número
    // que enseñar, y enseñar un 0 sería afirmar algo que no se sabe.
    const d = estadoSync({ ...CONECTADA, online: false })
    expect(d.title).toBe('Sin conexión')
    expect(d.cuenta).toBe(0)
  })
})

describe('con red', () => {
  it('los cambios encolados también salen contados', () => {
    expect(estadoSync({ ...CONECTADA, dirty: true, pendientes: 3 }).title).toBe('3 cambios sin subir')
  })

  it('al día no hay nada que contar', () => {
    const d = estadoSync({ ...CONECTADA, pendientes: 0 })
    expect(d.title).toBe('Al día')
    expect(d.cuenta).toBeFalsy()
  })

  it('la sesión caducada también dice cuánto hay en juego', () => {
    // Es el estado en el que más importa: lo apuntado no sube hasta que alguien
    // vuelva a entrar con Apple, y eso puede tardar días.
    expect(estadoSync({ ...CONECTADA, status: 'sesion-caducada', pendientes: 5 }).detalle)
      .toMatch(/5 cambios esperando/)
  })
})

describe('el punto', () => {
  it('enseña el número al lado cuando hay algo esperando', () => {
    render(<SyncDot sync={{ ...CONECTADA, online: false, pendientes: 7 }} />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/7 cambios/)
  })

  it('con más de noventa y nueve no crece más, que la cabecera es la que es', () => {
    render(<SyncDot sync={{ ...CONECTADA, online: false, pendientes: 240 }} />)
    expect(screen.getByText('99+')).toBeInTheDocument()
    // Pero el rótulo sí dice el número de verdad: ahí hay sitio.
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/240 cambios/)
  })

  it('y no enseña nada cuando no hay', () => {
    const { container } = render(<SyncDot sync={{ ...CONECTADA, pendientes: 0 }} />)
    expect(container.querySelector('.cuenta')).toBeNull()
  })
})
