import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'

/**
 * **Aplicar** las migraciones desde el móvil (SPECS §14.23): si administras y la
 * base va por detrás del código, Ajustes → La app lo dice y lo arregla desde
 * aquí, contando el progreso una a una. Antes ese camino era `wrangler` desde un
 * portátil, y el día que no lo había la base se quedaba atrás con la API ya
 * desplegada.
 *
 * Los cinco estados del renglón —al día, por detrás, preguntando, no se ha
 * podido preguntar, no te toca— se fijan en `LaApp.test.jsx`, que es donde vive
 * la ficha (§14.34-quater). Aquí se prueba lo que pasa al pulsar.
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

const pintar = () => render(
  <EventSettingsScreen
    eventId="ev_1"
    event={{ id: 'ev_1', name: 'Viaje 2026' }}
    sync={{ isConfigured: true, online: true, status: 'idle', recheck: vi.fn() }}
  />,
)

/** El dato del renglón de la base, sin su segunda línea. */
const laBase = () => [...document.querySelectorAll('.hecho')]
  .find((h) => h.querySelector('dt').textContent === 'Base de datos')
  ?.querySelector('dd').firstChild?.textContent

beforeEach(() => {
  leerMigraciones.mockReset()
  aplicarSiguienteMigracion.mockReset()
  localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { nombre: 'Óscar', rol: 'administrador' } }))
})
afterEach(() => localStorage.clear())

describe('poner la base al día', () => {
  it('cuenta el progreso migración a migración, y acaba diciendo que está al día', async () => {
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

    await waitFor(() => expect(laBase()).toBe('Al día'))
    expect(aplicarSiguienteMigracion).toHaveBeenCalledTimes(2)
    const pasos = document.querySelectorAll('.pasos li')
    expect(pasos).toHaveLength(2)
    expect([...pasos].every((p) => p.dataset.estado === 'hecho')).toBe(true)
    // Media migración ya estaba: se dice en su renglón, no se esconde.
    expect(pasos[1].textContent).toContain('1 ya estaban')
    // Y el botón se apaga: no queda nada que aplicar, pero sigue en su sitio.
    expect(screen.getByRole('button', { name: 'Poner la base al día' })).toBeDisabled()
  })

  it('un fallo se queda en su paso, copiable, y no sigue aplicando a ciegas', async () => {
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
    // El botón sigue encendido: arreglado el motivo, se reintenta desde aquí mismo.
    expect(screen.getByRole('button', { name: 'Poner la base al día' })).toBeEnabled()
  })
})
