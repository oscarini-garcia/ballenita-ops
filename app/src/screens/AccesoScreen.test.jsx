import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccesoScreen from './AccesoScreen.jsx'
import { modoLocal } from '../auth/sesion.js'
import { leerEspera } from '../auth/espera.js'

vi.mock('../auth/apple.js', () => ({ entrarConApple: vi.fn() }))
vi.mock('../lib/pwa.js', () => ({ forzarActualizacion: vi.fn().mockResolvedValue('reloaded') }))
const { entrarConApple } = await import('../auth/apple.js')
const { forzarActualizacion } = await import('../lib/pwa.js')

const CONFIG = { api: 'https://ejemplo.workers.dev' }

/** El error que devuelve `entrarConApple` cuando la solicitud queda apuntada. */
const enEspera = (extra = {}) => Object.assign(new Error('Hemos apuntado tu petición.'), {
  enEspera: true, nombre: 'Curro García', pase: 'pase.de.prueba', ...extra,
})

/** Lo que contesta `POST /api/sesion/espera`, sin red. */
const contesta = (cuerpo, ok = true) => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok, status: ok ? 200 : 401, json: async () => cuerpo,
  })
}

beforeEach(() => {
  entrarConApple.mockReset()
  localStorage.clear()
})

afterEach(() => { delete globalThis.fetch })

