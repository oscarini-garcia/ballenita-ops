import { describe, it, expect } from 'vitest'
import { repartoDeFamilias, fraseDelReparto } from './reparto-vista.js'
import { formatCents } from './money.js'

/**
 * El reparto a la vista (§14.68 · R1 · R5).
 *
 * La cuenta ya estaba probada en `reparto.test.js`; lo que se prueba aquí es
 * **cómo se cuenta**, que es donde estaba el trabajo: qué se ordena, qué se
 * calla y cuándo «a cada una» deja de ser verdad.
 */
const FAMILIAS = [
  { id: 'ga', name: 'García' },
  { id: 'pe', name: 'Pérez' },
  { id: 'so', name: 'Solteros' },
]
// Tres, dos y uno: los pesos son los de siempre —1 el mayor, 0,6 el niño—.
const PERSONAS = {
  a: { id: 'a', name: 'Ana', familyId: 'ga' },
  b: { id: 'b', name: 'Bea', familyId: 'ga' },
  c: { id: 'c', name: 'Coco', familyId: 'ga' },
  d: { id: 'd', name: 'Dani', familyId: 'pe' },
  e: { id: 'e', name: 'Eva', familyId: 'pe' },
  f: { id: 'f', name: 'Fran', familyId: 'so' },
}
const TODOS = ['a', 'b', 'c', 'd', 'e', 'f']
const texto = (trozos) => trozos.map((t) => t.t).join('')
// El dinero se compone con `formatCents` y no a mano: `Intl` mete un espacio
// **duro** antes del símbolo, y un literal con el espacio normal da un fallo
// en el que las dos cadenas se ven idénticas en pantalla.
const eur = (c) => formatCents(c, 'EUR')
const negritas = (trozos) => trozos.filter((t) => t.fuerte).map((t) => t.t)

describe('el reparto de un gasto, para enseñarlo', () => {
  it('sale por familia, de más a menos y con su nombre', () => {
    const filas = repartoDeFamilias(
      { amountCents: 4860, participantIds: TODOS, reparto: null }, FAMILIAS, PERSONAS,
    )
    expect(filas.map((f) => [f.nombre, f.cents])).toEqual([
      ['García', 2430], ['Pérez', 1620], ['Solteros', 810],
    ])
  })

  it('una familia que no entra en el gasto no es un renglón a cero', () => {
    const filas = repartoDeFamilias(
      { amountCents: 4860, participantIds: ['a', 'd'], reparto: null }, FAMILIAS, PERSONAS,
    )
    expect(filas.map((f) => f.nombre)).toEqual(['García', 'Pérez'])
  })

  it('quien no tiene familia sale con su nombre, no como «Sin familia»', () => {
    const suelto = { ...PERSONAS, z: { id: 'z', name: 'Zoe' } }
    const filas = repartoDeFamilias(
      { amountCents: 1000, participantIds: ['a', 'z'], reparto: null }, FAMILIAS, suelto,
    )
    expect(filas.map((f) => f.nombre).sort()).toEqual(['García', 'Zoe'])
  })

  it('sigue los tres modos, porque la cuenta es la de siempre', () => {
    const partes = repartoDeFamilias(
      { amountCents: 4800, participantIds: TODOS, reparto: { modo: 'partes', porFamilia: { ga: 1, pe: 1 } } },
      FAMILIAS, PERSONAS,
    )
    expect(partes.map((f) => f.cents)).toEqual([2400, 2400])
  })
})

