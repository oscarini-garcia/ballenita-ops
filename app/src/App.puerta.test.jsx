import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'
import { activarModoLocal, guardarSesion } from './auth/sesion.js'
import { enDemo } from './lib/demo.js'
import { createEvent } from './db.js'

// La puerta solo aparece en la app de iOS y con una API configurada, así que
// hay que fingir las dos cosas: en el resto de tests `isNative()` es false y la
// app entra directa, que es el comportamiento de la web.
vi.mock('./lib/native.js', async (original) => ({
  ...(await original()),
  isNative: () => true,
}))
vi.mock('./lib/config.js', async (original) => ({
  ...(await original()),
  cargarConfiguracion: async () => ({ api: 'https://ejemplo.workers.dev' }),
}))
vi.mock('./auth/apple.js', () => ({ entrarConApple: vi.fn() }))
// El transporte se finge sin API: así la primera bajada termina bien y en
// seguida —«esta instalación va solo local, no hay nada que traer»— sin tocar la
// red y, sobre todo, **sin sustituir la copia local** por una instantánea vacía,
// que es lo que se llevaría por delante los eventos que siembran estos tests.
// Con `isNative()` fingido, apuntar el token de APNs intenta hablar con un
// plugin nativo que aquí no existe. No es lo que se prueba en este fichero.
vi.mock('./lib/push.js', () => ({ asegurarPush: vi.fn(async () => ({ estado: 'no-aplica' })) }))
vi.mock('./sync/api.js', async (original) => ({
  ...(await original()),
  hayApi: vi.fn(async () => false),
  traerInstantanea: vi.fn(),
  enviarCambios: vi.fn(),
}))
const { hayApi } = await import('./sync/api.js')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  hayApi.mockImplementation(async () => false)
})

describe('App — la puerta de acceso', () => {
  it('en iOS con API y sin sesión, pide entrar', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: /Entrar con Apple/i })).toBeInTheDocument()
    expect(screen.queryByText('Tus eventos 🐳')).not.toBeInTheDocument()
  })

  // Con una sincronización ya hecha, este móvil no es nuevo: se entra directo.
  it('con sesión guardada y algo ya bajado no pregunta nada', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', nombre: 'Curro' } })
    localStorage.setItem('ballena.sync.ultima', String(Date.now()))
    render(<App />)
    expect(await screen.findByText('Tus eventos 🐳')).toBeInTheDocument()
  })

  // Y sin ella, lo que toca es contar la primera bajada en vez de enseñar una
  // libreta vacía que invita a crear un evento duplicado (§14.29 · C2).
  it('con sesión pero sin haber bajado nunca nada, cuenta la primera bajada', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', nombre: 'Curro García' } })
    // La bienvenida se retira sola en cuanto la bajada termina, y con el
    // transporte fingido termina en el mismo tick: sin dejarla a medias, lo que
    // se estaría probando es quién gana la carrera.
    // Fijo y no `…Once`: el motor de sincronización también llama a `hayApi` al
    // montar, y con una sola vez se la quedaba él.
    hayApi.mockImplementation(() => new Promise(() => {}))
    render(<App />)

    expect(await screen.findByText('Ya estás dentro, Curro')).toBeInTheDocument()
    expect(screen.getByText(/Trayendo lo del grupo/)).toBeInTheDocument()
  })

  // El caso que importa: Apple falla por algo que no se arregla desde el móvil
  // (falta la capacidad en el binario) y aun así se puede usar la libreta.
  it('«usar solo en este móvil» abre la app sin entrar', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Usar solo en este móvil/i }))
    await userEvent.click(await screen.findByRole('button', { name: /Seguir solo en este móvil/ }))

    expect(await screen.findByText('Tus eventos 🐳')).toBeInTheDocument()
  })

  it('la decisión se recuerda: al siguiente arranque ya no pasa por la puerta', async () => {
    activarModoLocal()
    render(<App />)
    expect(await screen.findByText('Tus eventos 🐳')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Entrar con Apple/i })).not.toBeInTheDocument()
  })

  // La otra salida, y la que Apple va a usar: quien no es del grupo no puede
  // entrar, así que sin esto la revisión ve una pantalla de acceso y nada más
  // (directriz 2.1). Se distingue de la local en que **abre ya con datos**: una
  // app vacía no enseña lo que hace.
  it('la demostración abre la app con el camping de ejemplo', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Ver una demostración/i }))
    await userEvent.click(await screen.findByRole('button', { name: /Abrir la demostración/ }))

    // El nombre importa: en la lista de eventos «Demo» se distingue de un viaje
    // de verdad, y «Ballenita 2026» no.
    expect(await screen.findByText('Demo')).toBeInTheDocument()
    expect(enDemo()).toBe(true)
  })

  it('durante la demostración la cabecera lo dice, y el punto de sync no está', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Ver una demostración/i }))
    await userEvent.click(await screen.findByRole('button', { name: /Abrir la demostración/ }))

    // La pastilla ocupa el sitio del punto: en una demostración no hay nada que
    // sincronizar, y un punto en verde sería mentira.
    expect(await screen.findByRole('button', { name: /demostración/i })).toBeInTheDocument()
    expect(document.querySelector('.sync-dot')).toBeNull()
  })
})

// ── Después de que te acepten (SPECS §14.29 · C2 y C4) ───────────────────────
describe('App — el primer arranque tras ser aceptado', () => {

  it('al terminar la primera bajada entra sola si el grupo tiene un solo evento', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', nombre: 'Curro' } })
    // Lo que se prueba aquí es el atajo, no la red: el evento ya está en la
    // base, como si acabara de bajar.
    await createEvent({ name: 'Ballenita 2026', lugar: 'Camping La Ballena Alegre' })

    render(<App />)

    // Nadie ha tenido que elegir en una lista de un solo elemento.
    expect(await screen.findByText('Ballenita 2026')).toBeInTheDocument()
    expect(screen.queryByText('Tus eventos 🐳')).not.toBeInTheDocument()
  })

  it('con dos eventos no elige por ti: enseña la lista', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', nombre: 'Curro' } })
    await createEvent({ name: 'Ballenita 2026' })
    await createEvent({ name: 'Finde en la sierra' })

    render(<App />)

    expect(await screen.findByText('Tus eventos 🐳')).toBeInTheDocument()
  })
})