describe('AccesoScreen', () => {
  it('entra con Apple y entrega la sesión', async () => {
    const sesion = { token: 'jwt', cuenta: { id: 'cta_1', nombre: 'Curro' } }
    entrarConApple.mockResolvedValue(sesion)
    const onEntrar = vi.fn()

    render(<AccesoScreen configuracion={CONFIG} onEntrar={onEntrar} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))

    expect(onEntrar).toHaveBeenCalledWith(sesion)
  })

  it('enseña el motivo cuando Apple falla', async () => {
    entrarConApple.mockRejectedValue(new Error('Apple canceló el acceso (error 1001).'))

    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/1001/)
  })

  it('un identificador sin dar de alta se enseña para pasarlo al grupo', async () => {
    const error = new Error('Este identificador todavía no tiene acceso.')
    error.identificador = '000123.abc'
    entrarConApple.mockRejectedValue(error)

    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))

    expect(await screen.findByText('000123.abc')).toBeInTheDocument()
  })

  // ── El pie y sus hojas (§14.29 · A3) ───────────────────────────────────────

  // Lo importante de esta pantalla: no puede ser un callejón sin salida. Si
  // Apple no deja pasar por algo que no se arregla desde el móvil, se sigue en
  // local y lo apuntado sube el día que se entre.
  it('deja seguir en local sin entrar, y lo recuerda', async () => {
    const onLocal = vi.fn()
    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} onLocal={onLocal} />)

    expect(modoLocal()).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: /Usar solo en este móvil/i }))
    await userEvent.click(await screen.findByRole('button', { name: /Seguir solo en este móvil/ }))

    expect(onLocal).toHaveBeenCalled()
    expect(modoLocal()).toBe(true)
    expect(entrarConApple).not.toHaveBeenCalled()
  })

  it('se puede traer la última versión sin haber entrado', async () => {
    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Buscar la última versión/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Buscar ahora/ }))
    expect(forzarActualizacion).toHaveBeenCalled()
  })

  // La explicación no desaparece: se lee en su hoja, sin competir con la puerta.
  it('la explicación de cada salida vive en su hoja, no en la puerta', async () => {
    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} />)

    expect(screen.queryByText(/Ballena Ops es tu libreta/)).toBe(null)
    await userEvent.click(screen.getByRole('button', { name: /Usar solo en este móvil/i }))
    expect(await screen.findByText(/Ballena Ops es tu libreta/)).toBeInTheDocument()
  })

  // ── La sala de espera es la pantalla (§14.29 · B2) ─────────────────────────

  it('quien no está enlazado todavía espera en la sala, no ve un error', async () => {
    entrarConApple.mockRejectedValue(enEspera())

    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))

    expect(await screen.findByText('Ya estás en la lista')).toBeInTheDocument()
    expect(screen.getByText(/Curro García/)).toBeInTheDocument()
    // Es un estado, no un fallo: no hay alerta ni código que copiar.
    expect(screen.queryByRole('alert')).toBe(null)
    expect(screen.getByRole('button', { name: /¿Ya me han dejado entrar\?/ })).toBeInTheDocument()
  })

  // La sala de espera **sustituye** a la puerta: si sigue estando «Entrar con
  // Apple», lo que se lee primero es cómo entrar, dirigido a quien ya lo ha
  // intentado y no puede.
  it('en la sala de espera no está el botón de Apple, y sí las salidas que sirven', async () => {
    entrarConApple.mockRejectedValue(enEspera())

    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))
    await screen.findByText('Ya estás en la lista')

    expect(screen.queryByRole('button', { name: /Entrar con Apple/i })).toBe(null)
    expect(screen.getByRole('button', { name: /Usar solo en este móvil/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Buscar la última versión/ })).toBeInTheDocument()
    // Quien ya está apuntado no está mirando la app por curiosidad.
    expect(screen.queryByRole('button', { name: /demostración/i })).toBe(null)
  })

  // Sin esto, cada arranque se lee como si nunca lo hubieras intentado — y lo
  // que invita es a volver a pasar por la hoja de Apple.
  it('la sala de espera se recuerda al reabrir la app', async () => {
    entrarConApple.mockRejectedValue(enEspera())

    const { unmount } = render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))
    await screen.findByText('Ya estás en la lista')
    unmount()

    expect(leerEspera()).toMatchObject({ nombre: 'Curro García', pase: 'pase.de.prueba' })

    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} />)
    expect(screen.getByText('Ya estás en la lista')).toBeInTheDocument()
  })

  // ── Mirar sin Apple (§14.29 · B4) ─────────────────────────────────────────

  it('«¿ya me han dejado entrar?» pregunta al Worker, no a Apple', async () => {
    entrarConApple.mockRejectedValue(enEspera())
    const onEntrar = vi.fn()

    render(<AccesoScreen configuracion={CONFIG} onEntrar={onEntrar} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))
    await screen.findByText('Ya estás en la lista')

    const sesion = { estado: 'dentro', token: 'jwt', cuenta: { id: 'cta_1', nombre: 'Curro' } }
    contesta(sesion)
    entrarConApple.mockClear()

    await userEvent.click(screen.getByRole('button', { name: /¿Ya me han dejado entrar\?/ }))

    await waitFor(() => expect(onEntrar).toHaveBeenCalledWith(sesion))
    expect(entrarConApple).not.toHaveBeenCalled()
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ejemplo.workers.dev/api/sesion/espera',
      expect.objectContaining({ method: 'POST' }),
    )
    // Y la espera se olvida: ya no hay nada por lo que preguntar.
    expect(leerEspera()).toBe(null)
  })

  it('mira sola cada pocos segundos y entra en cuanto la enlazan', async () => {
    entrarConApple.mockRejectedValue(enEspera())
    const onEntrar = vi.fn()

    // Un intervalo corto para no tener que esperar veinte segundos en un test;
    // el de verdad es `CADA`.
    render(<AccesoScreen configuracion={CONFIG} onEntrar={onEntrar} intervalo={20} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))
    await screen.findByText('Ya estás en la lista')

    contesta({ estado: 'espera', nombre: 'Curro García' })
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    expect(onEntrar).not.toHaveBeenCalled()

    contesta({ estado: 'dentro', token: 'jwt', cuenta: { id: 'cta_1' } })
    await waitFor(() => expect(onEntrar).toHaveBeenCalled())
  })

  // Si la solicitud desaparece, seguir preguntando por ella es preguntar por
  // nada: se vuelve a la puerta, que es donde se consigue un pase nuevo.
  it('si la solicitud ya no existe, vuelve a la puerta', async () => {
    entrarConApple.mockRejectedValue(enEspera())

    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} intervalo={20} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))
    await screen.findByText('Ya estás en la lista')

    contesta({ estado: 'desconocida' })
    expect(await screen.findByRole('button', { name: /Entrar con Apple/i })).toBeInTheDocument()
    expect(leerEspera()).toBe(null)
  })

  it('si le han cerrado la puerta, lo dice y deja de esperar', async () => {
    entrarConApple.mockRejectedValue(enEspera())

    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} intervalo={20} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))
    await screen.findByText('Ya estás en la lista')

    contesta({ estado: 'desactivada' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/desactivado/i)
  })

  // Que la red falle un momento no es una noticia que dar aquí: lo único que
  // cambia es que se sigue esperando.
  it('un fallo de red no saca a nadie de la sala de espera', async () => {
    entrarConApple.mockRejectedValue(enEspera())

    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} intervalo={20} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))
    await screen.findByText('Ya estás en la lista')

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('sin red'))
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())

    expect(screen.getByText('Ya estás en la lista')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBe(null)
  })

  // Un servidor viejo no manda pase. La sala de espera sigue valiendo: lo que se
  // pierde es mirar sola, no la pantalla.
  it('sin pase, la sala de espera sigue saliendo y no mira sola', async () => {
    entrarConApple.mockRejectedValue(enEspera({ pase: undefined }))
    globalThis.fetch = vi.fn()

    render(<AccesoScreen configuracion={CONFIG} onEntrar={vi.fn()} intervalo={20} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar con Apple/i }))

    expect(await screen.findByText('Ya estás en la lista')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /¿Ya me han dejado entrar\?/ })).toBeDisabled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
