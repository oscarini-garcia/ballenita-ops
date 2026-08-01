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
    expect(await screen.findByText('Gastos')).toBeInTheDocument()
    expect(screen.getByText('Saldos')).toBeInTheDocument()
    expect(screen.getByText('Gasto total del evento')).toBeInTheDocument()

    // Cambiar a Saldos: desaparece el total de gastos y aparece el saldo por familia.
    await userEvent.click(screen.getByText('Saldos'))
    expect(await screen.findByText('Saldo por familia')).toBeInTheDocument()
    expect(screen.queryByText('Gasto total del evento')).not.toBeInTheDocument()
  })

  it('«Cenas» lleva la Compra dentro como segunda sub-pestaña', async () => {
    await abrirEjemplo()
    await userEvent.click(document.querySelectorAll('.tabbar .tab')[2])

    // «Cenas» está ahora en la barra y en el segmentado, así que se apunta al
    // segmentado por su rol y no por su texto.
    expect(await screen.findByRole('tab', { name: 'Cenas' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Compra' }))
    // La lista de la compra trae su barra de alta rápida.
    expect(await screen.findByPlaceholderText(/Apunta algo/)).toBeInTheDocument()
  })

  it('Ajustes es la quinta pestaña de la barra, y ya no un ⚙️ en la cabecera', async () => {
    await abrirEjemplo()
    // La cabecera no tiene botón de ajustes: se ha ido abajo a la derecha.
    expect(document.querySelector('.appbar .iconbtn')).toBeNull()

    const barra = document.querySelector('.tabbar')
    const ultima = barra.querySelectorAll('.tab')[4]
    expect(ultima).toHaveTextContent('Ajustes')

    await userEvent.click(ultima)
    expect(await screen.findByText('Sincronización')).toBeInTheDocument()
  })

  it('la cabecera son tres cosas: ballena, dónde estás y el punto', async () => {
    await abrirEjemplo()
    expect(document.querySelector('.appbar .logo')).not.toBeNull()
    expect(document.querySelector('.appbar .ti')).toHaveTextContent('Ballenita')
    // Sin config.json la app va en modo solo-local y así lo dice el punto.
    expect(document.querySelector('.appbar .sync-dot')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Solo local' })).toBeInTheDocument()
    // Y ni rastro del badge de persona: en un móvil que es tuyo, decirte tu
    // nombre en todas las pantallas es gastar sitio en algo que ya sabes.
    expect(document.querySelector('.appbar .userbadge')).toBeNull()
  })

  it('Ajustes recoge en apartados el aspecto, quién eres, el evento y las estadísticas', async () => {
    await abrirEjemplo()
    await userEvent.click(document.querySelectorAll('.tabbar .tab')[4])

    for (const titulo of ['Sincronización', 'Aspecto', 'Quién eres', 'Evento', 'Estadísticas', 'La app']) {
      expect(await screen.findByText(titulo)).toBeInTheDocument()
    }
    // Todos plegados: la lista entera se lee de un vistazo y se toca la que toca.
    expect(document.querySelectorAll('.acordeon[open]')).toHaveLength(0)
  })

  it('«Quién eres» se ha comido el perfil que estaba en la cabecera', async () => {
    await abrirEjemplo()
    await userEvent.click(document.querySelectorAll('.tabbar .tab')[4])
    await userEvent.click(await screen.findByText('Quién eres'))

    // Sin identidad todavía no hay perfil que editar: primero se elige persona.
    expect(screen.queryByRole('button', { name: 'Guardar mi perfil' })).not.toBeInTheDocument()

    const opciones = document.querySelectorAll('.acordeon .persona-opcion')
    expect(opciones.length).toBeGreaterThan(0)
    await userEvent.click(opciones[0])

    // Y al elegirla aparecen ahí mismo el emoji, el estado y la foto.
    expect(await screen.findByRole('button', { name: 'Guardar mi perfil' })).toBeInTheDocument()
    expect(screen.getByLabelText('Estado a mano')).toBeInTheDocument()
    expect(screen.getByLabelText('Emoji a mano')).toBeInTheDocument()
    expect(screen.getByLabelText('Elegir foto de avatar')).toBeInTheDocument()
  })

  it('el apartado «Aspecto» deja cambiar el tamaño del texto', async () => {
    await abrirEjemplo()
    await userEvent.click(document.querySelectorAll('.tabbar .tab')[4])
    await userEvent.click(await screen.findByText('Aspecto'))

    await userEvent.click(await screen.findByRole('button', { name: 'Normal' }))
    expect(document.documentElement.getAttribute('data-texto')).toBe('normal')

    await userEvent.click(screen.getByRole('button', { name: 'Grande' }))
    // «Grande» es la talla de fábrica y no escribe atributo: vive en el CSS.
    expect(document.documentElement.getAttribute('data-texto')).toBeNull()
  })

  it('«Aspecto» ya solo elige la cara del tema: los nueve skins se han ido', async () => {
    await abrirEjemplo()
    await userEvent.click(document.querySelectorAll('.tabbar .tab')[4])
    await userEvent.click(await screen.findByText('Aspecto'))

    // Ni Abisal, ni Verbena, ni el dado.
    expect(screen.queryByText(/Abisal/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Aleatorio/)).not.toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: 'Oscuro' }))
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro')

    await userEvent.click(screen.getByRole('button', { name: 'Claro' }))
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro')

    // «Automático» quita el atributo, que es lo que deja mandar al sistema.
    await userEvent.click(screen.getByRole('button', { name: 'Automático' }))
    expect(document.documentElement.getAttribute('data-tema')).toBeNull()
  })

  it('las categorías de gasto son dibujo con su tono, no emoji', async () => {
    await abrirEjemplo()
    await userEvent.click(document.querySelectorAll('.tabbar .tab')[1])
    await screen.findByText('Gasto total del evento')

    const iconos = [...document.querySelectorAll('.lista-deslizable .ico')]
    expect(iconos.length).toBeGreaterThan(0)
    for (const i of iconos) {
      expect(i.querySelector('svg')).not.toBeNull()   // dibujo, no carácter
      expect(i.dataset.cat).toBeTruthy()              // y con su tono puesto
    }
  })
})
