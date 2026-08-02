import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Lo único que aquí puede salir mal en silencio: que el binario instalado sea
 * anterior al plugin. En web todo es `no-aplica` y no pasa nada; en la app, ese
 * caso hay que **decirlo**, porque es el único que no se arregla desde el
 * teléfono.
 */
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))

beforeEach(() => { vi.resetModules() })

describe('estadoDePush', () => {
  it('sin plugin en el binario, lo dice en vez de callarse', async () => {
    vi.doMock('@capacitor/push-notifications', () => { throw new Error('no está') })
    const { estadoDePush, SIN_PLUGIN } = await import('./native.js')
    expect(await estadoDePush()).toBe(SIN_PLUGIN)
  })

  it('con plugin, devuelve el permiso tal cual lo dice iOS', async () => {
    vi.doMock('@capacitor/push-notifications', () => ({
      PushNotifications: { checkPermissions: async () => ({ receive: 'denied' }) },
    }))
    const { estadoDePush } = await import('./native.js')
    expect(await estadoDePush()).toBe('denied')
  })
})

describe('registerPush', () => {
  it('sin plugin lanza, para que la pantalla no lo confunda con un «no» del usuario', async () => {
    vi.doMock('@capacitor/push-notifications', () => { throw new Error('no está') })
    const { registerPush, SIN_PLUGIN } = await import('./native.js')
    await expect(registerPush()).rejects.toThrow(SIN_PLUGIN)
  })

  it('si el permiso se deniega no hay token, y no se inventa ninguno', async () => {
    vi.doMock('@capacitor/push-notifications', () => ({
      PushNotifications: {
        checkPermissions: async () => ({ receive: 'prompt' }),
        requestPermissions: async () => ({ receive: 'denied' }),
        addListener: () => {},
        register: () => {},
      },
    }))
    const { registerPush } = await import('./native.js')
    expect(await registerPush()).toBe(null)
  })

  it('con permiso, el token es el que llega por el evento de registro', async () => {
    vi.doMock('@capacitor/push-notifications', () => ({
      PushNotifications: {
        checkPermissions: async () => ({ receive: 'granted' }),
        addListener: (evento, fn) => { if (evento === 'registration') setTimeout(() => fn({ value: 'tok_apns' }), 0) },
        register: () => {},
      },
    }))
    const { registerPush } = await import('./native.js')
    expect(await registerPush()).toBe('tok_apns')
  })
})

/**
 * Con tiempo de verdad y plazos de milisegundos, no con temporizadores falsos:
 * los falsos dejaban viva la promesa del plazo perdedor y Vitest la contaba
 * como rechazo sin dueño, con la suite entera en verde y la ejecución en rojo.
 */
describe('ninguna llamada al puente se queda colgada', () => {
  it('si `checkPermissions` no vuelve, se acaba diciendo que falta el binario', async () => {
    vi.doMock('@capacitor/push-notifications', () => ({
      PushNotifications: { checkPermissions: () => new Promise(() => {}) },
    }))
    const { estadoDePush, SIN_PLUGIN, PLAZOS } = await import('./native.js')
    PLAZOS.puente = 20
    expect(await estadoDePush()).toBe(SIN_PLUGIN)
  })

  it('si la hoja de permiso no llega a aparecer, tampoco', async () => {
    vi.doMock('@capacitor/push-notifications', () => ({
      PushNotifications: {
        checkPermissions: async () => ({ receive: 'prompt' }),
        requestPermissions: () => new Promise(() => {}),
        addListener: () => {},
        register: () => {},
      },
    }))
    const { registerPush, SIN_PLUGIN, PLAZOS } = await import('./native.js')
    PLAZOS.permiso = 20
    await expect(registerPush()).rejects.toThrow(SIN_PLUGIN)
  })
})

/**
 * El caso que costó tres intentos: el plugin **está** en el binario —sale en
 * `Capacitor.Plugins`— y aun así la pantalla se quedaba en «Pidiendo…». En la
 * consola de Xcode se veía llegar el `Haptics` del toque y ninguna llamada más:
 * el `await import()` del paquete no volvía nunca dentro de la cáscara.
 */
describe('el plugin se coge del puente, no se importa', () => {
  it('si el puente lo tiene, no se toca el import', async () => {
    const puente = {
      checkPermissions: async () => ({ receive: 'granted' }),
      addListener: (evento, fn) => { if (evento === 'registration') setTimeout(() => fn({ value: 'tok' }), 0) },
      register: () => {},
    }
    vi.doMock('@capacitor/core', () => ({
      Capacitor: { isNativePlatform: () => true, Plugins: { PushNotifications: puente } },
    }))
    // Si llegara a importarse, este módulo colgaría la promesa para siempre.
    vi.doMock('@capacitor/push-notifications', () => new Promise(() => {}))

    const { registerPush, estadoDePush } = await import('./native.js')
    expect(await estadoDePush()).toBe('granted')
    expect(await registerPush()).toBe('tok')
  })
})
