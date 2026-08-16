import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Comentarios from './Comentarios.jsx'
import {
  createEvent, addFamily, addPerson, addComentario, comentariosDe, anclaDe,
} from '../db.js'
import { olvidarLeidos } from '../lib/comentarios.js'

/**
 * El hilo enchufable (§14.55 · K2). Lo que fijan estos tests es la figura que se
 * eligió: **los dos últimos y el resto detrás de un renglón**, porque el hilo
 * entero dentro de una capa la lleva de 470 a más de 900 pt.
 */
/**
 * Un milisegundo de verdad entre dos comentarios.
 *
 * `escritoEl` tiene resolución de milisegundo y con la base en memoria dos
 * escrituras seguidas caen dentro del mismo, así que `comentariosDe` los ordena
 * empatados —y ante un empate el orden lo pone el índice de IndexedDB, no quien
 * escribió antes—. Sin esto, estas dos pruebas fallaban una de cada tantas, y
 * solo con la suite entera corriendo: exactamente el peor fallo que puede tener
 * una prueba, porque parece de la vuelta que la ha destapado.
 */
const unTic = () => new Promise((r) => setTimeout(r, 2))

async function viaje() {
  const eventId = await createEvent({ name: 'Playa 2026' })
  const garcia = await addFamily(eventId, { name: 'García', color: '#E5544B' })
  const curro = await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto' })
  const ana = await addPerson(eventId, { name: 'Ana', familyId: garcia, edad: 'adulto' })
  localStorage.setItem(`ballena.me:${eventId}`, curro)
  olvidarLeidos(eventId)
  return { eventId, curro, ana, ancla: anclaDe('plan', 'p1') }
}

