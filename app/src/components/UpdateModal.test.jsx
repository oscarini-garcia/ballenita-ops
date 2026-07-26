import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import UpdateModal from './UpdateModal.jsx'

const estados = () => screen.getAllByRole('listitem').map((li) => li.dataset.estado)

describe('UpdateModal', () => {
  it('enseña bien la versión en curso', () => {
    render(<UpdateModal paso="checking" version="0.1.7" />)
    expect(screen.getByText('v0.1.7')).toBeInTheDocument()
    expect(screen.getByText('Versión en curso')).toBeInTheDocument()
  })

  it('marca el paso en curso, los ya hechos y los que faltan', () => {
    const { rerender } = render(<UpdateModal paso="checking" version="0.1.7" />)
    expect(estados()).toEqual(['ahora', 'pendiente', 'pendiente'])

    rerender(<UpdateModal paso="downloading" version="0.1.7" />)
    expect(estados()).toEqual(['hecho', 'ahora', 'pendiente'])

    rerender(<UpdateModal paso="applying" version="0.1.7" />)
    expect(estados()).toEqual(['hecho', 'hecho', 'ahora'])
    // Los pasos ya cumplidos llevan su ✓.
    expect(screen.getAllByText('✓')).toHaveLength(2)
  })

  it('bloquea el scroll del fondo mientras está abierto', () => {
    const { unmount } = render(<UpdateModal paso="checking" version="0.1.7" />)
    expect(document.body.style.position).toBe('fixed')
    unmount()
    expect(document.body.style.position).toBe('')
  })
})
