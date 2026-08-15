import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isNative, tap, share, checkForOtaUpdate, hayOtaNueva, registerPush, initNative,
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

  // La pregunta barata del latido (§14.46): en web tampoco hay noticia que dar
  // —allí la versión la sirve el servidor al recargar— y sobre todo **no lanza**.
  it('hayOtaNueva() dice que no en web, sin lanzar', async () => {
    await expect(hayOtaNueva()).resolves.toEqual({ hay: false })
  })

  it('checkForOtaUpdate() se salta el OTA en web', async () => {
    await expect(checkForOtaUpdate()).resolves.toEqual({ status: 'skip' })
  })

  it('registerPush() devuelve null en web', async () => {
    await expect(registerPush()).resolves.toBeNull()
  })


  it('initNative() no hace nada ni lanza en web', async () => {
    await expect(initNative()).resolves.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// De dónde sale el manifiesto OTA (§14.28)
//
// La clave `otaManifiesto` llevaba desde julio declarada en `config.json` y sin
// que nadie la leyera —la URL estaba a fuego—, mientras `CLAUDE.md` la vendía
// como configuración en caliente. Lo encontró el mapa del repositorio.
// ─────────────────────────────────────────────────────────────────────────────
describe('la URL del manifiesto OTA', () => {
  beforeEach(() => { olvidarConfiguracion() })

  const conConfig = (cuerpo) => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => cuerpo }))
  }

  it('sale de `config.json`, que se cambia sin publicar un OTA', async () => {
    conConfig({ otaManifiesto: 'https://ejemplo.test/latest.json' })
    expect(await urlDelManifiestoOta()).toBe('https://ejemplo.test/latest.json')
  })

  it('le sobran los espacios', async () => {
    conConfig({ otaManifiesto: '  https://ejemplo.test/latest.json  ' })
    expect(await urlDelManifiestoOta()).toBe('https://ejemplo.test/latest.json')
  })

  it('y con la clave inservible o ausente cae al respaldo', async () => {
    for (const valor of [undefined, '', '   ', 42, null]) {
      olvidarConfiguracion()
      conConfig({ otaManifiesto: valor })
      expect(await urlDelManifiestoOta()).toMatch(/releases\/latest\/download\/latest\.json$/)
    }
  })

  // Sin respaldo, una configuración a medias dejaría a los móviles sin vía de
  // actualizarse: en el propio canal de actualización, eso es tener que
  // actualizar para poder actualizar.
  it('y si `config.json` no se puede leer, también', async () => {
    global.fetch = vi.fn(async () => { throw new Error('sin red') })
    expect(await urlDelManifiestoOta()).toMatch(/releases\/latest\/download\/latest\.json$/)
  })
})
