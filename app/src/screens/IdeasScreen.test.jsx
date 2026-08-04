import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IdeasScreen from './IdeasScreen.jsx'
import PlanesConAreasScreen from './PlanesConAreasScreen.jsx'
import {
  db, createEvent, getEvent, addPlanIdea, updatePlanIdea, listPlanIdeas,
  plansOf, addPerson, addFamily,
} from '../db.js'

/**
 * El área «Ideas» y el mando que la hace alcanzable (B3), más lo que trae
 * `docs/diseño/planes-ideas.html`: los dos grupos (A1), la firma con el alias
 * de la familia (B3), la fecha de cada grupo (F2) y el renglón de apuntar
 * (C1 + C3).
 */
async function viaje() {
  const id = await createEvent({ name: 'Viaje 2026', startDate: '2026-08-15', endDate: '2026-08-22' })
  return { eventId: id, event: await getEvent(id) }
}

/** La cabecera de un grupo y las filas que cuelgan de ella. */
function grupo(nombre) {
  const cabecera = screen.getByText(new RegExp(`^${nombre} · `))
  return cabecera.closest('.sec-h').nextElementSibling
}

beforeEach(async () => {
  for (const t of ['events', 'plans', 'planIdeas', 'persons', 'families', 'outbox']) await db[t].clear()
  localStorage.clear()
})

