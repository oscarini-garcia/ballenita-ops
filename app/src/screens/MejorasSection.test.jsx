import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLiveQuery } from 'dexie-react-hooks'
import MejorasSection from './MejorasSection.jsx'
import {
  db, createEvent, getEvent, addMejora, listMejoras, updateMejora,
  addFamily, addPerson, personsOf, familiesOf, TOPE_DE_MEJORA, NOMBRE_DEMO,
} from '../db.js'

/**
 * «Mejoras»: el roadmap de la app apuntado desde el móvil (SPECS §14.22,
 * `docs/diseño/mejoras.html` · A1 · B1 · C2 · D2 · E1). La figura es el bloque
 * de `garciadoral-ops`: renglón fijo, visto delante, lo hecho tachado y al
 * final, la firma de Ideas y la pregunta de quitar diciendo a quién afecta.
 */

/** El apartado como lo monta Ajustes: las consultas vivas van fuera. */
function Apartado({ evento, meId = null }) {
  const mejoras = useLiveQuery(() => listMejoras(evento), [evento?.id], [])
  const persons = useLiveQuery(() => personsOf(evento.id), [evento.id], [])
  const families = useLiveQuery(() => familiesOf(evento.id), [evento.id], [])
  return <MejorasSection evento={evento} mejoras={mejoras} persons={persons} families={families} meId={meId} />
}

async function viaje(campos = {}) {
  const id = await createEvent({ name: 'Viaje 2026', startDate: '2026-08-15', endDate: '2026-08-22', ...campos })
  return { eventId: id, event: await getEvent(id) }
}

