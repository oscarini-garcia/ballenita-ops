import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import 'fake-indexeddb/auto'

/**
 * Quién eres no se elige cuando lo dice tu cuenta (SPECS §14.42).
 *
 * La lista de personas y el botón «Salir» solo tienen sentido donde la
 * identidad es una preferencia de este móvil: la libreta local y la
 * demostración. Con sesión, quién eres es el enlace que hizo quien administra,
 * y un botón que se deshace solo al instante es peor que no tenerlo.
 */
vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  listarCuentas: vi.fn(async () => ({ cuentas: [] })),
  hayApi: vi.fn(async () => false),
  leerMigraciones: vi.fn(async () => ({ migraciones: [] })),
}))

const { default: EventSettingsScreen } = await import('./EventSettingsScreen.jsx')
const { addFamily, addPerson, createEvent, db } = await import('../db.js')

let evento
let mariona

const entrarComo = (rol, personId) => localStorage.setItem(
  'ballena.sesion',
  JSON.stringify({ token: 't', cuenta: { id: 'cta_1', nombre: 'Mariona', rol, personId } }),
)

const pintar = () => render(
  <EventSettingsScreen eventId={evento.id} event={evento} sync={{ recheck: vi.fn() }} />,
)

// Acotado a su apartado: «Salir» existe también en Cuentas —ahí cierra la
// sesión, que es otra cosa— y buscarlo suelto encuentra el que no es.
const apartado = () => within(screen.getByText('Quién eres').closest('details'))

beforeEach(async () => {
  localStorage.clear()
  evento = await db.events.get(await createEvent({
    name: 'Ballenita', startDate: '2026-08-01', endDate: '2026-08-08',
  }))
  const familia = await addFamily(evento.id, { name: 'García', color: '#E5544B' })
  mariona = await addPerson(evento.id, { name: 'Mariona', edad: 'adulto', familyId: familia })
  await addPerson(evento.id, { name: 'Curro', edad: 'adulto', familyId: familia })
})
afterEach(() => localStorage.clear())

describe('quién eres, con la cuenta enlazada', () => {
  it('un miembro enlazado no elige ni sale: lo dice su cuenta', async () => {
    entrarComo('miembro', mariona)
    pintar()

    await waitFor(() => expect(screen.getByText(/tu cuenta está enlazada/)).toBeInTheDocument())
    expect(screen.queryByText('Cambiar de persona')).toBeNull()
    expect(screen.queryByText('Elige quién eres')).toBeNull()
    expect(apartado().queryByRole('button', { name: 'Salir' })).toBeNull()
  })

  it('el administrador enlazado, igual', async () => {
    entrarComo('administrador', mariona)
    pintar()

    await waitFor(() => expect(screen.getByText(/tu cuenta está enlazada/)).toBeInTheDocument())
    expect(screen.queryByText('Cambiar de persona')).toBeNull()
  })

  it('sin sesión —libreta local, demostración— sí se elige', async () => {
    pintar()

    await waitFor(() => expect(screen.getByText('Elige quién eres')).toBeInTheDocument())
    expect(apartado().getByText(/cada uno elige la suya/)).toBeInTheDocument()
  })

  it('con sesión pero sin persona de este evento, la lista es la salida', async () => {
    entrarComo('miembro', 'per_de_otro_evento')
    pintar()

    await waitFor(() => expect(screen.getByText('Elige quién eres')).toBeInTheDocument())
  })
})
