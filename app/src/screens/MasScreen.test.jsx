import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import MasScreen from './MasScreen.jsx'

const ev = { name: 'Camping 2026', currency: 'EUR' }

afterEach(() => sessionStorage.clear())

describe('MasScreen', () => {
  it('por defecto abre Estadísticas', () => {
    render(<MasScreen eventId="e1" event={ev} />)
    expect(screen.getByRole('tab', { name: '📊 Estadísticas' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '⚙️ Ajustes' })).toHaveAttribute('aria-selected', 'false')
  })

  it('tras una actualización abre directamente en Ajustes', () => {
    sessionStorage.setItem('ballena.postUpdate', '1')
    render(<MasScreen eventId="e1" event={ev} />)
    expect(screen.getByRole('tab', { name: '⚙️ Ajustes' })).toHaveAttribute('aria-selected', 'true')
  })
})
