import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEventBase from '@testing-library/user-event'
import CompraScreen from './CompraScreen.jsx'
import { db, createEvent, addPerson, addBunga, addDish, addDinner, getEvent } from '../db.js'

/**
 * La compra sale de las cenas: el total para el carro y el reparto al abrir la
 * línea (§14.20 · C1).
 */
let userEvent
let eventId
let event

beforeEach(async () => {
  userEvent = userEventBase.setup()
  for (const t of ['events', 'persons', 'bungas', 'dishes', 'dinners', 'shop', 'outbox']) await db[t].clear()
  eventId = await createEvent({ name: 'Ballenita 2026', startDate: '2026-08-08', endDate: '2026-08-12' })
  event = await getEvent(eventId)
  const perez = await addBunga(eventId, { name: 'Pérez', alias: 'PER' })
  const solteros = await addBunga(eventId, { name: 'Solteros', alias: 'SOL' })
  for (let i = 0; i < 4; i += 1) await addPerson(eventId, { name: `Adulto ${i}`, edad: 'adulto' })
  for (let i = 0; i < 2; i += 1) await addPerson(eventId, { name: `Niño ${i}`, edad: 'niño' })
  const paella = await addDish({
    name: 'Paella mixta',
    raciones: 10,
    ingredientes: [{ nombre: 'Arroz', cantidad: 1, unidad: 'kg', lote: { tamano: 1, unidad: 'kg', nombre: 'paquete' } }],
  })
  await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella], bungaMayoresId: perez, bungaNinosId: solteros })
})

describe('la compra que sale de las cenas', () => {
  it('enseña lo que hay que meter en el carro, ya redondeado', async () => {
    render(<CompraScreen eventId={eventId} event={event} />)
    // 1 kg para 10 raciones y se sientan 5,2 → 0,52 kg, que se compran en un
    // paquete de uno. En la lista va lo que se coge, no la cifra exacta.
    expect(await screen.findByText('Arroz')).toBeInTheDocument()
    expect(await screen.findByText('1 kg')).toBeInTheDocument()
  })

  it('y el reparto entre las dos mesas al abrir la línea, con el nombre del bunga', async () => {
    render(<CompraScreen eventId={eventId} event={event} />)
    await screen.findByText('Arroz')
    await userEvent.click(await screen.findByRole('button', { name: /Ver el reparto de Arroz/ }))

    // El envase, lo que hace falta de verdad y dónde va cada parte.
    expect(await screen.findByText(/1 paquete de 1 kg/)).toBeInTheDocument()
    expect(screen.getByText(/hacen falta 0,52 kg/)).toBeInTheDocument()
    expect(screen.getByText(/PER 0,4 kg · SOL 0,12 kg/)).toBeInTheDocument()
  })

  it('lo apuntado a mano sigue sin cifra y tiene su propio verbo de borrar', async () => {
    render(<CompraScreen eventId={eventId} event={event} />)
    await userEvent.type(await screen.findByPlaceholderText(/Apunta algo/), 'Hielos')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    await screen.findByText('Hielos')
    // Nombrado por su línea: en la misma columna vive el chevron de las líneas
    // de cena, y antes eran el mismo control con dos comportamientos.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Borrar Hielos' }).length).toBe(1))
  })

  /**
   * A1 de `docs/diseño/borrar-confirmaciones.html`: aquí no hay cascada que
   * contar —una línea de la compra no arrastra nada—, así que lo único que hay
   * que evitar es el toque de más, y la segunda pulsación cuesta 0 pt de alto.
   */
  it('borrar a mano pide una segunda pulsación, y la primera no borra nada', async () => {
    render(<CompraScreen eventId={eventId} event={event} />)
    await userEvent.type(await screen.findByPlaceholderText(/Apunta algo/), 'Hielos')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    await screen.findByText('Hielos')

    await userEvent.click(screen.getByRole('button', { name: 'Borrar Hielos' }))
    // Sigue ahí: lo que ha cambiado es el propio control, que ahora pregunta.
    expect(screen.getByText('Hielos')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar que se borra Hielos' }))
    await waitFor(() => expect(screen.queryByText('Hielos')).toBeNull())
  })
})
