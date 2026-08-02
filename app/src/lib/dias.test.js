import { describe, it, expect } from 'vitest'
import {
  diasDe, resumenDeDia, diaQueEnsenaHoy, rotuloDelDia, titularDeCena,
  numeroYDia, diasEntre, platoQueManda,
} from './dias.js'

// Ballenita 2026, que es la semilla real de `db.js`: 8–15 de agosto.
const EVENTO = { startDate: '2026-08-08', endDate: '2026-08-15' }
const PAELLA = { id: 'd1', name: 'Paella mixta', categorias: ['principal'] }
const ACEITUNAS = { id: 'd2', name: 'Aceitunas y altramuces', categorias: ['aperitivo'] }
const SANDIA = { id: 'd3', name: 'Sandía', categorias: ['postre'] }

describe('diasDe', () => {
  it('da todos los días del evento, incluidos los vacíos', () => {
    const dias = diasDe(EVENTO)
    expect(dias).toHaveLength(8)
    expect(dias[0]).toBe('2026-08-08')
    expect(dias.at(-1)).toBe('2026-08-15')
  })

  it('un evento de un solo día es un día', () => {
    expect(diasDe({ startDate: '2026-08-08' })).toEqual(['2026-08-08'])
  })

  it('sin fechas, se cae a los días apuntados, ordenados y sin repetir', () => {
    expect(diasDe({}, ['2026-08-12', null, '2026-08-10', '2026-08-12']))
      .toEqual(['2026-08-10', '2026-08-12'])
  })

  it('no se va por las ramas con una fecha final disparatada', () => {
    expect(diasDe({ startDate: '2026-01-01', endDate: '2030-01-01' })).toHaveLength(60)
  })
})

describe('resumenDeDia', () => {
  it('la cena manda en el titular, y la nombra el plato principal', () => {
    const r = resumenDeDia({
      cena: { platoIds: ['d1', 'd2', 'd3'] },
      platos: [ACEITUNAS, PAELLA, SANDIA],
      bungaMayores: 'El del ruido',
      planes: [],
    })
    // La bunga **no** entra en el titular: «Paella mixta en El del ruido» son
    // 268 pt en una fila que tiene 237, y se recortaba en «El del…».
    expect(r.titulo).toBe('Paella mixta')
    expect(r.detalle).toBe('3 platos · sin planes')
  })

  it('sin plato que enseñar, la bunga rescata el titular de un «Cena» pelado', () => {
    expect(resumenDeDia({ cena: { platoIds: [] }, bungaMayores: 'El del ruido' }).titulo)
      .toBe('Cena en El del ruido')
    expect(resumenDeDia({ cena: { platoIds: [] } }).titulo).toBe('Cena')
  })

  it('sin cena, titula el primer plan', () => {
    const r = resumenDeDia({ planes: [{ titulo: 'Playa de la Cala' }] })
    expect(r.titulo).toBe('Playa de la Cala')
    expect(r.detalle).toBe('sin cena · 1 plan')
  })

  it('un día sin nada lo dice, no se queda callado', () => {
    expect(resumenDeDia({})).toEqual({ titulo: 'Día libre', detalle: 'nada apuntado' })
  })

  it('el primero y el último día vacíos se llaman por lo que son', () => {
    expect(resumenDeDia({ esPrimero: true }).titulo).toBe('Llegada')
    expect(resumenDeDia({ esUltimo: true }).titulo).toBe('Vuelta a casa')
  })

  it('una cena montada sin platos no se confunde con no tener cena', () => {
    expect(resumenDeDia({ cena: { platoIds: [] } }).detalle).toBe('cena sin platos · sin planes')
  })

  it('cuenta en plural cuando toca', () => {
    expect(resumenDeDia({ planes: [{ titulo: 'a' }, { titulo: 'b' }] }).detalle)
      .toBe('sin cena · 2 planes')
  })
})

describe('diaQueEnsenaHoy', () => {
  const dias = diasDe(EVENTO)

  it('durante el viaje enseña hoy', () => {
    expect(diaQueEnsenaHoy(dias, '2026-08-09')).toEqual({ dia: '2026-08-09', estado: 'hoy', distancia: 0 })
  })

  it('antes del viaje enseña el primer día y cuánto falta', () => {
    expect(diaQueEnsenaHoy(dias, '2026-08-02')).toEqual({ dia: '2026-08-08', estado: 'antes', distancia: 6 })
  })

  it('después del viaje enseña el último y cuánto hace', () => {
    expect(diaQueEnsenaHoy(dias, '2026-08-20')).toEqual({ dia: '2026-08-15', estado: 'despues', distancia: 5 })
  })

  it('sin días no hay nada que enseñar', () => {
    expect(diaQueEnsenaHoy([], '2026-08-09')).toBeNull()
  })
})

describe('rotuloDelDia', () => {
  it('con cena, hoy es esta noche', () => {
    expect(rotuloDelDia({ dia: '2026-08-09', estado: 'hoy', distancia: 0 }, { hayCena: true }))
      .toMatch(/esta noche$/)
  })

  it('sin cena, hoy es hoy', () => {
    expect(rotuloDelDia({ dia: '2026-08-09', estado: 'hoy', distancia: 0 })).toMatch(/· hoy$/)
  })

  it('mañana se dice mañana, no «dentro de 1 días»', () => {
    expect(rotuloDelDia({ dia: '2026-08-08', estado: 'antes', distancia: 1 }))
      .toBe('sáb, 8 ago · el primer día, mañana')
  })

  it('a seis días, los cuenta', () => {
    expect(rotuloDelDia({ dia: '2026-08-08', estado: 'antes', distancia: 6 }))
      .toMatch(/dentro de 6 días$/)
  })

  it('ayer se dice ayer', () => {
    expect(rotuloDelDia({ dia: '2026-08-15', estado: 'despues', distancia: 1 }))
      .toMatch(/el último día, fue ayer$/)
  })
})

describe('titularDeCena', () => {
  it('cuenta con letra el resto de los platos', () => {
    expect(titularDeCena({ platoIds: ['d1', 'd2', 'd3'] }, [PAELLA, ACEITUNAS, SANDIA]))
      .toBe('Paella mixta y dos cosas más')
  })

  it('un plato solo es un plato solo', () => {
    expect(titularDeCena({ platoIds: ['d1'] }, [PAELLA])).toBe('Paella mixta')
  })

  it('dos platos son «una cosa más», en singular', () => {
    expect(titularDeCena({ platoIds: ['d1', 'd2'] }, [PAELLA, ACEITUNAS]))
      .toBe('Paella mixta y una cosa más')
  })

  it('sin cena y con cena vacía dicen cosas distintas', () => {
    expect(titularDeCena(null)).toBe('Sin cena montada')
    expect(titularDeCena({ platoIds: [] }, [])).toBe('Cena sin platos apuntados')
  })
})

describe('los pedazos sueltos', () => {
  it('numeroYDia da el número y tres letras', () => {
    expect(numeroYDia('2026-08-09')).toEqual({ numero: '9', semana: 'dom' })
  })

  it('diasEntre cuenta días enteros', () => {
    expect(diasEntre('2026-08-08', '2026-08-15')).toBe(7)
    expect(diasEntre('2026-08-15', '2026-08-08')).toBe(-7)
  })

  it('platoQueManda prefiere el principal aunque no sea el primero', () => {
    expect(platoQueManda([ACEITUNAS, PAELLA, SANDIA])).toBe(PAELLA)
    expect(platoQueManda([ACEITUNAS, SANDIA])).toBe(ACEITUNAS)
    expect(platoQueManda([])).toBeNull()
  })
})
