import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HoyScreen from './HoyScreen.jsx'
import { db, createEvent, getEvent, addBunga, addDish, addDinner, addPlan } from '../db.js'

async function sembrar() {
  const eventId = await createEvent({
    name: 'Ballenita 2026', startDate: '2026-08-08', endDate: '2026-08-15',
  })
  const ruido = await addBunga(eventId, { name: 'Bunga 2', alias: 'El del ruido' })
  const fondo = await addBunga(eventId, { name: 'Bunga 3', alias: 'El del fondo' })
  const ids = []
  for (const [name, cat] of [
    ['Aceitunas y altramuces', 'aperitivo'], ['Ensaladilla rusa', 'entrante'],
    ['Paella mixta', 'principal'], ['Pan con tomate', 'acompanamiento'],
    ['Ensalada verde', 'acompanamiento'], ['Sandía', 'postre'],
  ]) ids.push(await addDish({ name, categorias: [cat] }))
  await addDinner(eventId, {
    dia: '2026-08-09', platoIds: ids, bungaMayoresId: ruido, bungaNinosId: fondo,
  })
  await addPlan(eventId, { titulo: 'Playa de la Cala', dia: '2026-08-10', estado: 'confirmado' })
  return { eventId, event: await getEvent(eventId) }
}

/**
 * Congela «hoy» para que la pantalla no dependa del día en que se corra.
 *
 * `shouldAdvanceTime` es imprescindible: sin él, los relojes falsos también
 * paran los que usa `findBy*` para esperar, y todo se queda colgado hasta que
 * salta el tiempo máximo de la prueba.
 */
function hoyEs(iso) {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${iso}T12:00:00Z`))
}

describe('HoyScreen', () => {
  beforeEach(async () => {
    for (const t of ['events', 'bungas', 'dishes', 'dinners', 'plans', 'outbox']) await db[t].clear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('titula el día con el plato principal y cuenta el resto con letra', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-09')
    render(<HoyScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Paella mixta y cinco cosas más')).toBeInTheDocument()
    expect(screen.getByText('Mayores en El del ruido · niños en El del fondo')).toBeInTheDocument()
  })

  it('un día sin planes lo dice sin que parezca que la app está rota', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-09')
    render(<HoyScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Nada apuntado')).toBeInTheDocument()
    expect(screen.getByText('un día libre, que también hace falta')).toBeInTheDocument()
  })

  it('enseña los planes del día', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-10')
    render(<HoyScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Playa de la Cala')).toBeInTheDocument()
    expect(screen.getByText('Confirmado')).toBeInTheDocument()
  })

  it('antes del viaje enseña el primer día y cuánto falta, no un vacío', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-02')
    render(<HoyScreen eventId={eventId} event={event} />)

    expect(await screen.findByText(/el primer día, dentro de 6 días/)).toBeInTheDocument()
    expect(screen.queryByText(/agenda está vacía/i)).not.toBeInTheDocument()
  })

  it('después del viaje enseña el último día diciendo que ya pasó', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-20')
    render(<HoyScreen eventId={eventId} event={event} />)

    expect(await screen.findByText(/el último día, hace 5 días/)).toBeInTheDocument()
  })

  it('sin cena montada lo dice, y no inventa una', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-11')
    render(<HoyScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Sin cena montada')).toBeInTheDocument()
    expect(screen.getByText('Nadie ha dicho dónde se cena')).toBeInTheDocument()
  })

  it('sin fechas en el evento manda a ponerlas', async () => {
    const eventId = await createEvent({ name: 'Sin fechas' })
    render(<HoyScreen eventId={eventId} event={await getEvent(eventId)} />)
    expect(await screen.findByText(/todavía no tiene fechas/)).toBeInTheDocument()
  })
})
