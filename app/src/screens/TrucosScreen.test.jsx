import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrucosScreen from './TrucosScreen.jsx'
import {
  createEvent, getEvent, addFamily, addPerson, addTruco, listTrucos,
} from '../db.js'

/**
 * Trucos (§14.53). Lo que fijan estos tests es lo que se puede romper sin que se
 * note: que la lista **no cuelga del evento**, que no hay nada que tachar, y que
 * el renglón de apuntar no se cierra al guardar.
 */
async function viaje() {
  const eventId = await createEvent({ name: 'Playa 2026', startDate: '2026-08-15', endDate: '2026-08-22' })
  const garcia = await addFamily(eventId, { name: 'García', color: '#E5544B' })
  const curro = await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto' })
  localStorage.setItem(`ballena.me:${eventId}`, curro)
  return { eventId, event: await getEvent(eventId), curro }
}

describe('TrucosScreen', () => {
  it('sin nada dice para qué sirve, y avisa de que no se borran al acabar', async () => {
    const { eventId, event } = await viaje()
    render(<TrucosScreen eventId={eventId} event={event} />)
    expect(await screen.findByText(/Todavía no hay ningún truco/)).toBeInTheDocument()
    expect(screen.getByText(/valen para el siguiente/)).toBeInTheDocument()
  })

  it('se apunta desde el renglón, que no se cierra ni se vacía de foco', async () => {
    const { eventId, event, curro } = await viaje()
    render(<TrucosScreen eventId={eventId} event={event} />)

    const campo = await screen.findByLabelText('Apunta un truco')
    await userEvent.type(campo, 'El súper cierra a las 14:00')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar truco' }))

    await waitFor(async () => {
      const guardados = await listTrucos(event)
      expect(guardados).toHaveLength(1)
      expect(guardados[0]).toMatchObject({ texto: 'El súper cierra a las 14:00', autorId: curro })
    })
    // El renglón sigue ahí y vacío: dos trucos seguidos son dos frases.
    expect(await screen.findByLabelText('Apunta un truco')).toHaveValue('')
  })

  it('no cuelga del evento: el mismo truco se ve desde otro viaje', async () => {
    const { event } = await viaje()
    await addTruco({ texto: 'Pedir el bunga del fondo' })

    const otroId = await createEvent({ name: 'Playa 2027' })
    const otro = await getEvent(otroId)
    render(<TrucosScreen eventId={otroId} event={otro} />)

    // Es la mitad de para qué existe la lista: un truco no caduca en septiembre.
    expect(await screen.findByText('Pedir el bunga del fondo')).toBeInTheDocument()
    expect(await listTrucos(event)).toHaveLength(1)
  })

  it('no hay nada que tachar: un truco no es una tarea', async () => {
    const { eventId, event } = await viaje()
    await addTruco({ texto: 'Llevar alargador' })
    render(<TrucosScreen eventId={eventId} event={event} />)

    await screen.findByText('Llevar alargador')
    expect(screen.queryByRole('button', { name: /Dar por hech/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/sin hacer/)).not.toBeInTheDocument()
  })

  it('se agrupa por categoría, con la suya en el encabezado', async () => {
    const { eventId, event } = await viaje()
    await addTruco({ texto: 'Llevar alargador', categoria: 'antes' })
    await addTruco({ texto: 'Sartén honda', categoria: 'cocina' })
    render(<TrucosScreen eventId={eventId} event={event} />)

    expect(await screen.findByText(/Antes de salir/)).toBeInTheDocument()
    expect(screen.getByText(/La cocina/)).toBeInTheDocument()
  })

  it('la firma dice quién lo apuntó y de qué familia', async () => {
    const { eventId, event, curro } = await viaje()
    await addTruco({ texto: 'Pedir el bunga del fondo', autorId: curro })
    render(<TrucosScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Curro', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('GA')).toBeInTheDocument()
  })

  it('se toca para editarlo, y borrar pregunta antes', async () => {
    const { eventId, event } = await viaje()
    await addTruco({ texto: 'Llevar alargador', categoria: 'antes' })
    render(<TrucosScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByText('Llevar alargador'))
    expect(await screen.findByRole('heading', { name: 'Editar truco' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    // La pregunta dice que se va de los próximos viajes, no solo de éste.
    expect(await screen.findByText(/próximos viajes/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    await waitFor(async () => { expect(await listTrucos(event)).toHaveLength(0) })
  })
})
