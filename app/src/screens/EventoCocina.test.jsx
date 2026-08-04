import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditorEvento } from './EventSettingsScreen.jsx'
import { COCINA_DE_ORIGEN } from '../lib/cocina.js'
import { db, createEvent, getEvent } from '../db.js'

/**
 * Con qué se cocina en este viaje (SPECS §14.20-quater).
 *
 * Es un dato del evento y **solo lo lee la IA**: sin él, proponer platos «de
 * camping» falla en las dos direcciones —cosas de horno, que no hay, y ninguna
 * de barbacoa, que es donde se hace casi todo—. No toca la compra, ni las
 * cenas, ni los saldos.
 */
describe('qué se puede cocinar', () => {
  beforeEach(async () => {
    for (const t of ['events', 'dinners', 'plans', 'expenses', 'outbox']) await db[t].clear()
  })

  async function abrir(campos = {}) {
    const id = await createEvent({ name: 'Ballenita 2026', startDate: '2026-08-15', endDate: '2026-08-22', ...campos })
    render(<EditorEvento event={await getEvent(id)} onCerrar={() => {}} />)
    return id
  }

  it('vacío enseña en gris lo que va a ir, que es como se ve que hace algo', async () => {
    await abrir()
    const campo = screen.getByLabelText('Qué se puede cocinar')
    expect(campo).toHaveValue('')
    // Sin enseñarlo, «vacío vale el de siempre» es una regla invisible y el
    // campo parece que no sirve para nada.
    expect(campo).toHaveAttribute('placeholder', COCINA_DE_ORIGEN)
    expect(screen.getByText(/Solo lo lee la IA/)).toBeInTheDocument()
  })

  it('se guarda en el evento, que es de donde lo lee el Worker', async () => {
    const id = await abrir()
    await userEvent.type(screen.getByLabelText('Qué se puede cocinar'), 'Solo un hornillo de gas')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect((await getEvent(id)).cocina).toBe('Solo un hornillo de gas')
  })

  it('lo escrito vuelve al abrir, y guardar el resto no se lo lleva por delante', async () => {
    const id = await abrir({ cocina: 'Barbacoa y poco más' })
    expect(screen.getByLabelText('Qué se puede cocinar')).toHaveValue('Barbacoa y poco más')

    // Cambiar el nombre no puede borrar lo que no se ha tocado: `updateEvent`
    // manda los campos del formulario, así que este tiene que ir en el patch.
    const nombre = screen.getByLabelText('Nombre')
    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Ballenita 2027')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    const ev = await getEvent(id)
    expect(ev.name).toBe('Ballenita 2027')
    expect(ev.cocina).toBe('Barbacoa y poco más')
  })
})
