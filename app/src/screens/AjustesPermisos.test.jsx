import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'

/**
 * Quién puede cambiar qué en Ajustes (SPECS §14.42, §14.43 y §14.45).
 *
 * **Quién eres** no se elige cuando lo dice tu cuenta: la lista de personas y
 * el «Salir» de ese apartado solo tienen sentido donde la identidad es una
 * preferencia de este móvil —libreta local y demostración—, y un botón que se
 * deshace solo al instante es peor que no tenerlo. **Quien administra es la
 * excepción**: él sí elige, para poder mirar la app como la ve otro.
 *
 * **El evento** lo lleva quien administra: sus fechas apartan cenas y planes de
 * todo el grupo, así que no es una corrección personal.
 */
vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  listarCuentas: vi.fn(async () => ({ cuentas: [] })),
  hayApi: vi.fn(async () => false),
  leerMigraciones: vi.fn(async () => ({ migraciones: [] })),
}))

const { default: EventSettingsScreen } = await import('./EventSettingsScreen.jsx')
const { default: BotonDePerfil } = await import('../components/BotonDePerfil.jsx')
const { addFamily, addPerson, createEvent, db } = await import('../db.js')

let evento
let mariona
let curro

const entrarComo = (rol, personId) => localStorage.setItem(
  'ballena.sesion',
  JSON.stringify({ token: 't', cuenta: { id: 'cta_1', nombre: 'Mariona', rol, personId } }),
)

const pintar = () => render(
  <EventSettingsScreen eventId={evento.id} event={evento} sync={{ recheck: vi.fn() }} />,
)

// El perfil ya no es un apartado de Ajustes: vive detrás de tu emoji en la
// cabecera (§14.62). Se abre y se mira dentro de su capa.
const abrirElPerfil = async () => {
  render(<BotonDePerfil eventId={evento.id} />)
  await userEvent.click(await screen.findByRole('button', { name: /Tu perfil|Di quién eres/ }))
  return within(document.querySelector('.modal'))
}

beforeEach(async () => {
  localStorage.clear()
  evento = await db.events.get(await createEvent({
    name: 'Ballenita', startDate: '2026-08-01', endDate: '2026-08-08',
  }))
  const familia = await addFamily(evento.id, { name: 'García', color: '#E5544B' })
  mariona = await addPerson(evento.id, { name: 'Mariona', edad: 'adulto', familyId: familia })
  curro = await addPerson(evento.id, { name: 'Curro', edad: 'adulto', familyId: familia })
})
afterEach(() => localStorage.clear())

describe('quién eres, con la cuenta enlazada', () => {
  it('un miembro enlazado no elige ni sale: lo dice su cuenta', async () => {
    entrarComo('miembro', mariona)
    const perfil = await abrirElPerfil()

    expect(perfil.getByText(/tu cuenta está enlazada/)).toBeInTheDocument()
    expect(screen.queryByText('Cambiar de persona')).toBeNull()
    expect(screen.queryByText('Elige quién eres')).toBeNull()
    expect(perfil.queryByRole('button', { name: /Dejar de ser/ })).toBeNull()
  })

  // Cambió a propósito (§14.45): quien administra **sí** cambia de persona —es
  // como mira la app tal como la ve otro cuando alguien dice «a mí no me sale»—,
  // y a él la cuenta solo le siembra el hueco.
  it('quien administra sí elige, y su elección no se la deshace la cuenta', async () => {
    entrarComo('administrador', mariona)
    const perfil = await abrirElPerfil()

    expect(perfil.getByText('Cambiar de persona')).toBeInTheDocument()
    expect(perfil.getByRole('button', { name: /Dejar de ser/ })).toBeInTheDocument()

    // Se pone en la piel de otro y ahí se queda: la cuenta no le corrige.
    await userEvent.click(perfil.getByRole('button', { name: /Curro/ }))
    await waitFor(() => expect(localStorage.getItem(`ballena.me:${evento.id}`)).toBe(curro))
  })

  it('sin sesión —libreta local, demostración— sí se elige', async () => {
    const perfil = await abrirElPerfil()

    expect(perfil.getByText('Elige quién eres')).toBeInTheDocument()
    expect(perfil.getByText(/cada uno elige la suya/)).toBeInTheDocument()
  })

  it('con sesión pero sin persona de este evento, la lista es la salida', async () => {
    entrarComo('miembro', 'per_de_otro_evento')
    const perfil = await abrirElPerfil()

    expect(perfil.getByText('Elige quién eres')).toBeInTheDocument()
  })
})

/**
 * El evento lo lleva quien administra (SPECS §14.43): sus fechas apartan cenas
 * y planes de todo el grupo, así que no es una corrección personal.
 */
describe('editar el evento', () => {
  const fichaDelEvento = () => within(screen.getByText('Evento').closest('details'))

  // Acotado a su apartado: la nota de la versión que cuenta este mismo cambio
  // vive en «La app» y dice la misma frase — un `getByText` suelto la encuentra.
  it('un miembro lo ve pero no lo toca', async () => {
    entrarComo('miembro', mariona)
    pintar()

    await waitFor(() => expect(fichaDelEvento().getByText(/lo lleva quien administra/)).toBeInTheDocument())
    expect(fichaDelEvento().queryByRole('button', { name: /Ballenita/ })).toBeNull()
  })

  it('quien administra sí', async () => {
    entrarComo('administrador', mariona)
    pintar()

    await waitFor(() => expect(fichaDelEvento().getByRole('button', { name: /Ballenita/ })).toBeInTheDocument())
    expect(fichaDelEvento().queryByText(/lo lleva quien administra/)).toBeNull()
  })

  it('sin sesión —libreta local, demostración— también', async () => {
    pintar()

    await waitFor(() => expect(fichaDelEvento().getByRole('button', { name: /Ballenita/ })).toBeInTheDocument())
  })
})
