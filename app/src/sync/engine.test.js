import { describe, it, expect, beforeEach, vi } from 'vitest'

// El motor habla con la red y con la sesión; aquí se sustituyen las dos para
// poder probar el ciclo entero —subir la cola, aplicar la instantánea, dejar la
// cola como toca— sin levantar nada.
vi.mock('./api.js', () => ({
  hayApi: vi.fn(async () => true),
  traerInstantanea: vi.fn(),
  enviarCambios: vi.fn(),
}))
vi.mock('../auth/sesion.js', () => ({
  haySesion: vi.fn(() => true),
  leerSesion: vi.fn(() => ({ token: 't' })),
  guardarSesion: vi.fn(),
  borrarSesion: vi.fn(),
}))

const { syncNow } = await import('./engine.js')
const api = await import('./api.js')
const sesionMock = await import('../auth/sesion.js')
const { db, addExpense, colaPendiente, createEvent, olvidarTodo } = await import('../db.js')

const instantaneaVacia = { v: 1, tables: {} }

beforeEach(async () => {
  vi.clearAllMocks()
  api.hayApi.mockResolvedValue(true)
  sesionMock.haySesion.mockReturnValue(true)
  await olvidarTodo()
})

describe('syncNow', () => {
  it('sin API configurada no hace nada', async () => {
    api.hayApi.mockResolvedValue(false)
    expect(await syncNow()).toEqual({ status: 'no-config' })
    expect(api.traerInstantanea).not.toHaveBeenCalled()
  })

  it('fuera de la app de iOS no se sincroniza nunca', async () => {
    // `hayApi` devuelve false en la web por diseño: el acceso con Apple vive en
    // la cáscara nativa, así que un navegador no tiene forma de autenticarse y
    // no debe llamar a la API ni aunque config.json apunte a ella.
    const { hayApi } = await vi.importActual('./api.js')
    expect(await hayApi()).toBe(false)
  })

  it('sin sesión no llama a la API', async () => {
    sesionMock.haySesion.mockReturnValue(false)
    expect(await syncNow()).toEqual({ status: 'sin-sesion' })
    expect(api.traerInstantanea).not.toHaveBeenCalled()
  })

  it('con la cola vacía solo baja la instantánea', async () => {
    api.traerInstantanea.mockResolvedValue({
      v: 1,
      tables: { events: [{ id: 'ev_srv', name: 'Ballenita', updatedAt: '2026-08-01T00:00:00.000Z' }] },
    })

    const r = await syncNow()

    expect(r.status).toBe('synced')
    expect(api.enviarCambios).not.toHaveBeenCalled()
    expect((await db.events.toArray())[0].id).toBe('ev_srv')
  })

  it('con cola pendiente la sube y vacía lo aceptado', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    await addExpense(eventId, { description: 'Hielo', amountCents: 300 })
    const pendientes = await colaPendiente()

    api.enviarCambios.mockResolvedValue({
      resultados: pendientes.map((c) => ({ tabla: c.tabla, id: c.id, aplicado: true })),
      instantanea: instantaneaVacia,
    })

    const r = await syncNow()

    expect(r.status).toBe('synced')
    expect(api.enviarCambios).toHaveBeenCalledOnce()

    // Lo que se manda son los cambios sin el número de orden, que es local.
    const enviados = api.enviarCambios.mock.calls[0][0]
    expect(enviados).toHaveLength(pendientes.length)
    expect(enviados[0]).not.toHaveProperty('orden')
    expect(enviados[0]).toMatchObject({ tabla: 'events', op: 'upsert' })

    expect(await colaPendiente()).toHaveLength(0)
  })

  it('lo encolado mientras la petición viaja no se pierde', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    const alVuelo = { id: null }

    api.enviarCambios.mockImplementation(async () => {
      // Alguien apunta un gasto justo mientras el lote está en el aire.
      alVuelo.id = await addExpense(eventId, { description: 'Tarde', amountCents: 700 })
      return { resultados: [], instantanea: instantaneaVacia }
    })

    await syncNow()

    // Ni se subió con el lote anterior ni se borró de la cola: queda para el
    // ciclo siguiente, y mientras tanto sigue viéndose en el móvil.
    const cola = await colaPendiente()
    expect(cola).toHaveLength(1)
    expect(cola[0].campos.description).toBe('Tarde')
    expect(await db.expenses.get(alVuelo.id)).toBeTruthy()
  })

  it('un cambio rechazado por el servidor sale del ciclo pero se avisa', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    await addExpense(eventId, { description: 'Viejo', amountCents: 100 })

    api.enviarCambios.mockResolvedValue({
      resultados: [{ tabla: 'expenses', id: 'exp_x', aplicado: false, motivo: 'el servidor tiene una versión más reciente' }],
      instantanea: instantaneaVacia,
    })
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const r = await syncNow()

    expect(r.status).toBe('synced')
    // Viajan con el resultado, que es lo que hace que la pantalla pueda
    // decirlo: la consola de Safari no se abre desde un iPhone.
    expect(r.rechazados).toHaveLength(1)
    expect(r.rechazados[0].motivo).toMatch(/versión más reciente/)
    expect(aviso).toHaveBeenCalled()
    // La cola se vacía igualmente: reintentar un cambio obsoleto no lo arregla,
    // solo lo deja atascado para siempre.
    expect(await colaPendiente()).toHaveLength(0)
    aviso.mockRestore()
  })

  it('una sesión caducada se distingue de un fallo de red', async () => {
    const caducada = new Error('sesión caducada')
    caducada.sesionCaducada = true
    api.traerInstantanea.mockRejectedValue(caducada)

    expect((await syncNow()).status).toBe('sesion-caducada')

    api.traerInstantanea.mockRejectedValue(new Error('la API respondió 500'))
    const fallo = await syncNow()
    expect(fallo.status).toBe('error')
    expect(fallo.error).toMatch(/500/)
  })

  it('un fallo de red no toca la cola', async () => {
    const eventId = await createEvent({ name: 'Ballenita' })
    await addExpense(eventId, { description: 'Hielo', amountCents: 300 })
    const antes = (await colaPendiente()).length

    api.enviarCambios.mockRejectedValue(new Error('sin red'))
    expect((await syncNow()).status).toBe('error')

    expect(await colaPendiente()).toHaveLength(antes)
  })
})

