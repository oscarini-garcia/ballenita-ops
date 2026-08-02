import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'

/**
 * El botón «Salir» de Ajustes → Tu cuenta, que es por donde se perdía el evento.
 *
 * Borraba la copia local **y la cola de cambios** de un tirón. Lo que aún no
 * había subido no volvía al entrar de nuevo, porque la instantánea del servidor
 * es entonces la única fuente. Este test mira lo único que importa de verdad:
 * que con cambios sin subir **no se borre nada** hasta que se diga que sí.
 */
vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  listarCuentas: vi.fn(async () => ({ cuentas: [] })),
  hayApi: vi.fn(async () => true),
}))

const olvidarTodo = vi.fn(async () => {})
vi.mock('../db.js', async (original) => ({
  ...(await original()),
  olvidarTodo: (...a) => olvidarTodo(...a),
}))

const comprobar = vi.fn()
vi.mock('../lib/salida.js', async (original) => ({
  ...(await original()),
  comprobarAntesDeSalir: (...a) => comprobar(...a),
}))

const { default: EventSettingsScreen } = await import('./EventSettingsScreen.jsx')

const recargar = vi.fn()

beforeEach(() => {
  olvidarTodo.mockClear()
  comprobar.mockReset()
  recargar.mockClear()
  localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { nombre: 'Óscar', rol: 'miembro' } }))
  // `window.location.reload` no existe en jsdom y saldría por la pantalla.
  Object.defineProperty(window, 'location', { value: { reload: recargar }, writable: true })
})
afterEach(() => localStorage.clear())

const pintar = () => render(
  <EventSettingsScreen eventId="ev_1" event={{ id: 'ev_1', name: 'Demo' }} sync={{ recheck: vi.fn() }} />,
)

describe('salir de la cuenta', () => {
  it('sin nada pendiente sale a la primera', async () => {
    comprobar.mockResolvedValue({ seguro: true, pendientes: 0, subidos: 0 })
    pintar()

    await userEvent.click(screen.getByRole('button', { name: 'Salir' }))

    await waitFor(() => expect(olvidarTodo).toHaveBeenCalled())
    expect(recargar).toHaveBeenCalled()
  })

  it('con cambios sin subir NO borra: avisa y espera', async () => {
    comprobar.mockResolvedValue({ seguro: false, pendientes: 3, motivo: 'no hay conexión' })
    pintar()

    await userEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/3 cambios sin subir: no hay conexión/)
    // Lo que se estaba comprobando: nada se ha borrado todavía.
    expect(olvidarTodo).not.toHaveBeenCalled()
    expect(recargar).not.toHaveBeenCalled()
  })

  it('«Quedarme» deja las cosas como estaban', async () => {
    comprobar.mockResolvedValue({ seguro: false, pendientes: 1, motivo: 'no hay conexión' })
    pintar()

    await userEvent.click(screen.getByRole('button', { name: 'Salir' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Quedarme' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(olvidarTodo).not.toHaveBeenCalled()
  })

  it('«Salir igualmente» sí borra: la decisión es de quien sale, no del botón', async () => {
    comprobar.mockResolvedValue({ seguro: false, pendientes: 2, motivo: 'no hay conexión' })
    pintar()

    await userEvent.click(screen.getByRole('button', { name: 'Salir' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Salir igualmente' }))

    await waitFor(() => expect(olvidarTodo).toHaveBeenCalled())
    expect(recargar).toHaveBeenCalled()
  })
})
