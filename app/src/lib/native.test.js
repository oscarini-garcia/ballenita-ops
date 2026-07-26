import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  isNative, tap, share, checkForOtaUpdate, registerPush, notifyGroup, initNative,
  urlDelManifiestoOta,
} from './native.js'
import { olvidarConfiguracion } from './config.js'

// En el entorno de test (jsdom) NO estamos dentro de la cáscara nativa, así que
// todo debe degradar con elegancia: no-op o equivalente web, nunca un throw.
describe('native (fuera de la cáscara iOS)', () => {
  it('isNative() es false en web/jsdom', () => {
    expect(isNative()).toBe(false)
  })

  it('tap() no lanza aunque no haya háptica', async () => {
    await expect(tap()).resolves.toBeUndefined()
    await expect(tap('medium')).resolves.toBeUndefined()
  })

  it('share() devuelve false si no hay soporte, sin lanzar', async () => {
    await expect(share({ title: 'x', text: 'y', url: 'https://e.x' })).resolves.toBe(false)
    await expect(share()).resolves.toBe(false)
  })

  it('checkForOtaUpdate() se salta el OTA en web', async () => {
    await expect(checkForOtaUpdate()).resolves.toEqual({ status: 'skip' })
  })

  it('registerPush() devuelve null en web', async () => {
    await expect(registerPush()).resolves.toBeNull()
  })

  it('notifyGroup() es no-op (false) sin endpoint configurado', async () => {
    await expect(notifyGroup({ title: 'x', message: 'y' })).resolves.toBe(false)
  })

  it('initNative() no hace nada ni lanza en web', async () => {
    await expect(initNative()).resolves.toBeUndefined()
  })
})

// El manifiesto OTA vive en config.json (configuración en caliente) para poder
// cambiar el canal de actualización sin publicar una actualización.
describe('urlDelManifiestoOta', () => {
  afterEach(() => {
    olvidarConfiguracion()
    vi.unstubAllGlobals()
  })

  const conConfiguracion = (cuerpo) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => cuerpo })))
  }

  it('usa la clave `otaManifiesto` de config.json', async () => {
    conConfiguracion({ api: 'https://api.ejemplo', otaManifiesto: 'https://ejemplo/latest.json' })
    expect(await urlDelManifiestoOta()).toBe('https://ejemplo/latest.json')
  })

  it('recorta los espacios sueltos de la clave', async () => {
    conConfiguracion({ otaManifiesto: '  https://ejemplo/latest.json  ' })
    expect(await urlDelManifiestoOta()).toBe('https://ejemplo/latest.json')
  })

  it('cae al respaldo si la clave falta, está vacía o no es texto', async () => {
    for (const valor of [undefined, '', '   ', 42]) {
      olvidarConfiguracion()
      conConfiguracion({ api: 'https://api.ejemplo', otaManifiesto: valor })
      // Sin respaldo, una configuración a medias dejaría al móvil sin poder
      // actualizarse nunca más, que es el peor fallo posible aquí.
      expect(await urlDelManifiestoOta()).toMatch(/^https:\/\/github\.com\/.*latest\.json$/)
    }
  })

  it('cae al respaldo si config.json no se puede leer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red') }))
    expect(await urlDelManifiestoOta()).toMatch(/^https:\/\/github\.com\/.*latest\.json$/)
  })
})