describe('Comentarios', () => {
  it('se escribe desde el renglón y queda anclado a su cosa', async () => {
    const { eventId, curro, ancla } = await viaje()
    render(<Comentarios eventId={eventId} ancla={ancla} />)

    await userEvent.type(await screen.findByLabelText('Escribe un comentario'), '¿A qué hora salimos?')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar comentario' }))

    await waitFor(async () => {
      const hilo = await comentariosDe(eventId, ancla)
      expect(hilo).toHaveLength(1)
      expect(hilo[0]).toMatchObject({ texto: '¿A qué hora salimos?', autorId: curro, ancla })
    })
    // El renglón se vacía y se queda: dos comentarios seguidos son dos frases.
    expect(await screen.findByLabelText('Escribe un comentario')).toHaveValue('')
  })

  it('enseña los dos últimos y el resto detrás de un renglón', async () => {
    const { eventId, ancla } = await viaje()
    for (const t of ['uno', 'dos', 'tres', 'cuatro']) {
      await addComentario(eventId, { ancla, texto: t })
      await unTic()
    }
    render(<Comentarios eventId={eventId} ancla={ancla} />)

    expect(await screen.findByText('tres')).toBeInTheDocument()
    expect(screen.getByText('cuatro')).toBeInTheDocument()
    expect(screen.queryByText('uno')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Ver los 4 comentarios/ }))
    expect(await screen.findByText('uno')).toBeInTheDocument()
  })

  it('con dos o menos no ofrece ver más: no hay nada escondido', async () => {
    const { eventId, ancla } = await viaje()
    await addComentario(eventId, { ancla, texto: 'uno' })
    render(<Comentarios eventId={eventId} ancla={ancla} />)

    await screen.findByText('uno')
    expect(screen.queryByRole('button', { name: /Ver los/ })).not.toBeInTheDocument()
  })

  it('van del más viejo al más nuevo: se lee como una conversación', async () => {
    const { eventId, ancla } = await viaje()
    await addComentario(eventId, { ancla, texto: 'primero' })
    await unTic()
    await addComentario(eventId, { ancla, texto: 'segundo' })
    render(<Comentarios eventId={eventId} ancla={ancla} />)

    await screen.findByText('primero')
    const textos = [...document.querySelectorAll('.coment-txt')].map((n) => n.textContent)
    expect(textos).toEqual(['primero', 'segundo'])
  })

  it('el aspa solo está en los tuyos: borrar lo de otro es reescribir la conversación', async () => {
    const { eventId, curro, ana, ancla } = await viaje()
    await addComentario(eventId, { ancla, texto: 'mío', autorId: curro })
    await addComentario(eventId, { ancla, texto: 'de Ana', autorId: ana })
    render(<Comentarios eventId={eventId} ancla={ancla} />)

    await screen.findByText('de Ana')
    expect(screen.getAllByRole('button', { name: /Borrar tu comentario/ })).toHaveLength(1)
  })

  it('borrar el tuyo pide una segunda pulsación', async () => {
    const { eventId, curro, ancla } = await viaje()
    await addComentario(eventId, { ancla, texto: 'me arrepiento', autorId: curro })
    render(<Comentarios eventId={eventId} ancla={ancla} />)

    await userEvent.click(await screen.findByRole('button', { name: /Borrar tu comentario/ }))
    expect(await screen.findByText('¿Seguro?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Confirmar que se borra/ }))

    await waitFor(async () => { expect(await comentariosDe(eventId, ancla)).toHaveLength(0) })
  })

  // La figura elegida en `docs/diseño/comentarios.html` · A2·B1·C3·D2: dos
  // fondos sin borde y un enlace, donde había cuatro cajas con canto.
  it('ni el hilo, ni el renglón, ni «ver los que faltan» llevan canto', async () => {
    const { eventId, ancla } = await viaje()
    for (const t of ['uno', 'dos', 'tres']) { await addComentario(eventId, { ancla, texto: t }); await unTic() }
    render(<Comentarios eventId={eventId} ancla={ancla} />)

    await screen.findByText('tres')
    expect(document.querySelector('.hilo')).not.toBeNull()
    expect(document.querySelector('.coment-escribir')).not.toBeNull()
    expect(screen.getByRole('button', { name: /Ver los 3 comentarios/ })).toHaveClass('ver-todos')
    // Las cuatro cajas de antes: la tarjeta del hilo, el renglón de «ver los
    // que faltan», la casilla con canto y el botón lleno de 44.
    expect(document.querySelector('.card')).toBeNull()
    expect(document.querySelector('.acor-ido')).toBeNull()
    expect(document.querySelector('.renglon-linea')).toBeNull()
    expect(document.querySelector('.btn.cuadrado')).toBeNull()
  })

  it('un comentario es prosa y no una fila de lista', async () => {
    // Heredaba `.row .main .n`, que existe para el **nombre** de una fila: se
    // pintaba a peso 550 y acababa siendo lo más negro de la capa de un plan.
    const { eventId, ancla } = await viaje()
    await addComentario(eventId, { ancla, texto: 'los niños van conmigo' })
    render(<Comentarios eventId={eventId} ancla={ancla} />)

    const txt = await screen.findByText('los niños van conmigo')
    expect(txt).toHaveClass('coment-txt')
    expect(txt.closest('.row')).toBeNull()
  })

  it('cada ancla es su hilo: dos cosas distintas no se mezclan', async () => {
    const { eventId } = await viaje()
    await addComentario(eventId, { ancla: anclaDe('plan', 'p1'), texto: 'del plan' })
    await addComentario(eventId, { ancla: anclaDe('gasto', 'g1'), texto: 'del gasto' })
    render(<Comentarios eventId={eventId} ancla={anclaDe('gasto', 'g1')} />)

    expect(await screen.findByText('del gasto')).toBeInTheDocument()
    expect(screen.queryByText('del plan')).not.toBeInTheDocument()
  })
  // El botón de la ballena lo enchufa quien coloca el hilo (§14.66-quater): sin
  // `sugerir` no existe, que es el caso de un plan, un gasto y un día — no
  // tienen ninguna evaluación detrás de la que hablar.
  it('sin quien lo enchufe, no hay botón de la ballena', async () => {
    const { eventId, ancla } = await viaje()
    render(<Comentarios eventId={eventId} ancla={ancla} />)

    await screen.findByLabelText('Escribe un comentario')
    expect(screen.queryByRole('button', { name: /ballena/i })).toBeNull()
  })
})
