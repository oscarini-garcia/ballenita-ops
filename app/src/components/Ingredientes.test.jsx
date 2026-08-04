import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEventBase from '@testing-library/user-event'
import Ingredientes from './Ingredientes.jsx'

/**
 * La línea de un ingrediente: dos campos, un aspa pequeña y una fila vacía
 * siempre al final (§14.20-bis · U1 · B3 · L2 + L4).
 */
/**
 * El componente es controlado, así que escribir letra a letra necesita que el
 * estado viva de verdad: con un `onCambiar` de mentira, cada tecla se aplicaría
 * sobre el valor de partida y «30 ud» acabaría siendo «kgd».
 */
function montar(valor = []) {
  const visto = { ultimo: valor }
  const onCambiar = vi.fn()
  function Envoltorio() {
    const [v, setV] = useState(valor)
    visto.ultimo = v
    return <Ingredientes valor={v} raciones={12} onCambiar={(x) => { onCambiar(x); setV(x) }} />
  }
  render(<Envoltorio />)
  return { onCambiar, visto, userEvent: userEventBase.setup() }
}

const ARROZ = { nombre: 'Arroz bomba', cantidad: 1.2, unidad: 'kg' }

describe('los dos campos', () => {
  it('la cantidad y su unidad se escriben de un tirón', async () => {
    const { visto, userEvent } = montar([ARROZ])
    const caja = screen.getByLabelText('Cantidad de Arroz bomba')
    expect(caja.value).toBe('1,2 kg')

    await userEvent.clear(caja)
    await userEvent.type(caja, '30 ud')
    expect(visto.ultimo[0]).toMatchObject({ cantidad: 30, unidad: 'ud' })
  })

  it('se puede rellenar solo el nombre, «a saco»', async () => {
    const { visto, userEvent } = montar([])
    await userEvent.type(screen.getByLabelText('Ingrediente nuevo'), 'tres pinchos de wagyu')
    expect(visto.ultimo[0]).toMatchObject({ nombre: 'tres pinchos de wagyu', cantidad: null })
  })
})

describe('la fila vacía del final', () => {
  it('siempre hay una donde escribir el siguiente', () => {
    montar([ARROZ])
    expect(screen.getByLabelText('Ingrediente nuevo')).toBeInTheDocument()
    expect(screen.getByLabelText('Ingrediente 1')).toBeInTheDocument()
  })

  it('y no tiene nada que borrar', () => {
    montar([ARROZ])
    // Un aspa por ingrediente de verdad, y ninguna en la fila fantasma.
    expect(screen.getAllByRole('button', { name: /Quitar/ })).toHaveLength(1)
  })
})

describe('el aspa', () => {
  it('quita esa línea y deja las demás', async () => {
    const { onCambiar, userEvent } = montar([ARROZ, { nombre: 'Mejillones', cantidad: 30, unidad: 'ud' }])
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Arroz bomba' }))
    expect(onCambiar).toHaveBeenCalledWith([expect.objectContaining({ nombre: 'Mejillones' })])
  })
})

describe('pegar una receta entera', () => {
  it('reparte las líneas, con guiones y viñetas fuera', async () => {
    const { onCambiar, userEvent } = montar([])
    const caja = screen.getByLabelText('Ingrediente nuevo')
    await userEvent.click(caja)
    await userEvent.paste('- 1 kg de arroz\n• 30 mejillones\nazafrán')
    expect(onCambiar).toHaveBeenCalledWith([
      expect.objectContaining({ nombre: '1 kg de arroz' }),
      expect.objectContaining({ nombre: '30 mejillones' }),
      expect.objectContaining({ nombre: 'azafrán' }),
    ])
  })

  it('pegar una sola línea es escribir, no repartir', async () => {
    const { onCambiar, userEvent } = montar([])
    await userEvent.click(screen.getByLabelText('Ingrediente nuevo'))
    await userEvent.paste('arroz')
    expect(onCambiar).toHaveBeenCalledWith([expect.objectContaining({ nombre: 'arroz' })])
  })
})

