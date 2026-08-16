import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEventBase from '@testing-library/user-event'
import PlanesScreen from './PlanesScreen.jsx'
import { db, createEvent, getEvent, addPerson, addFamily, addPlan, plansOf, listPlanIdeas, addPlanIdea, traerIdeaAlViaje } from '../db.js'

/**
 * Planes, rehecha: **aquí solo se vota** (`docs/diseño/planes-votar.html`).
 *
 * Lo que fijan estos tests es lo que se puede romper sin que se note: que el
 * día no se toca desde aquí, que el orden significa algo, que la fila dice
 * quién falta y que devolver a ideas es solo de quien administra.
 */
async function viaje() {
  const eventId = await createEvent({ name: 'Viaje', startDate: '2026-08-15', endDate: '2026-08-22' })
  // Cada uno de su familia: el alias que sale al votar es el de la suya, y sin
  // familia no habría pastilla que comprobar.
  const garcia = await addFamily(eventId, { name: 'García', color: '#E5544B' })
  const perez = await addFamily(eventId, { name: 'Pérez', color: '#2E9E6B' })
  const solteros = await addFamily(eventId, { name: 'Solteros', color: '#1FA6D6' })
  const curro = await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto', avatar: '🏖️' })
  const ana = await addPerson(eventId, { name: 'Ana', familyId: perez, edad: 'adulto', avatar: '🍷' })
  const luis = await addPerson(eventId, { name: 'Luis', familyId: solteros, edad: 'adulto', avatar: '🎉' })
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
  for (const t of ['events', 'persons', 'families', 'plans', 'planIdeas', 'outbox']) await db[t].clear()
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
    expect(screen.getByText(/A votación · 3/)).toBeInTheDocument()
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

  it('enseña los nombres bajo su voto, con su avatar y el alias de su familia', async () => {
    const { eventId, event, curro, ana } = await viaje()
    await addPlan(eventId, { titulo: 'Cuevas', votos: { [curro]: '👍', [ana]: '👎' } })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await abrir('Cuevas')

    const filas = [...document.querySelectorAll('.votantes-fila')]
    // Tres filas y no cuatro: 👍 · 🤷 · 👎. La de «falta» se retiró — eso ya lo
    // dice la fila cerrada, que es donde sirve.
    expect(filas).toHaveLength(3)
    expect(within(filas[0]).getByText('Curro')).toBeInTheDocument()
    expect(within(filas[1]).getByText('nadie')).toBeInTheDocument()
    expect(within(filas[2]).getByText('Ana')).toBeInTheDocument()
    // Luis no ha votado, y aquí dentro no se le nombra.
    expect(screen.queryByText('Luis')).not.toBeInTheDocument()

    // Con el nombre, su avatar y las dos letras de su familia: el nombre
    // identifica, el dibujo se reconoce de un vistazo y el alias dice de qué
    // casa viene el voto, que es lo que no dicen los otros dos.
    const curroVota = filas[0].querySelector('.votante')
    expect(curroVota.textContent).toBe('🏖️CurroGA')
    expect(filas[2].querySelector('.votante').textContent).toBe('🍷AnaPE')
  })

  it('cada voto dice cuántos son, y el cero se ve apagado', async () => {
    const { eventId, event, curro, ana } = await viaje()
    await addPlan(eventId, { titulo: 'Cuevas', votos: { [curro]: '👍', [ana]: '👍' } })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await abrir('Cuevas')

    const cuentas = [...document.querySelectorAll('.votantes-cuenta')]
    expect(cuentas.map((c) => c.textContent)).toEqual(['2', '0', '0'])
    // El que nadie ha votado se apaga: el número que importa es el que no es cero.
    expect(cuentas[0]).not.toHaveClass('cero')
    expect(cuentas[1]).toHaveClass('cero')
    // Y se dice en palabras para quien no ve la columna.
    expect(cuentas[0]).toHaveAttribute('aria-label', '2 votos')
  })

  it('el plan abierto se ve como una capa: centrado, con papel propio', async () => {
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Cuevas' })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await abrir('Cuevas')

    // El papel era el mismo color que el fondo de la app —1,0 : 1— y solo lo
    // separaba el velo (docs/diseño/plan-voto.html · P1 · F1+F4 · V2). La clase
    // `capa` que lo arreglaba **aquí** se retiró en §14.26-bis: ahora lo hace
    // `.modal` para todos, y quien monta guardia sobre el papel es
    // `src/estilos.test.js`, que mira el CSS y no el marcado.
    const caja = document.querySelector('.modal')
    expect(caja).toHaveClass('center')
  })

  it('con varios en el mismo voto, los nombres van seguidos', async () => {
    const { eventId, event, curro, ana, luis } = await viaje()
    await addPlan(eventId, { titulo: 'Cuevas', votos: { [curro]: '👍', [ana]: '👍', [luis]: '👍' } })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await abrir('Cuevas')

    // Los tres en la misma línea. El orden es el que trae la base, que no es el
    // de creación: lo que importa es que estén los tres, cada uno entero.
    const votantes = [...document.querySelectorAll('.votantes-fila')[0].querySelectorAll('.votante')]
    expect(votantes.map((v) => v.textContent).sort()).toEqual(['🍷AnaPE', '🎉LuisSO', '🏖️CurroGA'].sort())
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

describe('se hace y punto (§14.59)', () => {
  it('lo decidido va en su grupo, sin votos ni «faltan N por votar»', async () => {
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Paella del sábado', dia: '2026-08-15', estado: 'sehace' })
    await addPlan(eventId, { titulo: 'Kayaks en la cala', votos: { x: '👍' } })
    render(<PlanesScreen eventId={eventId} event={event} />)

    expect(await screen.findByText(/Se hacen · 1/)).toBeInTheDocument()
    expect(screen.getByText(/A votación · 1/)).toBeInTheDocument()
    // No sale en «Elegidos» aunque tenga día: manda el estado.
    expect(screen.queryByText(/Elegidos/)).not.toBeInTheDocument()

    // Su fila lleva la pastilla en palabras y **ningún recuento**: enseñar los
    // 👍 de algo ya decidido era exactamente la queja.
    const fila = screen.getByRole('button', { name: /Paella del sábado/ })
    expect(within(fila).getByText('se hace')).toBeInTheDocument()
    expect(within(fila).queryByText(/falta/)).not.toBeInTheDocument()
  })

  it('sin día lo dice, que es lo único que le queda pendiente', async () => {
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Cena de despedida', estado: 'sehace' })
    render(<PlanesScreen eventId={eventId} event={event} />)

    // Con `waitFor` y **volviendo a buscar** cada vez: la fila se repinta cuando
    // llega la segunda consulta viva (la de personas), así que un nodo capturado
    // por `findBy` antes de eso ya está fuera del documento cuando se comprueba.
    // Es la misma carrera que documenta el ayudante `abrir` de este fichero.
    await waitFor(() => { expect(screen.getByText('falta el día')).toBeInTheDocument() })
  })

  it('quien organiza lo cambia desde dentro, y los votos siguen ahí', async () => {
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Kayaks en la cala', votos: { a: '👍', b: '👎' } })
    render(<PlanesScreen eventId={eventId} event={event} />)

    await abrir('Kayaks en la cala')
    await userEvent.click(await screen.findByRole('button', { name: 'Se hace y punto' }))

    await waitFor(async () => {
      const [plan] = await plansOf(eventId)
      expect(plan.estado).toBe('sehace')
      // Y los votos no se han tocado: volver a votación los devuelve enteros.
      expect(Object.keys(plan.votos)).toHaveLength(2)
    })
  })

  it('con la identidad de un niño el interruptor no está: decidir es organizar', async () => {
    const { eventId, event } = await viaje()
    const nino = await addPerson(eventId, { name: 'Fran', edad: 'niño' })
    localStorage.setItem(`ballena.me:${eventId}`, nino)
    await addPlan(eventId, { titulo: 'Kayaks en la cala' })
    render(<PlanesScreen eventId={eventId} event={event} />)

    await abrir('Kayaks en la cala')
    expect(await screen.findByText('Tu voto')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Se hace y punto' })).not.toBeInTheDocument()
  })
})
