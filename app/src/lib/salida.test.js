import { describe, it, expect, vi } from 'vitest'
import { comprobarAntesDeSalir, avisoDeSalida } from './salida.js'

/**
 * Salir borraba la copia local **y la cola** sin mirar, así que lo apuntado que
 * aún no había subido no volvía nunca: al entrar de nuevo la instantánea del
 * servidor es la única fuente. Desde fuera eso se ve como «he salido y ha
 * desaparecido el evento».
 */
describe('comprobarAntesDeSalir', () => {
  it('sin nada pendiente sale directo: no hay nada que perder', async () => {
    const sincronizar = vi.fn()
    const r = await comprobarAntesDeSalir({ sincronizar, pendientes: async () => 0 })

    expect(r).toEqual({ seguro: true, pendientes: 0, subidos: 0 })
    // Ni siquiera se intenta: salir no es el momento de esperar a la red.
    expect(sincronizar).not.toHaveBeenCalled()
  })

  it('con cola, la sube antes de borrar, y si sube entera sale sin preguntar', async () => {
    let quedan = 3
    const sincronizar = vi.fn(async () => { quedan = 0; return { status: 'synced' } })

    const r = await comprobarAntesDeSalir({ sincronizar, pendientes: async () => quedan })

    expect(sincronizar).toHaveBeenCalled()
    expect(r).toEqual({ seguro: true, pendientes: 0, subidos: 3 })
  })

  it('si no puede subirla, no borra nada y dice cuántos y por qué', async () => {
    const r = await comprobarAntesDeSalir({
      sincronizar: async () => ({ status: 'offline' }),
      pendientes: async () => 4,
    })

    expect(r.seguro).toBe(false)
    expect(r.pendientes).toBe(4)
    expect(r.motivo).toBe('no hay conexión')
  })

  it('un motivo que no está en la tabla se cuenta con las palabras del error', async () => {
    const r = await comprobarAntesDeSalir({
      sincronizar: async () => ({ status: 'error', error: 'la API respondió 500' }),
      pendientes: async () => 1,
    })

    expect(r.motivo).toBe('la API respondió 500')
  })

  it('si sincronizar revienta, tampoco se borra: un fallo no es permiso para perder', async () => {
    const r = await comprobarAntesDeSalir({
      sincronizar: async () => { throw new Error('sin red') },
      pendientes: async () => 2,
    })

    expect(r.seguro).toBe(false)
    expect(r.motivo).toBe('sin red')
  })

  it('sube parte: lo que queda sigue contando', async () => {
    let quedan = 5
    const r = await comprobarAntesDeSalir({
      sincronizar: async () => { quedan = 2; return { status: 'error', error: 'se cortó' } },
      pendientes: async () => quedan,
    })

    expect(r).toMatchObject({ seguro: false, pendientes: 2 })
  })
})

describe('avisoDeSalida', () => {
  it('el número va delante, que es lo que se decide', () => {
    expect(avisoDeSalida({ pendientes: 4, motivo: 'no hay conexión' }))
      .toMatch(/^4 cambios sin subir: no hay conexión\./)
  })

  it('en singular no dice «1 cambios»', () => {
    const t = avisoDeSalida({ pendientes: 1, motivo: 'no hay conexión' })
    expect(t).toMatch(/^1 cambio sin subir/)
    expect(t).toMatch(/se pierde,/)
  })
})
