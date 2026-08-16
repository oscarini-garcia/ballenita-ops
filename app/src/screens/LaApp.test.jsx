import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import 'fake-indexeddb/auto'

/**
 * El apartado «La app»: **cuatro hechos y dos botones** (SPECS §14.34-quater).
 *
 * Antes eran tres bloques con sus tres rótulos, tres estados, tres botones y
 * tres listas de progreso, y cada dato salía dentro de una frase. Lo que se
 * fija aquí es lo que se puede romper sin que salte nada: **qué renglones hay**
 * —binario, paquete OTA, última sincronización y base de datos—, que sean **dos
 * botones y no tres**, y que ninguno de los cinco estados de la base sea un
 * hueco en blanco.
 */
let nativo = false
let ota = null
let paquetes = null
vi.mock('../lib/native.js', async (original) => ({
  ...(await original()),
  isNative: () => nativo,
  versionInstalada: async () => ota,
  estadoDelPaquete: async () => paquetes,
}))

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

/** El motor sincronizando bien, que es el estado normal. */
const AL_DIA = { isConfigured: true, online: true, status: 'idle', ultima: Date.now() - 20 * 60_000, recheck: vi.fn() }

const pintar = (sync = AL_DIA) => render(
  <EventSettingsScreen eventId="ev_1" event={{ id: 'ev_1', name: 'Viaje 2026' }} sync={sync} />,
)

/** Los renglones de la ficha, con su rótulo, su dato y su segunda línea. */
const hechos = () => [...document.querySelectorAll('.hecho')].map((h) => ({
  titulo: h.querySelector('dt').textContent,
  valor: h.querySelector('dd').firstChild?.textContent ?? '',
  sub: h.querySelector('dd .sub')?.textContent ?? null,
}))

const dato = (titulo) => hechos().find((h) => h.titulo === titulo)

beforeEach(() => {
  nativo = false
  ota = null
  paquetes = null
  leerMigraciones.mockReset()
  leerMigraciones.mockResolvedValue({ migraciones: [{ id: '0018_receta_del_plato', pendiente: false }] })
  localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { nombre: 'Óscar', rol: 'administrador' } }))
})
afterEach(() => localStorage.clear())

describe('el apartado «La app»', () => {
  it('en el móvil son cuatro hechos: binario, paquete, sincronización y base', async () => {
    // Los dos números son distintos a propósito: es justo la diferencia que
    // separa «no ha actualizado» de «el binario se ha quedado atrás», y antes
    // solo se decía —dentro de una frase— cuando no coincidían.
    nativo = true
    ota = '0.51.0'
    paquetes = { nativa: '0.44.0', actual: null, bundles: [] }
    pintar()

    await waitFor(() => expect(dato('Binario')?.valor).toBe('v0.44.0'))
    expect(dato('Paquete OTA').valor).toBe('v0.51.0')
    expect(hechos().map((h) => h.titulo)).toEqual(
      ['Binario', 'Paquete OTA', 'Última sincronización', 'Base de datos'],
    )
  })

  it('en la web no hay binario ni paquete, y se dice en vez de dejar dos guiones', async () => {
    pintar()
    await waitFor(() => expect(dato('Versión')).toBeTruthy())
    expect(dato('Versión').sub).toMatch(/no hay paquete OTA/)
    expect(dato('Binario')).toBeUndefined()
  })

  it('son dos botones y no tres: sincronizar lo hace el punto de la cabecera', async () => {
    pintar()
    await waitFor(() => expect(dato('Base de datos')?.valor).toBe('Al día'))

    const laApp = [...document.querySelectorAll('.acordeon')]
      .find((a) => a.querySelector('.acordeon-titulo')?.textContent === 'La app')
    const botones = [...laApp.querySelectorAll('.btn.block')].map((b) => b.textContent)
    expect(botones).toEqual(['Poner la app al día', 'Poner la base al día'])
    expect(screen.queryByRole('button', { name: /Sincronizar todo/ })).toBeNull()
  })

  it('la última sincronización va en palabras, y el estado solo cuando no va bien', async () => {
    pintar()
    await waitFor(() => expect(dato('Última sincronización')?.valor).toBe('hace 20 min'))
    // Yendo bien, la segunda línea sobra: «Al día» debajo de la hora no añade nada.
    expect(dato('Última sincronización').sub).toBe(null)

    document.body.innerHTML = ''
    pintar({ ...AL_DIA, online: false, pendientes: 3 })
    await waitFor(() => expect(dato('Última sincronización')?.sub).toMatch(/Sin conexión/))
  })
})

describe('la base de datos, dentro de «La app»', () => {
  it('al día apaga su botón en vez de quitarlo', async () => {
    pintar()
    await waitFor(() => expect(dato('Base de datos')?.valor).toBe('Al día'))
    // El botón se queda: aparecer solo a veces obliga a saber de antemano si iba
    // a estar, y este apartado se abre justo para buscarlo.
    expect(screen.getByRole('button', { name: 'Poner la base al día' })).toBeDisabled()
  })

  it('por detrás lo enciende y dice cuántas y cuáles', async () => {
    leerMigraciones.mockResolvedValue({
      migraciones: [
        { id: '0017_enlace_de_acceso', pendiente: false },
        { id: '0018_receta_del_plato', pendiente: true },
      ],
    })
    pintar()

    await waitFor(() => expect(dato('Base de datos')?.valor).toBe('1 por detrás'))
    expect(dato('Base de datos').sub).toBe('0018_receta_del_plato')
    expect(screen.getByRole('button', { name: 'Poner la base al día' })).toBeEnabled()
  })

  it('mientras la API no contesta lo dice, que es el hueco que quedaba', async () => {
    // §14.37-bis dejó vivo un silencio: el del primer instante. Con la ficha ya
    // no hace falta —el renglón existe siempre y solo cambia su palabra—.
    leerMigraciones.mockReturnValue(new Promise(() => {}))
    pintar()
    await waitFor(() => expect(dato('Base de datos')?.valor).toBe('Preguntando…'))
  })

  it('quien no administra ve por qué, y no se pregunta a la API', async () => {
    localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { nombre: 'Ana', rol: 'miembro' } }))
    leerMigraciones.mockClear()
    pintar()

    await waitFor(() => expect(dato('Base de datos')?.valor).toBe('No te toca'))
    expect(dato('Base de datos').sub).toMatch(/quien administra/)
    expect(screen.queryByRole('button', { name: 'Poner la base al día' })).toBeNull()
    expect(leerMigraciones).not.toHaveBeenCalled()
  })
})

describe('«Qué ha cambiado»', () => {
  it('es un apartado suyo, y el último', async () => {
    pintar()
    await waitFor(() => expect(dato('Base de datos')?.valor).toBe('Al día'))

    const titulos = [...document.querySelectorAll('.acordeon-titulo')].map((e) => e.textContent)
    expect(titulos.at(-1)).toBe('Qué ha cambiado')
    // Dentro va la prosa de `notas.js`, que es de donde sale la primera tarjeta.
    expect(screen.getByText(NOTAS[0].titulo, { selector: '.rn-titulo' })).toBeInTheDocument()
  })

  it('y va detrás de los dos botones de poner al día, no en medio', async () => {
    pintar()
    await waitFor(() => expect(dato('Base de datos')?.valor).toBe('Al día'))

    const boton = screen.getByRole('button', { name: 'Poner la base al día' })
    const notas = document.querySelector('.relnotas')
    // DOCUMENT_POSITION_FOLLOWING (4): las notas van después del botón.
    expect(boton.compareDocumentPosition(notas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
