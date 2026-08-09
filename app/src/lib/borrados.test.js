import { describe, it, expect } from 'vitest'
import {
  familiasQueTocaUnGasto,
  loQueSeCaeDeLaCompra,
  queSeLlevaUnGasto,
  queSeLlevaUnaCena,
} from './borrados.js'

/**
 * La frase es la mitad de la protección: una confirmación que no dice qué se
 * lleva no se puede contestar, solo obedecer. Y el cero no se dice (B3): «se van
 * 0 líneas» es algo que nadie diría en voz alta.
 */
const FAMILIAS = [{ id: 'f1', name: 'Pérez' }, { id: 'f2', name: 'Solteros' }, { id: 'f3', name: 'García' }]
const PERSONAS = [
  { id: 'p1', name: 'Ana', familyId: 'f1', edad: 'adulto', comeConMayores: true },
  { id: 'p2', name: 'Luis', familyId: 'f2', edad: 'adulto', comeConMayores: true },
  { id: 'p3', name: 'Sara', familyId: 'f3', edad: 'adulto', comeConMayores: true },
]

describe('a cuántas familias les mueve el saldo un gasto', () => {
  it('sin lista de participantes es de todos, que es como nace un gasto rápido', () => {
    const gasto = { payers: [{ familyId: 'f1' }] }
    expect(familiasQueTocaUnGasto(gasto, { familias: FAMILIAS, personas: PERSONAS })).toHaveLength(3)
  })

  it('con participantes, solo las suyas y la de quien pagó', () => {
    const gasto = { payers: [{ familyId: 'f1' }], participantIds: ['p2'] }
    expect(familiasQueTocaUnGasto(gasto, { familias: FAMILIAS, personas: PERSONAS }).sort())
      .toEqual(['f1', 'f2'])
  })

  it('una familia que ya no existe no se cuenta: sería prometer un efecto sobre nadie', () => {
    const gasto = { payers: [{ familyId: 'fantasma' }], participantIds: ['p1'] }
    expect(familiasQueTocaUnGasto(gasto, { familias: FAMILIAS, personas: PERSONAS })).toEqual(['f1'])
  })
})

describe('la frase de un gasto', () => {
  const contexto = { familias: FAMILIAS, personas: PERSONAS, importe: '48,60 €' }

  it('devuelve lo que la fila deslizada tapa: nombre, importe y quién pagó', () => {
    const gasto = { description: 'Cena en el chiringuito', payers: [{ familyId: 'f1' }] }
    const frase = queSeLlevaUnGasto(gasto, contexto)
    expect(frase).toContain('«Cena en el chiringuito»')
    expect(frase).toContain('48,60 €')
    expect(frase).toContain('pagó Pérez')
  })

  it('nombra a cuántas familias les cambia el saldo, que es lo que no se ve', () => {
    const gasto = { description: 'Gasolina', payers: [{ familyId: 'f2' }] }
    expect(queSeLlevaUnGasto(gasto, contexto)).toContain('Cambia el saldo de 3 familias')
  })

  it('con una sola familia en juego no habla de saldos: no hay reparto que rehacer', () => {
    const gasto = { description: 'Café', payers: [{ familyId: 'f1' }], participantIds: ['p1'] }
    const frase = queSeLlevaUnGasto(gasto, contexto)
    expect(frase).not.toMatch(/saldo/)
    expect(frase).toContain('«Café»')
  })

  it('un gasto sin descripción se llama por lo que es, no por un hueco', () => {
    // Escribir dejó de ser obligatorio al apuntar un gasto (§14.26).
    const gasto = { payers: [{ familyId: 'f1' }] }
    expect(queSeLlevaUnGasto(gasto, contexto)).toContain('Se borra este gasto')
  })
})

// Dos platos con un ingrediente en común y uno propio: así se comprueba que solo
// se cuentan las líneas que **se quedan huérfanas** y no todas las de la cena.
const PLATOS = [
  { id: 'd1', name: 'Paella', raciones: 4, ingredientes: [{ nombre: 'Arroz', cantidad: 400, unidad: 'g' }, { nombre: 'Azafrán', cantidad: 1, unidad: 'g' }] },
  { id: 'd2', name: 'Ensalada', raciones: 4, ingredientes: [{ nombre: 'Arroz', cantidad: 100, unidad: 'g' }, { nombre: 'Tomate', cantidad: 3, unidad: 'ud' }] },
]
const linea = (clave, extra = {}) => ({ origen: 'cena', clave, comprado: false, ...extra })

describe('qué se cae de la compra al borrar una cena', () => {
  const jueves = { id: 'c1', dia: '2026-08-13', platoIds: ['d1'] }
  const viernes = { id: 'c2', dia: '2026-08-14', platoIds: ['d2'] }
  const base = { cenas: [jueves, viernes], platos: PLATOS, personas: PERSONAS }

  it('solo cuenta lo que se queda sin ninguna cena detrás', () => {
    // El arroz sigue haciendo falta para la ensalada: no se va.
    const lineas = [linea('arroz|g'), linea('azafrán|g'), linea('tomate|ud')]
    expect(loQueSeCaeDeLaCompra(jueves, { ...base, lineas })).toEqual({ seVan: 1, comprado: 0 })
  })

  it('lo ya comprado se cuenta aparte, porque no se va del carro', () => {
    const lineas = [linea('arroz|g'), linea('azafrán|g', { comprado: true })]
    expect(loQueSeCaeDeLaCompra(jueves, { ...base, lineas })).toEqual({ seVan: 0, comprado: 1 })
  })

  it('lo escrito a mano no entra nunca en la cuenta', () => {
    const lineas = [linea('azafrán|g'), { origen: 'mano', clave: null, comprado: false, texto: 'Hielo' }]
    expect(loQueSeCaeDeLaCompra(jueves, { ...base, lineas }).seVan).toBe(1)
  })
})

describe('la frase de una cena', () => {
  const jueves = { id: 'c1', platoIds: ['d1'] }
  const base = { dia: 'jueves 14', platos: PLATOS, personas: PERSONAS, cenas: [jueves] }

  it('nombra el día y los platos que se pierden', () => {
    expect(queSeLlevaUnaCena(jueves, { ...base, lineas: [] }))
      .toBe('Se borra la cena del jueves 14 (Paella).')
  })

  it('cuenta las líneas que se van y dice que lo comprado se queda', () => {
    const lineas = [linea('arroz|g'), linea('azafrán|g', { comprado: true })]
    const frase = queSeLlevaUnaCena(jueves, { ...base, lineas })
    expect(frase).toContain('Se va 1 línea de la compra')
    expect(frase).toContain('la que ya está comprada se queda')
  })

  it('sin nada que arrastrar, la frase se queda corta: el cero no se dice', () => {
    const frase = queSeLlevaUnaCena(jueves, { ...base, lineas: [] })
    expect(frase).not.toMatch(/0 línea|ninguna línea/)
    expect(frase.endsWith('(Paella).')).toBe(true)
  })

  it('el plural cuadra cuando son varias', () => {
    const conDos = { id: 'c1', platoIds: ['d1', 'd2'] }
    const lineas = [linea('arroz|g'), linea('azafrán|g'), linea('tomate|ud')]
    const frase = queSeLlevaUnaCena(conDos, { ...base, cenas: [conDos], lineas })
    expect(frase).toContain('Se van 3 líneas de la compra')
  })
})
