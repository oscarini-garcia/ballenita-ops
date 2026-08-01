import { useEffect } from 'react'

// Bloqueo del scroll del fondo mientras hay un modal abierto.
//
// Hay **dos scrollers** que tapar, y taparon uno cada uno en su momento:
//
//  · El del documento. `overflow: hidden` en el body no basta en iOS Safari —el
//    gesto se lo queda igualmente el documento y la pantalla de detrás se mueve
//    bajo el modal—, así que se fija el body (`position: fixed`) desplazado
//    hacia arriba lo que estuviera scrolleado, y se devuelve al soltar.
//
//  · El de la aplicación. Desde que el esqueleto es una columna de `100dvh`
//    (SPECS §14.10) el documento ya no se desplaza nunca: lo que se desplaza es
//    `.body`, un `div`. Fijar el body de la página no le hace nada, y el fondo
//    volvía a moverse bajo el modal. Ahí sí basta `overflow: hidden`, porque el
//    problema de Safari es del scroller del documento y no de un div normal; se
//    pone por clase (`.modal-abierto` en theme.css) en vez de tocando estilos,
//    para no pelearse con quien haya puesto otros.
//
// Los dos siguen puestos: el primero cuesta nada y cubre cualquier pantalla que
// en el futuro vuelva a dejar scrollar el documento.
//
// El contador permite modales anidados (y el doble montaje de StrictMode en
// desarrollo) sin que el primero en cerrarse libere el scroll de los demás.
const CLASE = 'modal-abierto'

let abiertos = 0
let scrollGuardado = 0
let estiloPrevio = null

export function bloquearScrollDeFondo() {
  if (typeof document === 'undefined') return
  abiertos += 1
  if (abiertos > 1) return

  const body = document.body
  scrollGuardado = window.scrollY || document.documentElement.scrollTop || 0
  estiloPrevio = body.getAttribute('style')
  body.style.position = 'fixed'
  body.style.top = `-${scrollGuardado}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
  body.style.overflow = 'hidden'
  body.classList.add(CLASE)
}

export function liberarScrollDeFondo() {
  if (typeof document === 'undefined' || abiertos === 0) return
  abiertos -= 1
  if (abiertos > 0) return

  const body = document.body
  // Restaurar el atributo entero (y no borrar propiedad a propiedad) deja el
  // body exactamente como estaba, incluidos estilos puestos por otros.
  if (estiloPrevio === null) body.removeAttribute('style')
  else body.setAttribute('style', estiloPrevio)
  estiloPrevio = null
  body.classList.remove(CLASE)
  window.scrollTo(0, scrollGuardado)
}

/** Bloquea el scroll del fondo mientras el componente esté montado. */
export function useBloqueoDeScroll() {
  useEffect(() => {
    bloquearScrollDeFondo()
    return liberarScrollDeFondo
  }, [])
}