describe('IdeasScreen', () => {
  it('sin ideas lo dice, y no pinta una lista vacía', async () => {
    const { eventId, event } = await viaje()
    render(<IdeasScreen eventId={eventId} event={event} />)
    expect(await screen.findByText(/Todavía no hay ideas guardadas/)).toBeInTheDocument()
  })

  it('parte la lista en dos: primero las propuestas, luego las posibles', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'Kayak en el río' })
    await addPlanIdea({ titulo: 'Playa de la Cala' })
    render(<IdeasScreen eventId={eventId} event={event} />)

    // De partida no hay propuestas: solo el segundo grupo.
    expect(await screen.findByText(/^Posibles · 2$/)).toBeInTheDocument()
    expect(screen.queryByText(/^Propuestas/)).not.toBeInTheDocument()

    const filas = await screen.findAllByRole('button', { name: 'Proponer' })
    await userEvent.click(filas[1]) // «Playa de la Cala», que va segunda por nombre

    // Ahora hay dos grupos, y cada idea está en el suyo.
    expect(await screen.findByText(/^Propuestas · 1$/)).toBeInTheDocument()
    expect(within(grupo('Propuestas')).getByText('Playa de la Cala')).toBeInTheDocument()
    expect(within(grupo('Posibles')).getByText('Kayak en el río')).toBeInTheDocument()
  })

  it('«Proponer» deja el plan en este viaje, y una propuesta ya no se propone', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'Playa de la Cala', descripcion: 'La del sur' })
    render(<IdeasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Proponer' }))

    // El plan existe y ha llegado limpio.
    const planes = await plansOf(eventId)
    expect(planes).toHaveLength(1)
    expect(planes[0]).toMatchObject({ titulo: 'Playa de la Cala', dia: null, estado: 'votando' })
    expect(planes[0].propuestoEl).toBeTruthy()

    // Y ya no hay verbo que pulsar: el grupo dice que está propuesta, así que el
    // botón apagado de antes —144,2 pt de ancho para no hacer nada— sobra.
    expect(await screen.findByText(/^Propuestas · 1$/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Proponer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ya propuesta' })).not.toBeInTheDocument()
  })

  it('la firma dice quién la apuntó y de qué familia, con su alias', async () => {
    const { eventId, event } = await viaje()
    const garcia = await addFamily(eventId, { name: 'García' })
    const curro = await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto' })
    await addPlanIdea({ titulo: 'Playa de la Cala', creadaPor: curro })
    render(<IdeasScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Curro', { exact: false })).toBeInTheDocument()
    // El alias no se ha escrito a mano en ningún sitio: sale del nombre (D3).
    expect(screen.getByText('GA')).toBeInTheDocument()
  })

  it('una idea sin autor lo dice, en vez de inventarse uno', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'Mirador de las cabras' })
    render(<IdeasScreen eventId={eventId} event={event} />)
    expect(await screen.findByText(/sin autor/)).toBeInTheDocument()
  })

  it('enseña la fecha del grupo: la de la propuesta arriba, la del catálogo abajo', async () => {
    const { eventId, event } = await viaje()
    const vieja = await addPlanIdea({ titulo: 'Playa de la Cala' })
    await addPlanIdea({ titulo: 'Kayak en el río' })
    await updatePlanIdea(vieja, { apuntadaEl: '2020-08-01T10:00:00.000Z' })
    render(<IdeasScreen eventId={eventId} event={event} />)

    // Antes de proponerla, la fila enseña cuándo se apuntó al catálogo.
    expect(await screen.findByText(/1 de agosto de 2020/)).toBeInTheDocument()

    const filas = await screen.findAllByRole('button', { name: 'Proponer' })
    await userEvent.click(filas[1]) // «Playa de la Cala»

    // Y ya propuesta, cuándo se propuso a **este** viaje, que es de ahora mismo:
    // en el catálogo lleva desde 2020 y esa fecha ahí no contesta nada.
    expect(await screen.findByText(/^Propuestas · 1$/)).toBeInTheDocument()
    const arriba = grupo('Propuestas')
    expect(within(arriba).getByText(/hace un rato/)).toBeInTheDocument()
    expect(within(arriba).queryByText(/2020/)).not.toBeInTheDocument()
  })

  it('el renglón apunta una idea sin abrir nada, y se queda listo para la siguiente', async () => {
    const { eventId, event } = await viaje()
    const yo = await addPerson(eventId, { name: 'Curro', edad: 'adulto' })
    localStorage.setItem(`ballena.me:${eventId}`, yo)
    render(<IdeasScreen eventId={eventId} event={event} />)

    const campo = await screen.findByLabelText('Apunta una idea')
    // El ✓ no hace nada mientras no hay título: un toque en vacío guardaría una
    // idea sin nombre.
    expect(screen.getByRole('button', { name: 'Guardar idea' })).toBeDisabled()

    await userEvent.type(campo, 'Torneo de petanca')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar idea' }))

    const ideas = await listPlanIdeas()
    expect(ideas.map((i) => i.titulo)).toEqual(['Torneo de petanca'])
    expect(ideas[0].creadaPor).toBe(yo)
    expect(ideas[0].apuntadaEl).toBeTruthy()
    // Del catálogo de todos: sin `eventId`, aunque se apunte desde un viaje.
    expect(ideas[0].eventId).toBe(null)

    // Y sigue ahí, vacío: apuntar tres seguidas son tres frases y tres toques.
    expect(campo).toHaveValue('')
    await userEvent.type(campo, 'Feria del pueblo')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar idea' }))
    expect((await listPlanIdeas()).map((i) => i.titulo)).toEqual(['Feria del pueblo', 'Torneo de petanca'])
  })

  it('«Más detalles» añade descripción y enlace sin mover el campo del título', async () => {
    const { eventId, event } = await viaje()
    render(<IdeasScreen eventId={eventId} event={event} />)

    expect(screen.queryByLabelText('Descripción')).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /Más detalles/ }))

    await userEvent.type(screen.getByLabelText('Apunta una idea'), 'Kayak en el río')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Alquiler en el puente viejo')
    await userEvent.type(screen.getByLabelText('Enlace'), 'https://example.com/kayak')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar idea' }))

    expect((await listPlanIdeas())[0]).toMatchObject({
      titulo: 'Kayak en el río',
      descripcion: 'Alquiler en el puente viejo',
      enlace: 'https://example.com/kayak',
    })
    // Guardada, el detalle se pliega: el renglón vuelve a su tamaño de reposo.
    expect(screen.queryByLabelText('Descripción')).not.toBeInTheDocument()
  })

  it('se toca la fila para editarla, y ahí dentro está el contador de viajes', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'Playa de la Cala' })
    render(<IdeasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Proponer' }))
    expect(await screen.findByText(/^Propuestas · 1$/)).toBeInTheDocument()
    // Se edita tocando la fila: el lápiz de la derecha se fue.
    await userEvent.click(await screen.findByText('Playa de la Cala'))

    expect(await screen.findByRole('heading', { name: 'Editar idea' })).toBeInTheDocument()
    expect(screen.getByText(/Propuesta en 1 viaje/)).toBeInTheDocument()

    // Abre centrado y **sin robar el foco**: se entra a leer, y sin teclado
    // que lo pelee, centrado se lee mejor. El teclado no sale hasta tocar un
    // campo.
    expect(document.querySelector('.modal-bg')?.className).toContain('center')
    expect(document.activeElement).not.toBe(screen.getByLabelText('Qué es'))
  })

  it('borrar avisa de que se lleva la idea de todos los viajes', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'Playa de la Cala' })
    render(<IdeasScreen eventId={eventId} event={event} />)

    await userEvent.click(await screen.findByText('Playa de la Cala'))
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar idea' }))
    expect(screen.getByText(/de todos los viajes/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sí, borrarla' }))
    expect(await listPlanIdeas()).toEqual([])
  })
})

describe('Planes, con sus dos áreas', () => {
  it('abre en Planes y el mando lleva a Ideas', async () => {
    const { eventId, event } = await viaje()
    await addPlanIdea({ titulo: 'Playa de la Cala' })
    render(<PlanesConAreasScreen eventId={eventId} event={event} />)

    const mando = screen.getByRole('tablist')
    expect(within(mando).getByRole('tab', { name: 'Planes' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText(/Ningún plan todavía/)).toBeInTheDocument()

    await userEvent.click(within(mando).getByRole('tab', { name: 'Ideas' }))
    expect(await screen.findByText('Playa de la Cala')).toBeInTheDocument()
  })
})
