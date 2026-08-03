import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DiasScreen from './DiasScreen.jsx'
import {
  db, createEvent, getEvent, addBunga, addPerson, addDish, addDinner, addPlan, dinnersOf, plansOf,
} from '../db.js'

// Ballenita 2026: 8–15 de agosto, con la cena del día 9 y dos planes.
async function sembrar() {
  const eventId = await createEvent({
    name: 'Ballenita 2026', lugar: 'Camping La Ballena Alegre',
    startDate: '2026-08-08', endDate: '2026-08-15',
  })
  const ruido = await addBunga(eventId, { name: 'Bunga 2', alias: 'El del ruido' })
  const fondo = await addBunga(eventId, { name: 'Bunga 3', alias: 'El del fondo' })
  const curro = await addPerson(eventId, { name: 'Curro', edad: 'adulto' })
  await addPerson(eventId, { name: 'Ana', edad: 'adulto' })
  const paella = await addDish({ name: 'Paella mixta', categorias: ['principal'] })
  const sandia = await addDish({ name: 'Sandía', categorias: ['postre'] })
  await addDinner(eventId, {
    dia: '2026-08-09', platoIds: [paella, sandia], bungaMayoresId: ruido, bungaNinosId: fondo,
  })
  await addPlan(eventId, { titulo: 'Playa de la Cala', dia: '2026-08-10', estado: 'confirmado' })
  await addPlan(eventId, { titulo: 'Noche de juegos de mesa', votos: { [curro]: '👍' } })
  return { eventId, event: await getEvent(eventId) }
}

const abrirDia = async (nombre) =>
  userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${nombre}`, 'i') }))

describe('DiasScreen', () => {
  beforeEach(async () => {
    for (const t of ['events', 'bungas', 'persons', 'dishes', 'dinners', 'plans', 'outbox']) await db[t].clear()
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
    expect(screen.getAllByRole('button', { name: /de agosto:/ })).toHaveLength(8)
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

  /**
   * A1: el lápiz se fue y la fila entera abre. Con él se fue también el `span`
   * escondido: la fecha larga la dice ahora el rótulo del botón, que es lo único
   * que oye quien no ve.
   */
  it('la fila entera abre el día, sin lápiz que buscar', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    expect(screen.queryByRole('button', { name: /^Editar / })).toBeNull()
    await abrirDia('domingo, 9 de agosto')
    expect(await screen.findByRole('heading', { name: /domingo, 9 de agosto/i })).toBeInTheDocument()
  })

  it('la fecha entera se anuncia a quien no ve, aunque en pantalla sea un número', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    expect(await screen.findByRole('button', { name: /^domingo, 9 de agosto: Paella mixta, 2 platos/i }))
      .toBeInTheDocument()
  })

  /** B4: los dos textos libres ya no se piden en ninguna parte. */
  it('la cena ya no pregunta qué se hace ni las cantidades', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await screen.findByRole('heading', { name: /domingo, 9 de agosto/i })
    expect(screen.queryByText('Qué se hace')).toBeNull()
    expect(screen.queryByText('Cantidades')).toBeNull()
  })

  /** F1 + G1: los platos se marcan en su hoja, y no hay «plato al vuelo». */
  it('monta la cena de un día que no la tenía, eligiendo los platos en su hoja', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('martes, 11 de agosto')
    expect(screen.queryByText(/al vuelo/i)).toBeNull()

    await userEvent.click(await screen.findByRole('button', { name: /elige los platos/ }))
    await userEvent.click(await screen.findByRole('button', { name: /^Paella mixta/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Montar la cena' }))

    const cenas = await dinnersOf(eventId)
    const nueva = cenas.find((c) => c.dia === '2026-08-11')
    expect(nueva).toBeTruthy()
    expect(nueva.platoIds).toHaveLength(1)
  })

  it('el renglón de la cena dice lo que se cena, no «2 platos»', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    expect(await screen.findByRole('button', { name: 'Paella mixta y una cosa más' })).toBeInTheDocument()
  })

  /** C2: la hoja de planes libres, con los votos y quién falta. */
  it('coloca en el día un plan libre, elegido en su hoja', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Playa de la Cala')

    await abrirDia('miércoles, 12 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /Añadir un plan \(1 libre\)/ }))
    expect(await screen.findByText('1 👍 · falta por votar Ana')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Noche de juegos de mesa/ }))

    const planes = await plansOf(eventId)
    expect(planes.find((p) => p.titulo === 'Noche de juegos de mesa').dia).toBe('2026-08-12')
  })

  /**
   * D2: un plan cuyo día se cayó fuera de las fechas desaparecía del modal —no
   * estaba ni entre los del día ni entre los que no tienen ninguno—. Ahora
   * cuenta como libre y se dice de dónde viene.
   */
  it('un plan que se quedó fuera de las fechas vuelve a poder colocarse', async () => {
    const { eventId, event } = await sembrar()
    await addPlan(eventId, { titulo: 'Feria de Ronda', dia: '2026-08-17' })
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Playa de la Cala')

    await abrirDia('jueves, 13 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /Añadir un plan \(2 libres\)/ }))
    expect(await screen.findByText(/fuera del viaje/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Feria de Ronda/ }))

    const planes = await plansOf(eventId)
    expect(planes.find((p) => p.titulo === 'Feria de Ronda').dia).toBe('2026-08-13')
  })

  it('sin planes libres el botón lo dice y no abre una hoja vacía', async () => {
    const eventId = await createEvent({ name: 'Solo', startDate: '2026-08-08', endDate: '2026-08-09' })
    render(<DiasScreen eventId={eventId} event={await getEvent(eventId)} />)

    await abrirDia('sábado, 8 de agosto')
    expect(await screen.findByRole('button', { name: 'No queda ningún plan libre' })).toBeDisabled()
  })

  it('sin fechas en el evento, lo dice y manda a Ajustes', async () => {
    const eventId = await createEvent({ name: 'Sin fechas' })
    render(<DiasScreen eventId={eventId} event={await getEvent(eventId)} />)
    expect(await screen.findByText(/todavía no tiene fechas/)).toBeInTheDocument()
  })
})
