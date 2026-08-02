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
})
