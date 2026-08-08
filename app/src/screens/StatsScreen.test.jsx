import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatsScreen from './StatsScreen.jsx'
import { db, createEvent, getEvent, addFamily, addBunga, addPerson, addDinner } from '../db.js'

/**
 * Números: el balance de anfitrión enseña los bungas **como su selector**
 * (§14.31 · B1) — la familia manda, con su pastilla de dos letras, y el alias
 * del bunga queda de seña.
 */
async function sembrar() {
  const eventId = await createEvent({
    name: 'Ballenita 2026', currency: 'EUR', startDate: '2026-08-08', endDate: '2026-08-15',
  })
  const perez = await addFamily(eventId, { name: 'Pérez' })
  const ruido = await addBunga(eventId, { name: 'Bunga 2', alias: 'El del ruido', familyId: perez })
  // Sin familia dueña a propósito: es el caso que cae al alias.
  const nadie = await addBunga(eventId, { name: 'Bunga 4', alias: 'El de nadie' })
  await addPerson(eventId, { name: 'Ana', familyId: perez, edad: 'adulto' })
  await addDinner(eventId, {
    dia: '2026-08-09', platoIds: [], bungaMayoresId: ruido, bungaNinosId: nadie,
  })
  return { eventId, event: await getEvent(eventId) }
}

const filas = () => [...document.querySelectorAll('.card.tight .row')]

describe('StatsScreen — el balance de anfitrión', () => {
  beforeEach(async () => {
    for (const t of ['events', 'families', 'bungas', 'persons', 'dishes', 'dinners', 'plans', 'expenses', 'outbox']) {
      await db[t].clear()
    }
  })

  it('nombra cada bunga por su familia, con la pastilla de su alias', async () => {
    const { eventId, event } = await sembrar()
    render(<StatsScreen eventId={eventId} event={event} />)
    await screen.findByText('Balance de anfitrión (cenas)')

    const dePerez = filas().find((f) => f.textContent.includes('Pérez'))
    expect(dePerez, 'la fila del bunga de los Pérez').toBeTruthy()
    expect(dePerez.querySelector('.alias').textContent).toBe('PE')
    // El alias del bunga baja a la línea de debajo, con el recuento.
    expect(dePerez.querySelector('.sub').textContent).toBe('El del ruido · mayores 1 · niños 0')
  })

  it('un bunga sin familia dueña se queda con su alias, como en el selector', async () => {
    const { eventId, event } = await sembrar()
    render(<StatsScreen eventId={eventId} event={event} />)
    await screen.findByText('Balance de anfitrión (cenas)')

    const suelto = filas().find((f) => f.textContent.includes('El de nadie'))
    expect(suelto.querySelector('.n').textContent).toBe('El de nadie')
    expect(suelto.querySelector('.alias')).toBeNull()
    expect(suelto.querySelector('.sub').textContent).toBe('mayores 0 · niños 1')
  })

  it('el 🏠 del cromo se fue: el dibujo es el de línea de siempre', async () => {
    const { eventId, event } = await sembrar()
    render(<StatsScreen eventId={eventId} event={event} />)
    await screen.findByText('Balance de anfitrión (cenas)')

    const fila = filas()[0]
    expect(fila.textContent).not.toContain('🏠')
    expect(fila.querySelector('.ico svg')).not.toBeNull()
  })
})
