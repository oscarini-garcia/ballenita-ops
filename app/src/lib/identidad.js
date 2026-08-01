import { useEffect, useState } from 'react'

/**
 * Quién eres en un evento.
 *
 * Se guarda **por dispositivo** (localStorage) y no se sincroniza: cada móvil
 * elige su identidad. Lo que sí es un hecho del grupo —y por tanto sincroniza—
 * es tu emoji y tu estado, que viven en la propia persona.
 *
 * Vive aparte de `UserBadge` porque ahora lo usan dos sitios: el badge de la
 * cabecera y el apartado «Quién eres» de Ajustes.
 */
function meKey(eventId) { return `ballena.me:${eventId}` }

export function getMeId(eventId) {
  try { return localStorage.getItem(meKey(eventId)) } catch { return null }
}

export function setMeId(eventId, id) {
  try {
    if (id) localStorage.setItem(meKey(eventId), id)
    else localStorage.removeItem(meKey(eventId))
  } catch { /* almacenamiento no disponible */ }
}

// Los dos sitios que la usan tienen que enterarse cuando el otro la cambia, y
// `localStorage` no avisa dentro de la misma pestaña. Un evento propio sí.
const AVISO = 'ballena:identidad'

/**
 * `[me, elegir, salir]` para el evento dado. `me` es la persona entera (o null),
 * resuelta contra la lista que se pase: si la guardada ya no existe —borrada, u
 * otro evento— se olvida sola.
 */
export function useIdentidad(eventId, persons = []) {
  const [meId, setMe] = useState(() => getMeId(eventId))

  useEffect(() => { setMe(getMeId(eventId)) }, [eventId])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const alCambiar = () => setMe(getMeId(eventId))
    window.addEventListener(AVISO, alCambiar)
    return () => window.removeEventListener(AVISO, alCambiar)
  }, [eventId])

  const me = persons.find((p) => p.id === meId) || null

  useEffect(() => {
    if (meId && persons.length && !me) { setMeId(eventId, null); setMe(null) }
  }, [meId, persons, me, eventId])

  function elegir(id) {
    setMeId(eventId, id)
    setMe(id)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(AVISO))
  }

  return { meId, me, elegir, salir: () => elegir(null) }
}
