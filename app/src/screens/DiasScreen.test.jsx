import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DiasScreen from './DiasScreen.jsx'
import { ESTADO_SE_HACE } from '../lib/planes.js'
import {
  db, createEvent, getEvent, addFamily, addBunga, addPerson, addDish, addDinner, addPlan,
  updatePlan, dinnersOf, plansOf,
} from '../db.js'

// Ballenita 2026: 8–15 de agosto, con la cena del día 9 y dos planes. Las
// bungas llevan familia dueña porque la fila del elegidor la nombra (B1).
async function sembrar() {
  const eventId = await createEvent({
    name: 'Ballenita 2026', lugar: 'Camping La Ballena Alegre',
    startDate: '2026-08-08', endDate: '2026-08-15',
  })
  const perez = await addFamily(eventId, { name: 'Pérez' })
  const solteros = await addFamily(eventId, { name: 'Solteros' })
  const ruido = await addBunga(eventId, { name: 'Bunga 2', alias: 'El del ruido', familyId: perez })
  const fondo = await addBunga(eventId, { name: 'Bunga 3', alias: 'El del fondo', familyId: solteros })
  const curro = await addPerson(eventId, { name: 'Curro', edad: 'adulto' })
  await addPerson(eventId, { name: 'Ana', edad: 'adulto' })
  const paella = await addDish({ name: 'Paella mixta', categorias: ['principal'] })
  const sandia = await addDish({ name: 'Sandía', categorias: ['postre'] })
  await addDinner(eventId, {
    dia: '2026-08-09', platoIds: [paella, sandia], bungaMayoresId: ruido, bungaNinosId: fondo,
  })
  await addPlan(eventId, { titulo: 'Playa de la Cala', dia: '2026-08-10', estado: ESTADO_SE_HACE })
  await addPlan(eventId, { titulo: 'Noche de juegos de mesa', votos: { [curro]: '👍' } })
  return { eventId, event: await getEvent(eventId), ruido }
}

