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
    expect(await asegurarPush({ apuntar })).toEqual({ estado: 'apuntado' })
    expect(apuntar).toHaveBeenCalledWith('tok_de_apple', true)
  })

  it('en el navegador no se hace nada, y se dice', async () => {
    estado.nativo = false
    const apuntar = vi.fn()
    expect(await asegurarPush({ apuntar })).toEqual({ estado: 'no-aplica' })
    expect(apuntar).not.toHaveBeenCalled()
  })

  it('sin permiso no se pide nada: abriría una hoja de iOS sin venir a cuento', async () => {
    estado.permiso = 'prompt'
    const registrar = vi.fn()
    expect(await asegurarPush({ registrar })).toEqual({ estado: 'prompt' })
    expect(registrar).not.toHaveBeenCalled()
  })

  it('Apple sin contestar en su plazo tiene nombre propio', async () => {
    // Ni identificador ni error: el móvil sin red. No es un «no» de nadie, y
    // confundirlo con uno deja el fallo sin explicar.
    expect(await asegurarPush({ registrar: async () => null })).toEqual({ estado: 'sin-token' })
  })

  it('lo que contesta Apple al registro llega entero a quien pregunte', async () => {
    // Es el caso que importa: el mensaje **es** el diagnóstico, y resumirlo a
    // «no se pudo» obliga a venir a preguntar qué le pasa al binario.
    const registrar = async () => { throw new Error("Apple rechazó el registro: no valid 'aps-environment' entitlement") }
    expect(await asegurarPush({ registrar })).toEqual({
      estado: 'error',
      motivo: "Apple rechazó el registro: no valid 'aps-environment' entitlement",
    })
  })

  it('si la subida al servidor falla, se dice y el arranque sigue', async () => {
    const apuntar = async () => { throw new Error('500 al guardar') }
    expect(await asegurarPush({ apuntar })).toEqual({ estado: 'error', motivo: '500 al guardar' })
  })
})
