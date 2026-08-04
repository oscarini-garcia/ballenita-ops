import { describe, it, expect } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import LineaDelHorizonte from './LineaDelHorizonte.jsx'

/** La fracción del tramo que el componente le pasa al CSS, en tanto por ciento.
 *  Donde cae eso en píxeles lo decide `theme.css`, que es quien sabe cuánto mide
 *  el disco y por tanto por dónde puede viajar sin salirse. */
const pct = (el) => Number.parseFloat(el.style.getPropertyValue('--f')) * 100

describe('LineaDelHorizonte', () => {
  // El cielo (A2) sale del mismo dato que la franja, así que se comprueba aquí.
  it('pinta el cielo de la hora en la raíz, y lo quita al desmontarse', () => {
    const { unmount } = render(<LineaDelHorizonte ahora={new Date('2026-08-04T12:22:00Z')} />)
    const mediodia = document.documentElement.style.getPropertyValue('--cielo')
    expect(mediodia).toMatch(/^#[0-9a-f]{6}$/)
    unmount()
    expect(document.documentElement.style.getPropertyValue('--cielo')).toBe('')

    render(<LineaDelHorizonte ahora={new Date('2026-08-05T02:15:00Z')} />)
    // De madrugada no puede ser el mismo color que a mediodía: si lo fuera, el
    // cielo no estaría haciendo nada y volveríamos a lo de «no lo veo».
    expect(document.documentElement.style.getPropertyValue('--cielo')).not.toBe(mediodia)
  })

  it('a mediodía es de día y va por la mitad', () => {
    const { container } = render(<LineaDelHorizonte ahora={new Date('2026-08-04T12:22:00Z')} />)
    const franja = container.querySelector('.horizonte')
    expect(franja.dataset.fase).toBe('dia')
    expect(pct(franja)).toBeGreaterThan(45)
    expect(pct(franja)).toBeLessThan(55)
  })

  it('recién salido el sol la franja está casi vacía', () => {
    const { container } = render(<LineaDelHorizonte ahora={new Date('2026-08-04T05:20:00Z')} />)
    expect(pct(container.querySelector('.horizonte'))).toBeLessThan(3)
  })

  it('de noche cambia de cara sin apagarse', () => {
    const { container } = render(<LineaDelHorizonte ahora={new Date('2026-08-05T00:30:00Z')} />)
    const franja = container.querySelector('.horizonte')
    expect(franja.dataset.fase).toBe('noche')
    expect(pct(franja)).toBeGreaterThan(0)
  })

  // Es la mitad de lo que hace: decir cuánta luz queda sin tener que mirarla.
  it('dice en palabras cuánto queda, para quien no ve la franja', () => {
    render(<LineaDelHorizonte ahora={new Date('2026-08-04T17:00:00Z')} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/^Quedan 2 h \d+ de luz$/)
  })

  it('de noche cuenta para el amanecer, no para la puesta', () => {
    render(<LineaDelHorizonte ahora={new Date('2026-08-05T02:15:00Z')} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/^Amanece en /)
  })

  // La franja y el disco cuelgan de la misma `--f`, así que no pueden discrepar.
  // Lo que sí puede fallar es que la fracción se salga de sus topes: al amanecer
  // exacto media luna se salía por el borde izquierdo antes de acotarla.
  it('la fracción nunca se sale de sus topes, a ninguna hora', () => {
    for (let h = 0; h < 24; h += 1) {
      const { container } = render(
        <LineaDelHorizonte ahora={new Date(`2026-08-04T${String(h).padStart(2, '0')}:00:00Z`)} />,
      )
      const f = pct(container.querySelector('.horizonte'))
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThanOrEqual(100)
      cleanup()
    }
  })
})
