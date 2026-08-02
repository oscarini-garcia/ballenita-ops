import { describe, it, expect } from 'vitest'
import { bungaDeFamilia, bungasLibres, familiasLibres, etiquetaBunga } from './asignacion.js'

const FAMILIAS = [{ id: 'f1', name: 'García' }, { id: 'f2', name: 'Pérez' }, { id: 'f3', name: 'Solteros' }]
const BUNGAS = [
  { id: 'b1', name: 'Bunga 1', alias: 'el de la piscina', familyId: 'f1' },
  { id: 'b2', name: 'Bunga 2', alias: '', familyId: null },
  { id: 'b3', name: 'Bunga 3', alias: 'el del fondo', familyId: 'fantasma' },
]

describe('bungaDeFamilia', () => {
  it('devuelve el bunga de la familia', () => {
    expect(bungaDeFamilia(BUNGAS, 'f1').id).toBe('b1')
  })
  it('null si la familia no tiene, o si no hay familia', () => {
    expect(bungaDeFamilia(BUNGAS, 'f2')).toBe(null)
    expect(bungaDeFamilia(BUNGAS, null)).toBe(null)
  })
})

describe('bungasLibres — lo que puede ofrecer el formulario de familia', () => {
  it('solo los que no tiene nadie', () => {
    expect(bungasLibres(BUNGAS, FAMILIAS).map((b) => b.id)).toEqual(['b2', 'b3'])
  })
  it('el de una familia borrada vuelve a estar libre', () => {
    // b3 apunta a «fantasma», que ya no está en la lista de familias: si no se
    // contara como libre, no habría manera de reasignarlo desde la interfaz.
    expect(bungasLibres(BUNGAS, FAMILIAS).map((b) => b.id)).toContain('b3')
  })
  it('al editar una familia, el suyo sigue en la lista', () => {
    expect(bungasLibres(BUNGAS, FAMILIAS, { paraFamilia: 'f1' }).map((b) => b.id)).toEqual(['b1', 'b2', 'b3'])
  })
  it('aguanta listas vacías', () => {
    expect(bungasLibres()).toEqual([])
    expect(bungasLibres([], FAMILIAS)).toEqual([])
  })
})

describe('familiasLibres — lo que puede ofrecer el formulario de bunga', () => {
  it('solo las que no tienen bunga', () => {
    expect(familiasLibres(FAMILIAS, BUNGAS).map((f) => f.id)).toEqual(['f2', 'f3'])
  })
  it('al editar un bunga, la suya sigue en la lista', () => {
    expect(familiasLibres(FAMILIAS, BUNGAS, { paraBunga: 'b1' }).map((f) => f.id)).toEqual(['f1', 'f2', 'f3'])
  })
  it('sin bungas, todas están libres', () => {
    expect(familiasLibres(FAMILIAS, []).map((f) => f.id)).toEqual(['f1', 'f2', 'f3'])
  })
})

describe('etiquetaBunga', () => {
  it('nombre y alias, o solo nombre', () => {
    expect(etiquetaBunga(BUNGAS[0])).toBe('Bunga 1 (el de la piscina)')
    expect(etiquetaBunga(BUNGAS[1])).toBe('Bunga 2')
    expect(etiquetaBunga(null)).toBe('')
  })
})
