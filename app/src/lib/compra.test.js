import { describe, it, expect } from 'vitest'
import { normalizarIngredientes, estirar, loQueSeCompra, cifra, partirCantidad, juntarCantidad, partirPegado } from './receta.js'
import { racionesPorMesa, platosDeLaCena, loQueHayQueComprar, comoSeReparte } from './compra.js'

/**
 * El grupo del ejemplo de la hoja de opciones, para que los números de aquí y
 * los del dibujo sean los mismos: 12 adultos y 7 niños, y Fran —niño— come con
 * los mayores. Mesa de mayores 12,6 raciones; mesa de niños 3,6.
 */
const GENTE = [
  ...Array.from({ length: 12 }, (_, i) => ({ id: `a${i}`, edad: 'adulto', comeConMayores: true, pesoReparto: 1 })),
  { id: 'fran', edad: 'niño', comeConMayores: true, pesoReparto: 0.6 },
  ...Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, edad: 'niño', comeConMayores: false, pesoReparto: 0.6 })),
]

const PAELLA = {
  id: 'p1',
  name: 'Paella mixta',
  raciones: 12,
  ingredientes: [
    { nombre: 'Arroz bomba', cantidad: 1.2, unidad: 'kg', lote: { tamano: 1, unidad: 'kg', nombre: 'paquete' } },
    { nombre: 'Mejillones', cantidad: 30, unidad: 'ud' },
    { nombre: 'Azafrán' },
  ],
}
const MACARRONES = {
  id: 'p2', name: 'Macarrones', raciones: 4,
  ingredientes: [{ nombre: 'Macarrones', cantidad: 400, unidad: 'g' }],
}

describe('lo que había guardado sigue valiendo', () => {
  it('un ingrediente que era una palabra se lee como una línea sin cantidad', () => {
    // Los platos de antes guardan `['arroz', 'mejillones']`. No hay migración
    // que correr: se leen como lo que son, líneas a las que les falta la cifra.
    expect(normalizarIngredientes(['arroz', 'mejillones'])).toEqual([
      { nombre: 'arroz', cantidad: null, unidad: '', lote: null, deIA: false },
      { nombre: 'mejillones', cantidad: null, unidad: '', lote: null, deIA: false },
    ])
  })

  it('lo vacío no ocupa una línea', () => {
    expect(normalizarIngredientes(['  ', null, { nombre: '' }, 'sal'])).toHaveLength(1)
  })
})

describe('estirar la receta', () => {
  it('es una regla de tres, sin IA de por medio', () => {
    const arroz = normalizarIngredientes(PAELLA.ingredientes)[0]
    expect(estirar(arroz, { raciones: 12.6, deLaReceta: 12 }).cantidad).toBeCloseTo(1.26, 5)
    expect(estirar(arroz, { raciones: 3.6, deLaReceta: 12 }).cantidad).toBeCloseTo(0.36, 5)
  })

  it('sin «para cuántos» no se inventa un número, y se dice', () => {
    const arroz = normalizarIngredientes(PAELLA.ingredientes)[0]
    const r = estirar(arroz, { raciones: 16.2, deLaReceta: null })
    expect(r.cantidad).toBe(1.2)
    expect(r.estirado).toBe(false)
  })

  it('lo que no tiene cantidad se queda sin ella', () => {
    const azafran = normalizarIngredientes(PAELLA.ingredientes)[2]
    expect(estirar(azafran, { raciones: 16.2, deLaReceta: 12 }).cantidad).toBeNull()
  })
})

describe('lo que se compra de verdad', () => {
  const ARROZ = { tamano: 1, unidad: 'kg', nombre: 'paquete' }

  it('redondea al alza al lote, en la unidad de la receta', () => {
    // 1,62 kg de arroz no se compran: se compran dos paquetes de uno. En la
    // línea cabe «2 kg»; «2 paquetes de 1 kg» empujaba el nombre hasta «Arr…».
    expect(loQueSeCompra({ cantidad: 1.62, unidad: 'kg', lote: ARROZ }).texto).toBe('2 kg')
    expect(loQueSeCompra({ cantidad: 0.4, unidad: 'kg', lote: ARROZ }).texto).toBe('1 kg')
  })

  it('y cuántos envases son se dice al abrir la línea', () => {
    expect(loQueSeCompra({ cantidad: 1.62, unidad: 'kg', lote: ARROZ }).envase).toBe('2 paquetes de 1 kg')
    expect(loQueSeCompra({ cantidad: 0.4, unidad: 'kg', lote: ARROZ }).envase).toBe('1 paquete de 1 kg')
  })

  it('y guarda la cifra exacta, para poder coger de menos si se ve claro', () => {
    expect(loQueSeCompra({ cantidad: 1.62, unidad: 'kg', lote: ARROZ }).exacto).toBe('1,62 kg')
    // Cuando lo exacto ya es un lote entero no hay nada que decir debajo.
    expect(loQueSeCompra({ cantidad: 2, unidad: 'kg', lote: ARROZ }).exacto).toBeNull()
  })

  it('un lote que mide otra cosa no se usa: saldría un disparate', () => {
    // 30 mejillones con una malla de 1 kg no se dividen. Salía «15 mallas de
    // 1 kg», que tiene toda la pinta de una cuenta y no lo es.
    const mejillones = { cantidad: 30, unidad: 'ud', lote: { tamano: 1, unidad: 'kg', nombre: 'malla' } }
    expect(loQueSeCompra(mejillones).texto).toBe('30 ud')
    // Pero el envase se dice igual: en el súper hay que coger mallas.
    expect(loQueSeCompra(mejillones).envase).toBe('malla de 1 kg')
  })

  it('sin lote se dice la cifra exacta y no un «2 paquetes» inventado', () => {
    expect(loQueSeCompra({ cantidad: 40.5, unidad: 'ud', lote: null }).texto).toBe('40,5 ud')
  })

  it('sin cantidad lo dice, en vez de desaparecer de la lista', () => {
    // Esconderlo dejaría a alguien sin azafrán y sin saberlo.
    expect(loQueSeCompra({ cantidad: null }).texto).toBe('sin cantidad')
  })

  it('el número se lee, no se calcula: 1,62 y no 1,6200000000000001', () => {
    expect(cifra(0.54 * 3)).toBe('1,62')
    expect(cifra(2)).toBe('2')
  })
})

