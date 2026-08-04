import { describe, it, expect } from 'vitest'
import { solDelDia, momentoDelDia, enPalabras } from './sol.js'

/** Las horas se comprueban en UTC, que es lo que devuelve la fórmula. */
const utc = (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

/** Dos minutos de margen: la fórmula es la aproximada, y sobra para una franja. */
const cerca = (real, esperado) => {
  const [h, m] = esperado.split(':').map(Number)
  const [rh, rm] = utc(real).split(':').map(Number)
  expect(Math.abs((rh * 60 + rm) - (h * 60 + m))).toBeLessThanOrEqual(2)
}

describe('solDelDia', () => {
  // Madrid, con las horas de las efemérides. En agosto va UTC+2 y en enero
  // UTC+1, así que 05:15 UTC son las 07:15 de la mañana de verdad.
  it('acierta el 4 de agosto en Madrid (07:15 y 21:29 locales)', () => {
    const { salida, puesta } = solDelDia(new Date('2026-08-04T12:00:00Z'))
    cerca(salida, '05:15')
    cerca(puesta, '19:29')
  })

  it('acierta el 4 de enero, que es el caso que mata las horas fijas', () => {
    const { salida, puesta } = solDelDia(new Date('2026-01-04T12:00:00Z'))
    cerca(salida, '07:39') // 08:39 locales
    cerca(puesta, '17:01') // 18:01 locales
  })

  it('acierta el solsticio de junio', () => {
    const { salida, puesta } = solDelDia(new Date('2026-06-21T12:00:00Z'))
    cerca(salida, '04:45')
    cerca(puesta, '19:49')
  })

  it('en verano hay unas cinco horas más de luz que en invierno', () => {
    const luz = (iso) => {
      const { salida, puesta } = solDelDia(new Date(iso))
      return (puesta - salida) / 3600000
    }
    expect(luz('2026-08-04T12:00:00Z') - luz('2026-01-04T12:00:00Z')).toBeGreaterThan(4.5)
  })

  it('en el círculo polar dice que no hay salida ni puesta', () => {
    const junio = solDelDia(new Date('2026-06-21T12:00:00Z'), { lat: 78, lon: 15 })
    expect(junio.sinSol).toBe('dia')
    expect(junio.salida).toBeNull()

    const diciembre = solDelDia(new Date('2026-12-21T12:00:00Z'), { lat: 78, lon: 15 })
    expect(diciembre.sinSol).toBe('noche')
  })
})

describe('momentoDelDia', () => {
  it('a mediodía es de día y va por la mitad', () => {
    const m = momentoDelDia(new Date('2026-08-04T12:22:00Z'))
    expect(m.fase).toBe('dia')
    expect(m.fraccion).toBeGreaterThan(0.45)
    expect(m.fraccion).toBeLessThan(0.55)
  })

  it('recién salido el sol la fracción es casi cero', () => {
    const m = momentoDelDia(new Date('2026-08-04T05:20:00Z'))
    expect(m.fase).toBe('dia')
    expect(m.fraccion).toBeLessThan(0.02)
  })

  it('a punto de ponerse la fracción es casi uno y quedan pocos minutos', () => {
    const m = momentoDelDia(new Date('2026-08-04T19:00:00Z'))
    expect(m.fase).toBe('dia')
    expect(m.fraccion).toBeGreaterThan(0.95)
    expect(m.quedan).toBeLessThan(35)
  })

  // Es el caso que se hace mal si la noche se mide contra la salida del mismo
  // día: a las dos de la mañana el tramo empezó **ayer** por la tarde.
  it('de madrugada mide contra la puesta de ayer', () => {
    const m = momentoDelDia(new Date('2026-08-05T00:30:00Z'))
    expect(m.fase).toBe('noche')
    expect(m.fraccion).toBeGreaterThan(0.4)
    expect(m.fraccion).toBeLessThan(0.7)
  })

  it('justo después de la puesta la noche acaba de empezar', () => {
    const m = momentoDelDia(new Date('2026-08-04T19:40:00Z'))
    expect(m.fase).toBe('noche')
    expect(m.fraccion).toBeLessThan(0.05)
  })

  it('la fracción nunca se sale de 0 a 1', () => {
    for (let h = 0; h < 24; h += 1) {
      const m = momentoDelDia(new Date(`2026-08-04T${String(h).padStart(2, '0')}:00:00Z`))
      expect(m.fraccion).toBeGreaterThanOrEqual(0)
      expect(m.fraccion).toBeLessThanOrEqual(1)
    }
  })
})

describe('enPalabras', () => {
  it('dice las horas y los minutos como se dicen', () => {
    expect(enPalabras(47)).toBe('47 min')
    expect(enPalabras(60)).toBe('1 h')
    expect(enPalabras(192)).toBe('3 h 12')
    expect(enPalabras(null)).toBe('')
  })
})
