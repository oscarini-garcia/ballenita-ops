import { describe, it, expect } from 'vitest'
import { formatearHace } from './hace.js'

const AHORA = new Date('2026-08-12T14:30:00')
const hace = (m) => formatearHace(new Date(AHORA - m * 60000), AHORA)

describe('formatearHace', () => {
  it('por debajo de cinco minutos no da el número: no añade nada', () => {
    expect(hace(1)).toBe('hace un rato')
    expect(hace(4)).toBe('hace un rato')
    expect(hace(12)).toBe('hace 12 min')
  })

  it('dentro del día dice la hora, que es lo que tranquiliza de un vistazo', () => {
    expect(hace(90)).toBe('hoy a las 13:00')
  })

  it('ayer y la semana se dicen por su nombre', () => {
    expect(formatearHace(new Date('2026-08-11T09:05:00'), AHORA)).toBe('ayer a las 9:05')
    expect(formatearHace(new Date('2026-08-08T09:05:00'), AHORA)).toBe('el sábado')
  })

  it('más allá de una semana la hora ya no importa y sí la fecha', () => {
    expect(formatearHace(new Date('2026-07-20T09:05:00'), AHORA)).toBe('el 20 de julio')
    expect(formatearHace(new Date('2025-12-31T09:05:00'), AHORA)).toBe('el 31 de diciembre de 2025')
  })

  it('sin fecha no inventa nada', () => {
    expect(formatearHace(null)).toBe('')
    expect(formatearHace('no es una fecha')).toBe('')
  })
})
