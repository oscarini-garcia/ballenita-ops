import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserBadge, { getMeId } from './UserBadge.jsx'

const EVENT = 'ev_test'
const PERSONS = [
  { id: 'per_1', eventId: EVENT, name: 'Curro', apodo: 'el jefe', avatar: '🧑', estado: '' },
  { id: 'per_2', eventId: EVENT, name: 'Ana', apodo: '', avatar: '👩', estado: '🍷 vino en mano' },
]

describe('UserBadge', () => {
  it('sin identidad muestra «¿Quién eres?» y deja elegir persona', async () => {
    render(<UserBadge eventId={EVENT} persons={PERSONS} />)
    // El badge invita a elegir.
    await userEvent.click(screen.getByRole('button', { name: /Elegir quién eres/ }))
    // El sheet lista a la gente del evento.
    await userEvent.click(screen.getByRole('button', { name: /Curro/ }))
    // Tras elegir, se guarda la identidad por dispositivo…
    expect(getMeId(EVENT)).toBe('per_1')
    // …y el sheet pasa a modo edición de esa persona.
    expect(await screen.findByRole('heading', { name: /Eres Curro/ })).toBeInTheDocument()
  })

  it('con identidad muestra el apodo y permite guardar estado e icono', async () => {
    localStorage.setItem(`ballena.me:${EVENT}`, 'per_2')
    render(<UserBadge eventId={EVENT} persons={PERSONS} />)
    // El badge muestra el apodo si existe, si no el nombre.
    expect(screen.getByRole('button', { name: /Usuario: Ana/ })).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('«Salir» olvida quién eres en este móvil', async () => {
    localStorage.setItem(`ballena.me:${EVENT}`, 'per_1')
    render(<UserBadge eventId={EVENT} persons={PERSONS} />)
    await userEvent.click(screen.getByRole('button', { name: /Usuario: Curro/ }))
    const modal = screen.getByRole('heading', { name: /Eres Curro/ }).closest('.modal')
    await userEvent.click(within(modal).getByRole('button', { name: 'Salir' }))
    expect(getMeId(EVENT)).toBe(null)
  })

  it('olvida una identidad que ya no existe entre la gente del evento', async () => {
    localStorage.setItem(`ballena.me:${EVENT}`, 'per_borrada')
    render(<UserBadge eventId={EVENT} persons={PERSONS} />)
    // Como la persona no está, el badge vuelve a «¿Quién eres?» y limpia el guardado.
    expect(await screen.findByText('¿Quién eres?')).toBeInTheDocument()
    expect(getMeId(EVENT)).toBe(null)
  })
})
