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

describe('el detalle de la línea', () => {
  it('dice cuánto sale por ración, que es lo que deja juzgar la cifra', () => {
    montar([ARROZ])
    expect(screen.getByText(/0,1 kg\/ración/)).toBeInTheDocument()
  })

  it('y de quién es el número cuando lo puso la IA', () => {
    montar([{ ...ARROZ, deIA: true }])
    expect(screen.getByText(/lo puso la IA/)).toBeInTheDocument()
  })
})
