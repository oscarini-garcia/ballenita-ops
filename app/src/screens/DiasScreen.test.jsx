import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DiasScreen from './DiasScreen.jsx'
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
  await addPlan(eventId, { titulo: 'Playa de la Cala', dia: '2026-08-10', estado: 'confirmado' })
  await addPlan(eventId, { titulo: 'Noche de juegos de mesa', votos: { [curro]: '👍' } })
  return { eventId, event: await getEvent(eventId), ruido }
}

const abrirDia = async (nombre) =>
  userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${nombre}`, 'i') }))

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

    expect(await screen.findByText('Paella mixta')).toBeInTheDocument()
    expect(screen.getByText('2 platos · sin planes')).toBeInTheDocument()
    expect(screen.getByText('Playa de la Cala')).toBeInTheDocument()
    expect(screen.getByText('sin cena · 1 plan')).toBeInTheDocument()
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
    expect(await screen.findByRole('button', { name: /^domingo, 9 de agosto: Paella mixta, 2 platos/i }))
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
    await userEvent.click(await screen.findByRole('button', { name: /Paella mixta y una cosa más/ }))
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
    expect(await screen.findByRole('button', { name: /Paella mixta y una cosa más/ })).toBeInTheDocument()
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
    // La fila dice la familia con su pastilla de dos letras (numeros.html · 2)
    // y el alias de seña (B1).
    await userEvent.click(screen.getByRole('button', { name: 'Pérez PE El del ruido' }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))

    await waitFor(async () => {
      const nueva = (await dinnersOf(eventId)).find((c) => c.dia === '2026-08-14')
      expect(nueva?.bungaMayoresId).toBe(ruido)
    })
  })

  it('el elegidor de bungas no lleva buscador; el de platos sí', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /^Mayores/ }))
    expect(screen.queryByRole('searchbox')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await userEvent.click(await screen.findByRole('button', { name: /Paella mixta y una cosa más/ }))
    expect(screen.getByRole('searchbox', { name: 'Buscar un plato' })).toBeInTheDocument()
  })

  /** L3: el buscador filtra la lista sin esconderla al abrir. */
  it('el buscador de platos filtra por lo escrito, con tildes o sin ellas', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /Paella mixta y una cosa más/ }))
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
    await userEvent.click(await screen.findByRole('button', { name: /Paella mixta y una cosa más/ }))
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
    await userEvent.click(await screen.findByRole('button', { name: /Paella mixta y una cosa más/ }))
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
    // Y el día lo dice sin que haya que abrir el elegidor.
    expect(await screen.findByText(/los niños, otra cosa/)).toBeInTheDocument()
  })

  /** H1 de dia-abierto.html: quitar la cena sigue pidiendo segunda pulsación. */
  it('quitar la cena pide segunda pulsación, y se lleva platos y bungas', async () => {
    const { eventId, event } = await sembrar()
    render(<DiasScreen eventId={eventId} event={event} />)
    await screen.findByText('Paella mixta')

    await abrirDia('domingo, 9 de agosto')
    await userEvent.click(await screen.findByRole('button', { name: /Paella mixta y una cosa más/ }))
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
    // «Confirmado» distingue el renglón de la capa de la fila del día 10 de la
    // lista de detrás, cuyo rótulo también nombra la playa.
    await userEvent.click(await screen.findByRole('button', { name: /Playa de la Cala Confirmado/ }))
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
