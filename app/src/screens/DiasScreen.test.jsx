import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  return { eventId, event: await getEvent(eventId), ruido }
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

  /**
   * H1: los verbos de guardar se fueron —«Guardar la cena» guardaba también las
   * bungas y no tocaba los planes, que ya se guardaban solos— y con ellos el
   * borrador que moría al cerrar. Cada toque escribe.
   */
  it('el día abierto no lleva verbo de guardar: cada toque escribe', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await screen.findByRole('heading', { name: /domingo, 9 de agosto/i })
    expect(screen.queryByText(/Guardar la cena/)).toBeNull()
    expect(screen.queryByText(/Montar la cena/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'quitar' })).toBeNull()
  })

  /** M2 + R2: la cena nace sola al marcar el primer plato, sin ningún botón. */
  it('monta la cena de un día que no la tenía, marcando un plato en su hoja', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('martes, 11 de agosto')
    expect(screen.queryByText(/al vuelo/i)).toBeNull()

    await userEvent.click(await screen.findByRole('button', { name: /Sin cena montada/ }))
    await userEvent.click(await screen.findByRole('button', { name: /^Paella mixta/ }))

    // Sin «Listo» y sin «Montar la cena»: el toque ya escribió (H1).
    await waitFor(async () => {
      const nueva = (await dinnersOf(eventId)).find((c) => c.dia === '2026-08-11')
      expect(nueva).toBeTruthy()
      expect(nueva.platoIds).toHaveLength(1)
    })
  })

  it('dos toques rápidos no crean dos cenas el mismo día', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('martes, 11 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /Sin cena montada/ }))
    await userEvent.click(await screen.findByRole('button', { name: /^Paella mixta/ }))
    await userEvent.click(await screen.findByRole('button', { name: /^Sandía/ }))

    await waitFor(async () => {
      const delDia = (await dinnersOf(eventId)).filter((c) => c.dia === '2026-08-11')
      expect(delDia).toHaveLength(1)
      expect(delDia[0].platoIds).toHaveLength(2)
    })
  })

  it('el renglón de la cena dice lo que se cena, no «2 platos»', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    expect(await screen.findByRole('button', { name: /Paella mixta y una cosa más/ })).toBeInTheDocument()
  })

  /** R2: las bungas se eligen en su hoja, no en dos selectores nativos. */
  it('elige la bunga de mayores en su hoja, y también nace la cena si no había', async () => {
    const { eventId, event, ruido } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('viernes, 14 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /Sin bungas repartidas/ }))
    // Las dos listas enseñan las mismas bungas: la primera aparición es la de
    // mayores, que es la lista de arriba.
    await userEvent.click((await screen.findAllByRole('button', { name: 'El del ruido' }))[0])

    await waitFor(async () => {
      const nueva = (await dinnersOf(eventId)).find((c) => c.dia === '2026-08-14')
      expect(nueva?.bungaMayoresId).toBe(ruido)
    })
  })

  /** H1: quitar la cena vive en su hoja y pide segunda pulsación. */
  it('quitar la cena pide segunda pulsación, y se lleva platos y bungas', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /Paella mixta y una cosa más/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar la cena de este día' }))
    // Primera pulsación: todavía no ha pasado nada.
    expect((await dinnersOf(eventId)).find((c) => c.dia === '2026-08-09')).toBeTruthy()
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, quitarla' }))

    await waitFor(async () => {
      expect((await dinnersOf(eventId)).find((c) => c.dia === '2026-08-09')).toBeUndefined()
    })
  })

  /** R2: los planes se marcan —marcar pone, desmarcar quita— con votos y quién falta. */
  it('coloca en el día un plan libre, marcándolo en su hoja', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Playa de la Cala')

    await abrirDia('miércoles, 12 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /Nada apuntado/ }))
    expect(await screen.findByText('1 👍 · falta por votar Ana')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Noche de juegos de mesa/ }))

    await waitFor(async () => {
      const planes = await plansOf(eventId)
      expect(planes.find((p) => p.titulo === 'Noche de juegos de mesa').dia).toBe('2026-08-12')
    })
  })

  it('desmarcar un plan puesto lo devuelve a libres, sin verbo en la fila', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Playa de la Cala')

    await abrirDia('lunes, 10 de agosto')
    // El renglón del plan enseña el que está puesto; su hoja lo trae marcado.
    // «Confirmado» distingue el renglón de la capa de la fila del día 10 de la
    // lista de detrás, cuyo rótulo también nombra la playa.
    await userEvent.click(await screen.findByRole('button', { name: /Playa de la Cala Confirmado/ }))
    const puesto = await screen.findByRole('button', { name: /Playa de la Cala/, pressed: true })
    await userEvent.click(puesto)

    await waitFor(async () => {
      const planes = await plansOf(eventId)
      expect(planes.find((p) => p.titulo === 'Playa de la Cala').dia).toBeNull()
    })
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
    await userEvent.click(await screen.findByRole('button', { name: /2 planes libres por traer/ }))
    expect(await screen.findByText(/fuera del viaje/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Feria de Ronda/ }))

    await waitFor(async () => {
      const planes = await plansOf(eventId)
      expect(planes.find((p) => p.titulo === 'Feria de Ronda').dia).toBe('2026-08-13')
    })
  })

  it('sin planes que traer, el renglón lo dice y no abre una hoja vacía', async () => {
    const eventId = await createEvent({ name: 'Solo', startDate: '2026-08-08', endDate: '2026-08-09' })
    render(<DiasScreen eventId={eventId} event={await getEvent(eventId)} />)

    await abrirDia('sábado, 8 de agosto')
    expect(await screen.findByRole('button', { name: /ningún plan libre/ })).toBeDisabled()
  })

  it('sin fechas en el evento, lo dice y manda a Ajustes', async () => {
    const eventId = await createEvent({ name: 'Sin fechas' })
    render(<DiasScreen eventId={eventId} event={await getEvent(eventId)} />)
    expect(await screen.findByText(/todavía no tiene fechas/)).toBeInTheDocument()
  })
})
