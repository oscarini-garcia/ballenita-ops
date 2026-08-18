import { describe, it, expect } from 'vitest'
import { instanteDe, horaValida, porHora } from './horas.js'

/**
 * La hora de un plan (§14.73).
 *
 * Lo que se prueba aquí es lo que decide si el recordatorio llega a su hora en
 * octubre: que el instante lo calcule quien sabe el desfase, y que el orden no
 * se invente una hora para el que no la tiene.
 */
describe('el instante de un plan', () => {
  it('sale del día y la hora, en segundos', () => {
    const t = instanteDe('2026-08-18', '20:00')
    // Se comprueba contra la misma cuenta local, que es la del aparato: fijar
    // un número absoluto ataría la prueba al huso del contenedor, que va en UTC
    // y no es el del camping.
    expect(t).toBe(Math.floor(new Date('2026-08-18T20:00:00').getTime() / 1000))
  })

  it('una hora más tarde son 3600 segundos más, sea el mes que sea', () => {
    for (const dia of ['2026-01-15', '2026-08-18']) {
      expect(instanteDe(dia, '21:00') - instanteDe(dia, '20:00')).toBe(3600)
    }
  })

  it('sin hora no hay instante, y no revienta', () => {
    expect(instanteDe('2026-08-18', null)).toBeNull()
    expect(instanteDe('2026-08-18', '')).toBeNull()
    expect(instanteDe(null, '20:00')).toBeNull()
    expect(instanteDe('2026-08-18', '25:00')).toBeNull()
  })

  it('lo que no es una hora no cuela', () => {
    expect(horaValida('20:00')).toBe(true)
    expect(horaValida('00:00')).toBe(true)
    expect(horaValida('23:59')).toBe(true)
    for (const mala of ['7:5', '24:00', '20:60', 'tarde', '', null, undefined]) {
      expect(horaValida(mala), String(mala)).toBe(false)
    }
  })
})

describe('el orden de los planes de un día', () => {
  const conHora = (id, hora) => ({ id, titulo: id, hora })

  it('primero los que tienen hora, de menor a mayor', () => {
    const orden = porHora([conHora('c', '20:00'), conHora('a', '09:30'), conHora('b', '12:00')])
    expect(orden.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('y los sueltos al final, sin inventarles una hora', () => {
    const orden = porHora([
      conHora('suelto', null), conHora('noche', '20:00'), conHora('otro', null), conHora('maniana', '09:30'),
    ])
    expect(orden.map((p) => p.id)).toEqual(['maniana', 'noche', 'suelto', 'otro'])
  })

  it('dos a la misma hora se quedan como venían: el orden es estable', () => {
    const orden = porHora([conHora('uno', '20:00'), conHora('dos', '20:00')])
    expect(orden.map((p) => p.id)).toEqual(['uno', 'dos'])
  })

  it('una hora rota se trata como sin hora, no rompe la lista', () => {
    const orden = porHora([conHora('roto', 'tarde'), conHora('bueno', '09:30')])
    expect(orden.map((p) => p.id)).toEqual(['bueno', 'roto'])
  })

  it('no toca el array que le dan', () => {
    const original = [conHora('b', '20:00'), conHora('a', '09:00')]
    porHora(original)
    expect(original.map((p) => p.id)).toEqual(['b', 'a'])
  })
})
