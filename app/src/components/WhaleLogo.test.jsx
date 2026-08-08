import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import WhaleLogo from './WhaleLogo.jsx'

/**
 * La marca de dentro es el icono de fuera.
 *
 * Eran dos dibujos distintos: el icono en la pantalla de inicio y un trazo de
 * `Icono` en la cabecera. Tocas un dibujo y se abre una app con otro, y la
 * cabecera es justo donde se comprueba que has abierto lo que querías.
 */
describe('la marca', () => {
  it('es el icono de la app, servido desde public', () => {
    render(<WhaleLogo className="logo" />)
    const img = screen.getByAltText('Ballena Ops')
    expect(img.getAttribute('src')).toMatch(/marca-192\.png$/)
    expect(img.closest('.marca')).toHaveClass('logo')
  })

  it('y el fichero está, versionado y siendo un PNG de verdad', () => {
    // Como los iconos de la PWA (`iconos.test.js`): lo que rompe esto no es un
    // build sino un `git rm` distraído, y una marca que no carga se ve en el
    // móvil y no en el ordenador de quien la hizo.
    for (const p of [join('assets', 'marca.png'), join('public', 'marca-192.png')]) {
      const ruta = join(process.cwd(), p)
      expect(existsSync(ruta)).toBe(true)
      expect([...readFileSync(ruta).subarray(0, 8)])
        .toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    }
  })
})
