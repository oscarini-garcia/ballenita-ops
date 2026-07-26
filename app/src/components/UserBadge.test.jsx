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
  it('sin identidad no pregunta «¿quién eres?»: deja elegir y pasa al perfil', async () => {
    render(<UserBadge eventId={EVENT} persons={PERSONS} />)
    expect(screen.queryByText(/Quién eres/i)).not.toBeInTheDocument()

    expect(screen.getByText('Elígete')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Elegir usuario' }))
    await userEvent.click(screen.getByRole('button', { name: /Curro/ }))

    // Tras elegir, se guarda la identidad por dispositivo…
    expect(getMeId(EVENT)).toBe('per_1')
    // …y el sheet pasa a editar el perfil de esa persona.
    expect(await screen.findByRole('heading', { name: 'Curro' })).toBeInTheDocument()
  })

  it('con identidad el badge indica el usuario actual (apodo y estado)', () => {
    localStorage.setItem(`ballena.me:${EVENT}`, 'per_2')
    render(<UserBadge eventId={EVENT} persons={PERSONS} />)

    const badge = screen.getByRole('button', { name: 'Usuario: Ana' })
    expect(within(badge).getByText('Ana')).toBeInTheDocument()
    expect(within(badge).getByText('🍷 vino en mano')).toBeInTheDocument()
  })

  it('al abrir permite cambiar emoji, estado y foto de la persona actual', async () => {
    localStorage.setItem(`ballena.me:${EVENT}`, 'per_1')
    render(<UserBadge eventId={EVENT} persons={PERSONS} />)
    await userEvent.click(screen.getByRole('button', { name: 'Usuario: Curro' }))

    const modal = screen.getByRole('heading', { name: 'Curro' }).closest('.modal')

    // Emoji: los atajos rellenan el campo de texto libre.
    await userEvent.click(within(modal).getByRole('button', { name: '🦑' }))
    expect(within(modal).getByLabelText('Emoji a mano')).toHaveValue('🦑')

    // Estado: igual, con chips de coña.
    await userEvent.click(within(modal).getByRole('button', { name: '🍺 de resaca' }))
    expect(within(modal).getByLabelText('Estado a mano')).toHaveValue('🍺 de resaca')

    // Y la foto (que es solo de este móvil) tiene su selector.
    expect(within(modal).getByLabelText('Elegir foto de avatar')).toBeInTheDocument()
  })

  it('«Salir de …» olvida a esa persona en este móvil y vuelve a la lista', async () => {
    localStorage.setItem(`ballena.me:${EVENT}`, 'per_1')
    render(<UserBadge eventId={EVENT} persons={PERSONS} />)
    await userEvent.click(screen.getByRole('button', { name: 'Usuario: Curro' }))

    const modal = screen.getByRole('heading', { name: 'Curro' }).closest('.modal')
    await userEvent.click(within(modal).getByRole('button', { name: 'Salir de el jefe' }))

    expect(getMeId(EVENT)).toBe(null)
    expect(await screen.findByRole('heading', { name: /Elige tu persona/ })).toBeInTheDocument()
  })

  it('pinta la foto guardada en este dispositivo en vez del emoji', () => {
    localStorage.setItem(`ballena.me:${EVENT}`, 'per_1')
    localStorage.setItem(`ballena.foto:${EVENT}:per_1`, 'data:image/jpeg;base64,AAA')
    render(<UserBadge eventId={EVENT} persons={PERSONS} />)

    const badge = screen.getByRole('button', { name: 'Usuario: Curro' })
    expect(within(badge).getByRole('presentation')).toHaveAttribute('src', 'data:image/jpeg;base64,AAA')
  })

  it('olvida una identidad que ya no existe entre la gente del evento', async () => {
    localStorage.setItem(`ballena.me:${EVENT}`, 'per_borrada')
    render(<UserBadge eventId={EVENT} persons={PERSONS} />)

    expect(await screen.findByText('Elígete')).toBeInTheDocument()
    expect(getMeId(EVENT)).toBe(null)
  })
})
