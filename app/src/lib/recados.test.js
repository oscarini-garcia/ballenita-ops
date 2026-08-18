import { describe, it, expect } from 'vitest'
import { recadosDeDatos, bolsaDeRecados, elegirRecado } from './recados.js'
import { ESTADO_SE_HACE } from './planes.js'

const EVENTO = { id: 'ev1', currency: 'EUR', startDate: '2026-08-01', endDate: '2026-08-08' }
const NUEVE = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }))
const textos = (rs) => rs.map((r) => r.texto)
const porId = (rs, id) => rs.find((r) => r.id === id)

describe('recadosDeDatos', () => {
  it('con un evento vacío no dice nada', () => {
    expect(recadosDeDatos({ evento: EVENTO, hoy: '2026-08-03' })).toEqual([])
  })

  // La guarda es media plantilla: sin ella, un evento recién creado saluda con
  // «0,00 € apuntados. Salís a 0,00 € por cabeza», que se lee como que la app
  // cuenta mal, no como una broma.
  it('no habla de dinero sin gastos, ni de reparto sin gente', () => {
    expect(porId(recadosDeDatos({ evento: EVENTO, personas: NUEVE, hoy: '2026-08-03' }), 'total')).toBeUndefined()
    expect(porId(recadosDeDatos({
      evento: EVENTO,
      gastos: [{ amountCents: 1000, dateISO: '2026-08-03' }],
      hoy: '2026-08-03',
    }), 'total')).toBeUndefined()
  })

  it('cuenta el total y el reparto por cabeza', () => {
    const r = porId(recadosDeDatos({
      evento: EVENTO,
      personas: NUEVE,
      gastos: [{ amountCents: 9000, dateISO: '2026-08-03' }],
      hoy: '2026-08-03',
    }), 'total')
    expect(r.texto).toContain('90,00')
    expect(r.texto).toContain('10,00')
  })

  it('las rondas de bebida piden tres para salir', () => {
    const bebida = (n) => Array.from({ length: n }, () => ({ amountCents: 900, category: 'bebida', dateISO: '2026-08-03' }))
    expect(porId(recadosDeDatos({ evento: EVENTO, personas: NUEVE, gastos: bebida(2), hoy: '2026-08-03' }), 'bebida')).toBeUndefined()
    const r = porId(recadosDeDatos({ evento: EVENTO, personas: NUEVE, gastos: bebida(7), hoy: '2026-08-03' }), 'bebida')
    expect(r.texto).toContain('7 rondas')
    expect(r.texto).toContain('sois 9')
  })

  it('cuenta los días sin apuntar un gasto, y no lo dice el mismo día', () => {
    const gasto = [{ amountCents: 500, dateISO: '2026-08-02' }]
    expect(porId(recadosDeDatos({ evento: EVENTO, gastos: gasto, hoy: '2026-08-03' }), 'seco')).toBeUndefined()
    expect(porId(recadosDeDatos({ evento: EVENTO, gastos: gasto, hoy: '2026-08-06' }), 'seco').texto).toContain('4 días')
  })

  it('la compra avisa distinto si la cena es hoy', () => {
    const compra = [{ comprado: false }, { comprado: false }, { comprado: true }]
    const sinCena = porId(recadosDeDatos({ evento: EVENTO, compra, hoy: '2026-08-03' }), 'compra')
    expect(sinCena.texto).toBe('Faltan 2 cosas de la compra.')

    const conCena = porId(recadosDeDatos({
      evento: EVENTO, compra, cenas: [{ dia: '2026-08-03', bungaMayoresId: 'b1' }], hoy: '2026-08-03',
    }), 'compra')
    expect(conCena.texto).toContain('la cena es hoy')
  })

  it('el singular y el plural se dicen bien', () => {
    const uno = porId(recadosDeDatos({ evento: EVENTO, compra: [{ comprado: false }], hoy: '2026-08-03' }), 'compra')
    expect(uno.texto).toBe('Falta 1 cosa de la compra.'.replace('Falta ', 'Faltan '))
    const cena = porId(recadosDeDatos({ evento: EVENTO, cenas: [{ dia: '2026-08-03' }], hoy: '2026-08-03' }), 'sinbunga')
    expect(cena.texto).toContain('1 cena sin')
  })

  it('canta el plato repetido a partir de la tercera vez, y con su nombre', () => {
    const cenas = (n) => Array.from({ length: n }, (_, i) => ({ dia: `2026-08-0${i + 1}`, bungaMayoresId: 'b1', platoIds: ['d1'] }))
    const platos = [{ id: 'd1', name: 'Paella' }]
    expect(porId(recadosDeDatos({ evento: EVENTO, cenas: cenas(2), platos, hoy: '2026-08-03' }), 'plato')).toBeUndefined()
    expect(porId(recadosDeDatos({ evento: EVENTO, cenas: cenas(4), platos, hoy: '2026-08-03' }), 'plato').texto)
      .toBe('Paella, por 4ª vez. Nadie se ha quejado.')
  })

  it('sin el nombre del plato se calla en vez de decir «undefined»', () => {
    const cenas = Array.from({ length: 4 }, () => ({ dia: '2026-08-03', bungaMayoresId: 'b1', platoIds: ['fantasma'] }))
    expect(porId(recadosDeDatos({ evento: EVENTO, cenas, platos: [], hoy: '2026-08-03' }), 'plato')).toBeUndefined()
  })

  it('los planes sin un solo voto pesan más que los que ya tienen alguno', () => {
    const sin = recadosDeDatos({ evento: EVENTO, planes: [{ estado: 'propuesto', votos: {} }], hoy: '2026-08-03' })
    expect(porId(sin, 'sinvotos').texto).toContain('1 plan sin un solo voto')
    expect(porId(sin, 'votacion')).toBeUndefined()

    const con = recadosDeDatos({ evento: EVENTO, planes: [{ estado: 'propuesto', votos: { p1: '👍' } }], hoy: '2026-08-03' })
    expect(porId(con, 'sinvotos')).toBeUndefined()
    expect(porId(con, 'votacion').texto).toContain('1 plan espera votos')
  })

  it('un plan que se hace ya no espera nada', () => {
    const r = recadosDeDatos({ evento: EVENTO, planes: [{ estado: ESTADO_SE_HACE, votos: { p1: '👍' } }], hoy: '2026-08-03' })
    expect(porId(r, 'votacion')).toBeUndefined()
    expect(porId(r, 'sinvotos')).toBeUndefined()
  })

  it('la cuenta atrás solo sale al final, y fuera del viaje no sale', () => {
    expect(porId(recadosDeDatos({ evento: EVENTO, hoy: '2026-08-03' }), 'quedan')).toBeUndefined()
    expect(porId(recadosDeDatos({ evento: EVENTO, hoy: '2026-08-07' }), 'quedan').texto).toContain('Queda 1 día'.replace('Queda ', 'Quedan '))
    expect(porId(recadosDeDatos({ evento: EVENTO, hoy: '2026-08-08' }), 'ultimo').texto).toContain('Último día')
    expect(recadosDeDatos({ evento: EVENTO, hoy: '2026-09-01' })).toEqual([])
  })

  // La regla de fondo: se habla en plural o de números, nunca de quién.
  it('nunca nombra a una persona ni a una familia', () => {
    const todos = recadosDeDatos({
      evento: EVENTO,
      personas: NUEVE,
      gastos: [
        { amountCents: 9000, category: 'bebida', dateISO: '2026-08-01', payers: [{ familyId: 'f1', amountCents: 9000 }] },
        { amountCents: 900, category: 'bebida', dateISO: '2026-08-01' },
        { amountCents: 900, category: 'bebida', dateISO: '2026-08-01' },
      ],
      compra: [{ comprado: false }],
      cenas: [{ dia: '2026-08-05' }],
      planes: [{ estado: 'propuesto', votos: {} }],
      hoy: '2026-08-07',
    })
    expect(todos.length).toBeGreaterThan(4)
    for (const t of textos(todos)) {
      for (const p of NUEVE) expect(t).not.toContain(p.name)
      expect(t).not.toContain('f1')
    }
  })

  it('sin evento ninguna plantilla revienta', () => {
    expect(() => recadosDeDatos({})).not.toThrow()
    expect(() => recadosDeDatos()).not.toThrow()
  })
})

