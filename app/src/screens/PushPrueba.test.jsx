import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'

/**
 * «Dice que ha mandado el aviso, pero no llega».
 *
 * «Mandado» era todo lo que sabía decir la prueba, y eso es solo que **Apple lo
 * aceptó**: un 200 del servidor de APNs. El tramo de después —que el teléfono lo
 * reciba— no se miraba, y ahí caben dos cosas que se ven igual y se arreglan en
 * sitios distintos: que no llegue (el entorno de APNs, que además no da ningún
 * error) o que llegue y **con la app abierta iOS no pinte nada**, que es cosa de
 * `presentationOptions` en `capacitor.config.json` y del binario.
 */
const puente = { llega: true }

vi.mock('../lib/native.js', async (original) => ({
  ...(await original()),
  isNative: () => true,
  tap: async () => {},
  estadoDePush: async () => 'granted',
  registerPush: async ({ alPaso } = {}) => { alPaso?.('apple'); return 'tok_apns' },
  escucharUnAviso: async () => ({
    llegada: Promise.resolve(puente.llega ? { title: 'hola' } : null),
    soltar: async () => {},
  }),
}))

const probarPush = vi.fn(async () => ({ enviados: 1 }))
vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  listarCuentas: vi.fn(async () => ({ cuentas: [] })),
  hayApi: vi.fn(async () => true),
  registrarPush: vi.fn(async () => ({ ok: true })),
  probarPush: (...a) => probarPush(...a),
}))

const { NotificacionesSection } = await import('./CuentasSection.jsx')

beforeEach(() => {
  puente.llega = true
  probarPush.mockReset()
  probarPush.mockResolvedValue({ enviados: 1 })
  localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { nombre: 'Óscar', rol: 'admin' } }))
})
afterEach(() => localStorage.clear())

const mandar = async () => {
  render(<NotificacionesSection />)
  await userEvent.click(await screen.findByRole('button', { name: /aviso de prueba/ }))
}

describe('el aviso de prueba', () => {
  it('cuando llega, lo dice — y explica por qué no se ve con la app abierta', async () => {
    await mandar()
    const dicho = await screen.findByRole('status')
    await waitFor(() => expect(dicho).toHaveTextContent(/Ha llegado a este móvil/))
    expect(dicho).toHaveTextContent(/ciérrala del todo/)
  })

  it('cuando Apple lo acepta y no llega, no lo canta como un éxito', async () => {
    puente.llega = false
    await mandar()
    const dicho = await screen.findByRole('status')
    // Lo primero que nombra es el entorno, que es la causa que más veces es y la
    // única que no da ningún error: APNs contesta que sí y tira el aviso.
    await waitFor(() => expect(dicho).toHaveTextContent(/APNS_ENTORNO/))
    expect(dicho).not.toHaveTextContent(/Ha llegado/)
  })

  it('la espera es un paso más de la lista, no un silencio', async () => {
    await mandar()
    const renglones = await screen.findAllByRole('listitem')
    const textos = renglones.map((li) => li.textContent)
    expect(textos.some((t) => /Mandando el aviso/.test(t))).toBe(true)
    expect(textos.some((t) => /Esperando a que llegue/.test(t))).toBe(true)
  })

  it('si no llega, el renglón queda en aviso y no en fallo: salió bien', async () => {
    puente.llega = false
    await mandar()
    const renglones = await screen.findAllByRole('listitem')
    const ultimo = renglones[renglones.length - 1]
    await waitFor(() => expect(ultimo).toHaveAttribute('data-estado', 'aviso'))
  })

  it('si el servidor no lo manda, no se espera a nada', async () => {
    probarPush.mockResolvedValue({ enviados: 0, motivo: 'sin claves de APNs' })
    await mandar()
    const dicho = await screen.findByRole('status')
    await waitFor(() => expect(dicho).toHaveTextContent(/No salió: sin claves de APNs/))
    const textos = (await screen.findAllByRole('listitem')).map((li) => li.textContent)
    expect(textos.some((t) => /Esperando a que llegue/.test(t))).toBe(false)
  })
})
