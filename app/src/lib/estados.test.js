import { describe, it, expect } from 'vitest'
import {
  ESTADOS_DE_SIEMPRE, cincoAlAzar, estadoEnUnaLinea, partirEstado, quienTieneEstado,
} from './estados.js'

/** Un estado es un emoji y una frase corta, guardados como una sola cadena. */
describe('partirEstado', () => {
  it('separa el emoji de la frase', () => {
    expect(partirEstado('🍺 de resaca')).toEqual({ emoji: '🍺', texto: 'de resaca' })
    expect(partirEstado('  🫥   desaparecido en combate ')).toEqual({
      emoji: '🫥', texto: 'desaparecido en combate',
    })
  })

  it('lo que empieza por letra es todo frase: la «a» de «a mi bola» no es un emoji', () => {
    expect(partirEstado('a mi bola')).toEqual({ emoji: '', texto: 'a mi bola' })
    expect(partirEstado('de resaca')).toEqual({ emoji: '', texto: 'de resaca' })
  })

  it('un emoji solo es un emoji solo, y lo vacío no inventa nada', () => {
    expect(partirEstado('🐳')).toEqual({ emoji: '🐳', texto: '' })
    expect(partirEstado('')).toEqual({ emoji: '', texto: '' })
    expect(partirEstado('   ')).toEqual({ emoji: '', texto: '' })
  })

  it('va y vuelve: lo que se parte se vuelve a juntar igual', () => {
    for (const e of ESTADOS_DE_SIEMPRE) {
      expect(estadoEnUnaLinea(partirEstado(estadoEnUnaLinea(e)))).toBe(`${e.emoji} ${e.texto}`)
    }
  })
})

describe('cincoAlAzar', () => {
  it('da cinco distintos de los doce', () => {
    const cinco = cincoAlAzar()
    expect(cinco).toHaveLength(5)
    expect(new Set(cinco.map((e) => e.texto)).size).toBe(5)
    for (const e of cinco) expect(ESTADOS_DE_SIEMPRE).toContainEqual(e)
  })

  it('con menos de cinco da los que hay, sin repetir para rellenar', () => {
    const dos = [{ emoji: '🍺', texto: 'a' }, { emoji: '🐳', texto: 'b' }]
    expect(cincoAlAzar(dos)).toHaveLength(2)
    expect(cincoAlAzar([])).toEqual([])
  })
})

describe('quienTieneEstado', () => {
  it('solo los que han dicho algo, y por nombre para que no bailen', () => {
    const gente = [
      { id: '1', name: 'Pablo', estado: '🍺 de resaca' },
      { id: '2', name: 'Ana', estado: '' },
      { id: '3', name: 'Curro', estado: '   ' },
      { id: '4', name: 'Marta', apodo: 'Martita', estado: '🤿 buceando' },
    ]
    expect(quienTieneEstado(gente).map((p) => p.id)).toEqual(['4', '1'])
  })

  it('sin gente no revienta', () => {
    expect(quienTieneEstado()).toEqual([])
  })
})
