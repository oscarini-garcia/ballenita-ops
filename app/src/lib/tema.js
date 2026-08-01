import { useEffect, useState } from 'react'

/**
 * El tema, que ahora es **uno solo** con sus dos caras.
 *
 * Hubo nueve skins y un bombo que rotaba entre ellos. Se van: nueve paletas son
 * nueve sitios donde un contraste puede estar mal y ocho que nadie mira, y la
 * división en «para leer bien» y «con guasa» dejó de tener sentido en cuanto el
 * único tema se resolvió bien. Lo que queda es Abisal Sobrio —el azul de la
 * marca, plano y desaturado— en claro y en oscuro, diseñados por separado.
 *
 * Aquí solo se elige **qué cara**: automático (la del sistema), claro u oscuro.
 * Se guarda por dispositivo, como el tamaño del texto: es una propiedad de los
 * ojos que miran este móvil, no un hecho del grupo.
 */
export const TEMAS = [
  { id: 'auto', name: 'Automático' },
  { id: 'claro', name: 'Claro' },
  { id: 'oscuro', name: 'Oscuro' },
]

const KEY = 'ballena.tema'
const POR_DEFECTO = 'auto'

export function getTema() {
  try {
    const v = localStorage.getItem(KEY)
    return TEMAS.some((t) => t.id === v) ? v : POR_DEFECTO
  } catch {
    return POR_DEFECTO
  }
}

export function setTema(id) {
  try { localStorage.setItem(KEY, id) } catch { /* sin almacenamiento: da igual */ }
}

/**
 * Lo aplica al <html>. `auto` **quita** el atributo en vez de escribirlo, que es
 * lo que deja mandar a la consulta de medios del sistema; los otros dos tienen
 * que ganarle en los dos sentidos, no solo hacia el oscuro (ver theme.css).
 */
export function applyTema() {
  const id = getTema()
  const root = document.documentElement
  if (id === POR_DEFECTO) root.removeAttribute('data-tema')
  else root.setAttribute('data-tema', id)
  return id
}

export function useTema() {
  const [tema, setT] = useState(getTema)
  useEffect(() => { applyTema() }, [tema])
  return {
    tema,
    elegir(id) { setTema(id); setT(id); applyTema() },
  }
}
