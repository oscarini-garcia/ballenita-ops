import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PastillaDeEstado from './PastillaDeEstado.jsx'
import { db, createEvent, addPerson, personsOf } from '../db.js'
import { setMeId } from '../lib/identidad.js'

// Sin API configurada no hay botones de IA, que es el caso de estas pruebas
// salvo donde se diga: lo que se comprueba aquí es la pastilla y el borrador.
vi.mock('../sync/api.js', async () => ({
  hayApi: () => false,
  estadosSugeridos: vi.fn(async () => []),
  estadoConGracia: vi.fn(async () => null),
}))

/**
 * Tu estado en la cabecera (`docs/diseño/estado.html` · A3 · V1 · M2).
 */
async function sembrar({ estado = '', identificado = true } = {}) {
  const eventId = await createEvent({ name: 'Ballenita 2026', lugar: 'Camping La Ballena Alegre' })
  const curro = await addPerson(eventId, { name: 'Curro', edad: 'adulto', estado })
  if (identificado) setMeId(eventId, curro)
  return { eventId, curro }
}

describe('PastillaDeEstado', () => {
  beforeEach(async () => {
    for (const t of ['events', 'persons', 'outbox']) await db[t].clear()
    localStorage.clear()
  })

  it('sin identidad en este móvil, la segunda línea vuelve a decir el lugar', async () => {
    const { eventId } = await sembrar({ identificado: false })
    render(<PastillaDeEstado eventId={eventId} lugar="Camping La Ballena Alegre" />)

    expect(await screen.findByText('Camping La Ballena Alegre')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  /** V1: el hueco invita, porque un botón que no se ve no se estrena. */
  it('con identidad y sin estado, invita a poner uno', async () => {
    const { eventId } = await sembrar()
    render(<PastillaDeEstado eventId={eventId} lugar="Camping La Ballena Alegre" />)

    expect(await screen.findByRole('button', { name: '+ tu estado' })).toBeInTheDocument()
    expect(screen.queryByText('Camping La Ballena Alegre')).toBeNull()
  })

  it('con estado puesto lo enseña, entero aunque sea largo', async () => {
    const { eventId } = await sembrar({ estado: '🫥 desaparecido en combate' })
    render(<PastillaDeEstado eventId={eventId} lugar="Camping" />)

    expect(await screen.findByRole('button', { name: '🫥 desaparecido en combate' })).toBeInTheDocument()
  })

  /** M2: la capa trabaja sobre un borrador — «Cancelar» no escribe. */
  it('al tocar abre el modal, y «Cancelar» no cambia nada', async () => {
    const { eventId, curro } = await sembrar({ estado: '🍺 de resaca' })
    render(<PastillaDeEstado eventId={eventId} lugar="Camping" />)

    await userEvent.click(await screen.findByRole('button', { name: '🍺 de resaca' }))
    expect(await screen.findByRole('heading', { name: 'Tu estado' })).toBeInTheDocument()

    // Uno de los cinco de siempre, tocado pero sin guardar.
    const opciones = document.querySelectorAll('.eleccion-op')
    expect(opciones.length).toBe(5)
    await userEvent.click(opciones[0])
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    const [persona] = (await personsOf(eventId)).filter((p) => p.id === curro)
    expect(persona.estado).toBe('🍺 de resaca')
  })

  it('«Guardar» escribe el estado elegido, con su emoji delante', async () => {
    const { eventId, curro } = await sembrar()
    render(<PastillaDeEstado eventId={eventId} lugar="Camping" />)

    await userEvent.click(await screen.findByRole('button', { name: '+ tu estado' }))
    const primera = document.querySelectorAll('.eleccion-op')[0]
    const elegido = primera.textContent.trim()
    await userEvent.click(primera)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => {
      const [persona] = (await personsOf(eventId)).filter((p) => p.id === curro)
      expect(persona.estado.replace(/\s+/g, ' ')).toBe(elegido.replace(/\s+/g, ' '))
    })
  })

  it('se puede escribir el tuyo, y vaciarlo lo quita', async () => {
    const { eventId, curro } = await sembrar({ estado: '🍺 de resaca' })
    render(<PastillaDeEstado eventId={eventId} lugar="Camping" />)

    await userEvent.click(await screen.findByRole('button', { name: '🍺 de resaca' }))
    const caja = screen.getByLabelText('O el tuyo')
    await userEvent.clear(caja)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => {
      const [persona] = (await personsOf(eventId)).filter((p) => p.id === curro)
      expect(persona.estado).toBe('')
    })
  })

  it('sin API configurada no se ofrece la IA', async () => {
    const { eventId } = await sembrar()
    render(<PastillaDeEstado eventId={eventId} lugar="Camping" />)

    await userEvent.click(await screen.findByRole('button', { name: '+ tu estado' }))
    expect(screen.queryByRole('button', { name: /Otras cinco/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Más gracioso/ })).toBeNull()
  })
})
