import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEventBase from '@testing-library/user-event'
import PlanesScreen from './PlanesScreen.jsx'
import { db, createEvent, getEvent, addPerson, addFamily, addPlan, plansOf, listPlanIdeas, addPlanIdea, traerIdeaAlViaje } from '../db.js'

/**
 * Planes, rehecha: **aquí solo se vota** (`docs/diseño/planes-votar.html`).
 *
 * Lo que fijan estos tests es lo que se puede romper sin que se note: que el
 * día no se toca desde aquí, que el orden significa algo, que la fila dice
 * quién falta y que devolver a ideas lo hacen los adultos (§14.43-bis).
 */
async function viaje() {
  hoyEs('2026-08-16')
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

/**
 * **«Hoy» se congela** (§14.80). Desde que lo que ya pasó baja a su grupo, esta
 * pantalla depende del calendario, y las fechas de la semilla son de agosto de
 * 2026: sin congelar, estas pruebas pasarían hasta esa semana y a partir de ahí
 * fallarían todas a la vez sin que nadie hubiera tocado nada. Se planta el reloj
 * **dentro del viaje**, que es donde se mira esta pantalla.
 *
 * **Se falsea `Date` y nada más** (`toFake`). Con los temporizadores falsos
 * enteros, Dexie sobre `fake-indexeddb` se queda a medias —«Transaction has
 * already completed or failed» en las veinte pruebas— porque una transacción de
 * IndexedDB vive entre tareas y aquí las tareas las mueve el reloj. `Date` es lo
 * único que hace falta: `hoyISO()` no usa temporizadores.
 */
function hoyEs(iso) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${iso}T12:00:00`))
}
afterEach(() => { vi.useRealTimers() })

const titulos = () => [...document.querySelectorAll('.fila-plan .n')].map((e) => e.textContent)

/**
 * «Esto se ve», volviendo a buscarlo en cada intento.
 *
 * `findByText` devuelve **el nodo que encontró**, y esta pantalla tiene ahora
 * **tres** consultas vivas —planes, personas y comentarios—: cuando la última
 * llega, React sustituye la fila y el nodo capturado ya no está en el
 * documento, así que `toBeInTheDocument()` falla sobre algo que sí se ve. Pasó
 * en CI y no aquí, que es lo que hace a esta clase de carrera cara: la máquina
 * lenta pierde la que la rápida gana. `waitFor` con `getByText` vuelve a
 * preguntar cada vez, así que no hay nodo viejo que sostener.
 */
const seVe = (texto) => waitFor(() => { expect(screen.getByText(texto)).toBeInTheDocument() })

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
  // **Se insiste hasta que abra.** Esperar al subtítulo estrecha la ventana
  // pero no la cierra: con tres consultas vivas —planes, personas y los
  // comentarios del evento (§14.55)— la fila puede sustituirse entre que se la
  // encuentra y se la pulsa, y entonces el clic va a un nodo que ya no está.
  // Le pasó al gemelo de esta función en `SoloAdultosOrganizan.test.jsx`: pasó
  // dos veces en local y tumbó el CI de `main`. Volver a pulsar no hace nada
  // nuevo —abrir el que ya está abierto es el mismo `setAbierto`—.
  await waitFor(async () => {
    await userEvent.click(screen.getByRole('button', { name: new RegExp(titulo) }))
    expect(screen.getByText('Quién ha votado')).toBeInTheDocument()
  })
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
    await seVe('falta por votar Luis')
  })

  it('con más de dos sin votar da el número, que es lo que cabe', async () => {
    const { eventId, event, curro } = await viaje()
    await addPerson(eventId, { name: 'Marta', edad: 'adulto' })
    await addPlan(eventId, { titulo: 'Cuevas', votos: { [curro]: '👍' } })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await seVe('faltan 3 por votar')
  })

  it('sin votos y con todos votados lo dice con otras palabras', async () => {
    const { eventId, event, curro, ana, luis } = await viaje()
    await addPlan(eventId, { titulo: 'Nadie' })
    await addPlan(eventId, { titulo: 'Todos', votos: { [curro]: '👍', [ana]: '👎', [luis]: '🤷' } })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await seVe('sin votos todavía')
    await seVe('han votado todos')
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

  // El cerrojo es la edad y no el rol: devolver una propuesta es organizar el
  // viaje, igual que proponerla (§14.43-bis).
  it('con identidad de niño no se puede devolver a ideas', async () => {
    const { eventId, event } = await viaje()
    const fran = await addPerson(eventId, { name: 'Fran', edad: 'niño' })
    localStorage.setItem(`ballena.me:${eventId}`, fran)
    await addPlan(eventId, { titulo: 'Cuevas' })

    render(<PlanesScreen eventId={eventId} event={event} />)
    await abrir('Cuevas')
    expect(screen.queryByRole('button', { name: 'Devolver a ideas' })).not.toBeInTheDocument()
  })

  it('un adulto que no administra lo devuelve, y la idea se queda en el catálogo', async () => {
    localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { rol: 'miembro' } }))
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
    await addPlan(eventId, { titulo: 'Paella del sábado', dia: '2026-08-18', estado: 'sehace' })
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

    await seVe('falta el día')
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
    await seVe('Tu voto')
    expect(screen.queryByRole('button', { name: 'Se hace y punto' })).not.toBeInTheDocument()
  })
})

/**
 * **Lo que ya pasó baja al final marcado** (SPECS §14.80).
 *
 * Un plan del martes seguía diciendo «faltan 4 por votar» el jueves, entre los
 * que todavía se deciden: es pedir un voto para algo que ya ocurrió.
 */
describe('ya se hicieron (§14.80)', () => {
  it('el de ayer baja a su grupo, marcado y diciendo cuándo fue', async () => {
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Kayaks en la cala', dia: '2026-08-15' })
    await addPlan(eventId, { titulo: 'Cena de despedida', dia: '2026-08-20' })
    hoyEs('2026-08-16')
    render(<PlanesScreen eventId={eventId} event={event} />)

    expect(await screen.findByText(/Ya se hicieron · 1/)).toBeInTheDocument()
    expect(screen.getByText(/Elegidos · 1/)).toBeInTheDocument()
    // Y va al final: lo que queda por delante manda la lista.
    expect(titulos()).toEqual(['Cena de despedida', 'Kayaks en la cala'])

    const fila = screen.getByRole('button', { name: /Kayaks en la cala/ })
    expect(within(fila).getByText('hecho')).toBeInTheDocument()
    // Lo que ya pasó dice **cuándo fue**, no a quién hay que darle un toque.
    expect(within(fila).queryByText(/falta/)).not.toBeInTheDocument()
  })

  it('el de hoy sigue arriba: la tarde es de esta tarde', async () => {
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Bici a Cadaqués', dia: '2026-08-16' })
    hoyEs('2026-08-16')
    render(<PlanesScreen eventId={eventId} event={event} />)

    expect(await screen.findByText(/Elegidos · 1/)).toBeInTheDocument()
    expect(screen.queryByText(/Ya se hicieron/)).not.toBeInTheDocument()
  })

  it('sin día no baja, aunque el viaje haya terminado', async () => {
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Kayaks en la cala' })
    hoyEs('2026-09-30')
    render(<PlanesScreen eventId={eventId} event={event} />)

    // Un plan que nadie puso en un día no se hizo: se quedó sin hacer.
    expect(await screen.findByText(/A votación · 1/)).toBeInTheDocument()
    expect(screen.queryByText(/Ya se hicieron/)).not.toBeInTheDocument()
  })

  it('lo que se hacía y ya pasó también baja, y deja de estar «pendiente»', async () => {
    const { eventId, event } = await viaje()
    await addPlan(eventId, { titulo: 'Paella del sábado', dia: '2026-08-15', estado: 'sehace' })
    hoyEs('2026-08-16')
    render(<PlanesScreen eventId={eventId} event={event} />)

    expect(await screen.findByText(/Ya se hicieron · 1/)).toBeInTheDocument()
    expect(screen.queryByText(/Se hacen/)).not.toBeInTheDocument()
    const fila = screen.getByRole('button', { name: /Paella del sábado/ })
    expect(within(fila).getByText('hecho')).toBeInTheDocument()
    expect(within(fila).queryByText('se hace')).not.toBeInTheDocument()
  })

  it('se sigue abriendo: dentro están sus comentarios y quién votó qué', async () => {
    const { eventId, event, curro } = await viaje()
    await addPlan(eventId, { titulo: 'Kayaks en la cala', dia: '2026-08-15', votos: { [curro]: '👍' } })
    hoyEs('2026-08-16')
    render(<PlanesScreen eventId={eventId} event={event} />)

    await abrir('Kayaks en la cala')
    // `abrir` ya comprueba que la capa está: dentro sigue estando quién votó.
    expect(screen.getByText('Quién ha votado')).toBeInTheDocument()
  })
})
