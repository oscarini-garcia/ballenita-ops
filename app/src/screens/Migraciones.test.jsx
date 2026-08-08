import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'

/**
 * «Poner la base al día» (SPECS §14.23): si administras y la base va por
 * detrás del código, Ajustes → Actualizar lo dice y lo arregla desde el móvil,
 * contando el progreso en su sitio. Antes ese camino era `wrangler` desde un
 * portátil, y el día que no lo había la base se quedaba atrás con la API ya
 * desplegada.
 */
const leerMigraciones = vi.fn()
const aplicarSiguienteMigracion = vi.fn()
vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  listarCuentas: vi.fn(async () => ({ cuentas: [] })),
  hayApi: vi.fn(async () => true),
  leerMigraciones: (...a) => leerMigraciones(...a),
  aplicarSiguienteMigracion: (...a) => aplicarSiguienteMigracion(...a),
}))

const { default: EventSettingsScreen } = await import('./EventSettingsScreen.jsx')

function entrarComo(rol) {
  localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { nombre: 'Óscar', rol } }))
}

const pintar = () => render(
  <EventSettingsScreen eventId="ev_1" event={{ id: 'ev_1', name: 'Viaje 2026' }} sync={{ recheck: vi.fn() }} />,
)

beforeEach(() => {
  leerMigraciones.mockReset()
  aplicarSiguienteMigracion.mockReset()
})
afterEach(() => localStorage.clear())

describe('poner la base al día', () => {
  it('si la base va por detrás, lo dice con nombres y sale el botón', async () => {
    entrarComo('administrador')
    leerMigraciones.mockResolvedValue({
      migraciones: [
        { id: '0009_recetas_con_cantidades', pendiente: false },
        { id: '0010_mejoras', pendiente: true },
      ],
    })
    pintar()

    expect(await screen.findByText(/va 1 migración por detrás del código \(0010_mejoras\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Poner la base al día' })).toBeInTheDocument()
  })

  it('aplicarlas cuenta el progreso migración a migración, y acaba diciendo que está al día', async () => {
    entrarComo('administrador')
    leerMigraciones.mockResolvedValue({
      migraciones: [
        { id: '0010_mejoras', pendiente: true },
        { id: '0011_lo_que_venga', pendiente: true },
      ],
    })
    aplicarSiguienteMigracion
      .mockResolvedValueOnce({ aplicada: { id: '0010_mejoras', ejecutadas: 1, saltadas: 0 }, pendientes: ['0011_lo_que_venga'] })
      .mockResolvedValueOnce({ aplicada: { id: '0011_lo_que_venga', ejecutadas: 2, saltadas: 1 }, pendientes: [] })
    pintar()

    await userEvent.click(await screen.findByRole('button', { name: 'Poner la base al día' }))

    expect(await screen.findByText('La base de datos está al día.')).toBeInTheDocument()
    expect(aplicarSiguienteMigracion).toHaveBeenCalledTimes(2)
    const pasos = document.querySelectorAll('.pasos li')
    expect(pasos).toHaveLength(2)
    expect([...pasos].every((p) => p.dataset.estado === 'hecho')).toBe(true)
    // Media migración ya estaba: se dice en su renglón, no se esconde.
    expect(pasos[1].textContent).toContain('1 ya estaban')
    // Y el botón se ha ido: no queda nada que aplicar.
    expect(screen.queryByRole('button', { name: 'Poner la base al día' })).not.toBeInTheDocument()
  })

  it('un fallo se queda en su paso, copiable, y no sigue aplicando a ciegas', async () => {
    entrarComo('administrador')
    leerMigraciones.mockResolvedValue({
      migraciones: [
        { id: '0010_mejoras', pendiente: true },
        { id: '0011_lo_que_venga', pendiente: true },
      ],
    })
    aplicarSiguienteMigracion.mockRejectedValue(new Error('HTTP 500: no such table: mejoras'))
    pintar()

    await userEvent.click(await screen.findByRole('button', { name: 'Poner la base al día' }))

    await waitFor(() => {
      expect(document.querySelector('.pasos li[data-estado="fallo"]')).not.toBeNull()
    })
    expect(aplicarSiguienteMigracion).toHaveBeenCalledTimes(1)
    // El renglón del fallo lleva el informe y se toca para copiarlo (§14.9-bis).
    expect(document.querySelector('.pasos li[data-copiable="si"]')).not.toBeNull()
    // El botón sigue: arreglado el motivo, se reintenta desde aquí mismo.
    expect(screen.getByRole('button', { name: 'Poner la base al día' })).toBeInTheDocument()
  })

  it('si no se puede ni preguntar, se dice: el silencio se leía como «está al día»', async () => {
    // La consulta se tragaba su error y el bloque no aparecía. Desde el móvil,
    // «no hay nada que aplicar» y «no he podido preguntarlo» se ven igual —no se
    // ve nada—, y quien viene justo a lanzar una migración se queda buscando un
    // botón que no existe.
    entrarComo('administrador')
    leerMigraciones.mockRejectedValue(new Error('HTTP 401: sesión caducada'))
    pintar()

    const traza = await screen.findByText(/No se ha podido preguntar por las migraciones/)
    expect(traza).toHaveTextContent('HTTP 401: sesión caducada')
    expect(traza).toHaveClass('mal')
  })

  it('con la base al día lo dice, y no ofrece el botón', async () => {
    // Antes esto no pintaba nada, igual que «no administras» y que «no he podido
    // preguntar»: tres silencios distintos que desde el móvil son el mismo hueco.
    entrarComo('administrador')
    leerMigraciones.mockResolvedValue({ migraciones: [{ id: '0010_mejoras', pendiente: false }] })
    pintar()
    expect(await screen.findByText('La base de datos está al día.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Poner la base al día' })).not.toBeInTheDocument()
    expect(screen.queryByText(/por detrás del código/)).not.toBeInTheDocument()
  })

  it('quien no administra ve por qué no ve el botón, y no se pregunta a la API', async () => {
    leerMigraciones.mockClear()
    entrarComo('miembro')
    pintar()
    expect(await screen.findByText(/la pone al día quien administra/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Poner la base al día' })).not.toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 50))
    expect(leerMigraciones).not.toHaveBeenCalled()
  })
})
