import { describe, it, expect, vi, beforeEach } from 'vitest'
import { asegurarPush } from './push.js'

/**
 * El caso de la captura: **«Avisos encendidos» y el servidor sin saber a dónde
 * mandar**. El permiso estaba concedido, así que el botón «Encender» —el único
 * sitio desde el que se llamaba a `registerPush()`— no se pintaba, y no quedaba
 * ningún gesto en la app capaz de apuntar el identificador de este móvil.
 */
const estado = { nativo: true, permiso: 'granted' }

vi.mock('../sync/api.js', () => ({ registrarPush: vi.fn(async () => ({ ok: true })) }))
vi.mock('./native.js', () => ({
  isNative: () => estado.nativo,
  estadoDePush: async () => estado.permiso,
  registerPush: async () => 'tok_de_apple',
}))

beforeEach(() => { estado.nativo = true; estado.permiso = 'granted' })

describe('asegurarPush', () => {
  it('con el permiso dado, pide el identificador y lo apunta', async () => {
    const apuntar = vi.fn(async () => ({ ok: true }))
    expect(await asegurarPush({ apuntar })).toBe('apuntado')
    expect(apuntar).toHaveBeenCalledWith('tok_de_apple', true)
  })

  it('en el navegador no se hace nada, y se dice', async () => {
    estado.nativo = false
    const apuntar = vi.fn()
    expect(await asegurarPush({ apuntar })).toBe('no-aplica')
    expect(apuntar).not.toHaveBeenCalled()
  })

  it('sin permiso no se pide nada: abriría una hoja de iOS sin venir a cuento', async () => {
    estado.permiso = 'prompt'
    const registrar = vi.fn()
    expect(await asegurarPush({ registrar })).toBe('prompt')
    expect(registrar).not.toHaveBeenCalled()
  })

  it('permiso dado y Apple sin dar identificador tiene nombre propio', async () => {
    // Es el síntoma de un binario sin `aps-environment`, o de estar sin red. No
    // es un «no» de nadie, y confundirlo con uno deja el fallo sin explicar.
    expect(await asegurarPush({ registrar: async () => null })).toBe('sin-token')
  })

  it('si la subida al servidor falla, se dice y el arranque sigue', async () => {
    const apuntar = async () => { throw new Error('500') }
    expect(await asegurarPush({ apuntar })).toBe('error')
  })

  it('si el puente se cae, el arranque sigue igual', async () => {
    const registrar = async () => { throw new Error('sin-plugin') }
    expect(await asegurarPush({ registrar })).toBe('error')
  })
})
