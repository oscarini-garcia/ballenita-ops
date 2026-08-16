import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'

/**
 * El bunga resumido con guasa, sus comentarios y de quién es (SPECS §14.66).
 *
 * Tres cosas que la lista de bungas no decía: cómo es el sitio sin abrirlo, si
 * alguien ha escrito algo sobre él, y de qué familia es de un vistazo.
 */
const resumenDeBunga = vi.fn()
vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  resumenDeBunga: (...a) => resumenDeBunga(...a),
  hayApi: vi.fn(async () => true),
}))

const { default: GrupoSection } = await import('./GrupoSection.jsx')
const {
  db, createEvent, addFamily, addBunga, addPerson, addAlojamiento, updateBunga,
  updateAlojamiento, listAlojamientos, addComentario, anclaDe,
} = await import('../db.js')
const { huellaDelSitio } = await import('../lib/alojamientos.js')

let ctx

async function sembrar({ notas = 'la nevera congela mucho', pegatinas = ['nevera'] } = {}) {
  const eventId = await createEvent({ name: 'Ballenita', currency: 'EUR' })
  const garcia = await addFamily(eventId, { name: 'García', alias: 'GA', color: '#E5544B', avatar: '🏖️' })
  await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto' })
  const bunga = await addBunga(eventId, { name: 'Bunga 12', alias: 'el de la piscina', familyId: garcia })
  const aloj = await addAlojamiento({ name: 'Bunga 12', notas, pegatinas })
  await updateBunga(bunga, { alojamientoId: aloj })
  return { eventId, garcia, bunga, aloj }
}

const pintarBungas = () => render(<GrupoSection eventId={ctx.eventId} area="bungas" />)

beforeEach(async () => {
  localStorage.clear()
  resumenDeBunga.mockReset()
  for (const t of ['events', 'persons', 'families', 'bungas', 'alojamientos', 'comentarios', 'outbox']) {
    await db[t].clear()
  }
  ctx = await sembrar()
})
afterEach(() => localStorage.clear())

describe('la lista de bungas', () => {
  it('sin evaluación, la fila es el nombre y el mote', async () => {
    pintarBungas()
    expect(await screen.findByText('el de la piscina')).toBeInTheDocument()
    expect(document.querySelector('.bunga-eval')).toBeNull()
  })

  // La evaluación va **debajo de la fila**, a lo ancho: en el subtítulo competía
  // con el nombre del bunga y con la pastilla de su familia (§14.66-ter).
  it('con evaluación, va en su renglón debajo de la fila', async () => {
    const sitio = (await listAlojamientos()).find((a) => a.id === ctx.aloj)
    await updateAlojamiento(ctx.aloj, {
      resumen: 'La nevera va sobrada y el baño está bien; hay bichos en la terraza.',
      resumenDe: huellaDelSitio(sitio),
    })
    pintarBungas()

    const frase = await screen.findByText(/La nevera va sobrada/)
    expect(frase.className).toMatch(/bunga-eval/)
    expect(frase.className).not.toMatch(/viejo/)
    // Y el mote se queda donde estaba, bajo el nombre.
    expect(screen.getByText('el de la piscina')).toBeInTheDocument()
  })

  // Una frase convincente y desfasada es peor que ninguna en una lista que se
  // mira para decidir con cuál te quedas.
  it('una escrita antes de la última nota sale marcada', async () => {
    await updateAlojamiento(ctx.aloj, { resumen: 'La nevera va sobrada.', resumenDe: 'huella_vieja' })
    pintarBungas()

    const frase = await screen.findByText(/La nevera va sobrada/)
    expect(frase.className).toMatch(/viejo/)
    expect(screen.getByText(/escrita antes de lo último/)).toBeInTheDocument()
  })

  // **El nombre y no las dos letras** (§14.66-ter): aquí la pregunta es «¿quién
  // duerme en el 12?», y eso se contesta con un nombre. «GA» obliga a traducir.
  it('dice de quién es con el emoji y el nombre de su familia', async () => {
    pintarBungas()

    const suya = await screen.findByRole('button', { name: 'Es de los García' })
    expect(within(suya).getByText('🏖️')).toBeInTheDocument()
    expect(suya).toHaveTextContent('García')
    expect(suya).not.toHaveTextContent('GA ')
  })

  it('y cuenta los comentarios que tiene', async () => {
    await addComentario(ctx.eventId, { ancla: anclaDe('bunga', ctx.bunga), texto: '¿os importa cambiarlo?' })
    pintarBungas()

    expect(await screen.findByText(/💬 1/)).toBeInTheDocument()
  })
})

