import { describe, it, expect } from 'vitest'
import { borrarFoto, comprimirFoto, guardarFoto, leerFoto } from './avatares.js'

const EV = 'ev_1'
const PER = 'per_1'
const FOTO = 'data:image/jpeg;base64,AAAA'

describe('fotos de avatar (fuera de la sincronización)', () => {
  it('guarda, lee y borra la foto por evento y persona', () => {
    expect(leerFoto(EV, PER)).toBe(null)

    guardarFoto(EV, PER, FOTO)
    expect(leerFoto(EV, PER)).toBe(FOTO)
    // Es de este dispositivo: nunca sale de localStorage.
    expect(localStorage.getItem(`ballena.foto:${EV}:${PER}`)).toBe(FOTO)

    borrarFoto(EV, PER)
    expect(leerFoto(EV, PER)).toBe(null)
  })

  it('no se lía si falta el evento o la persona', () => {
    expect(leerFoto(null, PER)).toBe(null)
    expect(leerFoto(EV, null)).toBe(null)
    expect(() => guardarFoto(null, null, FOTO)).not.toThrow()
  })

  it('sin imagen, comprimir falla con un mensaje en español', async () => {
    await expect(comprimirFoto(null)).rejects.toThrow('No hay ninguna imagen')
  })
})
