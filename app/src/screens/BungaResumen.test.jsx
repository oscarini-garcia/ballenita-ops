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
  it('sin resumen enseña el mote de siempre', async () => {
    pintarBungas()
    expect(await screen.findByText('el de la piscina')).toBeInTheDocument()
  })

  it('con resumen, lo enseña en su sitio', async () => {
    const sitio = (await listAlojamientos()).find((a) => a.id === ctx.aloj)
    await updateAlojamiento(ctx.aloj, {
      resumen: 'nevera de sobra, bichos de propina', resumenDe: huellaDelSitio(sitio),
    })
    pintarBungas()

    const frase = await screen.findByText('nevera de sobra, bichos de propina')
    expect(frase).toBeInTheDocument()
    expect(frase.className).not.toMatch(/viejo/)
  })

  // Una frase convincente y desfasada es peor que ninguna en una lista que se
  // mira para decidir con cuál te quedas.
  it('un resumen escrito antes de la última nota sale marcado', async () => {
    await updateAlojamiento(ctx.aloj, { resumen: 'nevera de sobra', resumenDe: 'huella_vieja' })
    pintarBungas()

    const frase = await screen.findByText('nevera de sobra')
    expect(frase.className).toMatch(/viejo/)
  })

  // El emoji y las dos letras, que es la misma pareja que firma una idea y un
  // voto: las cosas de una familia se reconocen sin leer ningún nombre.
  it('dice de quién es con el emoji y el alias de su familia', async () => {
    pintarBungas()

    const suya = await screen.findByRole('button', { name: 'Es de los García' })
    expect(within(suya).getByText('🏖️')).toBeInTheDocument()
    expect(within(suya).getByText('GA')).toBeInTheDocument()
    // El nombre entero ya no está: no cabe al lado de una frase larga.
    expect(suya).not.toHaveTextContent('García')
  })

  it('y cuenta los comentarios que tiene', async () => {
    await addComentario(ctx.eventId, { ancla: anclaDe('bunga', ctx.bunga), texto: '¿os importa cambiarlo?' })
    pintarBungas()

    expect(await screen.findByText(/💬 1/)).toBeInTheDocument()
  })
})

describe('resumirlo con guasa', () => {
  const abrirElBunga = async () => {
    await waitFor(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Bunga 12/ }))
      expect(screen.getByText('Editar bunga')).toBeInTheDocument()
    })
  }

  it('lo pide al pulsar, y lo guarda en el sitio para que lo lean todos', async () => {
    resumenDeBunga.mockResolvedValue('nevera de sobra, bichos de propina')
    pintarBungas()
    await abrirElBunga()

    await userEvent.click(screen.getByRole('button', { name: 'Resumirlo con guasa' }))

    await waitFor(async () => {
      const sitio = (await listAlojamientos()).find((a) => a.id === ctx.aloj)
      expect(sitio.resumen).toBe('nevera de sobra, bichos de propina')
      // Con la huella de lo que se resumió, que es lo que deja decir «esto ya
      // no cuenta lo último».
      expect(sitio.resumenDe).toBe(huellaDelSitio(sitio))
    })
    // Y lo que se le manda al modelo es lo que hay escrito, sin nombres.
    expect(resumenDeBunga).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Bunga 12', notas: 'la nevera congela mucho',
    }))
    expect(resumenDeBunga.mock.calls[0][0]).not.toHaveProperty('familia')
  })

  // Con el sitio en blanco lo único que puede hacer el modelo es inventarse cómo
  // es el bungalow, que es justo lo que no se quiere leer al repartirlos.
  it('con el sitio en blanco el botón no se puede pulsar', async () => {
    await updateAlojamiento(ctx.aloj, { notas: '', pegatinas: [] })
    pintarBungas()
    await abrirElBunga()

    expect(screen.getByRole('button', { name: 'Resumirlo con guasa' })).toBeDisabled()
    expect(screen.getByText(/Pon alguna pegatina/)).toBeInTheDocument()
  })

  it('si el modelo falla, se dice con sus palabras', async () => {
    resumenDeBunga.mockRejectedValue(new Error('la API respondió 409: no hay clave de IA configurada'))
    pintarBungas()
    await abrirElBunga()

    await userEvent.click(screen.getByRole('button', { name: 'Resumirlo con guasa' }))

    expect(await screen.findByText(/no hay clave de IA/)).toBeInTheDocument()
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

