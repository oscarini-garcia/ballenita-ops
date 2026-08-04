import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlatosScreen from './PlatosScreen.jsx'
import { db, addDish, listDishes, addDinner, createEvent } from '../db.js'
import { hayApi, platosParecidos } from '../sync/api.js'

vi.mock('../sync/api.js', () => ({
  hayApi: vi.fn(async () => true),
  arreglarIngredientes: vi.fn(async () => []),
  platosParecidos: vi.fn(async () => []),
}))

describe('PlatosScreen', () => {
  beforeEach(async () => {
    for (const t of ['events', 'dishes', 'dinners', 'outbox']) await db[t].clear()
  })

  it('agrupa el catálogo por tipo, en el orden de la comida', async () => {
    await addDish({ name: 'Sandía', categorias: ['postre'] })
    await addDish({ name: 'Paella mixta', categorias: ['principal'] })
    const { container } = render(<PlatosScreen />)

    await screen.findByText('Paella mixta')
    // Los rótulos de sección, no la línea de debajo de cada fila —que dice el
    // mismo tipo y también casaría con el texto.
    const rotulos = [...container.querySelectorAll('.sec-h')].map((e) => e.textContent)
    expect(rotulos).toEqual(['Principal', 'Postre'])
  })

  it('dice en cuántas cenas está metido un plato', async () => {
    const eventId = await createEvent({ name: 'Ballenita 2026' })
    const paella = await addDish({ name: 'Paella mixta', categorias: ['principal'] })
    await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella] })
    await addDinner(eventId, { dia: '2026-08-11', platoIds: [paella] })
    render(<PlatosScreen />)

    expect(await screen.findByText('Principal · en 2 cenas')).toBeInTheDocument()
  })

  it('corrige el nombre de un plato, que hasta ahora no se podía', async () => {
    await addDish({ name: 'Paela mista', categorias: ['principal'] })
    render(<PlatosScreen />)

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir Paela mista' }))
    const campo = await screen.findByLabelText('Nombre')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Paella mixta')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect((await listDishes())[0].name).toBe('Paella mixta')
  })

  it('marca y desmarca un favorito', async () => {
    await addDish({ name: 'Paella mixta', categorias: ['principal'] })
    render(<PlatosScreen />)

    await userEvent.click(await screen.findByRole('button', { name: /Marcar Paella mixta como favorito/ }))
    await screen.findByRole('button', { name: /Quitar Paella mixta de favoritos/ })
    expect((await listDishes())[0].esFavorito).toBe(true)
  })

  it('añade un plato nuevo con sus ingredientes, uno por línea y con cantidad', async () => {
    render(<PlatosScreen />)

    await userEvent.click(await screen.findByRole('button', { name: /Añadir plato/i }))
    await userEvent.type(screen.getByLabelText('Nombre'), 'Tortilla de patata')
    await userEvent.click(screen.getByRole('button', { name: 'Principal' }))
    await userEvent.type(screen.getByLabelText('Para cuántas raciones'), '6')

    // Cada ingrediente es una línea, y **siempre hay una vacía al final**: no
    // cuesta ningún toque escribir el siguiente.
    for (const nombre of ['huevo', 'patata', 'cebolla']) {
      await userEvent.type(screen.getByLabelText('Ingrediente nuevo'), nombre)
    }
    // Dos campos y no tres: «8 ud» se escribe de un tirón y la app lo parte.
    await userEvent.type(screen.getByLabelText('Cantidad de huevo'), '8 ud')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir al catálogo' }))

    const [plato] = await listDishes()
    expect(plato.name).toBe('Tortilla de patata')
    expect(plato.categorias).toEqual(['principal'])
    expect(plato.raciones).toBe(6)
    expect(plato.ingredientes.map((x) => x.nombre)).toEqual(['huevo', 'patata', 'cebolla'])
    expect(plato.ingredientes[0]).toMatchObject({ cantidad: 8, unidad: 'ud' })
    // Y a lo que no se le puso cifra se le nota que le falta.
    expect(plato.ingredientes[1].cantidad).toBeNull()
  })

  it('antes de borrar avisa de que el catálogo es de todos los eventos', async () => {
    const eventId = await createEvent({ name: 'Ballenita 2026' })
    const paella = await addDish({ name: 'Paella mixta', categorias: ['principal'] })
    await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella] })
    render(<PlatosScreen />)

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir Paella mixta' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar plato' }))

    expect(await screen.findByText(/de todos los eventos/)).toBeInTheDocument()
    expect(screen.getByText(/está metido en 1 cena/)).toBeInTheDocument()

    // Y hasta que no se confirma, no se borra nada.
    expect(await listDishes()).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Sí, borrarlo' }))
    expect(await listDishes()).toHaveLength(0)
  })

  it('se abre a leer: ni el nombre ni la lista roban el foco', async () => {
    // Con el cursor puesto, iOS saca el teclado solo y entre él abajo y el modal
    // a ancho completo había que hacer scroll para ver la receta que venías a
    // mirar. Es la misma decisión que el editor de una idea (§14.19-ter).
    await addDish({ name: 'Paella mixta', categorias: ['principal'], ingredientes: [{ nombre: 'Arroz' }] })
    render(<PlatosScreen />)
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir Paella mixta' }))
    await screen.findByLabelText('Nombre')

    expect(document.activeElement).not.toBe(screen.getByLabelText('Nombre'))
    expect(document.activeElement).not.toBe(screen.getByLabelText('Ingrediente 1'))
    expect(document.activeElement?.tagName).not.toBe('INPUT')
  })

  it('el editor va estrecho y centrado, que es donde no está el teclado', async () => {
    await addDish({ name: 'Paella mixta', categorias: ['principal'] })
    const { container } = render(<PlatosScreen />)
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir Paella mixta' }))
    await screen.findByLabelText('Nombre')

    expect(container.querySelector('.modal-bg.center')).toBeInTheDocument()
    expect(container.querySelector('.modal.center.formulario')).toBeInTheDocument()
  })

  it('la fila entera abre el plato, sin lápiz al final', async () => {
    // El lápiz era un objetivo de 44 pt al final de una fila que ya se podía
    // tocar entera, y decía «editar» cuando lo que se abre sirve igual para
    // mirar la receta. Es el idioma de El grupo: se toca la fila y sube.
    await addDish({ name: 'Paella mixta', categorias: ['principal'] })
    render(<PlatosScreen />)

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir Paella mixta' }))
    expect(await screen.findByRole('heading', { name: 'Editar plato' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Editar Paella/ })).not.toBeInTheDocument()
  })

  it('la estrella se queda aparte: marcar un favorito no abre nada', async () => {
    await addDish({ name: 'Paella mixta', categorias: ['principal'] })
    render(<PlatosScreen />)

    await userEvent.click(await screen.findByRole('button', { name: /Marcar Paella mixta como favorito/ }))
    expect(screen.queryByRole('heading', { name: 'Editar plato' })).not.toBeInTheDocument()
    expect((await listDishes())[0].esFavorito).toBe(true)
  })

  it('el catálogo vacío se explica solo', async () => {
    render(<PlatosScreen />)
    expect(await screen.findByText(/El catálogo está vacío/)).toBeInTheDocument()
  })
})

