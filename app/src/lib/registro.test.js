import { describe, it, expect } from 'vitest'
import { apunteDe, claseDe, TABLAS_QUE_SE_APUNTAN } from './registro.js'

// La bitácora del viaje (SPECS §14.50). Lo que se prueba aquí es la frase: si
// dice el hecho o dice el campo, que es la diferencia entre un recap y un log.

describe('qué deja rastro y qué no', () => {
  it('el registro no se registra a sí mismo, ni la cola, ni el evento', () => {
    for (const t of ['registro', 'outbox', 'events']) {
      expect(TABLAS_QUE_SE_APUNTAN.has(t)).toBe(false)
      expect(apunteDe({ tabla: t, accion: 'crear', fila: { name: 'x' } })).toBe(null)
    }
  })
})

describe('el dinero', () => {
  it('un gasto se dice por su nombre, y borrarlo también', () => {
    const fila = { description: 'Hielo y birras', amountCents: 2430 }
    expect(apunteDe({ tabla: 'expenses', accion: 'crear', fila }))
      .toEqual({ clase: 'gasto', texto: 'apuntó «Hielo y birras»' })
    expect(apunteDe({ tabla: 'expenses', accion: 'editar', fila, antes: fila }).texto)
      .toBe('retocó «Hielo y birras»')
    expect(apunteDe({ tabla: 'expenses', accion: 'borrar', fila }).texto)
      .toBe('borró «Hielo y birras»')
  })

  it('un gasto sin descripción no deja un hueco', () => {
    expect(apunteDe({ tabla: 'expenses', accion: 'crear', fila: { amountCents: 100 } }).texto)
      .toBe('apuntó «un gasto»')
  })

  it('una liquidación es dinero, como el gasto', () => {
    expect(apunteDe({ tabla: 'settlements', accion: 'crear', fila: {} }))
      .toEqual({ clase: 'gasto', texto: 'saldó una deuda' })
  })
})

describe('los planes: votar no es editar', () => {
  const plan = { titulo: 'Playa de la Cala', votos: {}, estado: 'votando', dia: null }

  it('proponer, votar, poner día y confirmar son cuatro renglones distintos', () => {
    expect(apunteDe({ tabla: 'plans', accion: 'crear', fila: plan }))
      .toEqual({ clase: 'plan', texto: 'propuso «Playa de la Cala»' })

    // Votar es lo que más se hace, y se reconoce porque cambia el mapa de votos.
    expect(apunteDe({
      tabla: 'plans', accion: 'editar', antes: plan, fila: { ...plan, votos: { p1: '👍' } },
    })).toEqual({ clase: 'voto', texto: 'votó «Playa de la Cala»' })

    expect(apunteDe({
      tabla: 'plans', accion: 'editar', antes: plan, fila: { ...plan, dia: '2026-08-17' },
    }).texto).toMatch(/^puso «Playa de la Cala» el /)

    expect(apunteDe({
      tabla: 'plans', accion: 'editar', antes: plan, fila: { ...plan, estado: 'elegido' },
    }).texto).toBe('puso «Playa de la Cala» en «elegido»')
  })
})

describe('la compra: lo que interesa es marcar', () => {
  const linea = { texto: 'Hielos', comprado: false }

  it('apuntar y tachar sí, y recalcular una cantidad no', () => {
    expect(apunteDe({ tabla: 'shop', accion: 'crear', fila: linea }).texto)
      .toBe('apuntó «Hielos» en la compra')
    expect(apunteDe({
      tabla: 'shop', accion: 'editar', antes: linea, fila: { ...linea, comprado: true },
    }).texto).toBe('tachó «Hielos»')
    expect(apunteDe({
      tabla: 'shop', accion: 'editar', antes: { ...linea, comprado: true }, fila: { ...linea, comprado: false },
    }).texto).toBe('desmarcó «Hielos»')

    // Rehacer las cantidades al cambiar una cena toca todas las líneas de golpe
    // (§14.20): si eso dejara renglón, el recap sería la lista de la compra.
    expect(apunteDe({
      tabla: 'shop', accion: 'editar', antes: linea, fila: { ...linea, cantidad: 3 },
    })).toBe(null)
  })
})

describe('la gente', () => {
  it('el estado tiene clase propia y dice lo que se ha dicho', () => {
    const antes = { name: 'Marta', estado: '' }
    expect(apunteDe({ tabla: 'persons', accion: 'editar', antes, fila: { ...antes, estado: 'modo playa' } }))
      .toEqual({ clase: 'estado', texto: 'anda «modo playa»' })
    expect(apunteDe({
      tabla: 'persons', accion: 'editar', antes: { name: 'Marta', estado: 'modo playa' }, fila: antes,
    }).texto).toBe('se quitó el estado')
  })

  it('y lo demás de una ficha es «el grupo»', () => {
    const antes = { name: 'Marta', apodo: '' }
    expect(apunteDe({ tabla: 'persons', accion: 'editar', antes, fila: { ...antes, apodo: 'la jefa' } }))
      .toEqual({ clase: 'grupo', texto: 'retocó la ficha de Marta' })
  })
})

describe('la cena dice de qué día es', () => {
  it('y al borrarla lo sigue diciendo, porque la fila se lee antes', () => {
    const cena = { dia: '2026-08-17', platoIds: ['d1'] }
    expect(apunteDe({ tabla: 'dinners', accion: 'crear', fila: cena }).texto).toMatch(/^montó la cena del /)
    expect(apunteDe({ tabla: 'dinners', accion: 'borrar', fila: cena }).texto).toMatch(/^quitó la cena del /)
  })
})

describe('el catálogo de clases', () => {
  it('cada clase que sale de `apunteDe` tiene nombre y emoji', () => {
    const casos = [
      { tabla: 'expenses', accion: 'crear', fila: {} },
      { tabla: 'dinners', accion: 'crear', fila: { dia: '2026-08-17' } },
      { tabla: 'plans', accion: 'crear', fila: {} },
      { tabla: 'planIdeas', accion: 'crear', fila: {} },
      { tabla: 'shop', accion: 'crear', fila: {} },
      { tabla: 'persons', accion: 'crear', fila: {} },
      { tabla: 'families', accion: 'crear', fila: {} },
      { tabla: 'bungas', accion: 'crear', fila: {} },
      { tabla: 'dishes', accion: 'crear', fila: {} },
      { tabla: 'mejoras', accion: 'crear', fila: {} },
    ]
    for (const c of casos) {
      const clase = claseDe(apunteDe(c).clase)
      expect(clase, `${c.tabla} sin clase en CLASES`).toBeTruthy()
      expect(clase.emoji).toBeTruthy()
    }
    // Y la de votar, que solo sale de una edición.
    expect(claseDe('voto')).toBeTruthy()
  })
})
