import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * El registro ante Apple: el evento no se pierde, y el error se cuenta.
 *
 * En pantalla salía «Permiso dado, pero Apple no devuelve identificador», que es
 * verdad y no sirve de nada. Detrás había dos cosas: los escuchas se ponían sin
 * esperar el asa —`addListener` cruza el puente y es asíncrono, así que la
 * respuesta de iOS podía llegar antes que su escucha— y el `registrationError`
 * se tiraba a la basura para devolver `null`.
 *
 * En fichero aparte porque cada caso monta su propio `@capacitor/core`, y un
 * `vi.doMock` se queda puesto para lo que venga detrás en el mismo fichero.
 */
beforeEach(() => { vi.resetModules() })

const base = (extra) => ({
  checkPermissions: async () => ({ receive: 'granted' }),
  register: async () => {},
  addListener: async () => ({ remove: async () => {} }),
  ...extra,
})

async function conPuente(plugin) {
  vi.doMock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => true, Plugins: { PushNotifications: plugin } },
  }))
  return import('./native.js')
}

describe('el registro ante Apple', () => {
  it('no se pide el registro hasta tener puestos los dos escuchas', async () => {
    const orden = []
    const { registerPush } = await conPuente(base({
      addListener: async (evento, fn) => {
        orden.push(`escucha:${evento}`)
        // El asa tarda en volver, como cuando cruza el puente de verdad.
        await new Promise((s) => setTimeout(s, 5))
        if (evento === 'registration') setTimeout(() => fn({ value: 'tok' }), 10)
        return { remove: async () => {} }
      },
      register: async () => { orden.push('register') },
    }))
    expect(await registerPush()).toBe('tok')
    expect(orden).toEqual(['escucha:registration', 'escucha:registrationError', 'register'])
  })

  it('lo que contesta Apple al fallar se cuenta con sus palabras', async () => {
    const { registerPush } = await conPuente(base({
      addListener: async (evento, fn) => {
        if (evento === 'registrationError') {
          setTimeout(() => fn({ error: "no valid 'aps-environment' entitlement string found" }), 0)
        }
        return { remove: async () => {} }
      },
    }))
    await expect(registerPush()).rejects.toThrow(/aps-environment/)
  })

  it('los escuchas se sueltan al acabar, que esto corre en cada arranque', async () => {
    const sueltas = []
    const { registerPush } = await conPuente(base({
      addListener: async (evento, fn) => {
        if (evento === 'registration') setTimeout(() => fn({ value: 'tok' }), 0)
        return { remove: async () => { sueltas.push(evento) } }
      },
    }))
    await registerPush()
    expect(sueltas.sort()).toEqual(['registration', 'registrationError'])
  })

  it('si Apple no contesta ni bien ni mal, se acaba sin token y sin colgarse', async () => {
    const { registerPush, PLAZOS } = await conPuente(base())
    PLAZOS.registro = 20
    expect(await registerPush()).toBe(null)
  })

  /**
   * El caso de «se me queda colgado»: `register()` estaba **esperado** justo
   * delante de la carrera, así que el reloj corría sin que lo mirara nadie. Una
   * llamada que no vuelve dejaba la pantalla en «Pidiendo…» para siempre, que es
   * el único desenlace que no se puede contar ni arreglar desde el teléfono.
   */
  it('un register() que no vuelve nunca no cuelga la pantalla', async () => {
    const { registerPush, PLAZOS } = await conPuente(base({
      register: () => new Promise(() => {}),
      addListener: async (evento, fn) => {
        if (evento === 'registration') setTimeout(() => fn({ value: 'tok' }), 5)
        return { remove: async () => {} }
      },
    }))
    PLAZOS.registro = 50
    // El token llega por su evento aunque `register()` siga sin contestar.
    expect(await registerPush()).toBe('tok')
  })

  it('y si además no llega el evento, se acaba en su plazo y sin token', async () => {
    const { registerPush, PLAZOS } = await conPuente(base({ register: () => new Promise(() => {}) }))
    PLAZOS.registro = 20
    expect(await registerPush()).toBe(null)
  })

  it('un register() que rompe se cuenta con sus palabras', async () => {
    const { registerPush } = await conPuente(base({
      register: async () => { throw new Error('el puente no contesta') },
    }))
    await expect(registerPush()).rejects.toThrow(/el puente no contesta/)
  })

  it('un puente que no devuelve los escuchas tampoco cuelga', async () => {
    const { registerPush, PLAZOS, SIN_PLUGIN } = await conPuente(base({
      addListener: () => new Promise(() => {}),
    }))
    PLAZOS.puente = 20
    await expect(registerPush()).rejects.toThrow(SIN_PLUGIN)
  })

  it('con el permiso denegado no se vuelve a preguntar: iOS solo enseña su hoja una vez', async () => {
    const pedidos = []
    const { registerPush } = await conPuente(base({
      checkPermissions: async () => ({ receive: 'denied' }),
      requestPermissions: async () => { pedidos.push('pedido'); return { receive: 'denied' } },
    }))
    expect(await registerPush()).toBe(null)
    expect(pedidos).toEqual([])
  })

  it('cada eslabón se anuncia al empezarlo, que es lo que se pinta', async () => {
    const vistos = []
    const { registerPush } = await conPuente(base({
      addListener: async (evento, fn) => {
        if (evento === 'registration') setTimeout(() => fn({ value: 'tok' }), 0)
        return { remove: async () => {} }
      },
    }))
    await registerPush({ alPaso: (c) => vistos.push(c) })
    expect(vistos).toEqual(['plugin', 'permiso', 'apple'])
  })

  it('si quien pinta rompe, el registro sigue: pintar no es parte del registro', async () => {
    const { registerPush } = await conPuente(base({
      addListener: async (evento, fn) => {
        if (evento === 'registration') setTimeout(() => fn({ value: 'tok' }), 0)
        return { remove: async () => {} }
      },
    }))
    expect(await registerPush({ alPaso: () => { throw new Error('la pantalla se fue') } })).toBe('tok')
  })
})
