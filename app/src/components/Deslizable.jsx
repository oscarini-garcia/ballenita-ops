import { useEffect, useRef, useState } from 'react'
import { tap } from '../lib/native.js'

/**
 * Una fila que se desliza a la izquierda para descubrir sus verbos.
 *
 * Sustituye al botón «Borrar» que llevaba puesto cada fila, y que ocupaba justo
 * el hueco donde va el importe —lo que se viene a mirar en Dinero—. Es el gesto
 * de `garciadoral-ops` y `meeting-ops-air`, y el de cualquier lista de iOS.
 *
 * Tres cosas que lo hacen funcionar y que no salen gratis:
 *
 *  · **El desplazamiento vertical manda.** Se escucha con eventos de puntero
 *    —sirven igual al dedo y al ratón— y hasta que el gesto no se aparta 10 px
 *    no se decide de quién es: si baja más de lo que se mueve a los lados, es de
 *    la página y aquí no ha pasado nada. `touch-action: pan-y` se lo dice también
 *    al navegador, que así no espera a nuestro veredicto para empezar a scrollar.
 *
 *  · **Solo una abierta.** Abrir una cierra la que estuviera; si no, se van
 *    quedando filas a medio deslizar por toda la lista.
 *
 *  · **Con el teclado no hay nada que arrastrar.** Los verbos son botones de
 *    verdad, y enfocar cualquiera de ellos abre la fila. Al cerrarse, los verbos
 *    se ocultan de verdad (`visibility`), para que no queden en la ruta del
 *    tabulador ni los lea un lector de pantalla como si estuvieran a la vista.
 */

// Cuánto hay que apartarse antes de decidir si el gesto es horizontal o vertical.
const UMBRAL = 10
// A partir de qué fracción del recorrido la fila se queda abierta al soltar.
const SE_QUEDA = 0.4

// La fila abierta ahora mismo, si hay alguna. Módulo y no contexto: es un dato
// de la pantalla entera y no hay ninguna decisión que tomar sobre él.
let abierta = null

export default function Deslizable({ verbos, ancho = 152, children, className = '' }) {
  const [x, setX] = useState(0)
  // Durante el arrastre la cara sigue al dedo sin transición; al soltar, encaja.
  const [suave, setSuave] = useState(true)
  const yo = useRef({})
  const gesto = useRef(null)
  // Un arrastre con el dedo (o con el ratón) termina en un `click` sobre la
  // fila: el navegador lo dispara igualmente al soltar. Sin esta marca, ese
  // click entraba por `alTocar` y cerraba la fila en el mismo gesto que acababa
  // de abrirla — el gesto se veía funcionar y luego «rebotaba».
  const veniaDeArrastrar = useRef(false)

  yo.current.cerrar = () => { setSuave(true); setX(0) }

  useEffect(() => () => { if (abierta === yo.current) abierta = null }, [])

  function encajar(destino) {
    setSuave(true)
    setX(destino)
    if (destino > 0) {
      if (abierta && abierta !== yo.current) abierta.cerrar()
      abierta = yo.current
    } else if (abierta === yo.current) {
      abierta = null
    }
  }

  function alBajar(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    veniaDeArrastrar.current = false
    gesto.current = { x0: e.clientX, y0: e.clientY, base: x, mio: false }
  }

  function alMover(e) {
    const g = gesto.current
    if (!g) return
    const dx = e.clientX - g.x0
    const dy = e.clientY - g.y0

    if (!g.mio) {
      // Vertical: es de la página. Soltamos el gesto y no volvemos a mirarlo.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > UMBRAL) { gesto.current = null; return }
      if (Math.abs(dx) < UMBRAL) return
      g.mio = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setSuave(false)
    }
    setX(Math.max(0, Math.min(ancho, g.base - dx)))
  }

  function alSoltar() {
    const g = gesto.current
    gesto.current = null
    if (!g?.mio) return
    veniaDeArrastrar.current = true
    const destino = x > ancho * SE_QUEDA ? ancho : 0
    if (destino !== g.base) tap()
    encajar(destino)
  }

  // Con la fila abierta, tocar la cara la cierra en vez de activar lo que haya
  // debajo del dedo: es lo que espera quien la abrió sin querer.
  function alTocar(e) {
    // El click con el que el navegador remata un arrastre no es un toque: se
    // consume y la fila se queda como la haya dejado el gesto.
    if (veniaDeArrastrar.current) {
      veniaDeArrastrar.current = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (x === 0) return
    e.preventDefault()
    e.stopPropagation()
    encajar(0)
  }

  return (
    <div className={`deslizable ${className}`} style={{ '--verbos': `${ancho}px` }}>
      <div
        className="deslizable-verbos"
        style={{ visibility: x === 0 ? 'hidden' : 'visible' }}
        onFocus={() => encajar(ancho)}
      >
        {verbos}
      </div>
      <div
        className="deslizable-cara"
        style={{ transform: `translateX(-${x}px)`, transition: suave ? 'transform .18s ease' : 'none' }}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onClickCapture={alTocar}
      >
        {children}
      </div>
    </div>
  )
}