describe('la línea que lo dice (R1)', () => {
  it('sin importe todavía no dice nada', () => {
    expect(fraseDelReparto([])).toBeNull()
  })

  it('con una sola familia dentro, se lo lleva entera', () => {
    const filas = repartoDeFamilias(
      { amountCents: 4860, participantIds: ['a', 'b'], reparto: null }, FAMILIAS, PERSONAS,
    )
    expect(texto(fraseDelReparto(filas))).toBe('Entero para García')
  })

  /** El 90 % de los gastos: un pagador y todos dentro, a partes iguales. */
  it('repartido igual, dice cuánto a cada una y cuántas son', () => {
    const filas = repartoDeFamilias(
      { amountCents: 4860, participantIds: TODOS, reparto: { modo: 'partes', porFamilia: { ga: 1, pe: 1, so: 1 } } },
      FAMILIAS, PERSONAS,
    )
    const frase = fraseDelReparto(filas)
    expect(texto(frase)).toBe(`3 familias · ${eur(1620)} cada una`)
    expect(negritas(frase)).toEqual([eur(1620)])
  })

  /**
   * El pico del resto mayor **no rompe la frase normal**: 10,00 entre tres son
   * 3,34 · 3,33 · 3,33, y eso es un reparto a partes iguales con el céntimo
   * colocado. Sin la holgura de un céntimo, el caso más común de todos saldría
   * con la frase de «reparto fino».
   */
  it('un céntimo de diferencia por el resto mayor sigue siendo «a cada una»', () => {
    const filas = repartoDeFamilias(
      { amountCents: 1000, participantIds: TODOS, reparto: { modo: 'partes', porFamilia: { ga: 1, pe: 1, so: 1 } } },
      FAMILIAS, PERSONAS,
    )
    expect(filas.map((f) => f.cents)).toEqual([334, 333, 333])
    expect(texto(fraseDelReparto(filas))).toBe(`3 familias · ${eur(334)} cada una`)
  })

  /** Con coeficientes distintos «a cada una» sería mentira. */
  it('repartido fino, dice el suelo y el techo en vez de mentir', () => {
    const filas = repartoDeFamilias(
      { amountCents: 4860, participantIds: TODOS, reparto: null }, FAMILIAS, PERSONAS,
    )
    expect(texto(fraseDelReparto(filas)))
      .toBe(`3 familias · de 8,10 a ${eur(2430)}`)
  })

  it('respeta la moneda del gasto', () => {
    const filas = repartoDeFamilias(
      { amountCents: 4860, participantIds: ['a', 'b'], reparto: null }, FAMILIAS, PERSONAS,
    )
    expect(texto(fraseDelReparto(filas, 'GBP'))).toBe('Entero para García')
    const tres = repartoDeFamilias(
      { amountCents: 4860, participantIds: TODOS, reparto: { modo: 'partes', porFamilia: { ga: 1, pe: 1, so: 1 } } },
      FAMILIAS, PERSONAS,
    )
    expect(texto(fraseDelReparto(tres, 'GBP'))).toContain(formatCents(1620, 'GBP'))
  })
})

/**
 * El renglón cabe en una línea, y eso es un requisito medido y no una manía.
 *
 * La ficha rápida de §14.26 cabía **exacta** en Grande —0 pt de scroll— y su
 * botón de guardar se veía entero. Con la frase larga («Se reparte entre 3
 * familias, de 8,10 € a 24,30 €.») se iba a dos líneas y el botón se quedaba al
 * 59 %: la línea puesta para no tener que abrir nada obligaba a rodar para
 * llegar a Guardar. En Enorme era peor —el botón salía de la ventana entero—.
 *
 * 34 letras es lo que entra en un renglón de `--t-sub` en la caja de 362 pt con
 * la letra en **Enorme**, que es la que manda. Aquí se cuentan letras porque en
 * jsdom no hay maquetación: el ancho de verdad se midió en el navegador.
 */
describe('y cabe en un renglón', () => {
  const TOPE = 34
  const casos = [
    ['una familia', ['a', 'b'], null],
    ['a partes iguales', TODOS, { modo: 'partes', porFamilia: { ga: 1, pe: 1, so: 1 } }],
    ['por coeficiente', TODOS, null],
  ]
  for (const [nombre, quienes, reparto] of casos) {
    it(`${nombre}: ${TOPE} letras o menos`, () => {
      const filas = repartoDeFamilias(
        { amountCents: 4860, participantIds: quienes, reparto }, FAMILIAS, PERSONAS,
      )
      const frase = texto(fraseDelReparto(filas))
      expect(frase.length, `«${frase}» son ${frase.length} letras`).toBeLessThanOrEqual(TOPE)
    })
  }

  // Con seis familias y cifras de cuatro dígitos sigue entrando: es el peor
  // caso realista —el grupo son nueve personas— y el que rompería la línea.
  it('aguanta seis familias y cifras de cuatro cifras', () => {
    const seis = Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, name: `Familia ${i}` }))
    const gente = Object.fromEntries(seis.map((f, i) => [`p${i}`, { id: `p${i}`, name: `P${i}`, familyId: f.id }]))
    const filas = repartoDeFamilias(
      {
        amountCents: 999999,
        participantIds: Object.keys(gente),
        reparto: { modo: 'partes', porFamilia: Object.fromEntries(seis.map((f, i) => [f.id, i + 1])) },
      },
      seis, gente,
    )
    const frase = texto(fraseDelReparto(filas))
    expect(frase.length, `«${frase}» son ${frase.length} letras`).toBeLessThanOrEqual(TOPE)
  })
})
