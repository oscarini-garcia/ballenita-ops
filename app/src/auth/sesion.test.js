import { describe, it, expect, beforeEach } from 'vitest'
import {
  activarModoLocal, borrarSesion, guardarSesion, haySesion, leerSesion,
  modoLocal, salirDeModoLocal,
} from './sesion.js'

beforeEach(() => {
  localStorage.clear()
})

describe('sesión del dispositivo', () => {
  it('guarda, lee y borra', () => {
    expect(haySesion()).toBe(false)
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', rol: 'administrador' } })
    expect(haySesion()).toBe(true)
    expect(leerSesion().cuenta.rol).toBe('administrador')
    borrarSesion()
    expect(leerSesion()).toBe(null)
  })

  it('un valor corrupto no rompe la app: se lee como «sin sesión»', () => {
    localStorage.setItem('ballena.sesion', '{no es json')
    expect(leerSesion()).toBe(null)
    expect(haySesion()).toBe(false)
  })
})

describe('modo local', () => {
  it('empieza apagado y se recuerda entre arranques', () => {
    expect(modoLocal()).toBe(false)
    activarModoLocal()
    expect(modoLocal()).toBe(true)
  })

  it('se apaga al querer volver a intentar el acceso', () => {
    activarModoLocal()
    salirDeModoLocal()
    expect(modoLocal()).toBe(false)
  })

  it('es independiente de la sesión: entrar no lo borra por su cuenta', () => {
    activarModoLocal()
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1' } })
    expect(modoLocal()).toBe(true)
    expect(haySesion()).toBe(true)
  })
})
