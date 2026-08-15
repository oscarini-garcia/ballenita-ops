import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'
import { olvidarAreas } from './lib/areas.js'

// El área elegida dentro de una sección se recuerda a propósito (`lib/areas.js`)
// y vive en el módulo, así que sobrevive al desmontaje **y a la prueba
// anterior**: sin esto, la que deja Dinero en «Saldos» hace fallar a la
// siguiente, que espera encontrarlo en «Gastos».
beforeEach(olvidarAreas)

describe('App — smoke test', () => {
  it('sin evento activo muestra la lista de eventos', async () => {
    render(<App />)
    expect(await screen.findByText('Tus eventos 🐳')).toBeInTheDocument()
    expect(screen.getByText('+ Nuevo evento')).toBeInTheDocument()
  })

  it('cargar el ejemplo abre el evento y muestra las 5 pestañas', async () => {
    render(<App />)
    await userEvent.click(await screen.findByText(/Cargar el evento/))
    // La barra son 5 destinos: Agenda · Dinero · Comidas · Planes · Ajustes.
    // El rótulo nombra la sección, no su primera área: «Hoy» es un área dentro
    // de Agenda, y «Cenas» un área dentro de Comidas.
    for (const label of ['Agenda', 'Dinero', 'Comidas', 'Planes', 'Ajustes']) {
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
    await userEvent.click(await screen.findByText(/Cargar el evento/))
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

  it('«Comidas» tiene tres áreas: Cenas, la Carta y la Compra', async () => {
    await abrirEjemplo()
    await userEvent.click(document.querySelectorAll('.tabbar .tab')[2])

    for (const area of ['Cenas', 'Carta', 'Compra']) {
      expect(await screen.findByRole('tab', { name: area })).toBeInTheDocument()
    }

    // La Carta es el catálogo de lo que se sabe cocinar, que hasta ahora solo
    // existía dentro del modal de una cena y no se podía ni corregir. Se llamaba
    // «Platos» y se confundía con los platos **de esta cena**, que son los que se
    // marcan en Cenas y en el día.
    await userEvent.click(screen.getByRole('tab', { name: 'Carta' }))
    expect(await screen.findByText(/el mismo en todos los eventos/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Abrir Paella mixta' })).toBeInTheDocument()

    // Y la compra sigue a un toque, con su barra de alta rápida.
    await userEvent.click(screen.getByRole('tab', { name: 'Compra' }))
    expect(await screen.findByPlaceholderText(/Apunta algo/)).toBeInTheDocument()
  })

  // Al **abrir** la app manda el titular del día (no hay pulsación); **pulsar**
  // Agenda lleva al calendario (§14.47).
  it('la app abre en Hoy, y pulsar Agenda lleva a Días', async () => {
    await abrirEjemplo()
    expect(await screen.findByRole('tab', { name: 'Hoy' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(document.querySelectorAll('.tabbar .tab')[0])

    expect(await screen.findByRole('tab', { name: 'Días' })).toHaveAttribute('aria-selected', 'true')
    // Los ocho días del ejemplo, vacíos incluidos. Ya no llevan lápiz: la fila
    // entera abre, y su rótulo es la fecha larga (agenda-dia.html · A1).
    const dias = await screen.findAllByRole('button', { name: /de agosto:/ })
    expect(dias).toHaveLength(8)
  })

  it('y desde Hoy, volver a pulsar Agenda también lleva a Días', async () => {
    await abrirEjemplo()
    const barra = document.querySelectorAll('.tabbar .tab')

    await userEvent.click(barra[0])                                   // → Días
    await userEvent.click(await screen.findByRole('tab', { name: 'Hoy' }))
    expect(screen.getByRole('tab', { name: 'Hoy' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(barra[0])                                   // → Días otra vez
    expect(await screen.findByRole('tab', { name: 'Días' })).toHaveAttribute('aria-selected', 'true')
  })

  // La memoria de área sigue valiendo para las demás secciones: solo Agenda
  // tiene destino fijo.
  it('el área elegida no se olvida al ir y volver de otra sección', async () => {
    await abrirEjemplo()
    const barra = document.querySelectorAll('.tabbar .tab')

    await userEvent.click(barra[2])           // a Comidas…
    await userEvent.click(await screen.findByRole('tab', { name: 'Compra' }))
    expect(screen.getByRole('tab', { name: 'Compra' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(barra[1])           // a Dinero…
    await screen.findByText('Gasto total del evento')
    await userEvent.click(barra[2])           // …y de vuelta

    expect(await screen.findByRole('tab', { name: 'Compra' })).toHaveAttribute('aria-selected', 'true')
  })

  it('Ajustes es la quinta pestaña de la barra, y ya no un ⚙️ en la cabecera', async () => {
    await abrirEjemplo()
    // La cabecera no tiene botón de ajustes: se ha ido abajo a la derecha.
    expect(document.querySelector('.appbar .iconbtn')).toBeNull()

    const barra = document.querySelector('.tabbar')
    const ultima = barra.querySelectorAll('.tab')[4]
    expect(ultima).toHaveTextContent('Ajustes')

    await userEvent.click(ultima)
    expect(await screen.findByText('La app')).toBeInTheDocument()
  })

  it('la cabecera son tres cosas: ballena, dónde estás y el punto', async () => {
    await abrirEjemplo()
    expect(document.querySelector('.appbar .logo')).not.toBeNull()
    expect(document.querySelector('.appbar .ti')).toHaveTextContent('Demo')
    // Sin config.json la app va en modo solo-local y así lo dice el punto.
    expect(document.querySelector('.appbar .sync-dot')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Solo local' })).toBeInTheDocument()
    // Y ni rastro del badge de persona: en un móvil que es tuyo, decirte tu
    // nombre en todas las pantallas es gastar sitio en algo que ya sabes.
    expect(document.querySelector('.appbar .userbadge')).toBeNull()
  })

  it('Ajustes recoge en apartados el aspecto, quién eres y el evento', async () => {
    await abrirEjemplo()
    await userEvent.click(document.querySelectorAll('.tabbar .tab')[4])

    for (const titulo of ['Aspecto', 'Quién eres', 'Evento', 'La app']) {
      expect(await screen.findByText(titulo)).toBeInTheDocument()
    }
    // Las estadísticas ya no son un apartado: se miran, no se ajustan, y viven
    // en Agenda como tercera área.
    expect(screen.queryByText('Estadísticas')).toBeNull()
    // Sincronización y Actualizar tampoco: eran la misma operación contada en
    // dos mitades y van juntas en «La app» (SPECS §14.41).
    expect(screen.queryByText('Sincronización')).toBeNull()
    expect(screen.queryByText('Actualizar')).toBeNull()
    // Todos plegados: la lista entera se lee de un vistazo y se toca la que toca.
    expect(document.querySelectorAll('.acordeon[open]')).toHaveLength(0)
  })

  it('las estadísticas son la tercera área de Agenda, con el rótulo «Números»', async () => {
    await abrirEjemplo()
    await userEvent.click(document.querySelectorAll('.tabbar .tab')[0])

    await userEvent.click(await screen.findByRole('tab', { name: 'Números' }))
    // El Demo trae gastos, así que hay números que enseñar.
    expect(await screen.findByText('Gasto total')).toBeInTheDocument()
    expect(screen.getByText('Quién más adelanta')).toBeInTheDocument()
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
