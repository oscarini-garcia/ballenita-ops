import { describe, it, expect, vi } from 'vitest'
import { sincronizarTodo, informeDelFallo } from './sincronizarTodo.js'

const alDia = () => Promise.resolve('al-dia')

describe('sincronizarTodo', () => {
  it('cuenta las dos capas en una sola lista: primero los datos, después la app', async () => {
    const pasos = await sincronizarTodo({
      sincronizarDatos: () => Promise.resolve({ status: 'synced' }),
      comprobarApp: alDia,
    })

    expect(pasos.map((p) => p.estado)).toEqual(['hecho', 'hecho'])
    expect(pasos[0].texto).toMatch(/Datos al día/)
    expect(pasos[1].texto).toMatch(/última versión/)
  })

  it('un fallo de datos no impide comprobar la app: son dos preguntas distintas', async () => {
    const pasos = await sincronizarTodo({
      sincronizarDatos: () => Promise.resolve({ status: 'offline' }),
      comprobarApp: alDia,
    })

    expect(pasos).toHaveLength(2)
    expect(pasos[0].estado).toBe('fallo')
    expect(pasos[0].texto).toMatch(/no hay conexión/)
    expect(pasos[1].estado).toBe('hecho')
  })

  it('«solo local» es un aviso, no una avería', async () => {
    const pasos = await sincronizarTodo({
      sincronizarDatos: () => Promise.resolve({ status: 'no-config' }),
      comprobarApp: alDia,
    })
    expect(pasos[0].estado).toBe('aviso')
  })

  it('una excepción en la sincronización se cuenta, no revienta', async () => {
    const pasos = await sincronizarTodo({
      sincronizarDatos: () => Promise.reject(new Error('boom')),
      comprobarApp: alDia,
    })
    expect(pasos[0].estado).toBe('fallo')
    expect(pasos[0].texto).toMatch(/boom/)
  })

  it('va avisando en cada cambio, para que el modal se vea moverse', async () => {
    const vistos = []
    await sincronizarTodo({
      sincronizarDatos: () => Promise.resolve({ status: 'synced' }),
      comprobarApp: alDia,
      alAvanzar: (p) => vistos.push(p.map((x) => x.estado).join('·')),
    })

    // Abrir en curso → cerrar → abrir el siguiente en curso → cerrar.
    expect(vistos).toEqual(['curso', 'hecho', 'hecho·curso', 'hecho·hecho'])
  })

  it('cada avance es una copia: la UI no recibe el mismo array mutado', async () => {
    const vistos = []
    await sincronizarTodo({
      sincronizarDatos: () => Promise.resolve({ status: 'synced' }),
      comprobarApp: alDia,
      alAvanzar: (p) => vistos.push(p),
    })
    // Sin la copia, React vería siempre la misma referencia y no repintaría.
    expect(vistos[0]).not.toBe(vistos[1])
    expect(vistos[0]).toHaveLength(1)
  })

  it('lo que el servidor rechaza se dice, no se queda en la consola', async () => {
    // La interfaz es optimista: un cambio rechazado se vio guardado un momento y
    // desaparece con la instantánea. Callarlo se lee como que la app pierde cosas.
    const pasos = await sincronizarTodo({
      sincronizarDatos: () => Promise.resolve({
        status: 'synced',
        rechazados: [{ tabla: 'expenses', id: 'exp_1', motivo: 'obsoleto' }],
      }),
      comprobarApp: alDia,
    })

    expect(pasos).toHaveLength(3)
    expect(pasos[0].estado).toBe('hecho')
    expect(pasos[1]).toMatchObject({ estado: 'fallo' })
    expect(pasos[1].texto).toMatch(/1 cambio no se ha guardado/)
  })

  it('un fallo trae su informe para llevárselo: no se transcribe a mano', async () => {
    const pasos = await sincronizarTodo({
      sincronizarDatos: () => Promise.resolve({
        status: 'error',
        error: 'la API respondió 500: base de datos no disponible',
        estado: 500,
        ultima: new Date('2026-08-12T09:00:00').getTime(),
      }),
      comprobarApp: alDia,
    })

    expect(pasos[0].estado).toBe('fallo')
    expect(pasos[0].informe).toMatch(/Ballena Ops v/)
    expect(pasos[0].informe).toMatch(/base de datos no disponible/)
    expect(pasos[0].informe).toMatch(/Estado HTTP: 500/)
    expect(pasos[0].informe).toMatch(/Última correcta:/)
  })

  it('sin fallo no hay informe que llevarse', async () => {
    const pasos = await sincronizarTodo({
      sincronizarDatos: () => Promise.resolve({ status: 'synced' }),
      comprobarApp: alDia,
    })
    expect(pasos.every((p) => !p.informe)).toBe(true)
  })

  it('el informe dice cuándo fue la última correcta, o que nunca la hubo', () => {
    expect(informeDelFallo({ motivo: 'x', ultima: null })).toMatch(/Nunca ha llegado a sincronizar/)
  })

  it('pasa los rótulos de cada fase de la actualización a la lista', async () => {
    const comprobarApp = vi.fn(async ({ onStatus }) => {
      onStatus('downloading')
      return 'actualizando'
    })
    const pasos = await sincronizarTodo({
      sincronizarDatos: () => Promise.resolve({ status: 'synced' }),
      comprobarApp,
    })

    expect(comprobarApp).toHaveBeenCalled()
    expect(pasos[1].texto).toMatch(/se recarga sola/)
  })
})
