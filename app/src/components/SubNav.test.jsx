import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubNav from './SubNav.jsx'

const OPTIONS = [
  { id: 'gastos', label: '💸 Gastos' },
  { id: 'saldos', label: '⚖️ Saldos' },
]

describe('SubNav', () => {
  it('marca como activa la opción seleccionada', () => {
    render(<SubNav value="saldos" onChange={() => {}} options={OPTIONS} />)
    expect(screen.getByRole('tab', { name: '⚖️ Saldos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '💸 Gastos' })).toHaveAttribute('aria-selected', 'false')
  })

  it('avisa con el id al tocar otra opción', async () => {
    const onChange = vi.fn()
    render(<SubNav value="gastos" onChange={onChange} options={OPTIONS} />)
    await userEvent.click(screen.getByRole('tab', { name: '⚖️ Saldos' }))
    expect(onChange).toHaveBeenCalledWith('saldos')
  })
})
