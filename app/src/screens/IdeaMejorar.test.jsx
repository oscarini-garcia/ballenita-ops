import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * El botón «Mejorarla» del editor de una idea (SPECS §14.24): la figura de
 * «Arreglar» de la receta — rellena los campos sin guardar nada, se deshace, y
 * guardar sigue siendo el botón de siempre.
 */
const mejorarIdea = vi.fn()
vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  hayApi: vi.fn(async () => true),
  mejorarIdea: (...a) => mejorarIdea(...a),
}))

const { default: IdeasScreen } = await import('./IdeasScreen.jsx')
const { db, createEvent, getEvent, addPlanIdea, listPlanIdeas } = await import('../db.js')

async function viaje() {
  const id = await createEvent({ name: 'Viaje 2026', startDate: '2026-08-15', endDate: '2026-08-22' })
  return { eventId: id, event: await getEvent(id) }
}

beforeEach(async () => {
  mejorarIdea.mockReset()
  for (const t of ['events', 'plans', 'planIdeas', 'persons', 'families', 'outbox']) await db[t].clear()
  localStorage.clear()
})

describe('mejorar una idea con la IA', () => {
  it('rellena los campos sin guardar nada, y guardar sigue siendo Guardar', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'playa cala sur', descripcion: 'sombrilla' })
    mejorarIdea.mockResolvedValue({
      titulo: 'Playa de la Cala',
      descripcion: 'Cala del sur. Llevar sombrilla: no hay chiringuito.',
    })
    render(<IdeasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByText('playa cala sur'))
    await userEvent.click(await screen.findByRole('button', { name: /Mejorarla/ }))

    // Los campos se rellenan con la propuesta, pero la base sigue como estaba:
    // el modelo no guarda nada.
    expect(await screen.findByLabelText('Qué es')).toHaveValue('Playa de la Cala')
    expect(screen.getByLabelText('Descripción')).toHaveValue('Cala del sur. Llevar sombrilla: no hay chiringuito.')
    expect(mejorarIdea).toHaveBeenCalledWith({ titulo: 'playa cala sur', descripcion: 'sombrilla', enlace: '' })
    expect((await listPlanIdeas())[0].titulo).toBe('playa cala sur')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect((await listPlanIdeas())[0]).toMatchObject({
      titulo: 'Playa de la Cala',
      descripcion: 'Cala del sur. Llevar sombrilla: no hay chiringuito.',
    })
  })

  it('se puede deshacer mientras no se guarde', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'playa cala sur', descripcion: 'sombrilla' })
    mejorarIdea.mockResolvedValue({ titulo: 'Playa de la Cala', descripcion: 'Cala del sur.' })
    render(<IdeasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByText('playa cala sur'))
    await userEvent.click(await screen.findByRole('button', { name: /Mejorarla/ }))
    expect(await screen.findByText(/Mejorada con la IA/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'deshacer' }))
    expect(screen.getByLabelText('Qué es')).toHaveValue('playa cala sur')
    expect(screen.getByLabelText('Descripción')).toHaveValue('sombrilla')
    expect(screen.queryByText(/Mejorada con la IA/)).not.toBeInTheDocument()
  })

  it('el fallo se dice en palabras y no rompe lo escrito', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'playa cala sur' })
    mejorarIdea.mockRejectedValue(new Error('la API respondió 409: no hay clave de IA configurada'))
    render(<IdeasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByText('playa cala sur'))
    await userEvent.click(await screen.findByRole('button', { name: /Mejorarla/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/409/)
    expect(screen.getByLabelText('Qué es')).toHaveValue('playa cala sur')
  })
})