describe('las dos mesas', () => {
  it('se cuentan en raciones, con el peso que ya se usa para los gastos', () => {
    expect(racionesPorMesa(GENTE)).toEqual({ mayores: 12.6, ninos: 3.6 })
  })

  it('el adolescente cuenta donde come, no donde le tocaría por edad', () => {
    const { mayores, ninos } = racionesPorMesa([
      { edad: 'adulto', comeConMayores: true, pesoReparto: 1 },
      { edad: 'niño', comeConMayores: true, pesoReparto: 0.6 },
      { edad: 'niño', comeConMayores: false, pesoReparto: 0.6 },
    ])
    expect(mayores).toBe(1.6)
    expect(ninos).toBe(0.6)
  })

  it('el adolescente sin mesa dicha come con los mayores, como un adulto', () => {
    const { mayores, ninos } = racionesPorMesa([
      { edad: 'adolescente', pesoReparto: 1 },
      { edad: 'niño', pesoReparto: 0.6 },
    ])
    expect(mayores).toBe(1)
    expect(ninos).toBe(0.6)
  })

  it('los niños heredan los platos hasta que se les toca (G2)', () => {
    expect(platosDeLaCena({ platoIds: ['a', 'b'] })).toEqual({ mayores: ['a', 'b'], ninos: ['a', 'b'], hereda: true })
    expect(platosDeLaCena({ platoIds: ['a', 'b'], platoIdsNinos: ['c'] }))
      .toEqual({ mayores: ['a', 'b'], ninos: ['c'], hereda: false })
  })
})

describe('la lista de la compra', () => {
  const cenas = [{ id: 'c1', platoIds: ['p1'] }]

  it('suma las dos mesas y guarda el reparto al lado', () => {
    const [arroz] = loQueHayQueComprar({ cenas, platos: [PAELLA], personas: GENTE })
    expect(arroz.nombre).toBe('Arroz bomba')
    expect(arroz.cantidad).toBeCloseTo(1.62, 5)
    expect(arroz.desglose).toEqual({ mayores: 1.26, ninos: 0.36 })
    // Y lo que se compra es lo redondeado, que es lo que se mete en el carro.
    expect(arroz.texto).toBe('2 kg')
    expect(arroz.envase).toBe('2 paquetes de 1 kg')
  })

  it('cuando los niños comen otra cosa, deja de ser una división', () => {
    const propias = [{ id: 'c1', platoIds: ['p1'], platoIdsNinos: ['p2'] }]
    const lista = loQueHayQueComprar({ cenas: propias, platos: [PAELLA, MACARRONES], personas: GENTE })
    const arroz = lista.find((x) => x.nombre === 'Arroz bomba')
    const macarrones = lista.find((x) => x.nombre === 'Macarrones')
    // El arroz ya solo es para la mesa de mayores.
    expect(arroz.desglose).toEqual({ mayores: 1.26, ninos: 0 })
    // Y los macarrones, solo para la de niños: 400 g para 4 → 3,6 raciones.
    expect(macarrones.desglose.ninos).toBeCloseTo(360, 5)
    expect(macarrones.desglose.mayores).toBe(0)
  })

  it('el mismo ingrediente en dos cenas es una sola línea', () => {
    const dos = [{ id: 'c1', platoIds: ['p1'] }, { id: 'c2', platoIds: ['p1'] }]
    const lista = loQueHayQueComprar({ cenas: dos, platos: [PAELLA], personas: GENTE })
    expect(lista.filter((x) => x.nombre === 'Arroz bomba')).toHaveLength(1)
    expect(lista.find((x) => x.nombre === 'Arroz bomba').cantidad).toBeCloseTo(3.24, 5)
  })

  it('lo que no tiene cantidad aparece igual, y dice que le falta', () => {
    const lista = loQueHayQueComprar({ cenas, platos: [PAELLA], personas: GENTE })
    const azafran = lista.find((x) => x.nombre === 'Azafrán')
    expect(azafran.cantidad).toBeNull()
    expect(azafran.texto).toBe('sin cantidad')
  })

  it('y cada línea sabe de qué platos viene', () => {
    const lista = loQueHayQueComprar({ cenas, platos: [PAELLA], personas: GENTE })
    expect(lista[0].platos).toEqual(['Paella mixta'])
  })
})

