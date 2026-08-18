import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CacharrosSection from './CacharrosSection.jsx'
import {
  db, createEvent, getEvent, addFamily, addPerson, cacharrosOf,
} from '../db.js'
import { olvidarAreas } from '../lib/areas.js'

async function sembrar() {
  const eventId = await createEvent({
    name: 'Ballenita 2026', startDate: '2026-08-08', endDate: '2026-08-15',
  })
  const perez = await addFamily(eventId, { name: 'Pérez' })
  const solteros = await addFamily(eventId, { name: 'Solteros' })
  await addPerson(eventId, { name: 'Curro', edad: 'adulto', familyId: perez })
  await addPerson(eventId, { name: 'Ana', edad: 'adulto', familyId: solteros })
  return { eventId, event: await getEvent(eventId), perez, solteros }
}

beforeEach(async () => {
  olvidarAreas()
  await db.delete()
  await db.open()
})

/**
 * **Una familia trae los que quiera** (SPECS §14.77).
 *
 * El tope de uno por familia (§14.57 · G1) se llevaba por delante el caso
 * normal: llegar al camping con la nevera **y** el proyector. La fila de apuntar
 * desaparecía en cuanto se traía el primero, así que el segundo no tenía por
 * dónde entrar.
 */
describe('los cacharros de una familia', () => {
  it('la fila de apuntar sigue ahí después del primero, y dice cuántos lleva', async () => {
    const { eventId, event, perez } = await sembrar()
    render(<CacharrosSection eventId={eventId} event={event} />)

    const apuntar = async (texto) => {
      const fila = (await screen.findAllByRole('button', { name: /^\+ (Cacharro|Otro)$/ }))[0]
      await userEvent.click(fila)
      await userEvent.type(screen.getByLabelText('Cacharro de Pérez'), texto)
      await userEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    }

    expect(await screen.findAllByText('sin cacharro este año')).toHaveLength(2)
    await apuntar('Nevera de 12 V')
    await waitFor(async () => expect(await cacharrosOf(eventId)).toHaveLength(1))
    // El verbo cambia y el renglón cuenta: la fila no se va.
    expect(await screen.findByText('trae uno')).toBeInTheDocument()

    await apuntar('Proyector')
    await waitFor(async () => {
      const suyos = (await cacharrosOf(eventId)).filter((c) => c.familyId === perez)
      expect(suyos.map((c) => c.texto).sort()).toEqual(['Nevera de 12 V', 'Proyector'])
    })
    expect(await screen.findByText('trae dos')).toBeInTheDocument()
  })

  it('la otra familia sigue sin ninguno, y su fila lo dice', async () => {
    const { eventId, event } = await sembrar()
    render(<CacharrosSection eventId={eventId} event={event} />)

    await userEvent.click((await screen.findAllByRole('button', { name: '+ Cacharro' }))[0])
    await userEvent.type(screen.getByLabelText('Cacharro de Pérez'), 'Nevera de 12 V')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    await screen.findByText('trae uno')
    // Las dos filas siguen: una con lo que trae y otra invitando.
    expect(screen.getByText('sin cacharro este año')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Otro' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Cacharro' })).toBeInTheDocument()
  })
})
