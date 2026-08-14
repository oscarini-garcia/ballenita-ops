import { describe, it, expect, beforeEach } from 'vitest'
import {
  activarModoLocal, actualizarCuenta, borrarSesion, guardarSesion, haySesion, leerSesion,
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

describe('actualizarCuenta: lo que el servidor sabe de la cuenta, refrescado', () => {
  it('aprende el personId sin tocar el token', () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', nombre: 'Mariona', rol: 'miembro' } })
    actualizarCuenta({ id: 'cta_1', nombre: 'Mariona', rol: 'miembro', personId: 'per_mariona' })
    expect(leerSesion().cuenta.personId).toBe('per_mariona')
    expect(leerSesion().token).toBe('jwt')
  })

  it('sin sesión no inventa una', () => {
    actualizarCuenta({ id: 'cta_1', personId: 'per_x' })
    expect(leerSesion()).toBe(null)
  })

  it('la cuenta de otro no pisa la guardada', () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', rol: 'miembro' } })
    actualizarCuenta({ id: 'cta_2', personId: 'per_ajena' })
    expect(leerSesion().cuenta.personId ?? null).toBe(null)
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
