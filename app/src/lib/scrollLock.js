import { useEffect } from 'react'

// Bloqueo del scroll del fondo mientras hay un modal abierto.
//
// `overflow: hidden` en el body no basta en iOS Safari: el gesto se lo queda
// igualmente el documento y la pantalla de detrás se mueve bajo el modal. El
// truco que sí funciona es fijar el body (`position: fixed`) desplazado hacia
// arriba lo que estuviera scrolleado, y devolverlo al soltar.
//
// El contador permite modales anidados (y el doble montaje de StrictMode en
// desarrollo) sin que el primero en cerrarse libere el scroll de los demás.
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
  window.scrollTo(0, scrollGuardado)
}

/** Bloquea el scroll del fondo mientras el componente esté montado. */
export function useBloqueoDeScroll() {
  useEffect(() => {
    bloquearScrollDeFondo()
    return liberarScrollDeFondo
  }, [])
}
