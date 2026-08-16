import { describe, it, expect, beforeEach } from 'vitest'
import {
  aQuienLeImporta, leidos, marcarLeido, olvidarLeidos, sinLeer, ultimoDe, ultimos,
} from './comentarios.js'

const c = (id, escritoEl, autorId = 'otro') => ({ id, escritoEl, autorId })

describe('los comentarios (§14.55)', () => {
  beforeEach(() => { olvidarLeidos('ev') })

  it('sin haber abierto nada, todo lo de los demás está sin leer', () => {
    const hilo = [c('1', '2026-08-15T10:00:00Z'), c('2', '2026-08-15T11:00:00Z')]
    expect(sinLeer(hilo, { eventId: 'ev', ancla: 'plan:p1', meId: 'yo' })).toBe(2)
  })

  it('lo tuyo nunca cuenta como sin leer', () => {
    const hilo = [c('1', '2026-08-15T10:00:00Z', 'yo'), c('2', '2026-08-15T11:00:00Z')]
    // Es lo primero que se nota si falta: escribes y tu propia fila se enciende.
    expect(sinLeer(hilo, { eventId: 'ev', ancla: 'plan:p1', meId: 'yo' })).toBe(1)
  })

  it('marcar leído apaga el punto, y solo del hilo que se abrió', () => {
    const hilo = [c('1', '2026-08-15T10:00:00Z'), c('2', '2026-08-15T11:00:00Z')]
    marcarLeido('ev', 'plan:p1', ultimoDe(hilo))
    expect(sinLeer(hilo, { eventId: 'ev', ancla: 'plan:p1', meId: 'yo' })).toBe(0)
    expect(sinLeer(hilo, { eventId: 'ev', ancla: 'plan:p2', meId: 'yo' })).toBe(2)
  })

  it('se marca hasta el último que había, no hasta «ahora»', () => {
    const hilo = [c('1', '2026-08-15T10:00:00Z')]
    marcarLeido('ev', 'plan:p1', ultimoDe(hilo))
    // Uno escrito mientras tenías el hilo abierto sigue contando: con «ahora»
    // habría quedado marcado como visto sin haberlo visto.
    const luego = [...hilo, c('2', '2026-08-15T10:00:30Z')]
    expect(sinLeer(luego, { eventId: 'ev', ancla: 'plan:p1', meId: 'yo' })).toBe(1)
  })

  it('la marca no retrocede: volver a abrir un hilo viejo no reenciende nada', () => {
    marcarLeido('ev', 'plan:p1', '2026-08-15T11:00:00Z')
    marcarLeido('ev', 'plan:p1', '2026-08-15T09:00:00Z')
    expect(leidos('ev')['plan:p1']).toBe('2026-08-15T11:00:00Z')
  })

  it('cada evento lleva sus marcas, y olvidarlas es de uno solo', () => {
    marcarLeido('ev', 'plan:p1', '2026-08-15T11:00:00Z')
    marcarLeido('otro', 'plan:p1', '2026-08-15T11:00:00Z')
    olvidarLeidos('ev')
    expect(leidos('ev')).toEqual({})
    expect(leidos('otro')['plan:p1']).toBeTruthy()
    olvidarLeidos('otro')
  })

  it('con la marca rota, ni lanza ni pierde comentarios', () => {
    localStorage.setItem('ballena.leido:ev', 'esto no es json')
    expect(leidos('ev')).toEqual({})
    expect(sinLeer([c('1', '2026-08-15T10:00:00Z')], { eventId: 'ev', ancla: 'a', meId: 'yo' })).toBe(1)
  })

  it('en la capa se enseñan los dos últimos, que es lo que la deja de crecer', () => {
    const hilo = ['1', '2', '3', '4', '5'].map((n) => c(n, `2026-08-15T1${n}:00:00Z`))
    expect(ultimos(hilo).map((x) => x.id)).toEqual(['4', '5'])
    // Con menos de dos, los que haya.
    expect(ultimos(hilo.slice(0, 1))).toHaveLength(1)
    expect(ultimos([])).toEqual([])
  })

  it('a quién le importa son los involucrados y los del hilo, menos quien escribe', () => {
    expect(aQuienLeImporta({
      involucrados: ['curro', 'ana'],
      enElHilo: ['luis', 'curro'],
      autor: 'ana',
    }).sort()).toEqual(['curro', 'luis'])
  })

  it('sin nadie a quien importarle, la lista sale vacía y no con huecos', () => {
    expect(aQuienLeImporta({ involucrados: [null], enElHilo: [undefined], autor: null })).toEqual([])
  })
})
