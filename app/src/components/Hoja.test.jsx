import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Hoja from './Hoja.jsx'

/**
 * La hoja sale **por un portal al `body`** (SPECS §14.55-ter).
 *
 * Una hoja se abre a menudo desde dentro de otra capa —«ver todos los
 * comentarios» dentro del modal de un plan, de un gasto o de un día—, y ahí su
 * `.modal-bg` quedaba de hijo de un `.modal`, que es un **scroller**. En
 * Chromium se dibuja bien porque `position: fixed` va contra la ventana; en el
 * WebKit del iPhone, un `fixed` dentro de un scroller con
 * `-webkit-overflow-scrolling: touch` se coloca y se recorta **contra el
 * scroller**, y la hoja salía metida en la caja del modal de fuera, con el
 * título cortado por la izquierda.
 *
 * Lo que se fija aquí es lo único que se puede romper sin que se vea en el
 * navegador de desarrollo: **de quién cuelga**, y que los eventos sigan
 * subiendo por el árbol de React y no por el del DOM.
 */
describe('Hoja', () => {
  it('cuelga del body aunque se abra desde dentro de una capa', async () => {
    render(
      <div className="modal-bg center">
        <div className="modal center">
          <Hoja titulo="Comentarios" onCerrar={() => {}}>
            <p>lo que sea</p>
          </Hoja>
        </div>
      </div>,
    )

    const capa = document.querySelector('.modal.hoja')
    expect(capa).not.toBeNull()
    // Ni dentro de otro modal, ni dentro de nada que pueda hacer scroll.
    expect(capa.closest('.modal.center')).toBeNull()
    expect(capa.parentElement.parentElement).toBe(document.body)
  })

  it('el fondo la cierra, y el toque no se escapa a la capa de fuera', async () => {
    // Con el portal, los eventos siguen burbujeando por el árbol de React: el
    // `stopPropagation` del modal de fuera los para, así que cerrar la hoja no
    // cierra además el plan que hay debajo.
    const cerrarHoja = vi.fn()
    const cerrarPlan = vi.fn()
    render(
      <div className="modal-bg center" onClick={cerrarPlan}>
        <div className="modal center" onClick={(e) => e.stopPropagation()}>
          <Hoja titulo="Comentarios" onCerrar={cerrarHoja}><p>lo que sea</p></Hoja>
        </div>
      </div>,
    )

    await userEvent.click(document.querySelector('.modal-bg:not(.center)'))
    expect(cerrarHoja).toHaveBeenCalledTimes(1)
    expect(cerrarPlan).not.toHaveBeenCalled()
  })

  it('tocar dentro no la cierra', async () => {
    const cerrarHoja = vi.fn()
    render(<Hoja titulo="Comentarios" onCerrar={cerrarHoja}><p>lo que sea</p></Hoja>)

    await userEvent.click(screen.getByText('lo que sea'))
    expect(cerrarHoja).not.toHaveBeenCalled()
  })
})
