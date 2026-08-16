import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'
import { leerSesion } from './auth/sesion.js'

/**
 * Entrar por el enlace de acceso, desde el navegador (SPECS §14.61).
 *
 * `isNative()` **no** se finge aquí, y es a propósito: lo que se prueba es
 * justo el caso de la web, donde la puerta de Apple no existe y hasta ahora la
 * app solo podía ser una libreta local.
 */
vi.mock('./lib/config.js', async (original) => ({
  ...(await original()),
  cargarConfiguracion: async () => ({ api: 'https://ejemplo.workers.dev' }),
}))
vi.mock('./lib/push.js', () => ({ asegurarPush: vi.fn(async () => ({ estado: 'no-aplica' })) }))
vi.mock('./sync/api.js', async (original) => ({
  ...(await original()),
  hayApi: vi.fn(async () => false),
  traerInstantanea: vi.fn(),
  enviarCambios: vi.fn(),
}))
const { hayApi } = await import('./sync/api.js')

/** Lo que contesta `POST /api/sesion/enlace`, sin red. */
const contesta = (cuerpo, ok = true, status = 200) => {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok, status, json: async () => cuerpo })
}

const conPase = (pase = 'un.pase.cualquiera') => { window.location.hash = `pase=${pase}` }

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.location.hash = ''
  hayApi.mockImplementation(async () => false)
})

afterEach(() => {
  delete globalThis.fetch
  window.location.hash = ''
})

describe('App — el enlace de acceso', () => {
  it('con un pase en la URL, entra y guarda la sesión', async () => {
    contesta({ estado: 'dentro', token: 'jwt', cuenta: { id: 'cta_1', nombre: 'Curro García' } })
    // La primera bajada se deja a medias a posta: sin eso, lo que se probaría es
    // quién gana la carrera entre la bienvenida y el motor.
    hayApi.mockImplementation(() => new Promise(() => {}))
    conPase()

    render(<App />)

    expect(await screen.findByText('Ya estás dentro, Curro')).toBeInTheDocument()
    expect(leerSesion().token).toBe('jwt')
    // El pase no se queda ni en la barra ni en el historial.
    expect(window.location.hash).toBe('')
  })

  it('un enlace ya usado lo dice con las palabras del servidor', async () => {
    contesta({ estado: 'usado', mensaje: 'Este enlace ya se ha usado o se ha generado otro más nuevo.' }, false, 401)
    conPase()

    render(<App />)

    expect(await screen.findByText('Este enlace no abre')).toBeInTheDocument()
    expect(screen.getByText(/ya se ha usado/i)).toBeInTheDocument()
    expect(leerSesion()).toBe(null)
  })

  // Sin red el pase **sigue valiendo**: el servidor solo lo quema al canjearlo
  // de verdad, así que la URL no se toca y recargar reintenta.
  it('sin red se puede volver a intentar, y el pase se queda en la URL', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'))
    conPase('abc')

    render(<App />)

    expect(await screen.findByText('No hemos podido preguntar')).toBeInTheDocument()
    expect(window.location.hash).toBe('#pase=abc')

    contesta({ estado: 'dentro', token: 'jwt', cuenta: { id: 'cta_1', nombre: 'Curro' } })
    hayApi.mockImplementation(() => new Promise(() => {}))
    await userEvent.click(screen.getByRole('button', { name: /Volver a intentarlo/i }))

    expect(await screen.findByText('Ya estás dentro, Curro')).toBeInTheDocument()
  })

  it('quien no quiere entrar se queda con la libreta local', async () => {
    contesta({ estado: 'no-vale', mensaje: 'Este enlace no vale.' }, false, 401)
    conPase()

    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /Usar solo en este navegador/i }))
    expect(await screen.findByText('Tus eventos 🐳')).toBeInTheDocument()
  })

  it('sin pase en la URL no se pregunta nada y la app es la de siempre', async () => {
    globalThis.fetch = vi.fn()
    render(<App />)

    expect(await screen.findByText('Tus eventos 🐳')).toBeInTheDocument()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