describe('bolsaDeRecados', () => {
  it('junta los de datos con los de la IA', () => {
    const bolsa = bolsaDeRecados(
      [{ id: 'total', emoji: '💸', texto: 'Nueve euros.' }],
      [{ emoji: '🩴', texto: 'Tres chanclas.' }, { emoji: '🧊', texto: 'Sin hielo.' }],
    )
    expect(bolsa).toHaveLength(3)
    expect(bolsa[1].id).toBe('ia-0')
  })

  it('tira lo que viene mal de la IA en vez de pintar un hueco', () => {
    const bolsa = bolsaDeRecados([], [{ texto: '  ' }, { emoji: '🧊' }, null, 'nope', { emoji: '', texto: 'Vale.' }])
    expect(bolsa).toHaveLength(1)
    // El número es el del sitio que ocupa **después** de tirar la basura: solo
    // hace falta que no se repita dentro de la tanda.
    expect(bolsa[0]).toEqual({ id: 'ia-0', emoji: '🐳', texto: 'Vale.' })
  })

  it('sin nada devuelve nada', () => {
    expect(bolsaDeRecados()).toEqual([])
  })
})

describe('elegirRecado', () => {
  it('con la bolsa vacía devuelve nada, no revienta', () => {
    expect(elegirRecado([])).toBeNull()
    expect(elegirRecado()).toBeNull()
  })

  it('la misma semilla saca siempre el mismo, que es lo que evita que baile', () => {
    const bolsa = bolsaDeRecados([], [{ texto: 'a' }, { texto: 'b' }, { texto: 'c' }])
    expect(elegirRecado(bolsa, 0.5)).toBe(elegirRecado(bolsa, 0.5))
    expect(elegirRecado(bolsa, 0).texto).toBe('a')
    expect(elegirRecado(bolsa, 0.99).texto).toBe('c')
  })

  it('con el tope de la semilla no se sale de la bolsa', () => {
    const bolsa = bolsaDeRecados([], [{ texto: 'a' }, { texto: 'b' }])
    expect(elegirRecado(bolsa, 1)).not.toBeUndefined()
    expect(elegirRecado(bolsa, 1)).not.toBeNull()
  })
})
