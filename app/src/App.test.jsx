import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'

describe('App — smoke test', () => {
  it('sin evento activo muestra la lista de eventos', async () => {
    render(<App />)
    expect(await screen.findByText('Tus eventos 🐳')).toBeInTheDocument()
    expect(screen.getByText('+ Nuevo evento')).toBeInTheDocument()
  })

  it('cargar el ejemplo abre el evento y muestra las 5 pestañas (Opción A)', async () => {
    render(<App />)
    await userEvent.click(await screen.findByText(/Cargar ejemplo/))
    // La barra baja a 5 destinos: Hoy · Dinero · Cenas · Planes · Más.
    for (const label of ['Hoy', 'Dinero', 'Cenas', 'Planes', 'Más']) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
    // «Saldos» y «Stats» ya no son pestañas de primer nivel.
    expect(screen.queryByRole('button', { name: /^Saldos$/ })).not.toBeInTheDocument()
  })
})

describe('App — navegación de la Opción A', () => {
  async function abrirEjemplo() {
    render(<App />)
    await userEvent.click(await screen.findByText(/Cargar ejemplo/))
    await screen.findByText('Dinero')
  }

  it('«Dinero» une Gastos y Saldos en un control segmentado', async () => {
    await abrirEjemplo()
    await userEvent.click(screen.getByText('Dinero'))

    // Arranca en Gastos: se ve el total del evento y el segmentado.
    expect(await screen.findByText('💸 Gastos')).toBeInTheDocument()
    expect(screen.getByText('⚖️ Saldos')).toBeInTheDocument()
    expect(screen.getByText('Gasto total del evento')).toBeInTheDocument()

    // Cambiar a Saldos: desaparece el total de gastos y aparece el saldo por familia.
    await userEvent.click(screen.getByText('⚖️ Saldos'))
    expect(await screen.findByText('Saldo por familia')).toBeInTheDocument()
    expect(screen.queryByText('Gasto total del evento')).not.toBeInTheDocument()
  })

  it('«Cenas» lleva la Compra dentro como segunda sub-pestaña', async () => {
    await abrirEjemplo()
    await userEvent.click(screen.getByText('Cenas'))

    expect(await screen.findByText('🍳 Cenas')).toBeInTheDocument()
    await userEvent.click(screen.getByText('🛒 Compra'))
    // La lista de la compra trae su barra de alta rápida.
    expect(await screen.findByPlaceholderText(/Apunta algo/)).toBeInTheDocument()
  })

  it('el ⚙️ de la cabecera es un atajo a Ajustes', async () => {
    await abrirEjemplo()
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }))

    // Entra en «Más» pero directamente en la sub-pestaña de Ajustes, no en Stats.
    expect(await screen.findByRole('tab', { name: '⚙️ Ajustes' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText(/Cambiar/)).toBeInTheDocument()
  })

  it('el estado de sincronización ya no está en la cabecera, sino en Ajustes', async () => {
    await abrirEjemplo()
    expect(document.querySelector('.appbar .sync-dot')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
    // Sin config.json la app va en modo solo-local y así lo dice el punto.
    expect(await screen.findByRole('button', { name: 'Solo local (sin sincronización)' })).toBeInTheDocument()
  })

  it('«Más» agrupa Estadísticas y Ajustes', async () => {
    await abrirEjemplo()
    await userEvent.click(screen.getByText('Más'))

    expect(await screen.findByText('📊 Estadísticas')).toBeInTheDocument()
    await userEvent.click(screen.getByText('⚙️ Ajustes'))
    // Los ajustes del evento permiten cambiar de evento.
    expect(await screen.findByText(/Cambiar/)).toBeInTheDocument()
  })
})
