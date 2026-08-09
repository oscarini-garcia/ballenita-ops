import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'

/**
 * «Se me queda colgado en Pidiendo…».
 *
 * El registro tiene cuatro eslabones —la parte nativa, el permiso de iOS, el
 * identificador de Apple y el servidor— y hasta ahora los cuatro se veían igual:
 * un botón girando. Cada uno se arregla en un sitio distinto, así que decir en
 * cuál se ha quedado no es adorno, es la mitad del arreglo (SPECS §14.9-bis).
 */
const puente = {
  permiso: 'prompt',
  token: 'tok_apns',
  pasos: ['plugin', 'permiso', 'apple'],
  romper: null,
  alRegistrar: null,
}

vi.mock('../lib/native.js', async (original) => ({
  ...(await original()),
  isNative: () => true,
  tap: async () => {},
  estadoDePush: async () => puente.permiso,
  registerPush: async ({ alPaso } = {}) => {
    for (const p of puente.pasos) alPaso?.(p)
    puente.alRegistrar?.()
    if (puente.romper) throw new Error(puente.romper)
    return puente.token
  },
}))

const registrarPush = vi.fn(async () => ({ ok: true }))
vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  listarCuentas: vi.fn(async () => ({ cuentas: [] })),
  hayApi: vi.fn(async () => true),
  registrarPush: (...a) => registrarPush(...a),
}))

const { NotificacionesSection } = await import('./CuentasSection.jsx')

beforeEach(() => {
  puente.permiso = 'prompt'
  puente.token = 'tok_apns'
  puente.pasos = ['plugin', 'permiso', 'apple']
  puente.romper = null
  puente.alRegistrar = null
  registrarPush.mockClear()
  registrarPush.mockResolvedValue({ ok: true })
  localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { nombre: 'Óscar', rol: 'admin' } }))
})
afterEach(() => localStorage.clear())

const encender = async () => {
  render(<NotificacionesSection />)
  await userEvent.click(await screen.findByRole('button', { name: 'Encender' }))
}

describe('la lista de pasos de los avisos', () => {
  it('cuenta los cuatro eslabones, el del servidor incluido', async () => {
    await encender()
    await waitFor(() => expect(registrarPush).toHaveBeenCalledWith('tok_apns', true))
    const dichos = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(dichos).toHaveLength(4)
    expect(dichos[3]).toMatch(/servidor/i)
  })

  it('el eslabón donde se rompe queda marcado, y se toca para copiarlo', async () => {
    puente.romper = "Apple rechazó el registro: no valid 'aps-environment' entitlement"
    await encender()

    const renglones = await screen.findAllByRole('listitem')
    const ultimo = renglones[renglones.length - 1]
    await waitFor(() => expect(ultimo).toHaveAttribute('data-estado', 'fallo'))
    // Copiable: un mensaje de Apple no se transcribe a mano desde un móvil.
    expect(ultimo).toHaveAttribute('data-copiable', 'si')
    expect(await screen.findByRole('alert')).toHaveTextContent(/aps-environment/)
  })

  it('si es el servidor el que falla, el fallo cae en su renglón y no en el de Apple', async () => {
    registrarPush.mockRejectedValue(new Error('la API no contestó en 20 s (/api/push)'))
    await encender()

    const renglones = await screen.findAllByRole('listitem')
    expect(renglones).toHaveLength(4)
    await waitFor(() => expect(renglones[3]).toHaveAttribute('data-estado', 'fallo'))
    expect(renglones[2]).toHaveAttribute('data-estado', 'hecho')
    expect(await screen.findByRole('alert')).toHaveTextContent(/no contestó en 20 s/)
  })

  it('permiso dado y ningún identificador se cuenta en el renglón de Apple', async () => {
    puente.token = null
    await encender()

    const renglones = await screen.findAllByRole('listitem')
    // Tres: no se llega al servidor, así que no se nombra.
    expect(renglones).toHaveLength(3)
    await waitFor(() => expect(renglones[2]).toHaveAttribute('data-estado', 'fallo'))
    // Y lo que dice **no** es que le falte el permiso al binario: eso llega con
    // mensaje, no con silencio. Lo primero que se mira es el AppDelegate.
    const dicho = await screen.findByRole('alert')
    expect(dicho).toHaveTextContent(/AppDelegate/)
    expect(dicho).not.toHaveTextContent(/le falta el permiso de avisos/)
  })

  it('un «no» del usuario no se pinta como un fallo: es una respuesta', async () => {
    // Como pasa de verdad: se toca «Encender» con el permiso sin pedir, sale la
    // hoja de iOS y se contesta que no.
    puente.token = null
    puente.pasos = ['plugin', 'permiso']
    puente.alRegistrar = () => { puente.permiso = 'denied' }
    await encender()

    const renglones = await screen.findAllByRole('listitem')
    await waitFor(() => expect(renglones[renglones.length - 1]).toHaveAttribute('data-estado', 'aviso'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
