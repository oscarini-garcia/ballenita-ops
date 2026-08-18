import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HoyScreen from './HoyScreen.jsx'
import { ESTADO_SE_HACE } from '../lib/planes.js'
import { db, createEvent, getEvent, addBunga, addPerson, addDish, addDinner, addPlan, plansOf } from '../db.js'

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
  await addPlan(eventId, { titulo: 'Playa de la Cala', dia: '2026-08-10', estado: ESTADO_SE_HACE })
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

/** El titular es un botón con la frase dentro, en trozos: se lee su texto. */
const pantalla = {
  frase: async () => {
    await waitFor(() => expect(document.querySelector('.titular .frase')).not.toBeNull())
    return document.querySelector('.titular .frase').textContent
  },
}

describe('HoyScreen', () => {
  beforeEach(async () => {
    for (const t of ['events', 'bungas', 'persons', 'dishes', 'dinners', 'plans', 'outbox']) await db[t].clear()
  })
  afterEach(() => { vi.useRealTimers() })

  // La cena se **redacta** (`hoy-el-dia.html` · T1): decía el plato que manda y
  // llamaba «cinco cosas más» a las otras cinco, así que de seis platos se
  // nombraba uno. La frase se compone de trozos para poder poner en negrita lo
  // que se busca, así que se lee el titular entero y no un nodo suelto.
  it('la cena se cuenta redactada: el plato que manda, el resto y dónde se cena', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-09')
    render(<HoyScreen eventId={eventId} event={event} />)

    const frase = await pantalla.frase()
    expect(frase).toMatch(/^Esta noche Paella mixta/)
    expect(frase).toMatch(/Los mayores cenan en El del ruido y los niños en El del fondo\./)
  })

  it('un día sin planes lo dice sin que parezca que la app está rota', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-09')
    render(<HoyScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Nada apuntado')).toBeInTheDocument()
    expect(screen.getByText('un día libre, que también hace falta')).toBeInTheDocument()
  })

  /**
   * P2 (`docs/diseño/dia-abierto.html`): el titular titula **lo que hay**. El
   * lunes de la playa confirmada decía «Sin cena montada» en grande — lo que
   * **no** hay — con el día de verdad 127 pt más abajo, en letra de fila.
   */
  it('sin cena, el titular es el plan del día, y la cena baja al renglón pequeño', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-10')
    render(<HoyScreen eventId={eventId} event={event} />)

    // Dos veces: el titular y la fila de la lista de planes.
    expect(await screen.findAllByText('Playa de la Cala')).toHaveLength(2)
    expect(screen.getByText('Se hace · sin cena montada todavía')).toBeInTheDocument()
    expect(screen.queryByText('Sin cena montada')).toBeNull()
  })

  it('enseña los planes del día', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-10')
    render(<HoyScreen eventId={eventId} event={event} />)

    expect(await screen.findAllByText('Playa de la Cala')).toHaveLength(2)
    expect(screen.getByText('Se hace')).toBeInTheDocument()
  })

  /**
   * **«A votación» se retiró y con ella la comparación que la hacía salir
   * siempre** (SPECS §14.74). Es la prueba que faltaba: la que había fijaba
   * `'confirmado'` en el sembrado y comprobaba «Confirmado», así que pasaba en
   * verde mientras la app decía «A votación» en los cuatro planes del día.
   */
  it('un plan a votación no dice que está a votación', async () => {
    const { eventId, event } = await sembrar()
    await addPlan(eventId, { titulo: 'Torneo de pingpong', dia: '2026-08-10' })
    hoyEs('2026-08-10')
    render(<HoyScreen eventId={eventId} event={event} />)

    await screen.findAllByText('Torneo de pingpong')
    expect(screen.queryByText(/A votación/)).toBeNull()
  })

  it('tocar un plan lleva a Planes con ese plan abierto', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-10')
    const planes = await plansOf(eventId)
    const playa = planes.find((p) => p.titulo === 'Playa de la Cala')
    const onGoTab = vi.fn()
    render(<HoyScreen eventId={eventId} event={event} onGoTab={onGoTab} />)

    const filas = await screen.findAllByRole('button', { name: /Playa de la Cala/ })
    // La primera es el titular, que abre el día; la de la lista de planes es la
    // que lleva a Planes (§14.74).
    await userEvent.click(filas[filas.length - 1])
    expect(onGoTab).toHaveBeenCalledWith('planes', playa.id)
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

  it('un día sin cena y sin plan es un día libre, no una queja', async () => {
    const { eventId, event } = await sembrar()
    hoyEs('2026-08-11')
    render(<HoyScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Día libre')).toBeInTheDocument()
    expect(screen.getByText('Sin cena montada y sin planes — también hace falta')).toBeInTheDocument()
  })

  /**
   * G3 de `docs/diseño/estado.html`: la tira de caras con su estado. Hasta
   * ahora el estado de una persona sincronizaba a los nueve móviles y no se
   * pintaba en ninguna pantalla.
   */
  it('enseña quién anda en qué, y solo a los que han dicho algo', async () => {
    const { eventId, event } = await sembrar()
    await addPerson(eventId, { name: 'Curro', edad: 'adulto', estado: '🍺 de resaca' })
    await addPerson(eventId, { name: 'Ana', edad: 'adulto', estado: '' })
    hoyEs('2026-08-09')
    render(<HoyScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Quién anda en qué')).toBeInTheDocument()
    expect(screen.getByText('Curro')).toBeInTheDocument()
    expect(screen.getByText('de resaca')).toBeInTheDocument()
    // Quien no ha puesto estado no sale: una tira de caras mudas no cuenta nada.
    expect(screen.queryByText('Ana')).toBeNull()
  })

  it('sin nadie con estado, la tira no aparece', async () => {
    const { eventId, event } = await sembrar()
    await addPerson(eventId, { name: 'Curro', edad: 'adulto' })
    hoyEs('2026-08-09')
    render(<HoyScreen eventId={eventId} event={event} />)

    await waitFor(async () => expect(await pantalla.frase()).toMatch(/Paella mixta/))
    expect(screen.queryByText('Quién anda en qué')).toBeNull()
  })

  it('sin fechas en el evento manda a ponerlas', async () => {
    const eventId = await createEvent({ name: 'Sin fechas' })
    render(<HoyScreen eventId={eventId} event={await getEvent(eventId)} />)
    expect(await screen.findByText(/todavía no tiene fechas/)).toBeInTheDocument()
  })
})
