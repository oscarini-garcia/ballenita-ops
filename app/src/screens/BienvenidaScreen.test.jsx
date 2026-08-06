import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BienvenidaScreen from './BienvenidaScreen.jsx'

/** Una bajada que va bien y va contando. */
const buena = ({ alAvanzar }) => {
  alAvanzar([{ texto: 'Sesión abierta', estado: 'hecho' }])
  alAvanzar([
    { texto: 'Sesión abierta', estado: 'hecho' },
    { texto: 'Ya está: el viaje del grupo está en este móvil', estado: 'hecho' },
  ])
  return Promise.resolve({ bien: true })
}

describe('BienvenidaScreen', () => {
  it('saluda por tu nombre y cuenta lo que va pasando', async () => {
    render(<BienvenidaScreen nombre="Curro" sincronizar={buena} onListo={vi.fn()} />)

    expect(screen.getByText('Ya estás dentro, Curro')).toBeInTheDocument()
    expect(await screen.findByText(/el viaje del grupo está en este móvil/)).toBeInTheDocument()
  })

  it('avisa cuando ha terminado, para que la app entre', async () => {
    const onListo = vi.fn()
    render(<BienvenidaScreen nombre="Curro" sincronizar={buena} onListo={onListo} />)
    await waitFor(() => expect(onListo).toHaveBeenCalled())
  })

  // Lo que sustituye a la app vacía sin explicación: el motivo y una salida.
  it('cuando falla, lo dice y ofrece reintentar en vez de dejar la app vacía', async () => {
    const onListo = vi.fn()
    const mala = () => Promise.resolve({ bien: false })

    render(<BienvenidaScreen nombre="Curro" sincronizar={mala} onListo={onListo} />)

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.getByText(/Tus datos están a salvo en el servidor/)).toBeInTheDocument()
    expect(onListo).not.toHaveBeenCalled()
  })

  it('reintentar vuelve a bajar, y si esta vez va, entra', async () => {
    const onListo = vi.fn()
    const sincronizar = vi.fn()
      .mockResolvedValueOnce({ bien: false })
      .mockResolvedValueOnce({ bien: true })

    render(<BienvenidaScreen nombre="Curro" sincronizar={sincronizar} onListo={onListo} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(onListo).toHaveBeenCalled())
    expect(sincronizar).toHaveBeenCalledTimes(2)
  })

  // Un fallo que se repite no puede encerrar a nadie: la app funciona sin haber
  // bajado nada, y lo que se apunte subirá cuando la bajada vaya.
  it('deja seguir sin esperar si la bajada no hay manera', async () => {
    const onListo = vi.fn()
    render(<BienvenidaScreen nombre="Curro" sincronizar={() => Promise.resolve({ bien: false })} onListo={onListo} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Seguir sin esperar' }))
    expect(onListo).toHaveBeenCalled()
  })

  it('sin nombre saluda igual, sin dejar un hueco', async () => {
    render(<BienvenidaScreen sincronizar={buena} onListo={vi.fn()} />)
    expect(screen.getByText('Ya estás dentro')).toBeInTheDocument()
  })

  // `sincronizar` cambia de identidad en cada render de App; sin la referencia
  // que lo sujeta, la primera bajada se dispararía dos veces.
  it('la primera bajada se dispara una sola vez', async () => {
    const sincronizar = vi.fn().mockResolvedValue({ bien: true })
    const { rerender } = render(<BienvenidaScreen sincronizar={sincronizar} onListo={vi.fn()} />)
    rerender(<BienvenidaScreen sincronizar={() => sincronizar({ alAvanzar: () => {} })} onListo={vi.fn()} />)

    await waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1))
  })
})
