import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BalancesScreen from './BalancesScreen.jsx'
import {
  db, createEvent, getEvent, addFamily, addPerson, addExpense, settlementsOf,
} from '../db.js'

/**
 * Saldos, decidido en `docs/diseño/saldos.html` · F3 · R2 · E1.
 *
 * La semilla son los tres gastos del Demo, que dan saldos de verdad: los García
 * deben 91,85 €, y se salda con 70,56 € a los Pérez y 21,29 € a los Solteros.
 */
async function sembrar() {
  const eventId = await createEvent({ name: 'Ballenita 2026', currency: 'EUR' })
  const garcia = await addFamily(eventId, { name: 'García', color: '#E5544B' })
  const perez = await addFamily(eventId, { name: 'Pérez', color: '#2E9E6B' })
  const solteros = await addFamily(eventId, { name: 'Solteros', color: '#1FA6D6' })
  const ids = []
  for (const [name, familyId] of [
    ['Curro', garcia], ['Marta', garcia], ['Fran', garcia],
    ['Ana', perez], ['Luis', perez], ['Pablo', solteros],
  ]) ids.push(await addPerson(eventId, { name, familyId, edad: 'adulto' }))

  const comun = { currency: 'EUR', dateISO: new Date().toISOString(), participantIds: ids }
  await addExpense(eventId, { ...comun, description: 'Compra grande', amountCents: 14800, category: 'compra_general', payers: [{ familyId: perez, amountCents: 14800 }] })
  await addExpense(eventId, { ...comun, description: 'Gasolina', amountCents: 6000, category: 'varios', payers: [{ familyId: solteros, amountCents: 6000 }] })
  await addExpense(eventId, { ...comun, description: 'Hielo', amountCents: 2430, category: 'bebida', payers: [{ familyId: garcia, amountCents: 2430 }] })
  return { eventId, event: await getEvent(eventId) }
}

const filaCon = (texto) =>
  [...document.querySelectorAll('.card .row')].find((f) => f.textContent.includes(texto))

describe('BalancesScreen', () => {
  beforeEach(async () => {
    for (const t of ['events', 'families', 'persons', 'expenses', 'settlements', 'outbox']) await db[t].clear()
  })

  /** F3: la familia con su pastilla de dos letras, y sin el emoji sobre el color. */
  it('nombra cada familia con su pastilla de iniciales, no con su emoji', async () => {
    const { eventId, event } = await sembrar()
    render(<BalancesScreen eventId={eventId} event={event} />)
    await screen.findByText('Saldo por familia')

    const perez = filaCon('Pérez')
    expect(perez.querySelector('.alias').textContent).toBe('PE')
    // La casilla del emoji se fue: el color vive ahora en la pastilla.
    expect(perez.querySelector('.av')).toBeNull()
  })

  it('cuenta los saldos de verdad, y quién debe y a quién le deben', async () => {
    const { eventId, event } = await sembrar()
    render(<BalancesScreen eventId={eventId} event={event} />)
    await screen.findByText('Saldo por familia')

    expect(filaCon('García').textContent).toContain('debe')
    expect(filaCon('García').querySelector('.amt').textContent).toMatch(/91,85/)
    expect(filaCon('Pérez').querySelector('.amt').textContent).toMatch(/\+70,5/)
  })

  /** R2: dos líneas, quién paga a quién arriba y el importe debajo. */
  it('el renglón de saldar dice quién paga a quién, sin «transferencia pendiente»', async () => {
    const { eventId, event } = await sembrar()
    render(<BalancesScreen eventId={eventId} event={event} />)
    await screen.findByText('Quién paga a quién')

    expect(screen.queryByText('transferencia pendiente')).toBeNull()
    expect(screen.queryByText(/Cómo saldar/)).toBeNull()

    const fila = filaCon('García → Pérez')
    expect(fila).toBeTruthy()
    // Sin el «€» en el patrón: `Intl` separa la moneda con un espacio duro.
    expect(fila.querySelector('.sub').textContent).toMatch(/70,5\d/)
    // El verbo va al lado y en una palabra, no apilado bajo la cifra.
    expect(fila.querySelector('button').textContent).toBe('pagado')
  })

  it('marcar un pago lo apunta y lo baja a «Pagos apuntados» con la misma figura', async () => {
    const { eventId, event } = await sembrar()
    render(<BalancesScreen eventId={eventId} event={event} />)
    await screen.findByText('Quién paga a quién')

    await userEvent.click(filaCon('García → Pérez').querySelector('button'))

    expect(await screen.findByText('Pagos apuntados')).toBeInTheDocument()
    const apuntados = await settlementsOf(eventId)
    expect(apuntados).toHaveLength(1)
    // El céntimo del redondeo cae en una familia u otra según el orden de los
    // ids, que son de cliente: lo que se comprueba es que apunta el importe de
    // la transferencia, no un número escrito a mano.
    expect(apuntados[0].amountCents).toBeGreaterThan(7000)
  })

  /**
   * El arreglo del tercer defecto: una persona sin familia es una «familia de
   * uno», y todas se llamaban «Sin familia».
   */
  it('una persona sin familia sale con su nombre, no como «Sin familia»', async () => {
    const eventId = await createEvent({ name: 'Sueltos', currency: 'EUR' })
    const fam = await addFamily(eventId, { name: 'García' })
    const curro = await addPerson(eventId, { name: 'Curro', familyId: fam, edad: 'adulto' })
    const suelta = await addPerson(eventId, { name: 'Berta', edad: 'adulto' })
    await addExpense(eventId, {
      description: 'Taxi', amountCents: 2000, currency: 'EUR', category: 'varios',
      dateISO: new Date().toISOString(), payers: [{ familyId: fam, amountCents: 2000 }],
      participantIds: [curro, suelta],
    })
    render(<BalancesScreen eventId={eventId} event={await getEvent(eventId)} />)
    await screen.findByText('Saldo por familia')

    expect(filaCon('Berta')).toBeTruthy()
    expect(screen.queryByText('Sin familia')).toBeNull()
    // Sin familia dueña no hay color, pero sí sus dos letras.
    expect(filaCon('Berta').querySelector('.alias').textContent).toBe('BE')
  })

  it('sin gastos no hay cuentas que echar', async () => {
    const eventId = await createEvent({ name: 'Vacío', currency: 'EUR' })
    render(<BalancesScreen eventId={eventId} event={await getEvent(eventId)} />)
    expect(await screen.findByText(/Sin gastos, sin cuentas/)).toBeInTheDocument()
  })
})
