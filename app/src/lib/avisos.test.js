import { describe, it, expect } from 'vitest'
import { avisosDeCuentas, avisosPara } from './avisos.js'

const CUENTAS = [
  { id: 'c1', nombre: 'Óscar García Chillón', personId: 'per_oscar', creadoEn: '2026-08-01T10:00:00Z' },
  { id: 'c2', nombre: 'Curro García', personId: null, creadoEn: '2026-08-02T09:00:00Z' },
  { id: 'c3', nombre: '', personId: null, creadoEn: '2026-08-02T11:00:00Z' },
]

describe('avisos derivados de las cuentas', () => {
  it('avisa de quien ha entrado y todavía no es nadie', () => {
    const avisos = avisosDeCuentas(CUENTAS)
    expect(avisos.map((a) => a.id)).toEqual(['cuenta:c2', 'cuenta:c3'])
    expect(avisos[0].titulo).toBe('Curro García')
  })

  it('sin nombre de Apple, el aviso sigue diciendo que hay alguien', () => {
    expect(avisosDeCuentas(CUENTAS)[1].titulo).toBe('Alguien sin nombre')
  })

  it('enlazar la cuenta hace desaparecer su aviso, sin borrar nada', () => {
    const enlazadas = CUENTAS.map((c) => ({ ...c, personId: c.personId ?? 'per_x' }))
    expect(avisosDeCuentas(enlazadas)).toEqual([])
  })

  it('quien no administra no tiene avisos de cuentas', () => {
    expect(avisosPara({ cuentas: CUENTAS, esAdmin: false })).toEqual([])
    expect(avisosPara({ cuentas: CUENTAS, esAdmin: true }).length).toBe(2)
  })
})
