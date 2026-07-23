import { describe, it, expect } from 'vitest'
import { getPref, setPref, currentSkin, rollRandom, applySkin, POOL } from './skins.js'

describe('skins', () => {
  it('por defecto es "sistema"', () => {
    expect(getPref()).toBe('sistema')
  })

  it('elegir un tema concreto se resuelve tal cual', () => {
    setPref('abisal')
    expect(currentSkin()).toBe('abisal')
  })

  it('aleatorio resuelve a uno del pool', () => {
    setPref('random')
    expect(POOL).toContain(currentSkin())
  })

  it('rollRandom(true) evita repetir el mismo tema seguido', () => {
    const a = rollRandom(true)
    const b = rollRandom(true)
    expect(a).not.toBe(b)
    expect(POOL).toContain(a)
    expect(POOL).toContain(b)
  })

  it('sin forzar, no rota (mismo resultado inmediato)', () => {
    const a = rollRandom(true)
    const b = rollRandom(false)
    expect(a).toBe(b)
  })

  it('applySkin pone/quita data-skin en <html>', () => {
    setPref('verbena')
    applySkin()
    expect(document.documentElement.getAttribute('data-skin')).toBe('verbena')
    setPref('sistema')
    applySkin()
    expect(document.documentElement.hasAttribute('data-skin')).toBe(false)
  })
})
