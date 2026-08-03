import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlatosScreen from './PlatosScreen.jsx'
import { db, addDish, listDishes, addDinner, createEvent } from '../db.js'

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

    await userEvent.click(await screen.findByRole('button', { name: 'Editar Paela mista' }))
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

    // Cada ingrediente es una línea. La caja de comas se fue: partía por comas y
    // «sal, gorda» se guardaba como dos ingredientes.
    for (const nombre of ['huevo', 'patata', 'cebolla']) {
      await userEvent.type(screen.getByLabelText('Ingrediente nuevo'), nombre)
      await userEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    }
    await userEvent.type(screen.getByLabelText('Cantidad de huevo'), '8')
    await userEvent.type(screen.getByLabelText('Unidad de huevo'), 'ud')
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

    await userEvent.click(await screen.findByRole('button', { name: 'Editar Paella mixta' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar plato' }))

    expect(await screen.findByText(/de todos los eventos/)).toBeInTheDocument()
    expect(screen.getByText(/está metido en 1 cena/)).toBeInTheDocument()

    // Y hasta que no se confirma, no se borra nada.
    expect(await listDishes()).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Sí, borrarlo' }))
    expect(await listDishes()).toHaveLength(0)
  })

  it('el catálogo vacío se explica solo', async () => {
    render(<PlatosScreen />)
    expect(await screen.findByText(/El catálogo está vacío/)).toBeInTheDocument()
  })
})
