import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Campo from './Campo.jsx'

/**
 * Un campo es su rótulo, el control y la línea que lo explica **debajo**.
 *
 * Lo que hay que sujetar es que el rótulo esté enganchado al control: sin `for`
 * el rótulo es adorno, no se puede tocar para enfocar y un lector de pantalla
 * lee la caja sin decir de qué es.
 */
describe('Campo', () => {
  it('engancha el rótulo con su control', () => {
    render(
      <Campo etiqueta="Modelo" id="m" pista="Si lo retiran, se cambia solo.">
        <input id="m" defaultValue="claude-sonnet-4-5" />
      </Campo>,
    )

    expect(screen.getByLabelText('Modelo').value).toBe('claude-sonnet-4-5')
    expect(screen.getByText('Si lo retiran, se cambia solo.')).toBeInTheDocument()
  })

  it('sin pista no pinta el renglón vacío', () => {
    const { container } = render(<Campo etiqueta="Clave" id="c"><input id="c" /></Campo>)
    expect(container.querySelector('.pista')).toBeNull()
  })
})
