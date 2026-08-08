import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Lo único que aquí puede salir mal en silencio: que el binario instalado sea
 * anterior al plugin. En web todo es `no-aplica` y no pasa nada; en la app, ese
 * caso hay que **decirlo**, porque es el único que no se arregla desde el
 * teléfono.
 *
 * El plugin se pone **en el puente**, que es donde está de verdad: la parte
 * nativa escribe `Capacitor.Plugins.<nombre>` antes de que corra una línea de
 * esta aplicación. Antes estas pruebas lo montaban con un `vi.doMock` del
 * paquete de npm, y eso probaba un camino que en el móvil no existe: el
 * JavaScript del paquete viaja dentro del OTA, así que importarlo funciona
 * igual y no dice nada sobre si la parte nativa está.
 */
beforeEach(() => { vi.resetModules() })

async function conPuente(plugins) {
  vi.doMock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: plugins },
  }))
  return import('./native.js')
}

describe('estadoDePush', () => {
  it('sin plugin en el binario, lo dice en vez de callarse', async () => {
    const { estadoDePush, SIN_PLUGIN } = await conPuente({ Haptics: {}, Share: {} })
    expect(await estadoDePush()).toBe(SIN_PLUGIN)
  })

  it('con plugin, devuelve el permiso tal cual lo dice iOS', async () => {
    const { estadoDePush } = await conPuente({
      PushNotifications: { checkPermissions: async () => ({ receive: 'denied' }) },
    })
    expect(await estadoDePush()).toBe('denied')
  })
})

describe('registerPush', () => {
  it('sin plugin lanza, para que la pantalla no lo confunda con un «no» del usuario', async () => {
    const { registerPush, SIN_PLUGIN } = await conPuente({ Haptics: {} })
    await expect(registerPush()).rejects.toThrow(SIN_PLUGIN)
  })

  it('y lo dice en el acto, no seis segundos después', async () => {
    // El renglón en curso sin nada detrás era la mitad del problema: la
    // respuesta ya se sabía, y se esperaba a un `import()` que en la cáscara se
    // cuelga para acabar dando la equivocada.
    const { registerPush } = await conPuente({})
    const desde = performance.now()
    await expect(registerPush()).rejects.toThrow()
    expect(performance.now() - desde).toBeLessThan(100)
  })

  it('si el permiso se deniega no hay token, y no se inventa ninguno', async () => {
    const { registerPush } = await conPuente({
      PushNotifications: {
        checkPermissions: async () => ({ receive: 'prompt' }),
        requestPermissions: async () => ({ receive: 'denied' }),
        addListener: () => {},
        register: () => {},
      },
    })
    expect(await registerPush()).toBe(null)
  })

  it('con permiso, el token es el que llega por el evento de registro', async () => {
    const { registerPush } = await conPuente({
      PushNotifications: {
        checkPermissions: async () => ({ receive: 'granted' }),
        addListener: (evento, fn) => { if (evento === 'registration') setTimeout(() => fn({ value: 'tok_apns' }), 0) },
        register: () => {},
      },
    })
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
    const { estadoDePush, SIN_PLUGIN, PLAZOS } = await conPuente({
      PushNotifications: { checkPermissions: () => new Promise(() => {}) },
    })
    PLAZOS.puente = 20
    expect(await estadoDePush()).toBe(SIN_PLUGIN)
  })

  it('si la hoja de permiso no llega a aparecer, tampoco', async () => {
    const { registerPush, SIN_PLUGIN, PLAZOS } = await conPuente({
      PushNotifications: {
        checkPermissions: async () => ({ receive: 'prompt' }),
        requestPermissions: () => new Promise(() => {}),
        addListener: () => {},
        register: () => {},
      },
    })
    PLAZOS.permiso = 20
    await expect(registerPush()).rejects.toThrow(SIN_PLUGIN)
  })
})

/**
 * El caso que costó cuatro intentos: el `import()` del paquete no vuelve nunca
 * dentro de la cáscara. Se le puso plazo y dejó de ser eterno, pero seguía
 * siendo la respuesta equivocada esperada seis segundos. Ahora el puente es la
 * **única** fuente: si lo tiene, se usa; si no, eso ya es la respuesta.
 */
describe('el plugin se coge del puente, y solo del puente', () => {
  it('si el puente lo tiene, no se toca el import', async () => {
    // Si llegara a importarse, este módulo colgaría la promesa para siempre.
    vi.doMock('@capacitor/push-notifications', () => new Promise(() => {}))
    const { registerPush, estadoDePush } = await conPuente({
      PushNotifications: {
        checkPermissions: async () => ({ receive: 'granted' }),
        addListener: (evento, fn) => { if (evento === 'registration') setTimeout(() => fn({ value: 'tok' }), 0) },
        register: () => {},
      },
    })
    expect(await estadoDePush()).toBe('granted')
    expect(await registerPush()).toBe('tok')
  })

  it('y si no lo tiene, tampoco: el import no es una segunda opinión', async () => {
    // El JavaScript del paquete viaja dentro del OTA, así que importarlo
    // funciona igual y el objeto que devuelve llama a una parte nativa que no
    // existe. Preguntárselo es cambiar una certeza instantánea por una espera.
    vi.doMock('@capacitor/push-notifications', () => new Promise(() => {}))
    const { estadoDePush, SIN_PLUGIN } = await conPuente({ Haptics: {} })
    expect(await estadoDePush()).toBe(SIN_PLUGIN)
  })
})

describe('el informe del puente', () => {
  it('nombra lo que sí trae, que es lo que separa las dos causas', async () => {
    const { informeDelPuente } = await conPuente({ Haptics: {}, Share: {} })
    const informe = informeDelPuente()
    expect(informe).toContain('PushNotifications en el puente: false')
    expect(informe).toContain('Haptics, Share')
    expect(informe).toContain('plataforma: ios')
  })

  it('un puente sin ningún plugin se distingue de uno al que le falta este', async () => {
    const { informeDelPuente } = await conPuente({})
    expect(informeDelPuente()).toContain('(ninguno)')
  })
})
