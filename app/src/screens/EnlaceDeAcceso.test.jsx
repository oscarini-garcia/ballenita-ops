import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'

/**
 * Crear un enlace de acceso desde Ajustes → Cuentas (SPECS §14.61).
 *
 * Lo que importa aquí es que se pide **por persona y no por cuenta**: quien no
 * tiene iPhone nunca ha podido entrar, así que no está en la lista de «quién ha
 * pedido entrar» y no habría dónde tocar.
 */
const gestionarCuenta = vi.fn()
vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  listarCuentas: vi.fn(async () => ({ cuentas: [] })),
  gestionarCuenta: (...a) => gestionarCuenta(...a),
  hayApi: vi.fn(async () => true),
  leerAvisos: vi.fn(async () => ({ clases: [], apagadas: [] })),
  registrarPush: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../lib/config.js', async (original) => ({
  ...(await original()),
  cargarConfiguracion: async () => ({ api: 'https://ejemplo.workers.dev', web: 'https://ballenita.ejemplo' }),
}))
vi.mock('../lib/push.js', () => ({ asegurarPush: vi.fn(async () => ({ estado: 'no-aplica' })) }))

const { default: CuentasSection } = await import('./CuentasSection.jsx')
const { addPerson, createEvent } = await import('../db.js')

let eventId

beforeEach(async () => {
  gestionarCuenta.mockReset()
  localStorage.setItem('ballena.sesion', JSON.stringify({
    token: 't', cuenta: { id: 'cta_1', nombre: 'Óscar', rol: 'administrador' },
  }))
  eventId = await createEvent({ name: 'Camping', startDate: '2026-08-01', endDate: '2026-08-07' })
  await addPerson(eventId, { name: 'Curro García', avatar: '🧔' })
})

afterEach(() => localStorage.clear())

describe('el enlace de acceso', () => {
  it('se pide por persona y enseña la dirección para mandarla', async () => {
    gestionarCuenta.mockResolvedValue({ pase: 'abc.def.ghi', id: 'cta_2' })
    render(<CuentasSection eventId={eventId} sincronizar={vi.fn()} />)

    await userEvent.click(await screen.findByRole('button', { name: /Crear un enlace de acceso/i }))
    await userEvent.click(await screen.findByRole('button', { name: /Curro García/ }))

    await waitFor(() => expect(gestionarCuenta).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'enlace', nombre: 'Curro García' }),
    ))
    expect(await screen.findByText('https://ballenita.ejemplo/#pase=abc.def.ghi')).toBeInTheDocument()
  })

  it('si el servidor dice que no, se dice y no se enseña ningún enlace', async () => {
    gestionarCuenta.mockRejectedValue(new Error('la API respondió 400: esa cuenta está desactivada'))
    render(<CuentasSection eventId={eventId} sincronizar={vi.fn()} />)

    await userEvent.click(await screen.findByRole('button', { name: /Crear un enlace de acceso/i }))
    await userEvent.click(await screen.findByRole('button', { name: /Curro García/ }))

    expect(await screen.findByText(/desactivada/i)).toBeInTheDocument()
    expect(screen.queryByText(/#pase=/)).not.toBeInTheDocument()
  })

  // Quien no administra no tiene ni el botón: la lista de cuentas entera es
  // suya, y esto es la puerta de al lado.
  it('quien no administra no lo ve', async () => {
    localStorage.setItem('ballena.sesion', JSON.stringify({
      token: 't', cuenta: { id: 'cta_9', nombre: 'Curro', rol: 'miembro' },
    }))
    render(<CuentasSection eventId={eventId} sincronizar={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Miembro del grupo')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Crear un enlace de acceso/i })).not.toBeInTheDocument()
  })
})
