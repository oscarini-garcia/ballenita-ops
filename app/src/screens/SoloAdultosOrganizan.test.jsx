import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CenasScreen from './CenasScreen.jsx'
import DiasScreen from './DiasScreen.jsx'
import IdeasScreen from './IdeasScreen.jsx'
import PlanesScreen from './PlanesScreen.jsx'
import {
  db, createEvent, getEvent, addFamily, addBunga, addPerson, addDish, addDinner, addPlan, addPlanIdea,
} from '../db.js'

/**
 * Organizar el viaje es de los adultos (SPECS §14.43): montar cenas, pasar una
 * idea a propuesta y colocar el día. Lo que hace todo el mundo —mirar, votar,
 * apuntar ideas— se queda como estaba, y sin identidad no se capa nada.
 */
async function sembrar() {
  const eventId = await createEvent({
    name: 'Ballenita 2026', startDate: '2026-08-08', endDate: '2026-08-10',
  })
  const familia = await addFamily(eventId, { name: 'García' })
  const bunga = await addBunga(eventId, { name: 'Bunga 2', alias: 'El del ruido', familyId: familia })
  const adulto = await addPerson(eventId, { name: 'Mariona', edad: 'adulto', familyId: familia })
  const nino = await addPerson(eventId, { name: 'Fran', edad: 'niño', familyId: familia })
  const teo = await addPerson(eventId, { name: 'Teo', edad: 'adolescente', familyId: familia })
  const paella = await addDish({ name: 'Paella mixta', categorias: ['principal'] })
  await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella], bungaMayoresId: bunga })
  await addPlanIdea({ titulo: 'Kayak por la cala' })
  await addPlan(eventId, { titulo: 'Cuevas del Drach' })
  return { eventId, event: await getEvent(eventId), adulto, nino, teo }
}

let ctx
const soy = (quien) => localStorage.setItem(`ballena.me:${ctx.eventId}`, quien)

beforeEach(async () => {
  localStorage.clear()
  ctx = await sembrar()
})

describe('las cenas las montan los adultos', () => {
  it('con identidad de niño no hay «+ Cena» ni borrar', async () => {
    soy(ctx.nino)
    const { container } = render(<CenasScreen eventId={ctx.eventId} event={ctx.event} />)
    await screen.findByText(/Paella mixta/)

    expect(container.querySelector('.fab')).toBeNull()
    expect(screen.queryByText('Borrar la cena')).toBeNull()
    expect(screen.getByText(/las montan los adultos/)).toBeInTheDocument()
  })

  it('con identidad adulta, los verbos están donde siempre', async () => {
    soy(ctx.adulto)
    const { container } = render(<CenasScreen eventId={ctx.eventId} event={ctx.event} />)
    await screen.findByText(/Paella mixta/)

    expect(container.querySelector('.fab')).not.toBeNull()
    expect(screen.getByText('Borrar la cena')).toBeInTheDocument()
  })
})

describe('pasar una idea a propuesta', () => {
  it('el adolescente ve el catálogo pero no propone', async () => {
    soy(ctx.teo)
    render(<IdeasScreen eventId={ctx.eventId} event={ctx.event} />)
    await screen.findByText('Kayak por la cala')

    expect(screen.queryByRole('button', { name: 'Proponer' })).toBeNull()
  })

  it('el adulto sí', async () => {
    soy(ctx.adulto)
    render(<IdeasScreen eventId={ctx.eventId} event={ctx.event} />)
    await screen.findByText('Kayak por la cala')

    expect(screen.getByRole('button', { name: 'Proponer' })).toBeInTheDocument()
  })
})

describe('colocar el día', () => {
  it('el día se abre para mirarlo, pero sus renglones no editan', async () => {
    soy(ctx.nino)
    render(<DiasScreen eventId={ctx.eventId} event={ctx.event} />)

    await userEvent.click((await screen.findAllByText(/Paella/))[0].closest('button'))

    // La capa está abierta: se ve lo que hay puesto.
    await waitFor(() => expect(screen.getByText(/lo colocan los adultos/)).toBeInTheDocument())
    expect(screen.getByText(/El del ruido/)).toBeInTheDocument()
    // Y ningún renglón de dentro abre su elegidor.
    expect(document.querySelectorAll('.modal .fila-boton')).toHaveLength(0)
    expect(document.querySelectorAll('.modal .fila-capa').length).toBeGreaterThan(0)
  })

  it('con identidad adulta los renglones siguen siendo botones', async () => {
    soy(ctx.adulto)
    render(<DiasScreen eventId={ctx.eventId} event={ctx.event} />)

    await userEvent.click((await screen.findAllByText(/Paella/))[0].closest('button'))

    await waitFor(() => expect(document.querySelectorAll('.modal .fila-boton').length).toBeGreaterThan(0))
    expect(screen.queryByText(/lo colocan los adultos/)).toBeNull()
  })
})

/**
 * Devolver una propuesta al catálogo (§14.43-bis).
 *
 * Iba por `esAdministrador`, que es el cerrojo del **grupo** y no el del viaje:
 * cualquier adulto podía traer una idea al viaje y nadie más que quien
 * administra podía deshacerlo. Es un movimiento con dos sentidos y ahora los dos
 * llevan la misma regla.
 */
describe('devolver un plan al catálogo', () => {
  // La pantalla tiene dos consultas vivas —planes y personas— y el subtítulo de
  // la fila depende de las dos: pulsar entre una y otra le da al nodo que React
  // acaba de sustituir. Se espera al subtítulo y se vuelve a buscar la fila.
  const abrirElPlan = async () => {
    await waitFor(() => expect(document.querySelectorAll('.fila-plan .sub').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: /Cuevas del Drach/ }))
    await screen.findByText('Quién ha votado')
  }

  it('el niño lo abre y vota, pero no lo devuelve', async () => {
    soy(ctx.nino)
    render(<PlanesScreen eventId={ctx.eventId} event={ctx.event} />)
    await abrirElPlan()

    expect(screen.getByLabelText('Votar 👍')).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Devolver a ideas' })).toBeNull()
  })

  it('el adulto sí, sin ser administrador', async () => {
    soy(ctx.adulto)
    localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { rol: 'miembro' } }))
    render(<PlanesScreen eventId={ctx.eventId} event={ctx.event} />)
    await abrirElPlan()

    expect(screen.getByRole('button', { name: 'Devolver a ideas' })).toBeInTheDocument()
  })
})
