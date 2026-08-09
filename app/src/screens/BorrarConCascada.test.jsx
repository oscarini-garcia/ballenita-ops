import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'
import {
  db, createEvent, addFamily, addPerson, addExpense, addDinner, addDish, addShopItem,
  expensesOf, dinnersOf,
} from '../db.js'
import ExpensesScreen from './ExpensesScreen.jsx'
import CenasScreen from './CenasScreen.jsx'

/**
 * Los dos borrados que no preguntaban nada y sí arrastran
 * (`docs/diseño/borrar-confirmaciones.html` · A2·B2·B3).
 *
 * Lo que se prueba no es que salga un modal: es que **la primera pulsación no
 * borre** y que la frase **diga el número**. Una confirmación que no cuenta lo
 * que se lleva no se puede contestar, solo obedecer.
 */
let eventId
let event

beforeEach(async () => {
  for (const t of db.tables) await t.clear()
  eventId = await createEvent({ name: 'Camping', startDate: '2026-08-13', endDate: '2026-08-16', currency: 'EUR' })
  event = { id: eventId, name: 'Camping', startDate: '2026-08-13', endDate: '2026-08-16', currency: 'EUR' }
})
afterEach(async () => { for (const t of db.tables) await t.clear() })

describe('borrar un gasto', () => {
  beforeEach(async () => {
    const f1 = await addFamily(eventId, { name: 'Pérez' })
    const f2 = await addFamily(eventId, { name: 'Solteros' })
    await addPerson(eventId, { name: 'Ana', familyId: f1 })
    await addPerson(eventId, { name: 'Luis', familyId: f2 })
    await addExpense(eventId, {
      description: 'Cena en el chiringuito', amountCents: 4860, category: 'comida',
      dateISO: '2026-08-14T21:00:00.000Z', payers: [{ familyId: f1, amountCents: 4860 }],
    })
  })

  const abrirElVerbo = async () => {
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await screen.findByText('Cena en el chiringuito')
    // El verbo vive detrás del deslizamiento y en reposo está tapado
    // (`visibility: hidden`), así que se coge del DOM en vez de simular un
    // arrastre: lo que se prueba aquí es qué hace el verbo, no cómo se llega.
    const verbo = document.querySelector('.verbo.borrar')
    expect(verbo).not.toBeNull()
    await userEvent.click(verbo)
  }

  it('la primera pulsación pregunta y no borra', async () => {
    await abrirElVerbo()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(await expensesOf(eventId)).toHaveLength(1)
  })

  it('la pregunta dice el importe, quién pagó y a cuántas familias les mueve el saldo', async () => {
    await abrirElVerbo()
    const dicho = await screen.findByRole('alert')
    expect(dicho).toHaveTextContent('Cena en el chiringuito')
    expect(dicho).toHaveTextContent('48,60')
    expect(dicho).toHaveTextContent('pagó Pérez')
    // Lo que no se ve al borrar, que es la razón entera de preguntar.
    expect(dicho).toHaveTextContent('Cambia el saldo de 2 familias')
  })

  it('«Dejarlo» deja el gasto donde estaba', async () => {
    await abrirElVerbo()
    await userEvent.click(await screen.findByRole('button', { name: 'Dejarlo' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(await expensesOf(eventId)).toHaveLength(1)
  })

  it('«Sí, borrar» sí borra', async () => {
    await abrirElVerbo()
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, borrar' }))
    await waitFor(async () => expect(await expensesOf(eventId)).toHaveLength(0))
  })
})

describe('borrar una cena', () => {
  let cenaId

  beforeEach(async () => {
    await addPerson(eventId, { name: 'Ana', edad: 'adulto' })
    const plato = await addDish({
      name: 'Paella', categorias: ['principal'], raciones: 4,
      ingredientes: [{ nombre: 'Arroz', cantidad: 400, unidad: 'g' }],
    }, event)
    cenaId = await addDinner(eventId, { dia: '2026-08-14', platoIds: [plato] })
    await addShopItem(eventId, { texto: 'Arroz', origen: 'cena', clave: 'arroz|g', cantidad: 100, unidad: 'g' })
  })

  const abrirElVerbo = async () => {
    render(<CenasScreen eventId={eventId} event={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar la cena' }))
  }

  it('el verbo ya no está en la cabecera de la tarjeta, y pregunta antes', async () => {
    await abrirElVerbo()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(await dinnersOf(eventId)).toHaveLength(1)
  })

  it('la pregunta cuenta las líneas de la compra que se caen con ella', async () => {
    await abrirElVerbo()
    const dicho = await screen.findByRole('alert')
    expect(dicho).toHaveTextContent('Se borra la cena')
    expect(dicho).toHaveTextContent('Paella')
    expect(dicho).toHaveTextContent('Se va 1 línea de la compra')
  })

  it('confirmando se borra de verdad', async () => {
    await abrirElVerbo()
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, borrar' }))
    await waitFor(async () => expect(await dinnersOf(eventId)).toHaveLength(0))
  })
})