describe('cómo se lee el reparto', () => {
  it('con los nombres de los bungas, que es donde hay que llevarlo', () => {
    expect(comoSeReparte({ mayores: 1.26, ninos: 0.36 }, { mayores: 'Pérez', ninos: 'Solteros', unidad: 'kg' }))
      .toBe('Pérez 1,26 kg · Solteros 0,36 kg')
  })

  it('una mesa a cero no se nombra', () => {
    expect(comoSeReparte({ mayores: 2, ninos: 0 }, { mayores: 'Pérez', ninos: 'Solteros' })).toBe('Pérez 2')
  })
})

describe('los dos campos de la línea (§14.20-bis · U1)', () => {
  it('«1,2 kg» se parte en número y unidad, que es como se dice en voz alta', () => {
    expect(partirCantidad('1,2 kg')).toEqual({ cantidad: 1.2, unidad: 'kg', resto: '' })
    expect(partirCantidad('30ud')).toEqual({ cantidad: 30, unidad: 'ud', resto: '' })
    expect(partirCantidad('2')).toEqual({ cantidad: 2, unidad: '', resto: '' })
  })

  it('lo que no se entiende no se inventa: vuelve tal cual', () => {
    // «al gusto» no es una cantidad, y ponerle un número sería peor que dejarlo.
    expect(partirCantidad('al gusto')).toEqual({ cantidad: null, unidad: '', resto: 'al gusto' })
    expect(partirCantidad('')).toEqual({ cantidad: null, unidad: '', resto: '' })
  })

  it('y se vuelve a juntar para enseñarlo en la caja', () => {
    expect(juntarCantidad({ cantidad: 1.2, unidad: 'kg' })).toBe('1,2 kg')
    expect(juntarCantidad({ cantidad: 30, unidad: '' })).toBe('30')
    expect(juntarCantidad({ cantidad: null })).toBe('')
  })

  it('una receta pegada entra línea a línea, con guiones y viñetas fuera', () => {
    expect(partirPegado('- 1 kg de arroz\n• 30 mejillones\n\n  azafrán  ')).toEqual([
      '1 kg de arroz', '30 mejillones', 'azafrán',
    ])
  })

  it('la coma a medio escribir no es una unidad', () => {
    // «1,2 kg» se teclea de izquierda a derecha, así que en algún momento lo
    // escrito es «1,». Eso casaba con el hueco de la unidad —«1» y unidad «.»—,
    // la caja se repintaba «1 .» y ahí se atascaba: **no se podía escribir un
    // decimal**, ni en esta pantalla ni en ninguna que use la caja.
    expect(partirCantidad('1,')).toEqual({ cantidad: 1, unidad: '', resto: '' })
    expect(partirCantidad('1,2')).toEqual({ cantidad: 1.2, unidad: '', resto: '' })
  })
})

/**
 * Escribir por persona (§14.20-ter · C3).
 *
 * Lo guardado es **siempre el total de la receta**. Si se guardara la cantidad
 * por cabeza, cambiar las raciones de un plato ya escrito cambiaría lo que hay
 * que comprar sin que nadie hubiera tocado la receta.
 */
describe('para la receta o por persona', () => {
  it('lo tecleado por cabeza se guarda multiplicado', () => {
    expect(partirCantidad('0,1 kg', 12)).toEqual({ cantidad: 1.2, unidad: 'kg', resto: '' })
    // Y sin decimales de más: 0,1 × 12 en coma flotante son 1,2000000000000002.
    expect(partirCantidad('0,1', 12).cantidad).toBe(1.2)
  })

  it('y lo guardado se enseña dividido', () => {
    expect(juntarCantidad({ cantidad: 1.2, unidad: 'kg' }, 12)).toBe('0,1 kg')
    // 1,2 entre 12 son 0,09999999999999999 si no se redondea.
    expect(juntarCantidad({ cantidad: 1.2, unidad: 'kg' }, 12)).not.toContain('0999')
  })

  it('sin repartir el número no se toca, ni para redondearlo', () => {
    // Quien escribió 1,2345 tiene que seguir viendo 1,2345.
    expect(juntarCantidad({ cantidad: 1.2345, unidad: 'kg' })).toBe('1,2345 kg')
  })
})