/**
 * Los dos botones de IA del editor (§14.20-ter · P1 · M2 · A1 + A2).
 */
describe('preguntarle al modelo', () => {
  beforeEach(async () => {
    for (const t of ['events', 'dishes', 'dinners', 'outbox']) await db[t].clear()
    hayApi.mockResolvedValue(true)
    platosParecidos.mockResolvedValue([])
  })

  const PROPUESTA = {
    que: 'Fideuá de sepia',
    porque: 'Se hace en la misma paellera.',
    tipo: 'principal',
    ingredientes: [{ nombre: 'Fideos del 2', cantidad: 1, unidad: 'kg' }],
  }

  async function abrirEditor() {
    await addDish({ name: 'Paella mixta', categorias: ['principal'] })
    render(<PlatosScreen />)
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir Paella mixta' }))
    await screen.findByLabelText('Nombre')
  }

  it('el que has pulsado es el que dice que está pensando, no su vecino', async () => {
    // El texto colgaba de una sola variable de estado y vivía en «Arreglar»:
    // pulsabas «Parecidos» y contestaba el botón de al lado.
    let soltar
    platosParecidos.mockImplementation(() => new Promise((r) => { soltar = r }))
    await abrirEditor()
    await userEvent.click(screen.getByRole('button', { name: '🐳 Parecidos' }))

    const pensando = await screen.findByRole('button', { name: /Pensando/ })
    expect(pensando).toHaveAttribute('aria-busy', 'true')
    // Y el otro sigue llamándose como se llama, apagado.
    expect(screen.getByRole('button', { name: '🐳 Arreglar' })).toBeDisabled()

    soltar([PROPUESTA])
    await screen.findByRole('heading', { name: 'Fideuá de sepia' })
  })

  it('sin conexión no se ofrece, y dice por qué', async () => {
    hayApi.mockResolvedValue(false)
    await abrirEditor()

    // Antes se podían pulsar y lo que salía era el error del transporte contado
    // con las palabras del transporte, cuando ya era tarde.
    await waitFor(() => expect(screen.getByRole('button', { name: '🐳 Parecidos' })).toBeDisabled())
    expect(screen.getByRole('button', { name: '🐳 Arreglar' })).toBeDisabled()
    expect(screen.getByText(/la IA vive en el servidor/)).toBeInTheDocument()
  })

  it('parecidos abre un modal que dice que está cargando', async () => {
    let soltar
    platosParecidos.mockImplementation(() => new Promise((r) => { soltar = r }))
    await abrirEditor()
    await userEvent.click(screen.getByRole('button', { name: '🐳 Parecidos' }))

    expect(await screen.findByText('Buscando platos parecidos')).toBeInTheDocument()
    soltar([PROPUESTA])

    // Y luego la receta entera, con sus cantidades: antes los ingredientes eran
    // una ristra de nombres separados por puntos.
    await screen.findByRole('heading', { name: 'Fideuá de sepia' })
    expect(screen.getByText('Fideos del 2')).toBeInTheDocument()
    expect(screen.getByText('1 kg')).toBeInTheDocument()
  })

  it('sustituir la receta abierta avisa de en cuántas cenas está metida (A2)', async () => {
    const eventId = await createEvent({ name: 'Ballenita 2026' })
    const paella = await addDish({ name: 'Paella mixta', categorias: ['principal'] })
    await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella] })
    platosParecidos.mockResolvedValue([PROPUESTA])
    render(<PlatosScreen />)
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir Paella mixta' }))
    await userEvent.click(await screen.findByRole('button', { name: '🐳 Parecidos' }))
    await screen.findByRole('heading', { name: 'Fideuá de sepia' })

    await userEvent.click(screen.getByRole('button', { name: 'Sustituir esta receta' }))
    expect(screen.getByText(/está metido en 1 cena/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sí, sustituirla' }))
    // Escribe encima del editor y **no guarda**: hasta que no se le dé a Guardar
    // el plato del catálogo sigue siendo el de antes.
    expect(screen.getByLabelText('Nombre')).toHaveValue('Fideuá de sepia')
    expect((await listDishes())[0].name).toBe('Paella mixta')
  })

  it('añadirla como plato nuevo deja el que estabas mirando sin tocar (A1)', async () => {
    platosParecidos.mockResolvedValue([PROPUESTA])
    await abrirEditor()
    await userEvent.click(screen.getByRole('button', { name: '🐳 Parecidos' }))
    await screen.findByRole('heading', { name: 'Fideuá de sepia' })

    await userEvent.click(screen.getByRole('button', { name: 'Añadir como plato nuevo' }))
    expect(await screen.findByRole('heading', { name: 'Plato nuevo' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('Fideuá de sepia')
    expect(await listDishes()).toHaveLength(1)
  })
})
