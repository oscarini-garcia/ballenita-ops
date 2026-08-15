import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StatsScreen from './StatsScreen.jsx'
import {
  createEvent, addFamily, addPerson, addExpense, addShopItem, updateShopItem,
  getEvent, olvidarTodo,
} from '../db.js'
import { setMeId } from '../lib/identidad.js'

// El recap, al final de Números (SPECS §14.50).

beforeEach(async () => {
  await olvidarTodo()
  localStorage.clear()
})

async function sembrar() {
  const eventId = await createEvent({ name: 'Ballenita', currency: 'EUR' })
  const garcia = await addFamily(eventId, { name: 'García', color: '#E5544B' })
  const curro = await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto' })
  setMeId(eventId, curro)
  await addExpense(eventId, {
    description: 'Hielo y birras', amountCents: 2430, currency: 'EUR', category: 'bebida',
    payers: [{ familyId: garcia, amountCents: 2430 }], participantIds: [curro],
  })
  const linea = await addShopItem(eventId, { texto: 'Hielos' })
  await updateShopItem(linea, { comprado: true })
  return { eventId, curro }
}

describe('El recap', () => {
  it('cuenta lo que ha hecho el grupo, con el nombre de quien lo hizo', async () => {
    const { eventId } = await sembrar()
    render(<StatsScreen eventId={eventId} event={await getEvent(eventId)} />)

    expect(await screen.findByText('El recap')).toBeInTheDocument()
    // El renglón dice quién y qué, no qué campo cambió.
    expect(await screen.findByText(/Curro apuntó «Hielo y birras»/)).toBeInTheDocument()
    expect(screen.getByText(/Curro tachó «Hielos»/)).toBeInTheDocument()
    // Y el resumen por clase, de un vistazo.
    expect(screen.getByText('Dinero')).toBeInTheDocument()
    expect(screen.getByText('La compra')).toBeInTheDocument()
  })

  it('sin nada apuntado lo dice, en vez de enseñar una tarjeta vacía', async () => {
    const eventId = await createEvent({ name: 'Ballenita', currency: 'EUR' })
    await addExpense(eventId, { description: 'x', amountCents: 100, currency: 'EUR' })
    // El gasto de arriba ya deja renglón, así que para el caso vacío se limpia.
    const { db } = await import('../db.js')
    await db.registro.clear()

    render(<StatsScreen eventId={eventId} event={await getEvent(eventId)} />)
    expect(await screen.findByText(/Todavía no hay nada/)).toBeInTheDocument()
  })

  it('«ver todo» destapa los días de atrás, y de fábrica solo sale el último', async () => {
    const { eventId } = await sembrar()
    const { db } = await import('../db.js')
    // Un renglón de anteayer, para que haya más de un día que enseñar.
    await db.registro.put({
      id: 'reg_viejo', eventId, personId: null, tabla: 'plans', filaId: 'x',
      accion: 'crear', clase: 'plan', texto: 'propuso «Kayak»',
      cuando: '2020-08-01T10:00:00.000Z', updatedAt: '2020-08-01T10:00:00.000Z',
    })

    render(<StatsScreen eventId={eventId} event={await getEvent(eventId)} />)
    await screen.findByText('El recap')

    // Con el resumen puesto, el día viejo no está y se dice cuántos faltan.
    await waitFor(() => expect(screen.getByText(/1 día más/)).toBeInTheDocument())
    expect(screen.queryByText(/propuso «Kayak»/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ver todo' }))
    expect(await screen.findByText(/propuso «Kayak»/)).toBeInTheDocument()
  })

  it('un renglón sin dueño sale como «Alguien», no con un hueco', async () => {
    const { eventId } = await sembrar()
    const { db } = await import('../db.js')
    await db.registro.put({
      id: 'reg_huerfano', eventId, personId: null, tabla: 'plans', filaId: 'x',
      accion: 'crear', clase: 'plan', texto: 'propuso «Kayak»',
      cuando: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })

    render(<StatsScreen eventId={eventId} event={await getEvent(eventId)} />)
    expect(await screen.findByText(/Alguien propuso «Kayak»/)).toBeInTheDocument()
  })
})
