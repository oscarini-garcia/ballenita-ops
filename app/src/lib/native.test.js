import { describe, it, expect } from 'vitest'
import { isNative, tap, share, checkForOtaUpdate, registerPush, initNative } from './native.js'

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

  it('initNative() no hace nada ni lanza en web', async () => {
    await expect(initNative()).resolves.toBeUndefined()
  })
})
