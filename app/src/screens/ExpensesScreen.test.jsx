import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpensesScreen from './ExpensesScreen.jsx'
import { createEvent, addFamily, addPerson, addExpense, expensesOf } from '../db.js'

// Los creadores de `db.js` devuelven el id, no la fila.
const FECHA = '2026-08-12T18:00:00.000Z'

async function sembrar() {
  const eventId = await createEvent({ name: 'Ballenita', startDate: '2026-08-09', endDate: '2026-08-16' })
  const familyId = await addFamily(eventId, { name: 'García' })
  const personId = await addPerson(eventId, { name: 'Curro', familyId, edad: 'adulto', pesoReparto: 1 })
  await addExpense(eventId, {
    description: 'Cañas en el chiringuito',
    amountCents: 2460,
    currency: 'EUR',
    amountOriginal: 24.6,
    rate: 1,
    category: 'bebida',
    dateISO: FECHA,
    payers: [{ familyId, amountCents: 2460 }],
    participantIds: [personId],
  })
  return { eventId, event: { id: eventId, name: 'Ballenita', currency: 'EUR' } }
}

/** Abre la fila arrastrándola hacia la izquierda, como haría un pulgar. */
function deslizar(cara) {
  fireEvent.pointerDown(cara, { clientX: 300, clientY: 100, pointerId: 1, pointerType: 'touch' })
  fireEvent.pointerMove(cara, { clientX: 240, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(cara, { clientX: 160, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(cara, { clientX: 160, clientY: 100, pointerId: 1 })
}

describe('Gastos', () => {
  it('la fila enseña el importe, que es a lo que se entra aquí', async () => {
    const { eventId, event } = await sembrar()
    render(<ExpensesScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Cañas en el chiringuito')).toBeInTheDocument()
    expect(screen.getAllByText(/24,60/).length).toBeGreaterThan(0)
    // Y ya no lleva un botón de borrar puesto encima del hueco del importe.
    expect(screen.queryByRole('button', { name: /^borrar$/i })).not.toBeInTheDocument()
  })

  it('deslizar la fila descubre Editar y Borrar', async () => {
    const { eventId, event } = await sembrar()
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await screen.findByText('Cañas en el chiringuito')

    expect(document.querySelector('.deslizable-verbos').style.visibility).toBe('hidden')
    deslizar(document.querySelector('.deslizable-cara'))
    expect(document.querySelector('.deslizable-verbos').style.visibility).toBe('visible')
    expect(screen.getByRole('button', { name: /Editar/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Borrar/ })).toBeInTheDocument()
  })

  it('corregir un gasto lo actualiza en vez de crear otro, y le respeta la fecha', async () => {
    const { eventId, event } = await sembrar()
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await screen.findByText('Cañas en el chiringuito')

    deslizar(document.querySelector('.deslizable-cara'))
    await userEvent.click(screen.getByRole('button', { name: /Editar/ }))

    // La ficha arranca con lo que ya había: es una corrección, no un alta.
    expect(await screen.findByText('Corregir gasto')).toBeInTheDocument()
    const importe = screen.getByPlaceholderText('0,00')
    expect(importe).toHaveValue(24.6)

    await userEvent.clear(importe)
    await userEvent.type(importe, '26.40')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar los cambios' }))

    await waitFor(async () => {
      const gastos = await expensesOf(eventId)
      expect(gastos).toHaveLength(1)
      expect(gastos[0].amountCents).toBe(2640)
      // La fecha es cuándo se gastó, no cuándo se cayó en la cuenta del error.
      expect(gastos[0].dateISO).toBe(FECHA)
    })
  })
})
