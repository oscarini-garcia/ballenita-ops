import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HoyScreen from './HoyScreen.jsx'
import { db, createEvent, getEvent, addFamily, addPerson, ponerEstado } from '../db.js'

/**
 * El botón de «di en qué andas», en «Hoy» (SPECS §14.45).
 *
 * La pastilla de la cabecera ya invitaba, pero ahí es un renglón de 15 pt sobre
 * el cielo que se lee como parte del rótulo del evento. El sitio donde se ve lo
 * que dicen los demás es donde apetece decir lo tuyo — y en cuanto hay estado
 * la invitación desaparece: dos a la vez son ruido.
 */
let ctx

async function sembrar() {
  const eventId = await createEvent({
    name: 'Ballenita', startDate: '2026-08-08', endDate: '2026-08-15',
  })
  const familia = await addFamily(eventId, { name: 'García' })
  const mariona = await addPerson(eventId, { name: 'Mariona', edad: 'adulto', familyId: familia })
  const curro = await addPerson(eventId, { name: 'Curro', edad: 'adulto', familyId: familia })
  return { eventId, event: await getEvent(eventId), mariona, curro }
}

beforeEach(async () => {
  localStorage.clear()
  ctx = await sembrar()
})

const pintar = () => render(<HoyScreen eventId={ctx.eventId} event={ctx.event} />)
const soy = (quien) => localStorage.setItem(`ballena.me:${ctx.eventId}`, quien)

describe('decir en qué andas desde Hoy', () => {
  it('sin estado puesto, la tira abre con la invitación', async () => {
    soy(ctx.mariona)
    pintar()

    await waitFor(() => expect(screen.getByText('Quién anda en qué')).toBeInTheDocument())
    expect(screen.getByText('+ di en qué andas')).toBeInTheDocument()
  })

  // La hoja saca **cinco al azar** (`cincoAlAzar`), así que se toca el primero
  // que haya: pedir uno por su nombre sería un test que falla algunas veces.
  it('y abre la misma hoja, que guarda con su «cuándo»', async () => {
    soy(ctx.mariona)
    pintar()

    await userEvent.click(await screen.findByText('+ di en qué andas'))
    // La hoja sale **por un portal al `body`** (§14.55-ter), así que ya no está
    // dentro del `container` de esta pantalla: se busca en el documento.
    await waitFor(() => expect(document.querySelector('.eleccion-op')).not.toBeNull())
    await userEvent.click(document.querySelector('.eleccion-op'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => {
      const yo = await db.persons.get(ctx.mariona)
      expect(yo.estado?.trim()).toBeTruthy()
      expect(yo.estadoEl).toBeTruthy()
    })
    // Y con el estado puesto, la invitación se retira.
    await waitFor(() => expect(screen.queryByText('+ di en qué andas')).toBeNull())
  })

  it('con estado ya puesto no invita: sale el tuyo y punto', async () => {
    soy(ctx.mariona)
    await ponerEstado(ctx.mariona, '🔥 a la parrilla')
    pintar()

    await waitFor(() => expect(screen.getByText('a la parrilla')).toBeInTheDocument())
    expect(screen.queryByText('+ di en qué andas')).toBeNull()
  })

  it('sin identidad en este móvil no se invita a nadie', async () => {
    await ponerEstado(ctx.curro, '🔥 a la parrilla')
    pintar()

    await waitFor(() => expect(screen.getByText('a la parrilla')).toBeInTheDocument())
    expect(screen.queryByText('+ di en qué andas')).toBeNull()
  })
})
