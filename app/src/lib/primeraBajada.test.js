import { describe, it, expect, vi, beforeEach } from 'vitest'
import { primeraBajada } from './primeraBajada.js'

beforeEach(() => localStorage.clear())

describe('primeraBajada', () => {
  it('cuenta los pasos y dice que ha ido bien', async () => {
    const pintados = []
    const { bien, pasos } = await primeraBajada({
      sincronizarDatos: async () => ({ status: 'synced' }),
      alAvanzar: (p) => pintados.push(p),
    })

    expect(bien).toBe(true)
    expect(pasos.map((p) => p.estado)).toEqual(['hecho', 'hecho'])
    // La lista se pinta mientras pasa, no solo al final: es lo que la distingue
    // de un «Cargando…».
    expect(pintados.length).toBeGreaterThan(1)
  })

  it('sin API configurada no hay nada que traer, y eso no es un fallo', async () => {
    const { bien, pasos } = await primeraBajada({ sincronizarDatos: async () => ({ status: 'no-config' }) })

    expect(bien).toBe(true)
    expect(pasos.at(-1).estado).toBe('aviso')
  })

  // Un «Cargando…» que no acaba no dice por qué. Esto sí, y además se toca para
  // llevarse el informe (SPECS §14.9-bis).
  it('cuando falla lo dice con su motivo y deja copiar el informe', async () => {
    const { bien, pasos } = await primeraBajada({
      sincronizarDatos: async () => ({ status: 'error', error: 'HTTP 502 · el Worker no contesta', estado: 502 }),
    })

    expect(bien).toBe(false)
    expect(pasos.at(-1).estado).toBe('fallo')
    expect(pasos.at(-1).texto).toMatch(/502/)
    expect(pasos.at(-1).informe).toMatch(/Estado HTTP: 502/)
  })

  it('un error lanzado se cuenta igual que uno devuelto', async () => {
    const { bien, pasos } = await primeraBajada({
      sincronizarDatos: async () => { throw new Error('se cayó la red') },
    })

    expect(bien).toBe(false)
    expect(pasos.at(-1).texto).toMatch(/se cayó la red/)
  })

  // La versión de la app **no** se comprueba aquí: `sincronizarTodo` lo hace y
  // recarga si hay una nueva, y recargar a los tres segundos de entrar por
  // primera vez, sin que nadie lo haya pedido, es la peor primera impresión.
  it('no comprueba la versión de la app', async () => {
    const { pasos } = await primeraBajada({ sincronizarDatos: async () => ({ status: 'synced' }) })
    expect(pasos.some((p) => /versión/i.test(p.texto))).toBe(false)
  })
})
