import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEventBase from '@testing-library/user-event'
import PlanesScreen from './PlanesScreen.jsx'
import { db, createEvent, getEvent, addPerson, addPlan, plansOf, listPlanIdeas, addPlanIdea, traerIdeaAlViaje } from '../db.js'

/**
 * Planes, rehecha: **aquí solo se vota** (`docs/diseño/planes-votar.html`).
 *
 * Lo que fijan estos tests es lo que se puede romper sin que se note: que el
 * día no se toca desde aquí, que el orden significa algo, que la fila dice
 * quién falta y que devolver a ideas es solo de quien administra.
 */
async function viaje() {
  const eventId = await createEvent({ name: 'Viaje', startDate: '2026-08-15', endDate: '2026-08-22' })
  const curro = await addPerson(eventId, { name: 'Curro', edad: 'adulto', avatar: '🏖️' })
  const ana = await addPerson(eventId, { name: 'Ana', edad: 'adulto', avatar: '🍷' })
  const luis = await addPerson(eventId, { name: 'Luis', edad: 'adulto', avatar: '🎉' })
  localStorage.setItem(`ballena.me:${eventId}`, curro)
  return { eventId, event: await getEvent(eventId), curro, ana, luis }
}

const titulos = () => [...document.querySelectorAll('.fila-plan .n')].map((e) => e.textContent)

/**
 * Abrir un plan, esperando a que la lista deje de moverse.
 *
 * La pantalla tiene dos consultas vivas —planes y personas— y el subtítulo de la
 * fila depende de las dos: si se pulsa entre una y otra, React ya ha sustituido
 * el nodo y el clic va a un elemento que ya no está en la página. Por eso se
 * espera a que el subtítulo esté puesto y **se vuelve a buscar la fila** al
 * pulsarla.
 */
async function abrir(titulo) {
  await screen.findByRole('button', { name: /1|0|falta|votado|ago/ })
  await waitFor(() => expect(document.querySelectorAll('.fila-plan .sub').length).toBeGreaterThan(0))
  await userEvent.click(screen.getByRole('button', { name: new RegExp(titulo) }))
  await screen.findByText('Quién ha votado')
}

let userEvent
beforeEach(async () => {
  userEvent = userEventBase.setup()
  for (const t of ['events', 'persons', 'plans', 'planIdeas', 'outbox']) await db[t].clear()
  localStorage.clear()
})

describe('la lista', () => {
  it('los elegidos van primero y los disponibles por votos', async () => {
    const { eventId, event, curro, ana } = await viaje()
    await addPlan(eventId, { titulo: 'Sin votos' })
    await addPlan(eventId, { titulo: 'Con dos', votos: { [curro]: '👍', [ana]: '👍' } })
    await addPlan(eventId, { titulo: 'Con uno', votos: { [curro]: '👍' } })
    await addPlan(eventId, { titulo: 'Ya elegido', dia: '2026-08-17' })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await screen.findByText('Ya elegido')

    expect(titulos()).toEqual(['Ya elegido', 'Con dos', 'Con uno', 'Sin votos'])
    expect(screen.getByText(/Elegidos · 1/)).toBeInTheDocument()
    expect(screen.getByText(/Disponibles · 3/)).toBeInTheDocument()
  })

  it('la fila dice quién falta por votar, que es lo accionable', async () => {
    const { eventId, event, curro, ana } = await viaje()
    await addPlan(eventId, { titulo: 'Cuevas', votos: { [curro]: '👍', [ana]: '🤷' } })

    render(<PlanesScreen eventId={eventId} event={event} />)
    expect(await screen.findByText('falta por votar Luis')).toBeInTheDocument()
  })

  it('con más de dos sin votar da el número, que es lo que cabe', async () => {
    const { eventId, event, curro } = await viaje()
    await addPerson(eventId, { name: 'Marta', edad: 'adulto' })
    await addPlan(eventId, { titulo: 'Cuevas', votos: { [curro]: '👍' } })

    render(<PlanesScreen eventId={eventId} event={event} />)
    expect(await screen.findByText('faltan 3 por votar')).toBeInTheDocument()
  })

  it('sin votos y con todos votados lo dice con otras palabras', async () => {
    const { eventId, event, curro, ana, luis } = await viaje()
    await addPlan(eventId, { titulo: 'Nadie' })
    await addPlan(eventId, { titulo: 'Todos', votos: { [curro]: '👍', [ana]: '👎', [luis]: '🤷' } })

    render(<PlanesScreen eventId={eventId} event={event} />)
    expect(await screen.findByText('sin votos todavía')).toBeInTheDocument()
    expect(screen.getByText('han votado todos')).toBeInTheDocument()
  })

  it('el día ya no se toca desde aquí: no hay ningún selector de fecha', async () => {
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Cuevas', dia: '2026-08-17' })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await screen.findByText('Cuevas')

    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(0)
    for (const verbo of ['quitar día', 'confirmar', 'a votación', 'borrar']) {
      expect(screen.queryByRole('button', { name: verbo })).not.toBeInTheDocument()
    }
  })
})