/** Abre la fila arrastrándola hacia la izquierda, como haría un pulgar. */
function deslizar(cara) {
  fireEvent.pointerDown(cara, { clientX: 300, clientY: 100, pointerId: 1, pointerType: 'touch' })
  fireEvent.pointerMove(cara, { clientX: 240, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(cara, { clientX: 160, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(cara, { clientX: 160, clientY: 100, pointerId: 1 })
}

beforeEach(async () => {
  for (const t of ['events', 'mejoras', 'persons', 'families', 'outbox']) await db[t].clear()
  localStorage.clear()
})

describe('MejorasSection', () => {
  it('sin mejoras dice qué es esto y quién lo ve, en vez de una lista vacía', async () => {
    const { event } = await viaje()
    render(<Apartado evento={event} />)
    expect(await screen.findByText(/Ideas sobre esta aplicación.*Las ve todo el grupo/)).toBeInTheDocument()
  })

  it('el renglón apunta una mejora firmada y se queda listo para la siguiente', async () => {
    const { eventId, event } = await viaje()
    const garcia = await addFamily(eventId, { name: 'García' })
    const marta = await addPerson(eventId, { name: 'Marta', familyId: garcia, edad: 'adulto' })
    render(<Apartado evento={event} meId={marta} />)

    const campo = await screen.findByLabelText('Apunta una mejora')
    // El ✓ apagado en vacío: un toque sin texto guardaría una mejora sin nada.
    expect(screen.getByRole('button', { name: 'Guardar mejora' })).toBeDisabled()

    await userEvent.type(campo, 'Poder marcar la compra por pasillos del súper')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar mejora' }))

    const mejoras = await listMejoras()
    expect(mejoras).toHaveLength(1)
    expect(mejoras[0]).toMatchObject({
      texto: 'Poder marcar la compra por pasillos del súper',
      hecho: false,
      autorId: marta,
      eventId: null,
    })
    expect(mejoras[0].apuntadaEl).toBeTruthy()

    // La firma en pantalla: nombre, alias de la familia y quién las ve.
    expect(await screen.findByText('Marta', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('GA')).toBeInTheDocument()
    expect(screen.getByText(/1 sin hacer. Las ve todo el grupo/)).toBeInTheDocument()

    // Y el renglón sigue ahí, vacío: dos seguidas son dos frases y dos toques.
    expect(campo).toHaveValue('')
  })

  it('el visto la tacha y la baja al final, y deshacerlo la devuelve', async () => {
    const { event } = await viaje()
    await addMejora({ texto: 'Un aviso el día antes de que te toque cena' })
    await addMejora({ texto: 'Exportar los saldos a PDF' })
    render(<Apartado evento={event} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Dar por hecha «Exportar los saldos a PDF»' }))

    // Tachada —el botón ahora deshace— y al final de la lista.
    const deshacer = await screen.findByRole('button', { name: 'Deshacer «Exportar los saldos a PDF»' })
    expect(deshacer).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => {
      const filas = document.querySelectorAll('.fila-mejora')
      expect(filas[filas.length - 1].textContent).toContain('Exportar los saldos a PDF')
      expect(filas[filas.length - 1].className).toContain('hecha')
    })
    expect(screen.getByText(/1 sin hacer. Las ve todo el grupo/)).toBeInTheDocument()

    await userEvent.click(deshacer)
    expect(await screen.findByText(/2 sin hacer. Las ve todo el grupo/)).toBeInTheDocument()
  })

  it('se toca el texto para editarla, y editar no cambia de quién fue', async () => {
    const { eventId, event } = await viaje()
    const marta = await addPerson(eventId, { name: 'Marta', edad: 'adulto' })
    await addMejora({ texto: 'Buscar platos por ingrediente', autorId: marta })
    render(<Apartado evento={event} />)

    await userEvent.click(await screen.findByText('Buscar platos por ingrediente'))
    const hoja = await screen.findByRole('heading', { name: 'Mejora' })
    expect(hoja).toBeInTheDocument()

    // Como el editor de una idea: centrado y sin robar el foco — el teclado
    // no sale hasta que se toca el campo.
    expect(document.querySelector('.modal-bg')?.className).toContain('center')
    expect(document.activeElement).not.toBe(screen.getByLabelText('Qué se te ha ocurrido'))

    const campo = screen.getByLabelText('Qué se te ha ocurrido')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Buscar platos también por ingrediente')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    const [mejora] = await listMejoras()
    expect(mejora.texto).toBe('Buscar platos también por ingrediente')
    expect(mejora.autorId).toBe(marta)
  })

  it('quitar pregunta diciendo a quién afecta, y hasta el sí no se va nada', async () => {
    const { event } = await viaje()
    await addMejora({ texto: 'Trastear con los avisos' })
    render(<Apartado evento={event} />)

    await userEvent.click(await screen.findByText('Trastear con los avisos'))
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar mejora' }))

    // La pregunta es la protección (E1): cualquiera puede quitar la de
    // cualquiera, y a quién afecta se dice antes, no se descubre después.
    expect(screen.getByText(/Se va de la lista de todo el grupo/)).toBeInTheDocument()
    expect(await listMejoras()).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Sí, quitarla' }))
    await waitFor(async () => expect(await listMejoras()).toHaveLength(0))
  })

  it('deslizar descubre Editar y Borrar, y Borrar abre la hoja ya preguntando', async () => {
    const { event } = await viaje()
    await addMejora({ texto: 'Compartir los avatares con foto' })
    render(<Apartado evento={event} />)
    await screen.findByText('Compartir los avatares con foto')

    // Cerrada, los verbos no están en el camino de nadie; abierta, son botones
    // de verdad. Es el gesto que la app ya enseñó en Gastos (§14.10-bis).
    expect(document.querySelector('.deslizable-verbos').style.visibility).toBe('hidden')
    deslizar(document.querySelector('.deslizable-cara'))
    expect(document.querySelector('.deslizable-verbos').style.visibility).toBe('visible')

    // Borrar no borra: abre la hoja con la pregunta ya puesta, para que ningún
    // camino se salte la única protección que hay (E1).
    await userEvent.click(screen.getByRole('button', { name: /Borrar/ }))
    expect(await screen.findByText(/Se va de la lista de todo el grupo/)).toBeInTheDocument()
    expect(await listMejoras()).toHaveLength(1)
  })
})

describe('las mejoras en la base', () => {
  it('el texto se corta al tope en el móvil, como lo rechaza el Worker', async () => {
    await addMejora({ texto: 'x'.repeat(TOPE_DE_MEJORA + 500) })
    const [mejora] = await listMejoras()
    expect(mejora.texto).toHaveLength(TOPE_DE_MEJORA)

    await updateMejora(mejora.id, { texto: 'y'.repeat(TOPE_DE_MEJORA + 500) })
    expect((await listMejoras())[0].texto).toHaveLength(TOPE_DE_MEJORA)
  })

  it('el Demo escribe con su eventId y no ensucia la lista de verdad', async () => {
    const { event: demo } = await viaje({ name: NOMBRE_DEMO, esDemo: true })
    await addMejora({ texto: 'Trasteo del cajón de arena' }, demo)
    await addMejora({ texto: 'La de verdad' })

    expect((await listMejoras()).map((m) => m.texto)).toEqual(['La de verdad'])
    expect((await listMejoras(demo)).map((m) => m.texto)).toEqual(['Trasteo del cajón de arena'])
  })

  it('lo que falta va arriba por lo más nuevo, y lo hecho al final', async () => {
    const a = await addMejora({ texto: 'Vieja pendiente' })
    const b = await addMejora({ texto: 'Nueva pendiente' })
    const c = await addMejora({ texto: 'Ya hecha' })
    await updateMejora(a, { apuntadaEl: '2020-01-01T10:00:00.000Z' })
    await updateMejora(b, { apuntadaEl: '2026-01-01T10:00:00.000Z' })
    await updateMejora(c, { hecho: true, apuntadaEl: '2026-06-01T10:00:00.000Z' })

    expect((await listMejoras()).map((m) => m.texto))
      .toEqual(['Nueva pendiente', 'Vieja pendiente', 'Ya hecha'])
  })
})

describe('el rótulo de Ajustes', () => {
  it('lleva las que faltan, y se calla cuando no falta ninguna', async () => {
    vi.resetModules()
    const { eventId, event } = await viaje()
    await addMejora({ texto: 'Una pendiente' })
    const { default: EventSettingsScreen } = await import('./EventSettingsScreen.jsx')
    render(<EventSettingsScreen eventId={eventId} event={event} sync={{ recheck: vi.fn() }} />)

    const rotulo = await screen.findByText('Mejoras')
    expect(await within(rotulo.closest('summary')).findByText('1 sin hacer')).toBeInTheDocument()
  })

  /**
   * La hoja, que pasó de 380 pt de ancho y cuatro renglones a la anchura del
   * resto de capas y diez: una mejora son hasta 2000 letras, y escribirlas sin
   * ver lo escrito es la razón por la que se apuntaban a medias.
   */
  it('se puede apuntar una mejora larga desde la hoja, no solo desde el renglón', async () => {
    const { event } = await viaje()
    render(<Apartado evento={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Escribir una larga' }))

    // De una vez y no tecla a tecla: son 56 letras, y `userEvent.type` dispara un
    // renderizado por cada una. En este portátil sobraba tiempo y en el runner
    // no, que es exactamente la forma de una prueba inestable — y una inestable
    // ya dejó un OTA sin publicar.
    const campo = await screen.findByLabelText('Qué se te ha ocurrido')
    fireEvent.change(campo, { target: { value: 'Que la lista de la compra se pueda compartir por WhatsApp' } })
    await userEvent.click(await screen.findByRole('button', { name: 'Apuntarla' }))

    // Contra la base y no contra la pantalla: lo que se prueba es que la hoja
    // apunta, y la lista se repinta cuando Dexie avisa, que es otro reloj.
    await waitFor(async () => {
      const puestas = await listMejoras(event)
      expect(puestas.map((m) => m.texto)).toContain('Que la lista de la compra se pueda compartir por WhatsApp')
    })
  })

  it('lo tecleado en el renglón no se pierde al pasar a la hoja', async () => {
    const { event } = await viaje()
    render(<Apartado evento={event} />)
    fireEvent.change(await screen.findByLabelText('Apunta una mejora'), { target: { value: 'Los avisos' } })
    await userEvent.click(await screen.findByRole('button', { name: 'Escribir una larga' }))

    expect(await screen.findByLabelText('Qué se te ha ocurrido')).toHaveValue('Los avisos')
  })

  it('la hoja de una mejora se copia al portapapeles', async () => {
    const escrito = []
    Object.assign(navigator, { clipboard: { writeText: async (t) => { escrito.push(t) } } })
    const { event } = await viaje()
    await addMejora({ texto: 'Que el botón de cenas sea más grande' })

    render(<Apartado evento={event} />)
    await userEvent.click(await screen.findByText('Que el botón de cenas sea más grande'))
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar' }))

    expect(escrito).toEqual(['Que el botón de cenas sea más grande'])
    expect(await screen.findByText('Copiado')).toBeInTheDocument()
  })
})
