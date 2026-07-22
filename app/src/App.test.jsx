import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'

describe('App — smoke test', () => {
  it('sin evento activo muestra la lista de eventos', async () => {
    render(<App />)
    expect(await screen.findByText('Tus eventos 🐋')).toBeInTheDocument()
    expect(screen.getByText('+ Nuevo evento')).toBeInTheDocument()
  })

  it('cargar el ejemplo abre el evento y muestra las pestañas', async () => {
    render(<App />)
    const seed = await screen.findByText(/Cargar ejemplo/)
    await userEvent.click(seed)
    // Al entrar en el evento aparece la barra de pestañas.
    expect(await screen.findByText('Saldos')).toBeInTheDocument()
    expect(screen.getByText('Cenas')).toBeInTheDocument()
    expect(screen.getByText('Planes')).toBeInTheDocument()
  })
})
