import { describe, it, expect } from 'vitest'
import { cieloDelMomento } from './cielo.js'
import { momentoDelDia } from './sol.js'

/** Contraste WCAG, para poder exigirlo y no confiar en el ojo. */
function contraste(a, b) {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const [x, y] = [lum(a), lum(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** La tinta de la cabecera, que es fija (`--appbar-ink` en theme.css). */
const TINTA = '#e6eef3'

describe('cieloDelMomento', () => {
  it('devuelve siempre un color de seis cifras', () => {
    for (const fase of ['dia', 'noche']) {
      for (let f = 0; f <= 1.0001; f += 0.05) {
        expect(cieloDelMomento({ fase, fraccion: f })).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('sin momento, o donde el sol ni sale ni se pone, contesta el azul de siempre', () => {
    expect(cieloDelMomento(null)).toBe('#0b1f2c')
    expect(cieloDelMomento({})).toBe('#0b1f2c')
    expect(cieloDelMomento({ fase: null, fraccion: 0.5 })).toBe('#0b1f2c')
  })

  it('el ocaso y el principio de la noche empalman sin salto', () => {
    expect(cieloDelMomento({ fase: 'dia', fraccion: 1 }))
      .toBe(cieloDelMomento({ fase: 'noche', fraccion: 0 }))
  })

  it('el final de la noche empalma con el amanecer', () => {
    expect(cieloDelMomento({ fase: 'noche', fraccion: 1 }))
      .toBe(cieloDelMomento({ fase: 'dia', fraccion: 0 }))
  })

  it('el mediodía es el más claro y la madrugada el más hondo', () => {
    const luz = (c) => parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16)
    const mediodia = luz(cieloDelMomento({ fase: 'dia', fraccion: 0.5 }))
    const madrugada = luz(cieloDelMomento({ fase: 'noche', fraccion: 0.7 }))
    expect(mediodia).toBeGreaterThan(madrugada)
  })

  it('no da saltos bruscos: entre un minuto y el siguiente casi no cambia', () => {
    for (const fase of ['dia', 'noche']) {
      let antes = cieloDelMomento({ fase, fraccion: 0 })
      for (let f = 0.002; f <= 1; f += 0.002) {
        const ahora = cieloDelMomento({ fase, fraccion: f })
        const salto = Math.max(...[1, 3, 5].map((i) =>
          Math.abs(parseInt(ahora.slice(i, i + 2), 16) - parseInt(antes.slice(i, i + 2), 16))))
        expect(salto).toBeLessThanOrEqual(2)
        antes = ahora
      }
    }
  })

  // Es la razón de ser de esta paleta y lo que tumbó al cielo literal (A6),
  // que al mediodía deja el título en 1,26 : 1. Se comprueba **minuto a
  // minuto** de las 24 horas y con las horas de sol de verdad, no por tramos.
  it('a ningún minuto del día el título baja de 4,5 : 1', () => {
    let peor = { ratio: Infinity, hora: null }
    for (let m = 0; m < 24 * 60; m += 1) {
      const cuando = new Date(Date.UTC(2026, 7, 4, 0, m))
      const ratio = contraste(TINTA, cieloDelMomento(momentoDelDia(cuando)))
      if (ratio < peor.ratio) peor = { ratio, hora: cuando.toISOString().slice(11, 16) }
    }
    expect(peor.ratio).toBeGreaterThanOrEqual(4.5)
    // Y de hecho con mucho margen: el peor de la serie está por encima de 7.
    expect(peor.ratio).toBeGreaterThan(7)
  })

  it('también en diciembre, que tiene otras horas de sol', () => {
    for (let m = 0; m < 24 * 60; m += 5) {
      const cuando = new Date(Date.UTC(2026, 11, 21, 0, m))
      expect(contraste(TINTA, cieloDelMomento(momentoDelDia(cuando)))).toBeGreaterThanOrEqual(4.5)
    }
  })
})
