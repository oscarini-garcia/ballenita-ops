import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Deslizable from './Deslizable.jsx'

// Los eventos de puntero no existen en jsdom y se apañan en `test/setup.js`.

const ANCHO = 152

function fila(verbos, texto = 'Cañas') {
  return render(<Deslizable ancho={ANCHO} verbos={verbos}>{<div>{texto}</div>}</Deslizable>)
}

const cara = () => document.querySelector('.deslizable-cara')
const verbos = () => document.querySelector('.deslizable-verbos')
const desplazamiento = () => cara().style.transform

/** Un arrastre completo: bajar, mover en varios pasos y soltar. */
function arrastrar(dx, dy = 0) {
  const c = cara()
  fireEvent.pointerDown(c, { clientX: 200, clientY: 100, pointerId: 1, pointerType: 'touch' })
  fireEvent.pointerMove(c, { clientX: 200 + dx / 2, clientY: 100 + dy / 2, pointerId: 1 })
  fireEvent.pointerMove(c, { clientX: 200 + dx, clientY: 100 + dy, pointerId: 1 })
  fireEvent.pointerUp(c, { clientX: 200 + dx, clientY: 100 + dy, pointerId: 1 })
}

describe('Deslizable', () => {
  it('en reposo los verbos están tapados y fuera del alcance del tabulador', () => {
    fila(<button className="verbo borrar">Borrar</button>)
    expect(desplazamiento()).toBe('translateX(-0px)')
    expect(verbos().style.visibility).toBe('hidden')
  })

  it('arrastrar a la izquierda lo suficiente deja la fila abierta', () => {
    fila(<button className="verbo borrar">Borrar</button>)
    arrastrar(-120)
    expect(desplazamiento()).toBe(`translateX(-${ANCHO}px)`)
    expect(verbos().style.visibility).toBe('visible')
  })

  it('un arrastre corto se vuelve solo a su sitio', () => {
    fila(<button className="verbo borrar">Borrar</button>)
    arrastrar(-30)
    expect(desplazamiento()).toBe('translateX(-0px)')
  })

  it('si el dedo baja más de lo que se aparta, el gesto es de la página', () => {
    fila(<button className="verbo borrar">Borrar</button>)
    // 40 px a la izquierda pero 90 hacia abajo: eso es desplazar la lista.
    arrastrar(-40, 90)
    expect(desplazamiento()).toBe('translateX(-0px)')
  })

  it('el click con el que el navegador remata el arrastre no cierra la fila', () => {
    // jsdom no lo dispara solo, pero Chromium sí: sin consumirlo, la fila se
    // abría y se cerraba de golpe en el mismo gesto.
    const alTocar = vi.fn()
    render(
      <Deslizable ancho={ANCHO} verbos={<button className="verbo borrar">Borrar</button>}>
        <button onClick={alTocar}>Cañas</button>
      </Deslizable>,
    )
    arrastrar(-120)
    fireEvent.click(screen.getByText('Cañas'))

    expect(alTocar).not.toHaveBeenCalled()
    expect(desplazamiento()).toBe(`translateX(-${ANCHO}px)`)
  })

  it('con la fila abierta, tocar la cara la cierra en vez de activar lo de debajo', () => {
    const alTocar = vi.fn()
    render(
      <Deslizable ancho={ANCHO} verbos={<button className="verbo borrar">Borrar</button>}>
        <button onClick={alTocar}>Cañas</button>
      </Deslizable>,
    )
    // Abierta con el teclado, para que no quede pendiente el click del arrastre.
    fireEvent.focus(verbos())
    fireEvent.click(screen.getByText('Cañas'))

    expect(alTocar).not.toHaveBeenCalled()
    expect(desplazamiento()).toBe('translateX(-0px)')
  })

  it('con el teclado no hay nada que arrastrar: enfocar un verbo abre la fila', () => {
    fila(<button className="verbo borrar">Borrar</button>)
    fireEvent.focus(verbos())
    expect(desplazamiento()).toBe(`translateX(-${ANCHO}px)`)
  })

  it('abrir una fila cierra la que estuviera abierta', () => {
    render(
      <>
        <Deslizable ancho={ANCHO} verbos={<button className="verbo borrar">A</button>}><div>Uno</div></Deslizable>
        <Deslizable ancho={ANCHO} verbos={<button className="verbo borrar">B</button>}><div>Dos</div></Deslizable>
      </>,
    )
    const [caraUno, caraDos] = document.querySelectorAll('.deslizable-cara')

    const abrir = (c) => {
      fireEvent.pointerDown(c, { clientX: 200, clientY: 100, pointerId: 1, pointerType: 'touch' })
      fireEvent.pointerMove(c, { clientX: 120, clientY: 100, pointerId: 1 })
      fireEvent.pointerMove(c, { clientX: 60, clientY: 100, pointerId: 1 })
      fireEvent.pointerUp(c, { clientX: 60, clientY: 100, pointerId: 1 })
    }

    abrir(caraUno)
    expect(caraUno.style.transform).toBe(`translateX(-${ANCHO}px)`)

    abrir(caraDos)
    // Si no, se van quedando filas a medio deslizar por toda la lista.
    expect(caraUno.style.transform).toBe('translateX(-0px)')
    expect(caraDos.style.transform).toBe(`translateX(-${ANCHO}px)`)
  })
})