// ── El motor, rearmado al entrar (SPECS §14.29 · F5) ─────────────────────────
//
// El fallo que se veía desde el móvil: te aceptan, entras, y la app dice que no
// hay ningún evento; reinicias y ahí está. El motor se montaba con la app —o
// sea antes de que nadie hubiera entrado—, su primera vuelta devolvía
// `sin-sesion`, y con las dependencias vacías que tenía nadie lo volvía a
// llamar hasta el latido de 90 s.
describe('useSyncEngine se rearma cuando aparece la sesión', () => {
  it('vuelve a sincronizar en cuanto le llega una sesión que antes no había', async () => {
    const { renderHook, waitFor } = await import('@testing-library/react')
    const { useSyncEngine } = await import('./engine.js')

    sesionMock.haySesion.mockReturnValue(false)
    api.traerInstantanea.mockResolvedValue(instantaneaVacia)

    const { rerender } = renderHook(({ sesion }) => useSyncEngine(sesion), {
      initialProps: { sesion: null },
    })
    await waitFor(() => expect(api.hayApi).toHaveBeenCalled())
    expect(api.traerInstantanea).not.toHaveBeenCalled()

    // Se entra: esto es lo que hace `onEntrar` en App.
    sesionMock.haySesion.mockReturnValue(true)
    rerender({ sesion: { token: 'jwt' } })

    await waitFor(() => expect(api.traerInstantanea).toHaveBeenCalled())
  })

  it('un render con la misma sesión no vuelve a bajar la instantánea', async () => {
    const { renderHook, waitFor } = await import('@testing-library/react')
    const { useSyncEngine } = await import('./engine.js')

    api.traerInstantanea.mockResolvedValue(instantaneaVacia)
    const sesion = { token: 'jwt' }

    const { rerender } = renderHook(({ s }) => useSyncEngine(s), { initialProps: { s: sesion } })
    await waitFor(() => expect(api.traerInstantanea).toHaveBeenCalledTimes(1))

    // Otro objeto, el mismo token: es lo que pasa en cada render de App.
    rerender({ s: { token: 'jwt' } })
    await new Promise((r) => setTimeout(r, 20))

    expect(api.traerInstantanea).toHaveBeenCalledTimes(1)
  })
})
