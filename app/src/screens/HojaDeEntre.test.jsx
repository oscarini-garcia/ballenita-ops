import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HojaDeEntre from './HojaDeEntre.jsx'

const FAMILIAS = [
  { id: 'perez', name: 'Pérez' },
  { id: 'garcia', name: 'García' },
]
// Mayor lo dice la edad (§14.49), no una casilla guardada en cada persona.
const mayor = (id, name, familyId) => ({ id, name, familyId, edad: 'adulto', pesoReparto: 1 })
const peque = (id, name, familyId) => ({ id, name, familyId, edad: 'niño', pesoReparto: 0.6 })
const GENTE = [
  mayor('g1', 'Curro', 'garcia'), mayor('g2', 'Marta', 'garcia'), peque('g3', 'Pablo', 'garcia'),
  mayor('p1', 'Fran', 'perez'), peque('p2', 'Luis', 'perez'),
]

function abrir({ dentro = GENTE.map((p) => p.id) } = {}) {
  const onCambio = vi.fn()
  const onCerrar = vi.fn()
  render(
    <HojaDeEntre
      persons={GENTE} families={FAMILIAS} participantIds={dentro}
      onCambio={onCambio} onCerrar={onCerrar}
    />,
  )
  return { onCambio, onCerrar }
}

describe('Entre quién se divide · lo que se ve al abrir', () => {
  it('son los tres atajos y las familias, no los nombres de todo el grupo', async () => {
    abrir()
    for (const et of ['Todos', 'Mayores', 'Nadie']) {
      expect(screen.getByRole('button', { name: et })).toBeInTheDocument()
    }
    // «Peques» se retiró (§14.49): costaba un cuarto del mando para no usarse.
    expect(screen.queryByRole('button', { name: 'Peques' })).not.toBeInTheDocument()
    expect(screen.getByText('García')).toBeInTheDocument()
    expect(screen.getByText('Pérez')).toBeInTheDocument()
    // Los nueve nombres seguidos eran 434 pt de los 711 que medía la hoja.
    expect(screen.queryByText('Curro')).not.toBeInTheDocument()
  })

  it('las familias salen por nombre y no en el orden en que llegan', () => {
    abrir()
    const filas = [...document.querySelectorAll('.fila-fam .et')].map((e) => e.textContent)
    expect(filas).toEqual(['García', 'Pérez'])
  })

  it('y el renglón de cada una dice quién está dentro', () => {
    abrir({ dentro: ['g1', 'g2'] })
    expect(screen.getByText('Curro · Marta')).toBeInTheDocument()
    expect(screen.getByText('nadie')).toBeInTheDocument()
  })
})

