import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import 'fake-indexeddb/auto'

/**
 * El apartado «La app», por dentro (SPECS §14.34-bis), y las novedades fuera de
 * él (§14.34-ter).
 *
 * Lo que se fija aquí es el **orden**, que es lo único que se puede romper sin
 * que salte nada: las novedades estaban metidas entre el estado de la versión y
 * el botón de actualizar, así que de los dos bloques que hacen lo mismo —poner
 * la app al día y poner la base al día— uno salía partido en dos y el otro
 * entero. Ahora «La app» son esos dos y nada más, y lo que trajo cada versión es
 * un apartado que se abre por su cuenta.
 */
const leerMigraciones = vi.fn()
vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  listarCuentas: vi.fn(async () => ({ cuentas: [] })),
  hayApi: vi.fn(async () => true),
  leerMigraciones: (...a) => leerMigraciones(...a),
  aplicarSiguienteMigracion: vi.fn(),
}))

const { default: EventSettingsScreen } = await import('./EventSettingsScreen.jsx')
const { NOTAS } = await import('../lib/notas.js')

const pintar = () => render(
  <EventSettingsScreen eventId="ev_1" event={{ id: 'ev_1', name: 'Viaje 2026' }} sync={{ recheck: vi.fn() }} />,
)

/** Los rótulos del apartado, en el orden en que están en la página. */
const rotulos = () => [...document.querySelectorAll('.sec-h')].map((e) => e.textContent)

beforeEach(() => {
  leerMigraciones.mockReset()
  leerMigraciones.mockResolvedValue({ migraciones: [{ id: '0017_enlace_de_acceso', pendiente: false }] })
  localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { nombre: 'Óscar', rol: 'administrador' } }))
})
afterEach(() => localStorage.clear())

describe('el apartado «La app»', () => {
  it('lleva sus dos bloques rotulados, y las novedades ya no son uno de ellos', async () => {
    pintar()
    await screen.findByText('La base de datos está al día.')

    const mios = rotulos().filter((t) => ['Los datos del grupo', 'La versión', 'La base de datos', 'Qué ha cambiado'].includes(t))
    expect(mios).toEqual(['Los datos del grupo', 'La versión', 'La base de datos'])
  })

  it('«Qué ha cambiado» es un apartado suyo, y el último', async () => {
    pintar()
    await screen.findByText('La base de datos está al día.')

    const titulos = [...document.querySelectorAll('.acordeon-titulo')].map((e) => e.textContent)
    expect(titulos.at(-1)).toBe('Qué ha cambiado')
    // Dentro va la prosa de `notas.js`, que es de donde sale la primera tarjeta.
    expect(screen.getByText(NOTAS[0].titulo, { selector: '.rn-titulo' })).toBeInTheDocument()
  })

  it('las novedades van detrás de los dos botones de poner al día, no en medio', async () => {
    pintar()
    await screen.findByText('La base de datos está al día.')

    const boton = screen.getByRole('button', { name: 'Poner la app al día' })
    const notas = document.querySelector('.relnotas')
    // DOCUMENT_POSITION_FOLLOWING (4): las notas van después del botón.
    expect(boton.compareDocumentPosition(notas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // Los dos verbos son el mismo verbo, que es lo que dice que hacen lo mismo
  // sobre dos cosas distintas.
  it('los dos botones se llaman igual: poner al día', async () => {
    leerMigraciones.mockResolvedValue({ migraciones: [{ id: '0017_enlace_de_acceso', pendiente: true }] })
    pintar()

    expect(await screen.findByRole('button', { name: 'Poner la base al día' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Poner la app al día' })).toBeInTheDocument()
  })

  // El único silencio que se queda es el del primer instante (§14.37-bis): un
  // rótulo solo, con el hueco debajo mientras contesta la API, sería una quinta
  // forma de no decir nada.
  it('mientras la API no contesta, el rótulo de la base tampoco sale', async () => {
    leerMigraciones.mockReturnValue(new Promise(() => {}))
    pintar()

    await waitFor(() => expect(rotulos()).toContain('La versión'))
    expect(rotulos()).not.toContain('La base de datos')
  })
})
