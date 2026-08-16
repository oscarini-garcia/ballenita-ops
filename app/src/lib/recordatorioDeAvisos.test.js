import { describe, it, expect, beforeEach } from 'vitest'
import {
  CADA_MS, apuntarRecordatorio, queDecir, tocaRecordar, ultimoRecordatorio,
} from './recordatorioDeAvisos.js'

/**
 * Volver a acordarse de los avisos (SPECS §14.65).
 *
 * Lo que fija esto es la asimetría que hace que el recordatorio no sea un
 * «vuelve a preguntar»: con el permiso sin contestar la hoja de iOS **sale**, y
 * con el permiso denegado **no vuelve a salir en la vida de la instalación**, así
 * que ahí no hay botón que valga y lo único cierto es dónde se enciende.
 */
beforeEach(() => localStorage.clear())

describe('qué se puede decir', () => {
  it('sin contestar, se ofrece encenderlo', () => {
    expect(queDecir('prompt').verbo).toBe('Encender los avisos')
    expect(queDecir('prompt-with-rationale').verbo).toBe('Encender los avisos')
  })

  it('denegado, se dice dónde y **sin botón**: esa hoja ya no vuelve a salir', () => {
    const dice = queDecir('denied')
    expect(dice.verbo).toBe(null)
    expect(dice.texto).toMatch(/Ajustes del iPhone/i)
  })

  it('concedido no se recuerda nada', () => {
    expect(queDecir('granted')).toBe(null)
  })

  // Ni el binario viejo ni la web: uno no se arregla desde el teléfono y la otra
  // no tiene avisos. Insistir cada semana con algo que no puedes resolver es dar
  // la lata.
  it('sin plugin y en la web tampoco', () => {
    expect(queDecir('sin-plugin')).toBe(null)
    expect(queDecir('no-aplica')).toBe(null)
  })
})

describe('cada cuánto', () => {
  const ahora = 1_760_000_000_000

  it('la primera vez sí, en cuanto el móvil se ha estrenado', () => {
    expect(tocaRecordar({ permiso: 'prompt', ultimo: null, estrenado: true, ahora })).toBe(true)
  })

  // El mismo motivo por el que el permiso no se pide al arrancar (§14.17): en el
  // primer segundo se contesta que no.
  it('en el primer arranque no', () => {
    expect(tocaRecordar({ permiso: 'prompt', ultimo: null, estrenado: false, ahora })).toBe(false)
  })

  it('recién dicho no se repite', () => {
    expect(tocaRecordar({ permiso: 'prompt', ultimo: ahora - 1000, ahora })).toBe(false)
  })

  it('a la semana, otra vez', () => {
    expect(tocaRecordar({ permiso: 'denied', ultimo: ahora - CADA_MS, ahora })).toBe(true)
    expect(tocaRecordar({ permiso: 'denied', ultimo: ahora - CADA_MS + 1, ahora })).toBe(false)
  })

  it('con los avisos encendidos, nunca', () => {
    expect(tocaRecordar({ permiso: 'granted', ultimo: null, ahora })).toBe(false)
  })
})

describe('lo que se recuerda entre arranques', () => {
  it('se guarda y se lee', () => {
    expect(ultimoRecordatorio()).toBe(null)
    apuntarRecordatorio(1234)
    expect(ultimoRecordatorio()).toBe(1234)
  })

  it('una marca ilegible no cuenta como recordado', () => {
    localStorage.setItem('ballena.avisos.recordado', 'ayer')
    expect(ultimoRecordatorio()).toBe(null)
  })
})