describe('se rehace solo', () => {
  const abrirElBunga = async () => {
    await waitFor(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Bunga 12/ }))
      expect(screen.getByText('Editar bunga')).toBeInTheDocument()
    })
  }

  // El botón se retiró (§14.66-bis): en cuanto cambia una nota o una pegatina,
  // la frase se rehace sola.
  it('al cambiar una nota se pide y se guarda en el sitio, sin tocar nada', async () => {
    resumenDeBunga.mockResolvedValue('nevera de sobra, bichos de propina')
    pintarBungas()
    await abrirElBunga()

    // Se abre con una frase ya escrita, así que nada que rehacer todavía…
    expect(screen.queryByRole('button', { name: /Resumirlo/ })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /bichos/ }))

    await waitFor(async () => {
      const sitio = (await listAlojamientos()).find((a) => a.id === ctx.aloj)
      expect(sitio.resumen).toBe('nevera de sobra, bichos de propina')
      expect(sitio.resumenDe).toBe(huellaDelSitio(sitio))
    }, { timeout: 4000 })

    // Y lo que se le manda al modelo es lo que hay escrito, sin nombres.
    expect(resumenDeBunga).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Bunga 12', notas: 'la nevera congela mucho',
    }))
    expect(resumenDeBunga.mock.calls[0][0]).not.toHaveProperty('familia')
  })

  // Abrir el bunga cuarenta veces no puede costar cuarenta llamadas: la huella
  // dice si de verdad ha cambiado algo.
  it('si la frase corresponde a lo que hay, no se pide nada', async () => {
    const sitio = (await listAlojamientos()).find((a) => a.id === ctx.aloj)
    await updateAlojamiento(ctx.aloj, { resumen: 'lo de siempre', resumenDe: huellaDelSitio(sitio) })
    pintarBungas()
    await abrirElBunga()

    await new Promise((r) => setTimeout(r, 2200))
    expect(resumenDeBunga).not.toHaveBeenCalled()
  })

  // Con el sitio en blanco lo único que puede hacer el modelo es inventarse cómo
  // es el bungalow, que es justo lo que no se quiere leer al repartirlos.
  it('con el sitio en blanco no se pide, y se dice qué falta', async () => {
    await updateAlojamiento(ctx.aloj, { notas: '', pegatinas: [], resumen: '', resumenDe: '' })
    pintarBungas()
    await abrirElBunga()

    expect(screen.getByText(/Pon alguna pegatina/)).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 2200))
    expect(resumenDeBunga).not.toHaveBeenCalled()
  })

  it('si el modelo falla, se dice con sus palabras y no se reintenta en bucle', async () => {
    resumenDeBunga.mockRejectedValue(new Error('la API respondió 409: no hay clave de IA configurada'))
    pintarBungas()
    await abrirElBunga()

    await userEvent.click(screen.getByRole('button', { name: /bichos/ }))

    expect(await screen.findByText(/no hay clave de IA/, {}, { timeout: 4000 })).toBeInTheDocument()
    // Una sola vez por versión del texto: lo que queda es el botón de recuperar
    // el fallo, que no es el de pedir la frase.
    await new Promise((r) => setTimeout(r, 2200))
    expect(resumenDeBunga).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Volver a intentarlo' })).toBeInTheDocument()
  })

  it('el hilo del bunga está dentro de su pantalla', async () => {
    pintarBungas()
    await abrirElBunga()

    expect(screen.getByLabelText('Escribe un comentario')).toBeInTheDocument()
  })
})

describe('llegar desde un aviso', () => {
  // §14.60: tocar el aviso de un comentario abre **ese** bunga, no la portada
  // ni la pestaña por donde se dejó la app.
  it('abre el bunga que trae el aviso', async () => {
    render(<GrupoSection eventId={ctx.eventId} area="bungas" abrir={ctx.bunga} onAbierta={vi.fn()} />)

    expect(await screen.findByText('Editar bunga')).toBeInTheDocument()
  })

  it('y un id que no es de aquí no abre nada', async () => {
    render(<GrupoSection eventId={ctx.eventId} area="bungas" abrir="bun_de_otro_viaje" />)

    await screen.findByText('Bunga 12')
    expect(screen.queryByText('Editar bunga')).toBeNull()
  })
})

