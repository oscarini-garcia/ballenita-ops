import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IdeasScreen from './IdeasScreen.jsx'
import PlanesConAreasScreen from './PlanesConAreasScreen.jsx'
import { db, createEvent, getEvent, addPlanIdea, listPlanIdeas, plansOf } from '../db.js'

/**
 * El área «Ideas» y el mando que la hace alcanzable (B3).
 */
async function viaje() {
  const id = await createEvent({ name: 'Viaje 2026', startDate: '2026-08-15', endDate: '2026-08-22' })
  return { eventId: id, event: await getEvent(id) }
}

beforeEach(async () => {
  for (const t of ['events', 'plans', 'planIdeas', 'persons', 'outbox']) await db[t].clear()
  localStorage.clear()
})

describe('IdeasScreen', () => {
  it('sin ideas lo dice, y no pinta una lista vacía', async () => {
    const { eventId, event } = await viaje()
    render(<IdeasScreen eventId={eventId} event={event} />)
    expect(await screen.findByText(/Todavía no hay ideas guardadas/)).toBeInTheDocument()
  })

  it('«traer» deja el plan en este viaje y lo dice', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'Playa de la Cala', ubicacion: 'Cala del sur' })
    render(<IdeasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByRole('button', { name: 'traer' }))

    // El plan existe y ha llegado limpio.
    const planes = await plansOf(eventId)
    expect(planes).toHaveLength(1)
    expect(planes[0]).toMatchObject({ titulo: 'Playa de la Cala', dia: null, estado: 'votando' })
    // Y el botón lo confirma en vez de quedarse igual: un toque sin respuesta
    // a la vista no dice nada.
    expect(await screen.findByRole('button', { name: '✓ traída' })).toBeDisabled()
  })

  it('la fila cuenta en cuántos viajes se ha usado', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'Playa de la Cala' })
    render(<IdeasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByRole('button', { name: 'traer' }))
    expect(await screen.findByText(/1 viaje/)).toBeInTheDocument()
  })

  it('crear una idea la deja en el catálogo compartido', async () => {
    const { eventId, event } = await viaje()
    render(<IdeasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Añadir idea' }))
    await userEvent.type(screen.getByLabelText('Qué es'), 'Torneo de petanca')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir al catálogo' }))

    const ideas = await listPlanIdeas()
    expect(ideas.map((i) => i.titulo)).toEqual(['Torneo de petanca'])
    // Del catálogo de todos: sin `eventId`, aunque se creara desde un viaje.
    expect(ideas[0].eventId).toBe(null)
  })

  it('borrar avisa de que se lleva la idea de todos los viajes', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'Playa de la Cala' })
    render(<IdeasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByRole('button', { name: /Editar Playa de la Cala/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Borrar idea' }))
    expect(screen.getByText(/de todos los viajes/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sí, borrarla' }))
    expect(await listPlanIdeas()).toEqual([])
  })
})

describe('Planes, con sus dos áreas', () => {
  it('abre en Planes y el mando lleva a Ideas', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'Playa de la Cala' })
    render(<PlanesConAreasScreen eventId={eventId} event={event} />)

    const mando = screen.getByRole('tablist')
    expect(within(mando).getByRole('tab', { name: 'Planes' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText(/Ningún plan todavía/)).toBeInTheDocument()

    await userEvent.click(within(mando).getByRole('tab', { name: 'Ideas' }))
    expect(await screen.findByText('Playa de la Cala')).toBeInTheDocument()
  })
})
