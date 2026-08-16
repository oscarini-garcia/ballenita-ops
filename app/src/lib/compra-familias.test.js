import { describe, it, expect } from 'vitest'
import { dondeSeApunta, gruposDeCompra } from './compra-familias.js'

const CATS = [
  { id: 'bebida', label: 'Bebida', icon: '🍺' },
  { id: 'otros', label: 'Otros', icon: '🧺' },
]
const FAMILIAS = [
  { id: 'perez', name: 'Pérez' },
  { id: 'garcia', name: 'García' },
]

const linea = (extra) => ({ categoria: 'otros', origen: 'mano', ...extra })

describe('cómo se agrupa la compra (§14.54)', () => {
  it('lo de las cenas primero, después lo común y al final cada familia', () => {
    const grupos = gruposDeCompra([
      linea({ texto: 'Leche', familyId: 'garcia' }),
      linea({ texto: 'Arroz', origen: 'cena' }),
      linea({ texto: 'Hielo' }),
      linea({ texto: 'Pan', familyId: 'perez' }),
    ], FAMILIAS, CATS)

    expect(grupos.map((g) => g.titulo)).toEqual([
      'De las cenas · Otros', 'Otros', 'Los García', 'Los Pérez',
    ])
  })

  it('las familias van por nombre y no por el orden en que estén guardadas', () => {
    const grupos = gruposDeCompra([
      linea({ texto: 'Pan', familyId: 'perez' }),
      linea({ texto: 'Leche', familyId: 'garcia' }),
    ], FAMILIAS, CATS)
    // FAMILIAS llega con Pérez primero; se pintan García y Pérez.
    expect(grupos.map((g) => g.titulo)).toEqual(['Los García', 'Los Pérez'])
  })

  it('lo de las cenas y lo común se siguen partiendo por categoría; lo de una familia no', () => {
    const grupos = gruposDeCompra([
      linea({ texto: 'Cerveza', categoria: 'bebida' }),
      linea({ texto: 'Hielo', categoria: 'otros' }),
      linea({ texto: 'Vino', categoria: 'bebida', familyId: 'garcia' }),
      linea({ texto: 'Leche', categoria: 'otros', familyId: 'garcia' }),
    ], FAMILIAS, CATS)

    // Dos encabezados para lo común, uno solo para los García: tres o cuatro
    // cosas partidas en cinco encabezados gastan más alto que la lista.
    expect(grupos.map((g) => g.titulo)).toEqual(['Bebida', 'Otros', 'Los García'])
    expect(grupos.at(-1).list).toHaveLength(2)
  })

  it('una línea de una familia borrada cae en «común» y no desaparece', () => {
    const grupos = gruposDeCompra([linea({ texto: 'Pan', familyId: 'ya-no-existe' })], FAMILIAS, CATS)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].titulo).toBe('Otros')
    expect(grupos[0].familia).toBeUndefined()
  })

  it('una categoría que ya no existe tampoco pierde su línea', () => {
    const grupos = gruposDeCompra([linea({ texto: 'Carbón', categoria: 'brasa' })], FAMILIAS, CATS)
    expect(grupos.map((g) => g.titulo)).toEqual(['Sin categoría'])
  })

  it('sin nada pendiente no hay ningún encabezado', () => {
    expect(gruposDeCompra([], FAMILIAS, CATS)).toEqual([])
  })

  it('el renglón dice para quién se apunta, también cuando es para todos', () => {
    expect(dondeSeApunta(null)).toBe('Para todos')
    expect(dondeSeApunta({ name: 'García' })).toBe('Para los García')
  })
})