const abrirDia = async (nombre) =>
  userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${nombre}`, 'i') }))

/**
 * El renglón de la cena dentro de la capa del día.
 *
 * Se busca **en el modal** y no por su texto: desde §14.69 dice «Paella mixta»
 * igual que la fila de la lista que queda detrás, que es justo lo que se quería
 * —dos pantallas hermanas no contestan distinto a la misma pregunta—, pero deja
 * la búsqueda por texto ambigua.
 */
const tarjetaDePlanes = () => [...document.querySelectorAll('.modal .card')].at(-1)
const titulosDePlanes = () => [...tarjetaDePlanes().querySelectorAll('.n')].map((e) => e.textContent)
const abrirLosPlanes = async () => {
  await waitFor(() => expect(tarjetaDePlanes()?.querySelector('.fila-boton')).not.toBeNull())
  await userEvent.click(tarjetaDePlanes().querySelector('.fila-boton'))
}

const abrirLosPlatos = async () => {
  await waitFor(() => expect(document.querySelector('.modal .fila-boton')).not.toBeNull())
  await userEvent.click(document.querySelector('.modal .fila-boton'))
}


describe('DiasScreen', () => {
  beforeEach(async () => {
    for (const t of ['events', 'families', 'bungas', 'persons', 'dishes', 'dinners', 'plans', 'outbox']) await db[t].clear()
  })

  it('pinta un día por cada uno del evento, también los vacíos', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)

    // Esperar a que hayan resuelto **las dos** consultas: hasta que llegan las
    // cenas y los planes, los ocho días se pintan vacíos y contar antes no dice
    // nada. Resuelven por separado, así que hay que esperar a las dos.
    await screen.findByText('Paella mixta')
    await screen.findByText('Playa de la Cala')

    // Ocho días: el 9 con cena, el 10 con plan y los otros seis sin nada.
    expect(screen.getAllByRole('button', { name: /de agosto:/ })).toHaveLength(8)
    expect(screen.getAllByText('nada apuntado')).toHaveLength(6)
  })

  it('resume cada día por lo que se hace en él', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)

    // El renglón **nombra en vez de contar** (§14.69): del día 9 lo que hace
    // falta saber es que no hay nada que hacer, no que haya dos platos.
    expect(await screen.findByText('Paella mixta')).toBeInTheDocument()
    expect(screen.getByText('sin planes')).toBeInTheDocument()
    // Y el plan que titula no se repite debajo: solo se dice lo que falta.
    expect(screen.getByText('Playa de la Cala')).toBeInTheDocument()
    expect(screen.getByText('sin cena')).toBeInTheDocument()
    // El primero y el último día vacíos se llaman por lo que son.
    expect(screen.getByText('Llegada')).toBeInTheDocument()
    expect(screen.getByText('Vuelta a casa')).toBeInTheDocument()
  })

  /**
   * A1: el lápiz se fue y la fila entera abre. Con él se fue también el `span`
   * escondido: la fecha larga la dice ahora el rótulo del botón, que es lo único
   * que oye quien no ve.
   */
  it('la fila entera abre el día, sin lápiz que buscar', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    expect(screen.queryByRole('button', { name: /^Editar / })).toBeNull()
    await abrirDia('domingo, 9 de agosto')
    expect(await screen.findByRole('heading', { name: /domingo, 9 de agosto/i })).toBeInTheDocument()
  })

  it('la fecha entera se anuncia a quien no ve, aunque en pantalla sea un número', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    expect(await screen.findByRole('button', { name: /^domingo, 9 de agosto: Paella mixta, sin planes/i }))
      .toBeInTheDocument()
  })

  /** El día son tres secciones (S2) y no lleva ningún verbo de guardar. */
  it('el día abierto son tres secciones, sin verbo de guardar ni «quitar» en la fila', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await screen.findByRole('heading', { name: /domingo, 9 de agosto/i })
    expect(screen.getByText('La cena')).toBeInTheDocument()
    // «Los bungas», en masculino: es como habla el grupo («El del ruido»).
    expect(screen.getByText('Los bungas')).toBeInTheDocument()
    expect(screen.getByText('El plan')).toBeInTheDocument()
    expect(screen.getByText('el de los Pérez')).toBeInTheDocument()
    expect(screen.queryByText(/Guardar la cena/)).toBeNull()
    expect(screen.queryByText(/Montar la cena/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'quitar' })).toBeNull()
  })

  /** E1 + K4 + G1 (dia-estado.html): el icono de cada renglón es el semáforo. */
  it('el semáforo del día: verde lo elegido, ámbar lo pendiente', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    // El día 9 tiene cena y bungas puestos, y ningún plan: tres verdes y un ámbar.
    await abrirDia('domingo, 9 de agosto')
    await screen.findByRole('heading', { name: /domingo, 9 de agosto/i })
    expect(document.querySelectorAll('.modal .ico.verde')).toHaveLength(3)
    expect(document.querySelectorAll('.modal .ico.ambar')).toHaveLength(1)
  })

  it('un día vacío no grita: cuatro renglones en ámbar y ninguno en rojo', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('martes, 11 de agosto')
    await screen.findByRole('heading', { name: /martes, 11 de agosto/i })
    expect(document.querySelectorAll('.modal .ico.ambar')).toHaveLength(4)
    expect(document.querySelectorAll('.modal .ico.verde')).toHaveLength(0)
  })

  /** C2: el elegidor trabaja sobre un borrador — nada escribe hasta «Listo». */
  it('marcar un plato no escribe nada hasta «Listo»', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('martes, 11 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /Sin cena montada/ }))
    await userEvent.click(await screen.findByRole('button', { name: /^Paella mixta/ }))

    // Marcado en el borrador, sin cena en la base todavía.
    expect((await dinnersOf(eventId)).find((c) => c.dia === '2026-08-11')).toBeUndefined()

    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    await waitFor(async () => {
      const nueva = (await dinnersOf(eventId)).find((c) => c.dia === '2026-08-11')
      expect(nueva).toBeTruthy()
      expect(nueva.platoIds).toHaveLength(1)
    })
  })

  it('dos platos marcados son un solo «Listo» y una sola cena', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('martes, 11 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /Sin cena montada/ }))
    await userEvent.click(await screen.findByRole('button', { name: /^Paella mixta/ }))
    await userEvent.click(await screen.findByRole('button', { name: /^Sandía/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))

    await waitFor(async () => {
      const delDia = (await dinnersOf(eventId)).filter((c) => c.dia === '2026-08-11')
      expect(delDia).toHaveLength(1)
      expect(delDia[0].platoIds).toHaveLength(2)
    })
  })

  it('«Cancelar» descarta lo marcado y la cena se queda como estaba', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await abrirLosPlatos()
    // Desmarcar la paella en el borrador…
    await userEvent.click(await screen.findByRole('button', { name: /^Paella mixta/, pressed: true }))
    // …y arrepentirse.
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    // De vuelta en el día, con la cena intacta.
    expect(await screen.findByRole('heading', { name: /domingo, 9 de agosto/i })).toBeInTheDocument()
    const cena = (await dinnersOf(eventId)).find((c) => c.dia === '2026-08-09')
    expect(cena.platoIds).toHaveLength(2)
  })

  it('el renglón de la cena dice lo que se cena, no «2 platos»', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    expect(document.querySelector('.modal .fila-boton').textContent).toContain('Paella mixta')
  })

  /** S2 + B1: cada bunga tiene su renglón, y su elegidor nombra la familia. */
  it('elige la bunga de mayores en su elegidor, por el nombre de la familia', async () => {
    const { eventId, event, ruido } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('viernes, 14 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /^Mayores toca para elegir/ }))
    expect(await screen.findByRole('heading', { name: 'Bunga mayores' })).toBeInTheDocument()
    // Quitar también es elegir, y en masculino: «Ninguno», no «Ninguna».
    expect(screen.getByRole('button', { name: 'Ninguno' })).toBeInTheDocument()
    // La fila dice la familia con su pastilla de dos letras (numeros.html · 2),
    // el alias de seña (B1) y cuántas veces ha acogido ya (§14.72).
    await userEvent.click(screen.getByRole('button', { name: /^Pérez PE El del ruido · / }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))

    await waitFor(async () => {
      const nueva = (await dinnersOf(eventId)).find((c) => c.dia === '2026-08-14')
      expect(nueva?.bungaMayoresId).toBe(ruido)
    })
  })

  /**
   * Cuántas veces ha acogido cada bunga (§14.72).
   *
   * La pregunta que se hace al abrir esto no es «¿cuál es cuál?» sino **«¿a
   * quién le toca?»**, y se contestaba de memoria o yéndose a Números — a otra
   * sección, y perdiendo el día a medio montar.
   */
  it('el elegidor de bunga dice cuántas veces ha acogido cada uno', async () => {
    const { eventId, event, ruido } = await sembrar()
    // El 9 ya acoge «El del ruido» (mayores) y «El del fondo» (niños); se le
    // añaden dos noches más al primero para que la cuenta no sea trivial.
    await addDinner(eventId, { dia: '2026-08-11', bungaMayoresId: ruido, platoIds: [] })
    await addDinner(eventId, { dia: '2026-08-12', bungaNinosId: ruido, platoIds: [] })
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('viernes, 14 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /^Mayores toca para elegir/ }))
    await screen.findByRole('heading', { name: 'Bunga mayores' })

    const filas = [...document.querySelectorAll('.eleccion-op')].map((e) => e.textContent)
    // Tres veces: el 9 de mayores, el 11 de mayores y el 12 de niños.
    expect(filas.some((t) => /El del ruido · 3 veces/.test(t))).toBe(true)
    // Y el que solo ha acogido una vez lo dice en singular.
    expect(filas.some((t) => /El del fondo · 1 vez/.test(t))).toBe(true)
  })

  it('no se cuenta la propia noche que se está decidiendo', async () => {
    const { eventId, event, ruido } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    // El 9 es justo la noche que ya acoge «El del ruido»: al reabrirla, contarla
    // inflaría a quien está puesto y la cuenta dejaría de contestar a quién le
    // toca **aparte de esta**.
    await abrirDia('domingo, 9 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /^Mayores/ }))
    await screen.findByRole('heading', { name: 'Bunga mayores' })

    const filas = [...document.querySelectorAll('.eleccion-op')].map((e) => e.textContent)
    expect(filas.some((t) => /El del ruido · aún ninguna/.test(t))).toBe(true)
  })

  it('el elegidor de bungas no lleva buscador; el de platos sí', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /^Mayores/ }))
    expect(screen.queryByRole('searchbox')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await abrirLosPlatos()
    expect(screen.getByRole('searchbox', { name: 'Buscar un plato' })).toBeInTheDocument()
  })

  /** L3: el buscador filtra la lista sin esconderla al abrir. */
  it('el buscador de platos filtra por lo escrito, con tildes o sin ellas', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await abrirLosPlatos()
    await userEvent.type(screen.getByRole('searchbox'), 'sandia')

    expect(screen.getByRole('button', { name: /^Sandía/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Paella mixta/ })).toBeNull()
  })

  /**
   * H3 de `cenas-fuera-y-reparto.html`: el alta de un plato se mudó aquí desde
   * Comidas → Cenas, y **no es el formulario de allí**. Cero controles en
   * reposo: el verbo sale solo cuando lo buscado no existe.
   */
  it('el buscador ofrece crear el plato que no existe, con el nombre puesto', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await abrirLosPlatos()
    // En reposo no hay ningún verbo de crear: es el catálogo entero, no un alta.
    expect(screen.queryByRole('button', { name: /^Crear/ })).toBeNull()

    // Buscar algo que sí está tampoco lo ofrece: eso es estar buscándolo.
    await userEvent.type(screen.getByRole('searchbox'), 'paella')
    expect(screen.queryByRole('button', { name: /^Crear/ })).toBeNull()

    await userEvent.clear(screen.getByRole('searchbox'))
    await userEvent.type(screen.getByRole('searchbox'), 'Tortilla de patata')
    await userEvent.click(await screen.findByRole('button', { name: 'Crear «Tortilla de patata» y marcarlo' }))

    // Nace en el catálogo, sin tipo, y se queda marcado —pero todavía sin
    // escribir en la cena, que eso es cosa de «Listo» (§14.31).
    await waitFor(async () => {
      expect((await db.dishes.toArray()).map((d) => d.name)).toContain('Tortilla de patata')
    })
    const nuevo = (await db.dishes.toArray()).find((d) => d.name === 'Tortilla de patata')
    expect(nuevo.categorias).toEqual([])
    expect((await dinnersOf(eventId)).find((c) => c.dia === '2026-08-09').platoIds)
      .not.toContain(nuevo.id)

    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    await waitFor(async () => {
      expect((await dinnersOf(eventId)).find((c) => c.dia === '2026-08-09').platoIds)
        .toContain(nuevo.id)
    })
  })

  /**
   * K1: la mesa de niños vive en el elegidor. Mientras hereden no hay nada que
   * leer —`null` es «comen lo mismo»— y con lista propia sale el segmentado.
   */
  it('los niños pueden comer otra cosa, con su lista dentro del mismo elegidor', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await abrirLosPlatos()
    // Heredando: ni segmentado ni segunda lista, solo el verbo de una línea.
    expect(screen.queryByRole('group', { name: 'Qué mesa' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Los niños comen otra cosa…' }))
    expect(await screen.findByRole('group', { name: 'Qué mesa' })).toBeInTheDocument()
    // Arranca de lo que comen los mayores y se pasa a su mesa.
    expect(screen.getByRole('heading', { name: 'Los platos de los niños' })).toBeInTheDocument()

    // Quitarles la sandía deja a los mayores como estaban.
    await userEvent.click(screen.getByRole('button', { name: /^Sandía/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))

    await waitFor(async () => {
      const cena = (await dinnersOf(eventId)).find((c) => c.dia === '2026-08-09')
      expect(cena.platoIdsNinos).toHaveLength(1)
      expect(cena.platoIds).toHaveLength(2)
    })
    // Y el día **dice qué comen** sin que haya que abrir el elegidor (§14.76):
    // «los niños, otra cosa» avisaba de que había otra respuesta y no la daba.
    expect(await screen.findByText('Los niños · Paella mixta')).toBeInTheDocument()
  })

  /**
   * Se cena fuera (§14.70). El día 13 de Ballenita'26 —«Tardeo cena de
   * chiringo»— se apuntaba como plan porque era el único sitio donde cabía, y el
   * día se quedaba diciendo «sin cena» teniendo la cena decidida.
   */
  it('se puede decir que se cena fuera, y dónde', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    // El día 10 no tiene cena montada.
    await abrirDia('lunes, 10 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /toca para elegir los platos/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Esta noche se cena fuera…' }))

    // La lista de platos se aparta: es la misma decisión con otra respuesta.
    expect(screen.getByRole('heading', { name: 'Esta noche se cena fuera' })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).toBeNull()

    await userEvent.type(screen.getByLabelText('¿Dónde?'), 'El chiringuito de Paco')
    // Todavía sin escribir: el elegidor es un borrador (§14.31).
    expect((await dinnersOf(eventId)).find((c) => c.dia === '2026-08-10')).toBeUndefined()

    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    await waitFor(async () => {
      const cena = (await dinnersOf(eventId)).find((c) => c.dia === '2026-08-10')
      expect(cena.fuera).toBe(1)
      expect(cena.donde).toBe('El chiringuito de Paco')
    })
    // Y la fila del día lo dice sin abrir nada. Se busca **en la lista**: la
    // capa sigue abierta detrás diciendo lo mismo, que es justo lo que se quiere.
    await waitFor(() => {
      const filas = [...document.querySelectorAll('.fila-dia .n')].map((e) => e.textContent)
      expect(filas).toContain('Fuera · El chiringuito de Paco')
    })
  })

  it('decirlo sin sitio también vale, y cría la cena igual', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('lunes, 10 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /toca para elegir los platos/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Esta noche se cena fuera…' }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))

    await waitFor(async () => {
      const cena = (await dinnersOf(eventId)).find((c) => c.dia === '2026-08-10')
      expect(cena.fuera).toBe(1)
      expect(cena.donde).toBe('')
    })
    await waitFor(() => {
      const filas = [...document.querySelectorAll('.fila-dia .n')].map((e) => e.textContent)
      expect(filas).toContain('Se cena fuera')
    })
  })

  it('y se puede volver al camping', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    // El día 9 tiene cena con platos: se sale y se vuelve, y los platos siguen.
    await abrirDia('domingo, 9 de agosto')
    await abrirLosPlatos()
    await userEvent.click(screen.getByRole('button', { name: 'Esta noche se cena fuera…' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cenamos en el camping' }))

    expect(await screen.findByRole('button', { name: /^Paella mixta/, pressed: true })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))

    await waitFor(async () => {
      const cena = (await dinnersOf(eventId)).find((c) => c.dia === '2026-08-09')
      expect(cena.fuera).toBeFalsy()
      expect(cena.platoIds).toHaveLength(2)
    })
  })

  /**
   * O se cena fuera, o se reparten bungas (§14.70-bis): son alternativas, no dos
   * preguntas del mismo día. Desde §14.70 los dos renglones se quedaban ahí,
   * ámbar y perpetuamente a medias, pidiendo algo que esa noche no se puede
   * contestar porque no acoge nadie.
   */
  it('al cenar fuera, los bungas se retiran de la capa del día', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    // El día 9 tiene cena y los dos bungas puestos.
    await abrirDia('domingo, 9 de agosto')
    expect(await screen.findByText('Los bungas')).toBeInTheDocument()

    await abrirLosPlatos()
    await userEvent.click(screen.getByRole('button', { name: 'Esta noche se cena fuera…' }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))

    await waitFor(() => expect(screen.queryByText('Los bungas')).toBeNull())
    // Y lo elegido no se ha borrado: vuelve entero al volver al camping.
    const cena = (await dinnersOf(eventId)).find((c) => c.dia === '2026-08-09')
    expect(cena.bungaMayoresId).toBeTruthy()
    expect(cena.bungaNinosId).toBeTruthy()

    await abrirLosPlatos()
    await userEvent.click(screen.getByRole('button', { name: 'Cenamos en el camping' }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(await screen.findByText('Los bungas')).toBeInTheDocument()
  })

  /**
   * Los planes de un día **se ven todos** (§14.71).
   *
   * El renglón era uno solo y decía «Torneo de pingpong comunitario y tres
   * más»: de cuatro planes se veía uno, y para saber los otros tres había que
   * abrir el elegidor — que es la herramienta de cambiarlos, no la de mirar.
   */
  it('el día enseña todos sus planes, uno por renglón y con sus votos', async () => {
    const { eventId, event } = await sembrar()
    // Cuatro planes el mismo día, como el martes 18 de la captura.
    for (const titulo of ['Torneo de pingpong comunitario', 'Kayak', 'Cine de verano']) {
      await addPlan(eventId, { titulo, dia: '2026-08-10' })
    }
    render(<DiasScreen eventId={eventId} event={event} />)
    // Se espera a la cena del 9: con cuatro planes el día 10, cuál de ellos
    // titula su fila depende del orden en que los devuelva IndexedDB.
    await screen.findByText('Paella mixta')

    await abrirDia('lunes, 10 de agosto')
    await screen.findByRole('heading', { name: /lunes, 10 de agosto/i })

    // Los cuatro por su nombre, y ninguno escondido tras un «y tres más». Se
    // miran **dentro del modal**: la fila de la lista que queda detrás lleva el
    // titular del día, que es uno de estos mismos.
    await waitFor(() => {
      const enLaCapa = [...document.querySelectorAll('.modal .fila-capa .n')].map((e) => e.textContent)
      for (const titulo of ['Playa de la Cala', 'Torneo de pingpong comunitario', 'Kayak', 'Cine de verano']) {
        expect(enLaCapa).toContain(titulo)
      }
    })
    expect(document.querySelector('.modal').textContent).not.toMatch(/y tres más/)

    // Con más de uno, el rótulo va en plural.
    expect(screen.getByText('Los planes')).toBeInTheDocument()
    // Y cada uno lleva su nota: antes los votos solo salían con un plan. Sin
    // hora puesta, la nota lo dice — es lo que explica por qué está al final.
    expect(screen.getByText(/a lo largo del día · Se hace/)).toBeInTheDocument()
  })

  it('y un día sin planes lo sigue diciendo en singular', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await screen.findByRole('heading', { name: /domingo, 9 de agosto/i })
    expect(screen.getByText('El plan')).toBeInTheDocument()
    expect(screen.getByText('Nada apuntado')).toBeInTheDocument()
  })

  /**
   * La hora de un plan (§14.73).
   *
   * Va en el elegidor y solo sobre los que ya están puestos en este día, porque
   * una hora es del **día** y no de la idea: «Kayak» no es a las diez, es a las
   * diez *el martes*.
   */
  it('se le pone hora a un plan del día, y viaja con su instante', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Playa de la Cala')

    await abrirDia('lunes, 10 de agosto')
    await abrirLosPlanes()
    await screen.findByRole('heading', { name: 'Los planes de este día' })

    // El campo sale **solo en los marcados**: un plan libre no tiene día al que
    // atar una hora. En la semilla, «Noche de juegos de mesa» está libre.
    expect(document.querySelectorAll('.reng-hora')).toHaveLength(1)

    // Sin hora puesta hay un botón que la pone en 12h, y de ahí se sube a
    // pulsos (§14.75 · S4). No hay campo que teclear: no sabe escribir minutos.
    await userEvent.click(screen.getByRole('button', { name: 'Poner hora' }))
    expect(screen.getByText('12h')).toBeInTheDocument()
    for (let i = 0; i < 8; i += 1) await userEvent.click(screen.getByRole('button', { name: 'Una hora después' }))
    expect(screen.getByText('20h')).toBeInTheDocument()
    // Borrador: todavía no ha escrito nada (§14.31).
    expect((await plansOf(eventId)).find((p) => p.titulo === 'Playa de la Cala').hora).toBeFalsy()

    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    await waitFor(async () => {
      const plan = (await plansOf(eventId)).find((p) => p.titulo === 'Playa de la Cala')
      expect(plan.hora).toBe('20:00')
      // El instante lo calcula **este móvil**, que es quien sabe su desfase: el
      // Worker solo compara números y no deduce ninguna zona horaria.
      expect(plan.cuando).toBe(Math.floor(new Date('2026-08-10T20:00:00').getTime() / 1000))
    })
    // Y la fila lo enseña en el sitio del icono, en «20h» (§14.75 · C2).
    expect(await screen.findByText('20h')).toBeInTheDocument()
  })

  /**
   * **El selector da la vuelta** (§14.75 · S4). Sin esto, un plan de medianoche
   * desde las 20h no se puede poner subiendo, y ese es justo el plan que se
   * apunta a las once de la noche.
   */
  it('de 23h se sube a 0h y de 0h se baja a 23h', async () => {
    const { eventId, event } = await sembrar()
    await addPlan(eventId, { titulo: 'Cine de verano', dia: '2026-08-10', hora: '23:00' })
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('lunes, 10 de agosto')
    await abrirLosPlanes()
    await screen.findByRole('heading', { name: 'Los planes de este día' })

    expect(screen.getByText('23h')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Una hora después' }))
    expect(screen.getByText('0h')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Una hora antes' }))
    expect(screen.getByText('23h')).toBeInTheDocument()
  })

  /**
   * **Lo que ya estaba guardado con minutos se redondea** (§14.75). La pastilla
   * de C2 solo puede decir «10h» si nada guarda «10:30», así que la puerta de
   * `updatePlan` lo impone y el borrador del elegidor arranca ya en punto: abrir
   * el día y dar a «Listo» lo deja limpio sin tocar nada.
   */
  it('un plan viejo con minutos se guarda en punto al pasar por el elegidor', async () => {
    const { eventId, event } = await sembrar()
    await addPlan(eventId, { titulo: 'Fata', dia: '2026-08-10', hora: '23:46' })
    // Ni siquiera al crearlo se queda con los minutos: la regla vive en `db.js`.
    expect((await plansOf(eventId)).find((p) => p.titulo === 'Fata').hora).toBe('23:00')

    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')
    await abrirDia('lunes, 10 de agosto')
    expect(await screen.findByText('23h')).toBeInTheDocument()
  })

  it('los planes del día salen en orden, y los sueltos al final', async () => {
    const { eventId, event } = await sembrar()
    const tarde = await addPlan(eventId, { titulo: 'Cine de verano', dia: '2026-08-10', hora: '22:00' })
    const pronto = await addPlan(eventId, { titulo: 'Kayak', dia: '2026-08-10', hora: '09:30' })
    await addPlan(eventId, { titulo: 'Vermut', dia: '2026-08-10' })
    expect([tarde, pronto]).toHaveLength(2)
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('lunes, 10 de agosto')
    await waitFor(() => {
      // Con hora, de menor a mayor; sin ella, al final — sin inventarles una.
      const titulos = titulosDePlanes()
      expect(titulos.slice(0, 2)).toEqual(['Kayak', 'Cine de verano'])
      // Entre los dos sueltos **no se dice nada**: `porHora` es estable, así que
      // conserva el orden en que vengan, y ese lo decide IndexedDB. Fijarlo aquí
      // sería atar la prueba a algo que no es una promesa de nadie.
      expect(titulos.slice(2).sort()).toEqual(['Playa de la Cala', 'Vermut'])
    })
  })

  it('quitar un plan del día le quita también la hora', async () => {
    const { eventId, event } = await sembrar()
    await addPlan(eventId, { titulo: 'Kayak', dia: '2026-08-10', hora: '09:30' })
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('lunes, 10 de agosto')
    await abrirLosPlanes()
    await screen.findByRole('heading', { name: 'Los planes de este día' })
    await userEvent.click(screen.getByRole('button', { name: /^Kayak/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))

    await waitFor(async () => {
      const plan = (await plansOf(eventId)).find((p) => p.titulo === 'Kayak')
      // Vuelve a libres, y sin día no hay hora que guardar: una hora suelta
      // reaparecería al colocarlo en otro día distinto.
      expect(plan.dia).toBeNull()
      expect(plan.hora).toBeNull()
      expect(plan.cuando).toBeNull()
    })
  })

  /** H1 de dia-abierto.html: quitar la cena sigue pidiendo segunda pulsación. */
  it('quitar la cena pide segunda pulsación, y se lleva platos y bungas', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await abrirLosPlatos()
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar la cena de este día' }))
    // Primera pulsación: todavía no ha pasado nada.
    expect((await dinnersOf(eventId)).find((c) => c.dia === '2026-08-09')).toBeTruthy()
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, quitarla' }))

    await waitFor(async () => {
      expect((await dinnersOf(eventId)).find((c) => c.dia === '2026-08-09')).toBeUndefined()
    })
  })

  /** C2 en los planes: marcar es borrador, «Listo» coloca. */
  it('coloca un plan libre marcándolo, y no escribe hasta «Listo»', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Playa de la Cala')

    await abrirDia('miércoles, 12 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /Nada apuntado/ }))
    expect(await screen.findByText('1 👍 · falta por votar Ana')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Noche de juegos de mesa/ }))

    // Marcado, pero todavía en el borrador.
    expect((await plansOf(eventId)).find((p) => p.titulo === 'Noche de juegos de mesa').dia).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    await waitFor(async () => {
      const planes = await plansOf(eventId)
      expect(planes.find((p) => p.titulo === 'Noche de juegos de mesa').dia).toBe('2026-08-12')
    })
  })

  it('desmarcar un plan puesto lo devuelve a libres al dar a «Listo»', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Playa de la Cala')

    await abrirDia('lunes, 10 de agosto')
    // «Se hace» distingue el renglón de la capa de la fila del día 10 de la
    // lista de detrás, cuyo rótulo también nombra la playa.
    await userEvent.click(await screen.findByRole('button', { name: /Playa de la Cala.*Se hace/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Playa de la Cala/, pressed: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))

    await waitFor(async () => {
      const planes = await plansOf(eventId)
      expect(planes.find((p) => p.titulo === 'Playa de la Cala').dia).toBeNull()
    })
  })

  /**
   * D2: un plan cuyo día se cayó fuera de las fechas desaparecía del modal —no
   * estaba ni entre los del día ni entre los que no tienen ninguno—. Ahora
   * cuenta como libre y se dice de dónde viene.
   */
  it('un plan que se quedó fuera de las fechas vuelve a poder colocarse', async () => {
    const { eventId, event } = await sembrar()
    await addPlan(eventId, { titulo: 'Feria de Ronda', dia: '2026-08-17' })
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Playa de la Cala')

    await abrirDia('jueves, 13 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /2 planes libres por traer/ }))
    expect(await screen.findByText(/fuera del viaje/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Feria de Ronda/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))

    await waitFor(async () => {
      const planes = await plansOf(eventId)
      expect(planes.find((p) => p.titulo === 'Feria de Ronda').dia).toBe('2026-08-13')
    })
  })

  it('sin planes que traer, el renglón lo dice y no abre un elegidor vacío', async () => {
    const eventId = await createEvent({ name: 'Solo', startDate: '2026-08-08', endDate: '2026-08-09' })
    render(<DiasScreen eventId={eventId} event={await getEvent(eventId)} />)

    await abrirDia('sábado, 8 de agosto')
    expect(await screen.findByRole('button', { name: /ningún plan libre/ })).toBeDisabled()
  })

  /** El semáforo en la lista (numeros.html · decidido 1, revisa D1 de dia-estado). */
  it('la lista de Días tiñe el número: verde el día completo, ámbar el resto', async () => {
    const { eventId, event } = await sembrar()
    // Con la noche de juegos puesta en el 9, ese día lo tiene todo: cena con
    // platos, los dos bungas y un plan.
    const noche = (await plansOf(eventId)).find((p) => p.titulo === 'Noche de juegos de mesa')
    await updatePlan(noche.id, { dia: '2026-08-09' })
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')
    await screen.findByText('Playa de la Cala')

    await waitFor(() => {
      expect(document.querySelectorAll('.dia-num.verde')).toHaveLength(1)
      expect(document.querySelectorAll('.dia-num.ambar')).toHaveLength(7)
    })
  })

  it('sin fechas en el evento, lo dice y manda a Ajustes', async () => {
    const eventId = await createEvent({ name: 'Sin fechas' })
    render(<DiasScreen eventId={eventId} event={await getEvent(eventId)} />)
    expect(await screen.findByText(/todavía no tiene fechas/)).toBeInTheDocument()
  })
})
