import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DiasScreen from './DiasScreen.jsx'
import PlanesScreen from './PlanesScreen.jsx'
import { db, createEvent, getEvent, addBunga, addDish, addDinner, addPlan } from '../db.js'

/**
 * Lo que se cayó fuera de las fechas no abre la lista.
 *
 * El viaje empieza el 15 y había una cena del 14 —de cuando las fechas eran
 * otras—. Las cenas salían en el orden en que IndexedDB las devolvía, que no es
 * ninguno, y sin mirar el calendario: la primera cosa que se veía del viaje era
 * un día que el viaje no tiene, con el mismo aspecto que las de verdad.
 *
 * No se esconde, se aparta: escondida seguiría contando en Estadísticas y
 * ocupando bunga en el balance de anfitrión, invisible.
 *
 * **Esto lo guardaba Comidas → Cenas y ahora lo guarda Días** (§14.68 · N1). Al
 * retirarse aquella área la guardia se quedaba sin sujeto, y el reflejo fácil
 * —borrar estos dos casos— habría dado una suite verde con la cena del 14
 * invisible: `diasDe` solo mira los días apuntados **cuando el evento no tiene
 * fechas**. Por eso el test se muda en vez de irse.
 */
const VIAJE = { startDate: '2026-08-15', endDate: '2026-08-22' }

async function sembrar() {
  const eventId = await createEvent({ name: 'Viaje', ...VIAJE })
  const bunga = await addBunga(eventId, { name: 'Bunga 1', alias: 'El de la piscina' })
  const paella = await addDish({ name: 'Paella mixta', categorias: ['principal'] })
  const sardinas = await addDish({ name: 'Sardinas', categorias: ['principal'] })
  // A propósito en este orden: la de fuera se guarda **primero**.
  await addDinner(eventId, { dia: '2026-08-14', platoIds: [sardinas], bungaMayoresId: bunga })
  await addDinner(eventId, { dia: '2026-08-16', platoIds: [paella], bungaMayoresId: bunga })
  await addPlan(eventId, { titulo: 'Cena de despedida en el pueblo', dia: '2026-08-14' })
  await addPlan(eventId, { titulo: 'Playa de la Cala', dia: '2026-08-17' })
  return { eventId, event: await getEvent(eventId) }
}

const textos = (sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent)

describe('lo que cae fuera de las fechas', () => {
  beforeEach(async () => {
    for (const t of ['events', 'bungas', 'dishes', 'dinners', 'plans', 'outbox']) await db[t].clear()
  })

  it('Días: el 14 no abre la lista, va al final y va marcado', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)

    await screen.findByText('Fuera de las fechas del viaje')
    // Los ocho del viaje primero; el de fuera, el último de todos.
    const numeros = textos('.dia-num b')
    expect(numeros[0]).toBe('15')
    expect(numeros[numeros.length - 1]).toBe('14')

    expect(screen.getByText('fuera del viaje')).toBeInTheDocument()
    // Y se puede abrir: apartar no es esconder — es lo que deja vaciarlo.
    const filas = [...document.querySelectorAll('.dia-abre')]
    expect(filas[filas.length - 1].getAttribute('aria-label')).toMatch(/14 de agosto/)
  })

  it('Días: sin nada fuera, ni encabezado ni marca', async () => {
    const eventId = await createEvent({ name: 'Viaje', ...VIAJE })
    const bunga = await addBunga(eventId, { name: 'Bunga 1' })
    await addDinner(eventId, { dia: '2026-08-16', platoIds: [], bungaMayoresId: bunga })
    render(<DiasScreen eventId={eventId} event={await getEvent(eventId)} />)

    await screen.findByText('15', { selector: '.dia-num b' })
    expect(screen.queryByText('Fuera de las fechas del viaje')).not.toBeInTheDocument()
    expect(screen.queryByText('fuera del viaje')).not.toBeInTheDocument()
  })

  it('Planes: el del 14 baja al final y va marcado', async () => {
    const { eventId, event } = await sembrar()
    render(<PlanesScreen eventId={eventId} event={event} />)

    await screen.findByText('Playa de la Cala')
    // Los de dentro arriba; el de fuera, en su grupo del final.
    const titulos = textos('.fila-plan .n')
    expect(titulos[0]).toBe('Playa de la Cala')
    expect(titulos[titulos.length - 1]).toBe('Cena de despedida en el pueblo')

    expect(screen.getByText('Fuera de las fechas del viaje')).toBeInTheDocument()
  })
})
