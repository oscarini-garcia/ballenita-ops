import { useEffect, useState } from 'react'

/**
 * Tamaño del texto, por dispositivo.
 *
 * La idea es de `meeting-ops-air`: **un solo número** (`--escala`) del que cuelga
 * toda la escala tipográfica (`--t-*` en theme.css). Subirlo mueve los siete
 * rangos a la vez y conserva las proporciones, que es lo que no pasa cuando cada
 * pantalla se retoca a mano.
 *
 * No se sincroniza a propósito: quién ve pequeño es una propiedad de los ojos
 * que miran este móvil, no un hecho del grupo.
 */
export const TAMANOS = [
  { id: 'normal', name: 'Normal', escala: 1 },
  { id: 'grande', name: 'Grande', escala: 1.12 },
  { id: 'enorme', name: 'Enorme', escala: 1.26 },
]

const KEY = 'ballena.tamano'
const POR_DEFECTO = 'normal'

export function getTamano() {
  try {
    const v = localStorage.getItem(KEY)
    return TAMANOS.some((t) => t.id === v) ? v : POR_DEFECTO
  } catch {
    return POR_DEFECTO
  }
}

export function setTamano(id) {
  try { localStorage.setItem(KEY, id) } catch { /* sin almacenamiento: da igual */ }
}

/**
 * Lo aplica al <html>. `normal` quita el atributo en vez de escribir `1`: así el
 * valor de origen vive en un sitio solo (theme.css) y no en dos que puedan
 * discrepar.
 */
export function applyTamano() {
  const id = getTamano()
  const root = document.documentElement
  if (id === POR_DEFECTO) root.removeAttribute('data-texto')
  else root.setAttribute('data-texto', id)
  return id
}

export function useTamano() {
  const [tamano, setT] = useState(getTamano)
  useEffect(() => { applyTamano() }, [tamano])
  return {
    tamano,
    elegir(id) { setTamano(id); setT(id); applyTamano() },
  }
}
