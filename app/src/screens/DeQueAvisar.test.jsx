import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'

/**
 * De qué avisarte (SPECS §14.39).
 *
 * El catálogo lo manda el servidor con los nombres puestos: esta pantalla **no
 * lleva su propia copia**, porque una clase que se llame distinto en los dos
 * sitios se apaga en uno y sigue sonando en el otro. Lo que se prueba aquí es
 * eso, y que un guardado que falla **devuelve el interruptor a donde estaba**
 * — dejarlo puesto diría que está apagado cuando el servidor sigue avisando.
 */
const CATALOGO = [
  { id: 'solicitud', titulo: 'Alguien quiere entrar', pista: 'Solo a quien administra.', soloAdministradores: true, quiero: true },
  { id: 'dinero', titulo: 'Gastos que te tocan', pista: 'Un gasto nuevo que te mueve el saldo.', quiero: true },
  { id: 'estado', titulo: 'En qué anda la gente', pista: 'Cuando alguien cambia su estado.', quiero: false },
]

const leerAvisos = vi.fn()
const guardarAvisos = vi.fn()

vi.mock('../lib/native.js', async (original) => ({
  ...(await original()),
  isNative: () => true,
  tap: async () => {},
  estadoDePush: async () => 'granted',
}))

vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  listarCuentas: vi.fn(async () => ({ cuentas: [] })),
  hayApi: vi.fn(async () => true),
  leerAvisos: (...a) => leerAvisos(...a),
  guardarAvisos: (...a) => guardarAvisos(...a),
}))

const { NotificacionesSection } = await import('./CuentasSection.jsx')

beforeEach(() => {
  leerAvisos.mockReset()
  guardarAvisos.mockReset()
  leerAvisos.mockResolvedValue({ clases: CATALOGO, esAdministrador: true })
  guardarAvisos.mockImplementation(async (clases) => ({
    clases: CATALOGO.map((c) => (c.id in clases ? { ...c, quiero: clases[c.id] } : c)),
  }))
  localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { nombre: 'Óscar', rol: 'administrador' } }))
})
afterEach(() => localStorage.clear())

describe('de qué avisarte', () => {
  it('pinta el catálogo que manda el servidor, con sus nombres', async () => {
    render(<NotificacionesSection />)
    expect(await screen.findByText('Gastos que te tocan')).toBeInTheDocument()
    expect(screen.getByText('En qué anda la gente')).toBeInTheDocument()
    expect(screen.getByText('Alguien quiere entrar')).toBeInTheDocument()
  })

  it('el estado de cada uno se lee sin tocarlo', async () => {
    render(<NotificacionesSection />)
    const dinero = (await screen.findByText('Gastos que te tocan')).closest('.row')
    expect(dinero.querySelector('[aria-pressed]')).toHaveAttribute('aria-pressed', 'true')
    const estado = screen.getByText('En qué anda la gente').closest('.row')
    expect(estado.querySelector('[aria-pressed]')).toHaveAttribute('aria-pressed', 'false')
  })

  it('apagar uno lo guarda al momento, sin botón de guardar', async () => {
    render(<NotificacionesSection />)
    const dinero = (await screen.findByText('Gastos que te tocan')).closest('.row')
    await userEvent.click(dinero.querySelector('[aria-pressed]'))

    await waitFor(() => expect(guardarAvisos).toHaveBeenCalledWith({ dinero: false }))
    await waitFor(() => expect(dinero.querySelector('[aria-pressed]')).toHaveAttribute('aria-pressed', 'false'))
  })

  it('si el guardado falla, el interruptor vuelve a donde estaba', async () => {
    guardarAvisos.mockRejectedValue(new Error('la API no contestó en 20 s'))
    render(<NotificacionesSection />)
    const dinero = (await screen.findByText('Gastos que te tocan')).closest('.row')
    await userEvent.click(dinero.querySelector('[aria-pressed]'))

    // Y se dice: un interruptor que se desdice solo, sin explicación, se lee
    // como que la pantalla no funciona.
    expect(await screen.findByText(/No se ha podido guardar/)).toBeInTheDocument()
    await waitFor(() => expect(dinero.querySelector('[aria-pressed]')).toHaveAttribute('aria-pressed', 'true'))
  })

  it('a quien no administra no se le pinta el interruptor que nunca podría sonar', async () => {
    localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { nombre: 'Ana', rol: 'miembro' } }))
    render(<NotificacionesSection />)
    expect(await screen.findByText('Gastos que te tocan')).toBeInTheDocument()
    expect(screen.queryByText('Alguien quiere entrar')).toBeNull()
  })
})
