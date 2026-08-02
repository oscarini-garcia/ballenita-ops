import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Acordeon from './Acordeon.jsx'

describe('Acordeon — se acuerda de dónde lo dejaste', () => {
  beforeEach(() => localStorage.clear())

  it('arranca plegado y guarda que lo has abierto', async () => {
    const { unmount } = render(<Acordeon titulo="La app"><p>dentro</p></Acordeon>)
    const detalle = screen.getByText('La app').closest('details')
    expect(detalle.open).toBe(false)
    await userEvent.click(screen.getByText('La app'))
    expect(localStorage.getItem('ballena.acordeon.La app')).toBe('1')
    unmount()

    // Es lo que pasa al forzar la última versión: la app se recarga y tiene que
    // volver al mismo sitio en vez de a una lista de solapas cerradas.
    render(<Acordeon titulo="La app"><p>dentro</p></Acordeon>)
    expect(screen.getByText('La app').closest('details').open).toBe(true)
  })

  it('lo guardado manda sobre el valor de fábrica', async () => {
    localStorage.setItem('ballena.acordeon.Aspecto', '0')
    render(<Acordeon titulo="Aspecto" abierta><p>dentro</p></Acordeon>)
    expect(screen.getByText('Aspecto').closest('details').open).toBe(false)
  })

  it('cada apartado recuerda el suyo', async () => {
    render(
      <>
        <Acordeon titulo="Evento"><p>uno</p></Acordeon>
        <Acordeon titulo="El grupo"><p>dos</p></Acordeon>
      </>,
    )
    await userEvent.click(screen.getByText('El grupo'))
    expect(localStorage.getItem('ballena.acordeon.El grupo')).toBe('1')
    expect(localStorage.getItem('ballena.acordeon.Evento')).toBe(null)
  })
})
