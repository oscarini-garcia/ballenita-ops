import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'
import { activarModoLocal, guardarSesion } from './auth/sesion.js'

// La puerta solo aparece en la app de iOS y con una API configurada, así que
// hay que fingir las dos cosas: en el resto de tests `isNative()` es false y la
// app entra directa, que es el comportamiento de la web.
vi.mock('./lib/native.js', async (original) => ({
  ...(await original()),
  isNative: () => true,
}))
vi.mock('./lib/config.js', async (original) => ({
  ...(await original()),
  cargarConfiguracion: async () => ({ api: 'https://ejemplo.workers.dev' }),
}))
vi.mock('./auth/apple.js', () => ({ entrarConApple: vi.fn() }))

beforeEach(() => {
  localStorage.clear()
})

describe('App — la puerta de acceso', () => {
  it('en iOS con API y sin sesión, pide entrar', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: /Entrar con Apple/i })).toBeInTheDocument()
    expect(screen.queryByText('Tus eventos 🐳')).not.toBeInTheDocument()
  })

  it('con sesión guardada no pregunta nada', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', nombre: 'Curro' } })
    render(<App />)
    expect(await screen.findByText('Tus eventos 🐳')).toBeInTheDocument()
  })

  // El caso que importa: Apple falla por algo que no se arregla desde el móvil
  // (falta la capacidad en el binario) y aun así se puede usar la libreta.
  it('«usar solo en este móvil» abre la app sin entrar', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Usar solo en este móvil/i }))

    expect(await screen.findByText('Tus eventos 🐳')).toBeInTheDocument()
  })

  it('la decisión se recuerda: al siguiente arranque ya no pasa por la puerta', async () => {
    activarModoLocal()
    render(<App />)
    expect(await screen.findByText('Tus eventos 🐳')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Entrar con Apple/i })).not.toBeInTheDocument()
  })
})
