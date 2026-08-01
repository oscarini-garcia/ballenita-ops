import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccesoScreen from './AccesoScreen.jsx'
import { modoLocal } from '../auth/sesion.js'

vi.mock('../auth/apple.js', () => ({ entrarConApple: vi.fn() }))
const { entrarConApple } = await import('../auth/apple.js')

const CONFIG = { api: 'https://ejemplo.workers.dev' }

beforeEach(() => {
  entrarConApple.mockReset()
})

describe('AccesoScreen', () => {
  it('entra con Apple y entrega la sesión', async () => {
    const sesion = { token: 'jwt', cuenta: { id: 'cta_1', nombre: 'Curro' } }
    entrarConApple.mockResolvedValue(sesion)
    const onEntrar = vi.fn()

    render(<AccesoScreen configuracion={CONFIG} onEntrar={onEntrar} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))

    expect(onEntrar).toHaveBeenCalledWith(sesion)
  })

  it('enseña el motivo cuando Apple falla', async () => {
    entrarConApple.mockRejectedValue(new Error('Apple canceló el acceso (error 1001).'))

    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/1001/)
  })

  it('un identificador sin dar de alta se enseña para pasarlo al grupo', async () => {
    const error = new Error('Este identificador todavía no tiene acceso.')
    error.identificador = '000123.abc'
    entrarConApple.mockRejectedValue(error)

    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))

    expect(await screen.findByText('000123.abc')).toBeInTheDocument()
  })

  // Lo importante de esta pantalla: no puede ser un callejón sin salida. Si
  // Apple no deja pasar por algo que no se arregla desde el móvil, se sigue en
  // local y lo apuntado sube el día que se entre.
  it('deja seguir en local sin entrar, y lo recuerda', async () => {
    const onLocal = vi.fn()
    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} onLocal={onLocal} />)

    expect(modoLocal()).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: /Usar solo en este móvil/i }))

    expect(onLocal).toHaveBeenCalled()
    expect(modoLocal()).toBe(true)
    expect(entrarConApple).not.toHaveBeenCalled()
  })
})
