import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DiasScreen from './DiasScreen.jsx'
import {
  db, createEvent, getEvent, addBunga, addDish, addDinner, addPlan, dinnersOf, plansOf,
} from '../db.js'

// Ballenita 2026: 8–15 de agosto, con la cena del día 9 y dos planes.
async function sembrar() {
  const eventId = await createEvent({
    name: 'Ballenita 2026', lugar: 'Camping La Ballena Alegre',
    startDate: '2026-08-08', endDate: '2026-08-15',
  })
  const ruido = await addBunga(eventId, { name: 'Bunga 2', alias: 'El del ruido' })
  const fondo = await addBunga(eventId, { name: 'Bunga 3', alias: 'El del fondo' })
  const paella = await addDish({ name: 'Paella mixta', categorias: ['principal'] })
  const sandia = await addDish({ name: 'Sandía', categorias: ['postre'] })
  await addDinner(eventId, {
    dia: '2026-08-09', platoIds: [paella, sandia], bungaMayoresId: ruido, bungaNinosId: fondo,
  })
  await addPlan(eventId, { titulo: 'Playa de la Cala', dia: '2026-08-10', estado: 'confirmado' })
  await addPlan(eventId, { titulo: 'Noche de juegos de mesa' })
  return { eventId, event: await getEvent(eventId) }
}

describe('DiasScreen', () => {
  beforeEach(async () => {
    for (const t of ['events', 'bungas', 'dishes', 'dinners', 'plans', 'outbox']) await db[t].clear()
  })

  it('pinta un día por cada uno del evento, también los vacíos', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)

    // Esperar a que hayan resuelto **las dos** consultas: hasta que llegan las
    // cenas y los planes, los ocho días se pintan vacíos y contar antes no dice
    // nada. Resuelven por separado, así que hay que esperar a las dos.
    await screen.findByText('Paella mixta')
    await screen.findByText('Playa de la Cala')

    // Ocho días: el 9 con cena, el 10 con plan y los otros seis sin nada.
    expect(screen.getAllByRole('button', { name: /^Editar / })).toHaveLength(8)
    expect(screen.getAllByText('nada apuntado')).toHaveLength(6)
  })

  it('resume cada día por lo que se hace en él', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Paella mixta')).toBeInTheDocument()
    expect(screen.getByText('2 platos · sin planes')).toBeInTheDocument()
    expect(screen.getByText('Playa de la Cala')).toBeInTheDocument()
    expect(screen.getByText('sin cena · 1 plan')).toBeInTheDocument()
    // El primero y el último día vacíos se llaman por lo que son.
    expect(screen.getByText('Llegada')).toBeInTheDocument()
    expect(screen.getByText('Vuelta a casa')).toBeInTheDocument()
  })

  it('el lápiz abre el día en su modal', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByRole('button', { name: /^Editar domingo, 9 de agosto/ }))
    expect(await screen.findByRole('heading', { name: /domingo, 9 de agosto/i })).toBeInTheDocument()
  })

  it('monta la cena de un día que no la tenía', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByRole('button', { name: /^Editar martes, 11 de agosto/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Paella mixta' }))
    await userEvent.click(screen.getByRole('button', { name: 'Montar la cena' }))

    const cenas = await dinnersOf(eventId)
    const nueva = cenas.find((c) => c.dia === '2026-08-11')
    expect(nueva).toBeTruthy()
    expect(nueva.platoIds).toHaveLength(1)
  })

  it('mete un plan sin día en el día que se está mirando', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByRole('button', { name: /^Editar miércoles, 12 de agosto/ }))
    await userEvent.click(await screen.findByRole('button', { name: '+ Noche de juegos de mesa' }))

    const planes = await plansOf(eventId)
    expect(planes.find((p) => p.titulo === 'Noche de juegos de mesa').dia).toBe('2026-08-12')
  })

  it('sin fechas en el evento, lo dice y manda a Ajustes', async () => {
    const eventId = await createEvent({ name: 'Sin fechas' })
    render(<DiasScreen eventId={eventId} event={await getEvent(eventId)} />)
    expect(await screen.findByText(/todavía no tiene fechas/)).toBeInTheDocument()
  })

  it('la fecha entera se anuncia a quien no ve, aunque en pantalla sea un número', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    const fila = (await screen.findByText('Paella mixta')).closest('.fila-dia')
    expect(within(fila).getByText(/domingo, 9 de agosto/i)).toBeInTheDocument()
  })
})
