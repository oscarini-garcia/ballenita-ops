import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WhaleLogo from './WhaleLogo.jsx'

/**
 * La marca de dentro es el icono de fuera.
 *
 * Eran dos dibujos distintos: `assets/icon.png` en la pantalla de inicio y un
 * trazo de `Icono` en la cabecera. Tocas un dibujo y se abre una app con otro, y
 * la cabecera es justo donde se comprueba que has abierto lo que querías.
 */
describe('la marca', () => {
  it('es el icono de la app, servido desde public', () => {
    render(<WhaleLogo className="logo" />)
    const img = screen.getByAltText('Ballena Ops')
    expect(img.getAttribute('src')).toMatch(/icon-192\.png$/)
    expect(img.closest('.marca')).toHaveClass('logo')
  })

  it('el de la puerta pide el grande: mide 84 pt y a 3× son 252', () => {
    render(<WhaleLogo className="acceso-logo" grande />)
    expect(screen.getByAltText('Ballena Ops').getAttribute('src')).toMatch(/icon-512\.png$/)
  })
})
