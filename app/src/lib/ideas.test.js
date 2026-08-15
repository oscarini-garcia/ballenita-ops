import { describe, it, expect, beforeEach } from 'vitest'
import {
  db, createEvent, getEvent, addPlan, plansOf, updatePlan,
  addPlanIdea, listPlanIdeas, updatePlanIdea, removePlanIdea,
  traerIdeaAlViaje, guardarPlanComoIdea, usoDeIdeas,
} from '../db.js'

/**
 * El catálogo de ideas de plan (`docs/diseño/planes-catalogo.html` · A3 · B3 · C1).
 *
 * Lo que estos tests fijan no es que exista una tabla, es la parte que se puede
 * romper sin que nadie se entere: que **el día, el estado y los votos no viajan**
 * y que traer una idea **copia** en vez de enlazar.
 */
beforeEach(async () => {
  for (const t of ['events', 'plans', 'planIdeas', 'outbox']) await db[t].clear()
})

describe('el catálogo de ideas', () => {
  it('es el mismo en todos los viajes', async () => {
    await addPlanIdea({ titulo: 'Playa de la Cala', ubicacion: 'Cala del sur' })
    const uno = await createEvent({ name: 'Viaje 2026' })
    const otro = await createEvent({ name: 'Viaje 2027' })

    for (const ev of [uno, otro]) {
      const ideas = await listPlanIdeas(await getEvent(ev))
      expect(ideas.map((i) => i.titulo)).toEqual(['Playa de la Cala'])
    }
  })

  it('sale ordenado por título, con la ñ y los acentos en su sitio', async () => {
    for (const t of ['Zoo', 'Ñora', 'Álora', 'baño']) await addPlanIdea({ titulo: t })
    expect((await listPlanIdeas()).map((i) => i.titulo)).toEqual(['Álora', 'baño', 'Ñora', 'Zoo'])
  })

  // El mismo trato que los platos (§14.9-quater): trastear en la demostración no
  // puede volver a ensuciar el catálogo de verdad.
  it('lo que se apunta en el Demo se queda en el Demo', async () => {
    const demoId = await createEvent({ name: 'Demo', esDemo: true })
    const demo = await getEvent(demoId)

    await addPlanIdea({ titulo: 'Idea del Demo' }, demo)
    await addPlanIdea({ titulo: 'Idea de verdad' })

    expect((await listPlanIdeas(demo)).map((i) => i.titulo)).toEqual(['Idea del Demo'])
    expect((await listPlanIdeas()).map((i) => i.titulo)).toEqual(['Idea de verdad'])
  })
})

describe('traer una idea al viaje', () => {
  it('llega sin día, sin votos y a votación: los tres son de aquel agosto', async () => {
    const eventId = await createEvent({ name: 'Viaje 2026', startDate: '2026-08-15', endDate: '2026-08-22' })
    const ideaId = await addPlanIdea({
      titulo: 'Excursión a las cuevas', descripcion: 'En Nerja, entrada a la vez', enlace: 'https://cuevas',
    })
    const idea = (await listPlanIdeas())[0]
    expect(idea.id).toBe(ideaId)

    await traerIdeaAlViaje(eventId, idea)
    const [plan] = await plansOf(eventId)

    expect(plan.titulo).toBe('Excursión a las cuevas')
    expect(plan.descripcion).toBe('En Nerja, entrada a la vez')
    expect(plan.enlace).toBe('https://cuevas')
    // Lo que no puede viajar, y no es una elección de diseño sino una
    // consecuencia: los votos apuntan a personas de otro evento, «confirmado»
    // fue una decisión de aquel agosto y el día de entonces no es de este viaje.
    expect(plan.dia).toBe(null)
    expect(plan.votos).toEqual({})
    expect(plan.estado).toBe('votando')
  })

  it('se copia, no se enlaza: corregir la idea no reescribe el viaje ya planeado', async () => {
    const eventId = await createEvent({ name: 'Viaje 2026' })
    await addPlanIdea({ titulo: 'Playa de la Cala', descripcion: 'La del sur' })
    await traerIdeaAlViaje(eventId, (await listPlanIdeas())[0])

    await updatePlanIdea((await listPlanIdeas())[0].id, { titulo: 'Cala del sur', descripcion: 'La otra' })

    const [plan] = await plansOf(eventId)
    expect(plan.titulo).toBe('Playa de la Cala')
    expect(plan.descripcion).toBe('La del sur')
  })

  it('borrar la idea no se lleva los planes que salieron de ella', async () => {
    const eventId = await createEvent({ name: 'Viaje 2026' })
    await addPlanIdea({ titulo: 'Playa de la Cala' })
    const idea = (await listPlanIdeas())[0]
    await traerIdeaAlViaje(eventId, idea)

    await removePlanIdea(idea.id)

    expect(await listPlanIdeas()).toEqual([])
    expect((await plansOf(eventId)).map((p) => p.titulo)).toEqual(['Playa de la Cala'])
  })
})

