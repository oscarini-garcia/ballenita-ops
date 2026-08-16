import { describe, it, expect } from 'vitest'
import { conPegatina, historicoDe, pegatinasPuestas, resumenDelHistorico } from './alojamientos.js'

const EVENTOS = [
  { id: 'e24', name: 'Playa 2024', startDate: '2024-08-10' },
  { id: 'e25', name: 'Playa 2025', startDate: '2025-08-09' },
  { id: 'e26', name: 'Playa 2026', startDate: '2026-08-15' },
]
const FAMILIAS = [
  { id: 'garcia', name: 'García' },
  { id: 'perez', name: 'Pérez' },
  { id: 'solteros', name: 'Solteros' },
]
const BUNGAS = [
  { id: 'b24', eventId: 'e24', alojamientoId: 'a1', familyId: 'perez' },
  { id: 'b25', eventId: 'e25', alojamientoId: 'a1', familyId: 'solteros' },
  { id: 'b26', eventId: 'e26', alojamientoId: 'a1', familyId: 'garcia' },
  { id: 'otro', eventId: 'e26', alojamientoId: 'a2', familyId: 'perez' },
]

describe('el bunga como sitio (§14.56)', () => {
  it('el histórico sale de los eventos y los bungas, sin guardar nada', () => {
    const h = historicoDe('a1', { eventos: EVENTOS, bungas: BUNGAS, familias: FAMILIAS })
    expect(h.map((x) => [x.anio, x.familia?.name])).toEqual([
      ['2026', 'García'], ['2025', 'Solteros'], ['2024', 'Pérez'],
    ])
  })

  it('el año lo da la fecha del viaje, no cuándo se creó la fila', () => {
    // Un evento se crea en junio y es de agosto, y en enero se planifica el del
    // verano: `creadoEn` diría el año equivocado la mitad de las veces.
    const [ultimo] = historicoDe('a1', { eventos: EVENTOS, bungas: BUNGAS, familias: FAMILIAS })
    expect(ultimo.evento.name).toBe('Playa 2026')
  })

  it('un viaje sin fechas entra igual, y va al final', () => {
    const eventos = [...EVENTOS, { id: 'ex', name: 'Finde suelto' }]
    const bungas = [...BUNGAS, { id: 'bx', eventId: 'ex', alojamientoId: 'a1', familyId: 'perez' }]
    const h = historicoDe('a1', { eventos, bungas, familias: FAMILIAS })
    // Apartarlo lo dejaría invisible teniendo datos, que es lo que §14.10-quater
    // decidió no hacer con las cenas y los planes.
    expect(h).toHaveLength(4)
    expect(h.at(-1).anio).toBe(null)
  })

  it('sin alojamiento no hay histórico: un bunga suelto no es un sitio', () => {
    expect(historicoDe(null, { eventos: EVENTOS, bungas: BUNGAS })).toEqual([])
  })

  it('el resumen no cuenta el viaje en curso: quien está ahí no ha «estado»', () => {
    const h = historicoDe('a1', { eventos: EVENTOS, bungas: BUNGAS, familias: FAMILIAS })
    expect(resumenDelHistorico(h, { salvoBungaId: 'b26' })).toBe('aquí desde 2024')
  })

  it('con un solo año lo dice, y estrenando lo dice también', () => {
    const h = historicoDe('a2', { eventos: EVENTOS, bungas: BUNGAS, familias: FAMILIAS })
    expect(resumenDelHistorico(h, { salvoBungaId: 'otro' })).toBe('estrenan')

    const dos = historicoDe('a1', {
      eventos: EVENTOS,
      bungas: BUNGAS.filter((b) => ['b25', 'b26'].includes(b.id)),
      familias: FAMILIAS,
    })
    expect(resumenDelHistorico(dos, { salvoBungaId: 'b26' })).toBe('ya estuvieron en 2025')
  })

  it('una pegatina se pone y se quita, y siempre en una lista nueva', () => {
    const antes = ['nevera']
    const con = conPegatina(antes, 'sombra')
    expect(con).toEqual(['nevera', 'sombra'])
    // Nunca la misma lista: mutada en sitio no se distingue de la que había, y
    // el cambio no llegaría a subir.
    expect(con).not.toBe(antes)
    expect(conPegatina(con, 'nevera')).toEqual(['sombra'])
    expect(conPegatina(undefined, 'bano')).toEqual(['bano'])
  })

  it('las puestas salen en el orden del catálogo y no en el de los toques', () => {
    const catalogo = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    // Dos bungas con las mismas tres pegatinas tienen que verse iguales.
    expect(pegatinasPuestas(['c', 'a'], catalogo).map((p) => p.id)).toEqual(['a', 'c'])
  })
})
