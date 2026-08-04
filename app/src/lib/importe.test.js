import { describe, it, expect } from 'vitest'
import {
  IMPORTE_VACIO, desdeCents, teclear, totalCents, guardable, cinta, enPalabras, TECLAS,
} from './importe.js'

/** Teclea una secuencia entera: `pulsar('2','4','3','0')`. */
const pulsar = (...teclas) => teclas.reduce(teclear, IMPORTE_VACIO)

describe('el importe se teclea como una caja registradora', () => {
  it('los dígitos entran por la derecha: 2·4·3·0 son 24,30 €', () => {
    expect(totalCents(pulsar('2', '4', '3', '0'))).toBe(2430)
  })

  it('un solo dígito son céntimos, no euros', () => {
    expect(totalCents(pulsar('5'))).toBe(5)
    expect(enPalabras(totalCents(pulsar('5')))).toBe('0,05')
  })

  it('«00» ahorra los dos toques de un importe redondo', () => {
    expect(totalCents(pulsar('1', '4', '8', '00'))).toBe(14800)
  })

  it('no se pasa del tope aunque se apoye el dedo', () => {
    const largo = pulsar(...Array(14).fill('9'))
    expect(totalCents(largo)).toBe(99999999)
  })
})

describe('sumar y restar sin salir de la ficha', () => {
  it('dos tickets: 18,40 + 5,90 = 24,30 sin tocar «=»', () => {
    const e = pulsar('1', '8', '4', '0', '+', '5', '9', '0')
    expect(totalCents(e)).toBe(2430)
  })

  it('«=» aplana: el total se queda y la cinta se vacía', () => {
    const e = teclear(pulsar('1', '8', '4', '0', '+', '5', '9', '0'), '=')
    expect(totalCents(e)).toBe(2430)
    expect(cinta(e)).toBe('')
    // Y se puede seguir operando sobre el resultado.
    expect(totalCents(pulsar('1', '8', '4', '0', '+', '5', '9', '0'))).toBe(2430)
  })

  it('resta', () => {
    expect(totalCents(pulsar('2', '0', '00', '−', '5', '00'))).toBe(1500)
  })

  it('un signo detrás de otro cambia de idea, no suma cero', () => {
    const e = pulsar('1', '0', '00', '+', '−', '3', '00')
    expect(totalCents(e)).toBe(700)
    expect(e.terminos).toHaveLength(1)
  })
})

describe('deshacer', () => {
  it('«⌫» quita un dígito', () => {
    expect(totalCents(pulsar('2', '4', '3', '0', '⌫'))).toBe(243)
  })

  it('sin cifra que borrar, «⌫» recupera el término anterior', () => {
    const e = pulsar('1', '8', '4', '0', '+', '⌫')
    expect(totalCents(e)).toBe(1840)
    expect(e.terminos).toHaveLength(0)
    expect(cinta(e)).toBe('')
  })

  it('«C» lo borra todo', () => {
    const e = pulsar('1', '8', '4', '0', '+', '5', '9', '0', 'C')
    expect(e).toEqual(IMPORTE_VACIO)
    expect(totalCents(e)).toBe(0)
  })
})

describe('lo que se enseña', () => {
  it('la cinta solo aparece cuando hay operación', () => {
    expect(cinta(pulsar('2', '4', '3', '0'))).toBe('')
    expect(cinta(pulsar('1', '8', '4', '0', '+'))).toBe('18,40 +')
    expect(cinta(pulsar('1', '8', '4', '0', '+', '5', '9', '0'))).toBe('18,40 + 5,90')
    expect(cinta(pulsar('2', '0', '00', '−', '5', '00'))).toBe('20,00 − 5,00')
  })

  it('las cifras salen en español y siempre con dos decimales', () => {
    expect(enPalabras(2430)).toBe('24,30')
    expect(enPalabras(14800)).toBe('148,00')
    expect(enPalabras(0)).toBe('0,00')
  })
})

describe('cuándo se puede guardar', () => {
  it('cero no se guarda: un gasto de 0 € no es un gasto', () => {
    expect(guardable(IMPORTE_VACIO)).toBe(false)
    expect(guardable(pulsar('0', '0'))).toBe(false)
  })

  it('un total negativo tampoco, pero se enseña', () => {
    const e = pulsar('5', '00', '−', '9', '00')
    expect(totalCents(e)).toBe(-400)
    expect(guardable(e)).toBe(false)
  })

  it('cualquier cosa positiva, sí', () => {
    expect(guardable(pulsar('1'))).toBe(true)
  })
})

describe('corregir un gasto', () => {
  it('arranca con la cifra puesta y sin operación', () => {
    const e = desdeCents(2460)
    expect(totalCents(e)).toBe(2460)
    expect(cinta(e)).toBe('')
    // Y `⌫` la corrige dígito a dígito, como si la hubieras tecleado tú.
    expect(totalCents(teclear(e, '⌫'))).toBe(246)
  })
})

describe('el pad', () => {
  it('son dieciséis teclas y la coma no está entre ellas', () => {
    expect(TECLAS).toHaveLength(16)
    expect(TECLAS).not.toContain(',')
    expect(TECLAS).toContain('C')
  })
})