describe('Entre quién se divide · los atajos', () => {
  it('«Mayores» deja fuera a los peques', async () => {
    const { onCambio } = abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Mayores' }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onCambio).toHaveBeenCalledWith(expect.arrayContaining(['g1', 'g2', 'p1']))
    expect(onCambio.mock.calls[0][0]).toHaveLength(3)
  })

  // Y un reparto solo de peques se sigue pudiendo hacer, que es lo que hace que
  // retirar el atajo no quite nada: «Nadie» y marcar los dos nombres.
  it('solo los peques se marca a mano, en dos toques más', async () => {
    const { onCambio } = abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Nadie' }))
    await userEvent.click(screen.getByRole('button', { name: /^García/ }))   // destapa
    await userEvent.click(screen.getByRole('button', { name: /Pablo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onCambio.mock.calls[0][0]).toEqual(['g3'])
  })

  it('«Nadie» vacía la lista, que es lo que hace baratos los repartos raros', async () => {
    const { onCambio } = abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Nadie' }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onCambio).toHaveBeenCalledWith([])
  })

  it('el atajo encendido sigue a lo marcado, no a lo último que se tocó', async () => {
    abrir()
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Mayores' }))
    expect(screen.getByRole('button', { name: 'Mayores' })).toHaveAttribute('aria-pressed', 'true')
    // Y al completar los García a mano —con Pablo dentro— deja de describirlo
    // ninguno de los tres: el mando sigue al reparto, no al último toque.
    await userEvent.click(screen.getByRole('button', { name: /Poner a los García/ }))
    for (const et of ['Todos', 'Mayores', 'Nadie']) {
      expect(screen.getByRole('button', { name: et })).toHaveAttribute('aria-pressed', 'false')
    }
  })
})

describe('Entre quién se divide · las familias', () => {
  it('la casilla marca a toda la familia de un toque', async () => {
    const { onCambio } = abrir({ dentro: [] })
    await userEvent.click(screen.getByRole('button', { name: /Poner a los García/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onCambio.mock.calls[0][0].sort()).toEqual(['g1', 'g2', 'g3'])
  })

  it('una familia a medias se completa al tocarla, no se vacía', async () => {
    const { onCambio } = abrir({ dentro: ['g1'] })
    await userEvent.click(screen.getByRole('button', { name: /Poner a los García/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onCambio.mock.calls[0][0].sort()).toEqual(['g1', 'g2', 'g3'])
  })

  it('el cuerpo de la fila abre la familia y saca a su gente', async () => {
    abrir()
    expect(screen.queryByText('Curro')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { expanded: false, name: /García/ }))
    expect(screen.getByText('Curro')).toBeInTheDocument()
    expect(screen.getByText('Marta')).toBeInTheDocument()
    // Sangrada: una persona no aparece nunca huérfana, se ve de quién es.
    expect(document.querySelector('.fila-persona.sangrada')).toBeInTheDocument()
  })

  it('y desde ahí se quita a una sola persona', async () => {
    const { onCambio } = abrir()
    await userEvent.click(screen.getByRole('button', { expanded: false, name: /García/ }))
    // `^Pablo` para no coger la fila de la familia, cuyo renglón lo nombra.
    await userEvent.click(screen.getByRole('button', { name: /^Pablo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onCambio.mock.calls[0][0]).not.toContain('g3')
    expect(onCambio.mock.calls[0][0]).toHaveLength(4)
  })
})

describe('Entre quién se divide · el buscador', () => {
  it('no ocupa sitio hasta que se toca la lupa', async () => {
    abrir()
    expect(screen.queryByLabelText('Buscar a alguien')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Buscar/ }))
    expect(screen.getByLabelText('Buscar a alguien')).toBeInTheDocument()
  })

  it('al escribir, las familias se retiran y salen las personas', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /Buscar/ }))
    await userEvent.type(screen.getByLabelText('Buscar a alguien'), 'ma')

    expect(screen.getByText('Marta')).toBeInTheDocument()
    expect(screen.queryByText('García')).not.toBeInTheDocument()
    // Con su familia al lado, para desambiguar dos Anas.
    expect(screen.getByText(/García · ×1/)).toBeInTheDocument()
  })

  it('y si no coincide nadie, lo dice', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /Buscar/ }))
    await userEvent.type(screen.getByLabelText('Buscar a alguien'), 'zzz')
    expect(screen.getByText('Nadie se llama así.')).toBeInTheDocument()
  })
})

describe('Entre quién se divide · salir sin guardar', () => {
  // No es que faltara el botón: la hoja escribía en la ficha en cada toque, así
  // que al cerrarse ya estaba hecho. Sin borrador no hay nada que cancelar.
  it('«Cancelar» cierra y no toca nada', async () => {
    const { onCambio, onCerrar } = abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Nadie' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCambio).not.toHaveBeenCalled()
    expect(onCerrar).toHaveBeenCalled()
  })

  it('y el fondo hace lo mismo que «Cancelar», no lo contrario', async () => {
    const { onCambio, onCerrar } = abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Nadie' }))
    await userEvent.click(document.querySelector('.modal-bg'))
    expect(onCambio).not.toHaveBeenCalled()
    expect(onCerrar).toHaveBeenCalled()
  })

  it('solo «Listo» guarda', async () => {
    const { onCambio, onCerrar } = abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onCambio).toHaveBeenCalled()
    expect(onCerrar).toHaveBeenCalled()
  })
})
