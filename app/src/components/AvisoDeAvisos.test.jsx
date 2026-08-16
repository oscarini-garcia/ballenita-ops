import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * El recordatorio de los avisos, en «Hoy» (SPECS §14.65).
 */
const estadoDePush = vi.fn()
vi.mock('../lib/native.js', async (original) => ({
  ...(await original()),
  estadoDePush: (...a) => estadoDePush(...a),
  tap: vi.fn(),
}))
const asegurarPush = vi.fn()
vi.mock('../lib/push.js', () => ({ asegurarPush: (...a) => asegurarPush(...a) }))

const { default: AvisoDeAvisos } = await import('./AvisoDeAvisos.jsx')

// «Estrenado» es haber sincronizado alguna vez: sin eso no se recuerda nada.
const estrenado = () => localStorage.setItem('ballena.sync.ultima', String(Date.now()))

beforeEach(() => {
  localStorage.clear()
  estadoDePush.mockReset()
  asegurarPush.mockReset()
  estrenado()
})
afterEach(() => localStorage.clear())

describe('el recordatorio de los avisos', () => {
  it('sin contestar, invita y ofrece encenderlos', async () => {
    estadoDePush.mockResolvedValue('prompt')
    render(<AvisoDeAvisos />)

    expect(await screen.findByText(/Enciende los avisos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Encender los avisos' })).toBeInTheDocument()
  })

  // La asimetría que hace que esto no sea un «vuelve a preguntar»: con el
  // permiso denegado, iOS no vuelve a enseñar su hoja.
  it('denegado, dice dónde se enciende y no ofrece ningún botón que no haga nada', async () => {
    estadoDePush.mockResolvedValue('denied')
    render(<AvisoDeAvisos />)

    expect(await screen.findByText(/Los avisos están apagados/)).toBeInTheDocument()
    expect(screen.getByText(/Ajustes del iPhone/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Encender/ })).toBeNull()
  })

  it('con los avisos encendidos no se ve nada', async () => {
    estadoDePush.mockResolvedValue('granted')
    const { container } = render(<AvisoDeAvisos />)

    await waitFor(() => expect(estadoDePush).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('en el primer arranque tampoco: el permiso no se pide en el primer segundo', async () => {
    localStorage.clear()
    estadoDePush.mockResolvedValue('prompt')
    const { container } = render(<AvisoDeAvisos />)

    await waitFor(() => expect(estadoDePush).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('«Ahora no» lo retira y lo apunta, para no volver hasta dentro de una semana', async () => {
    estadoDePush.mockResolvedValue('prompt')
    render(<AvisoDeAvisos />)

    await userEvent.click(await screen.findByRole('button', { name: 'Ahora no' }))

    expect(screen.queryByText(/Enciende los avisos/)).toBeNull()
    expect(Number(localStorage.getItem('ballena.avisos.recordado'))).toBeGreaterThan(0)
  })

  it('encender hace el camino entero, no solo el permiso', async () => {
    estadoDePush.mockResolvedValueOnce('prompt').mockResolvedValue('granted')
    asegurarPush.mockResolvedValue({ estado: 'apuntado' })
    render(<AvisoDeAvisos />)

    await userEvent.click(await screen.findByRole('button', { name: 'Encender los avisos' }))

    expect(asegurarPush).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText(/Enciende los avisos/)).toBeNull())
  })

  // Lo que falla se dice: «encendido» sin que llegue nada es el fallo que más
  // veces se ha pagado en este apartado (§14.17-ter).
  it('si no se puede, lo cuenta con sus palabras', async () => {
    estadoDePush.mockResolvedValue('prompt')
    asegurarPush.mockResolvedValue({ estado: 'error', motivo: 'Apple rechazó el registro: sin entitlement' })
    render(<AvisoDeAvisos />)

    await userEvent.click(await screen.findByRole('button', { name: 'Encender los avisos' }))

    expect(await screen.findByText(/sin entitlement/)).toBeInTheDocument()
  })
})