describe('el plan abierto', () => {
  it('se vota, y el voto se guarda', async () => {
    const { eventId, event, curro } = await viaje()
    await addPlan(eventId, { titulo: 'Cuevas' })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await abrir('Cuevas')
    await userEvent.click(screen.getByRole('button', { name: 'Votar 👍' }))

    expect((await plansOf(eventId))[0].votos).toEqual({ [curro]: '👍' })
  })

  it('enseña los avatares bajo su voto, y aparte los que faltan', async () => {
    const { eventId, event, curro, ana } = await viaje()
    await addPlan(eventId, { titulo: 'Cuevas', votos: { [curro]: '👍', [ana]: '👎' } })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await abrir('Cuevas')

    const filas = [...document.querySelectorAll('.votantes-fila')]
    // 👍 · 🤷 · 👎 · falta
    expect(filas).toHaveLength(4)
    expect(within(filas[0]).getByTitle('Curro')).toHaveTextContent('🏖️')
    expect(within(filas[1]).getByText('nadie')).toBeInTheDocument()
    expect(within(filas[2]).getByTitle('Ana')).toHaveTextContent('🍷')
    // Los que faltan van apagados: es a los que hay que dar un toque.
    expect(filas[3].querySelector('.votantes-caras')).toHaveClass('apagadas')
    expect(within(filas[3]).getByTitle('Luis')).toBeInTheDocument()
  })

  it('sin ser administrador no se puede devolver a ideas', async () => {
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Cuevas' })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await abrir('Cuevas')
    expect(screen.queryByRole('button', { name: 'Devolver a ideas' })).not.toBeInTheDocument()
  })

  it('quien administra lo devuelve, y la idea se queda en el catálogo', async () => {
    localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { rol: 'administrador' } }))
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'Cuevas' })
    await traerIdeaAlViaje(eventId, (await listPlanIdeas())[0])

    render(<PlanesScreen eventId={eventId} event={event} />)
    await abrir('Cuevas')
    await userEvent.click(screen.getByRole('button', { name: 'Devolver a ideas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sí, devolverlo' }))
    // El modal se cierra cuando la escritura ha terminado: es la señal de que ya
    // se puede mirar la base sin correr contra ella.
    await waitFor(() => expect(screen.queryByText('Quién ha votado')).not.toBeInTheDocument())

    expect(await plansOf(eventId)).toHaveLength(0)
    expect((await listPlanIdeas()).map((i) => i.titulo)).toEqual(['Cuevas'])
  })

  it('un plan escrito a mano se guarda como idea antes de irse', async () => {
    localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { rol: 'administrador' } }))
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Petanca', descripcion: 'En la pista' })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await abrir('Petanca')
    await userEvent.click(screen.getByRole('button', { name: 'Devolver a ideas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sí, devolverlo' }))

    await waitFor(() => expect(screen.queryByText('Quién ha votado')).not.toBeInTheDocument())

    // No se pierde: nunca había estado en el catálogo y ahora sí.
    expect(await plansOf(eventId)).toHaveLength(0)
    expect((await listPlanIdeas()).map((i) => i.titulo)).toEqual(['Petanca'])
  })
})

describe('un plan no se crea aquí: sale de proponer una idea', () => {
  it('no hay botón de añadir, y el vacío dice por dónde se entra', async () => {
    const { eventId, event } = await viaje()
    render(<PlanesScreen eventId={eventId} event={event} />)

    expect(await screen.findByText(/Ningún plan todavía/)).toBeInTheDocument()
    expect(screen.getByText(/apunta la idea ahí y dale a/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir plan' })).not.toBeInTheDocument()
  })

  it('con planes en la lista, lo sigue diciendo al final', async () => {
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Cuevas' })
    render(<PlanesScreen eventId={eventId} event={event} />)

    // Es donde aparece la pregunta: se recorre la lista, no está lo que buscabas.
    expect(await screen.findByText(/Un plan sale de/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir plan' })).not.toBeInTheDocument()
  })
})
