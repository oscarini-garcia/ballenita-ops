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

  it('cargar el ejemplo abre el evento y muestra las 5 pestañas', async () => {
    render(<App />)
    await userEvent.click(await screen.findByText(/Cargar ejemplo/))
    // La barra baja a 5 destinos: Hoy · Dinero · Cenas · Planes · Ajustes.
    for (const label of ['Hoy', 'Dinero', 'Cenas', 'Planes', 'Ajustes']) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
    // «Saldos», «Stats» y «Más» ya no son pestañas de primer nivel.
    expect(screen.queryByRole('button', { name: /^Saldos$/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Más')).not.toBeInTheDocument()
  })
})

describe('App — navegación', () => {
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

  it('Ajustes es la quinta pestaña de la barra, y ya no un ⚙️ en la cabecera', async () => {
    await abrirEjemplo()
    // La cabecera no tiene botón de ajustes: se ha ido abajo a la derecha.
    expect(document.querySelector('.appbar .iconbtn')).toBeNull()
    // Ni logotipo: el sitio es del nombre del evento, que no está en otro lado.
    expect(document.querySelector('.appbar .logo')).toBeNull()

    const barra = document.querySelector('.tabbar')
    const ultima = barra.querySelectorAll('.tab')[4]
    expect(ultima).toHaveTextContent('Ajustes')

    await userEvent.click(ultima)
    expect(await screen.findByText('Sincronización')).toBeInTheDocument()
  })

  it('el punto de sincronización vuelve a la cabecera', async () => {
    await abrirEjemplo()
    // Sin config.json la app va en modo solo-local y así lo dice el punto.
    expect(document.querySelector('.appbar .sync-dot')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Solo local' })).toBeInTheDocument()
  })

  it('Ajustes recoge en apartados el aspecto, quién eres, el evento y las estadísticas', async () => {
    await abrirEjemplo()
    await userEvent.click(document.querySelectorAll('.tabbar .tab')[4])

    for (const titulo of ['Sincronización', 'Aspecto', 'Quién eres', 'Evento', 'Estadísticas', 'La app']) {
      expect(await screen.findByText(titulo)).toBeInTheDocument()
    }
    // Solo Sincronización arranca abierto: a Ajustes se llega porque algo no va.
    const abiertos = [...document.querySelectorAll('.acordeon[open]')]
    expect(abiertos).toHaveLength(1)
    expect(abiertos[0]).toHaveTextContent('Sincronización')
  })

  it('elegirse en Ajustes se ve al momento en el badge de la cabecera', async () => {
    await abrirEjemplo()
    expect(screen.getByRole('button', { name: 'Elegir usuario' })).toBeInTheDocument()

    await userEvent.click(document.querySelectorAll('.tabbar .tab')[4])
    await userEvent.click(await screen.findByText('Quién eres'))

    // La primera persona del evento de ejemplo, sea quien sea.
    const opciones = document.querySelectorAll('.acordeon .persona-opcion')
    expect(opciones.length).toBeGreaterThan(0)
    await userEvent.click(opciones[0])

    // El badge de arriba se entera sin recargar: la identidad es compartida.
    expect(document.querySelector('.appbar .userbadge .un').textContent).not.toBe('Elígete')
  })

  it('el apartado «Aspecto» deja cambiar el tamaño del texto', async () => {
    await abrirEjemplo()
    await userEvent.click(document.querySelectorAll('.tabbar .tab')[4])
    await userEvent.click(await screen.findByText('Aspecto'))

    await userEvent.click(await screen.findByRole('button', { name: 'Enorme' }))
    expect(document.documentElement.getAttribute('data-texto')).toBe('enorme')

    await userEvent.click(screen.getByRole('button', { name: 'Normal' }))
    // «Normal» es el valor de origen y no escribe atributo: vive en el CSS.
    expect(document.documentElement.getAttribute('data-texto')).toBeNull()
  })
})
