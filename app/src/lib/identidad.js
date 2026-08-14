import { useEffect, useState } from 'react'
import { leerSesion } from '../auth/sesion.js'
import { esAdministrador } from './admin.js'

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
 * Con quién está enlazada esta cuenta, si hay sesión. `null` en la libreta
 * local y en la demostración, que es donde quién eres se elige a mano.
 */
export const personaDeLaCuenta = () => leerSesion()?.cuenta?.personId ?? null

/**
 * `{ me, elegir, salir, deLaCuenta }` para el evento dado. `me` es la persona
 * entera (o null), resuelta contra la lista que se pase: si la guardada ya no
 * existe —borrada, u otro evento— se olvida sola. `deLaCuenta` dice si quién
 * eres lo manda el enlace de tu cuenta, que es cuando no se elige a mano.
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

  // **Con sesión, quién eres lo dice la cuenta** (SPECS §14.42). No es una
  // preferencia de este móvil sino el enlace que hizo quien administra, así que
  // no se elige a mano y **manda siempre**, no solo cuando el hueco está vacío:
  // rellenar el hueco y luego esconder la lista dejaría atrapado para siempre a
  // quien se hubiera elegido mal antes de que esto existiera.
  //
  // **Salvo a quien administra** (§14.45): a él la cuenta le **siembra** el
  // hueco y ahí se acaba, porque es el único que sí cambia de persona —para
  // mirar la app como la ve otro, que es lo que hace falta cuando alguien dice
  // «a mí no me sale»—. Imponérsela le desharía la elección en el acto.
  //
  // Si la persona enlazada no es de este evento no se toca nada: ahí sigue
  // habiendo lista, que es la única salida de un evento donde tu cuenta no
  // figura.
  const enlazada = personaDeLaCuenta()
  const mandaLaCuenta = Boolean(enlazada) && !esAdministrador(leerSesion())
  useEffect(() => {
    if (!enlazada || !persons.length || meId === enlazada) return
    // Quien administra ya eligió: sembrar es para el hueco, no para corregirle.
    if (meId && !mandaLaCuenta) return
    if (!persons.some((p) => p.id === enlazada)) return
    setMeId(eventId, enlazada)
    setMe(enlazada)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(AVISO))
  }, [enlazada, mandaLaCuenta, meId, persons, eventId])

  function elegir(id) {
    setMeId(eventId, id)
    setMe(id)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(AVISO))
  }

  return {
    meId,
    me,
    elegir,
    salir: () => elegir(null),
    // Quién eres viene de la cuenta: ni se cambia ni se sale de ello. Para
    // quien administra es `false` aunque esté enlazado — él sí elige (§14.45).
    deLaCuenta: Boolean(me && mandaLaCuenta && me.id === enlazada),
  }
}