/**
 * El renglón del pie (§14.20-ter · F4).
 *
 * El detalle vivía **debajo de cada línea** y eso casi doblaba la fila —105,9 pt
 * frente a 60,6—, así que escribir una cantidad alargaba la lista 45 pt bajo el
 * dedo. Ahora es un solo renglón: el de la línea que tocas, y el resumen cuando
 * no tocas ninguna.
 */
describe('el renglón del pie', () => {
  it('en reposo dice para cuántas es y cuántas van sin cantidad', () => {
    montar([ARROZ, { nombre: 'Azafrán' }])
    expect(screen.getByRole('status')).toHaveTextContent('Para 12 · 1 sin cantidad')
    // Y no lleva el detalle de ninguna línea encima.
    expect(screen.queryByText(/kg\/ración/)).not.toBeInTheDocument()
  })

  it('al tocar una línea dice cuánto sale por ración, que es lo que deja juzgar la cifra', async () => {
    const { userEvent } = montar([ARROZ])
    await userEvent.click(screen.getByLabelText('Cantidad de Arroz bomba'))
    expect(screen.getByRole('status')).toHaveTextContent('0,1 kg/ración')
  })

  it('y de quién es el número cuando lo puso la IA', async () => {
    const { userEvent } = montar([{ ...ARROZ, deIA: true }])
    await userEvent.click(screen.getByLabelText('Ingrediente 1'))
    expect(screen.getByRole('status')).toHaveTextContent('lo puso la IA')
  })

  it('el resumen cuenta las que puso la IA, que es lo que no se ve de un vistazo', () => {
    montar([{ ...ARROZ, deIA: true }, { nombre: 'Mejillones', cantidad: 30, unidad: 'ud' }])
    expect(screen.getByRole('status')).toHaveTextContent('Para 12 · 1 de la IA · 2 ingredientes')
  })
})

/**
 * El mando de la cantidad (§14.20-ter · C3).
 *
 * Lo guardado es **siempre el total de la receta**: el mando solo cambia en qué
 * unidades se teclea. Si guardara la cantidad por persona, cambiar las raciones
 * de un plato ya escrito cambiaría lo que hay que comprar sin que nadie tocara
 * la receta.
 */
describe('para la receta o por persona', () => {
  it('de partida se escribe el total, y el mando lo dice', () => {
    montar([ARROZ])
    expect(screen.getByRole('button', { name: 'Para 12' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Cantidad de Arroz bomba').value).toBe('1,2 kg')
  })

  it('por persona enseña la ración y guarda el total', async () => {
    const { visto, userEvent } = montar([ARROZ])
    await userEvent.click(screen.getByRole('button', { name: 'Por persona' }))

    const caja = screen.getByLabelText('Cantidad de Arroz bomba por persona')
    expect(caja.value).toBe('0,1 kg')

    await userEvent.clear(caja)
    await userEvent.type(caja, '0,2 kg')
    // 0,2 por cabeza y doce a la mesa son 2,4 kg, que es lo que se guarda.
    expect(visto.ultimo[0]).toMatchObject({ cantidad: 2.4, unidad: 'kg' })
  })

  it('y el pie enseña la otra cifra, que es la que el mando esconde', async () => {
    const { userEvent } = montar([ARROZ])
    await userEvent.click(screen.getByRole('button', { name: 'Por persona' }))
    await userEvent.click(screen.getByLabelText('Cantidad de Arroz bomba por persona'))
    expect(screen.getByRole('status')).toHaveTextContent('1,2 kg para 12')
  })

  it('sin raciones no hay «por persona» que valga, y se dice en vez de mentir', () => {
    render(<Ingredientes valor={[ARROZ]} raciones={null} onCambiar={() => {}} />)
    expect(screen.getByRole('button', { name: 'Por persona' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Toda la receta' })).toHaveAttribute('aria-pressed', 'true')
  })
})