describe('guardar un plan como idea', () => {
  it('sube al catálogo lo que se repite, y solo eso', async () => {
    const eventId = await createEvent({ name: 'Viaje 2026' })
    await addPlan(eventId, {
      titulo: 'Torneo de petanca', descripcion: 'Por parejas, en la pista',
      dia: '2026-08-18', estado: 'confirmado', votos: { p1: '👍' },
    })
    const [plan] = await plansOf(eventId)

    await guardarPlanComoIdea(plan)
    const [idea] = await listPlanIdeas()

    expect(idea.titulo).toBe('Torneo de petanca')
    expect(idea.descripcion).toBe('Por parejas, en la pista')
    // La idea no tiene día, ni estado, ni votos: no son campos suyos.
    expect(idea.dia).toBeUndefined()
    expect(idea.estado).toBeUndefined()
    expect(idea.votos).toBeUndefined()
    // Y el plan queda apuntado a ella, para poder contar viajes.
    expect((await plansOf(eventId))[0].ideaId).toBe(idea.id)
  })
})

describe('en cuántos viajes se ha usado', () => {
  it('cuenta viajes, no planes: dos veces en el mismo viaje es un viaje', async () => {
    const uno = await createEvent({ name: 'Viaje 2026' })
    const otro = await createEvent({ name: 'Viaje 2027' })
    await addPlanIdea({ titulo: 'Playa de la Cala' })
    const idea = (await listPlanIdeas())[0]

    await traerIdeaAlViaje(uno, idea)
    await traerIdeaAlViaje(uno, idea)
    await traerIdeaAlViaje(otro, idea)

    expect((await usoDeIdeas())[idea.id]).toBe(2)
  })

  it('un plan escrito a mano no cuenta para ninguna idea', async () => {
    const eventId = await createEvent({ name: 'Viaje 2026' })
    await addPlan(eventId, { titulo: 'Algo nuevo' })
    expect(await usoDeIdeas()).toEqual({})
  })
})

describe('la cola de cambios', () => {
  it('una idea sube como cualquier otro hecho del grupo', async () => {
    await db.outbox.clear()
    await addPlanIdea({ titulo: 'Playa de la Cala' })
    // Y detrás, su renglón del recap (§14.50): sube por la misma cola.
    const cola = await db.outbox.toArray()
    expect(cola.map((c) => c.tabla)).toEqual(['planIdeas', 'registro'])
    expect(cola[0].op).toBe('upsert')
  })
})

describe('un plan traído sigue siendo un plan normal', () => {
  it('se le puede poner día y votar como a cualquiera', async () => {
    const eventId = await createEvent({ name: 'Viaje 2026' })
    await addPlanIdea({ titulo: 'Playa de la Cala' })
    await traerIdeaAlViaje(eventId, (await listPlanIdeas())[0])

    const [plan] = await plansOf(eventId)
    await updatePlan(plan.id, { dia: '2026-08-17', votos: { p1: '👍' } })

    const [despues] = await plansOf(eventId)
    expect(despues.dia).toBe('2026-08-17')
    expect(despues.votos).toEqual({ p1: '👍' })
  })
})
