/**
 * La sala de espera, del lado del móvil.
 *
 * Quien entra con Apple y todavía no tiene acceso queda **apuntado** en el
 * servidor, y desde ese momento lo único que falta es que alguien del grupo diga
 * quién es. Eso no depende de este móvil, así que la app no tiene nada que
 * preguntarle a nadie: solo esperar.
 *
 * Lo que hace falta para esperar bien son dos cosas, y las dos viven aquí.
 *
 * La primera es **acordarse**. La solicitud está hecha en el servidor, pero si
 * al reabrir la app vuelve a salir la puerta con su «Entrar con Apple», la sala
 * de espera no existe: cada arranque se lee como si nunca lo hubieras intentado,
 * y lo que invita es a volver a pasar por la hoja de Apple. Por eso el estado se
 * guarda en `localStorage` —es de este móvil, como la sesión, no un hecho del
 * grupo—.
 *
 * La segunda es **poder preguntar sin Apple**. Hasta ahora, «¿ya me han dejado
 * entrar?» era otro `entrarConApple()` entero, o sea sacar la hoja del sistema
 * por encima de la app: se puede hacer cuando alguien pulsa un botón, y no cada
 * veinte segundos. El servidor entrega un **pase** al apuntar la solicitud
 * (`api/src/sesion.js`), y con él la pregunta es una petición normal — que es lo
 * que deja que la app entre sola en cuanto la enlacen.
 */

const CLAVE = 'ballena.espera'

/** `{ nombre, pase }` mientras la solicitud siga viva; `null` si no hay ninguna. */
export function leerEspera() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE) || 'null')
    return guardada?.pase ? guardada : null
  } catch {
    return null
  }
}

export function guardarEspera({ nombre, pase }) {
  // Sin pase no hay nada que guardar: lo que se recuerda no es «lo intenté»
  // sino «puedo volver a preguntar». Un servidor viejo no lo manda, y entonces
  // la sala de espera se comporta como antes —con su botón, sin mirar sola—.
  if (!pase) return null
  const espera = { nombre: nombre || '', pase }
  try {
    localStorage.setItem(CLAVE, JSON.stringify(espera))
  } catch {
    /* sin almacenamiento: durará lo que la app esté abierta */
  }
  return espera
}

export function olvidarEspera() {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    /* nada que borrar */
  }
}

/**
 * Le pregunta al servidor si ya le han enlazado.
 *
 * Devuelve lo que conteste el Worker, que es una de cuatro:
 *   · `{ estado: 'espera', nombre }`   — sigue apuntado, nada que hacer
 *   · `{ estado: 'dentro', token, cuenta }` — ya está: esto **es** la sesión
 *   · `{ estado: 'desactivada' }`      — le han cerrado la puerta a propósito
 *   · `{ estado: 'desconocida' }`      — la solicitud ya no existe
 *
 * Un fallo de red devuelve `{ estado: 'sin-respuesta' }` y no lanza: esto se
 * llama solo cada veinte segundos, y una sala de espera que se llena de errores
 * rojos porque el ascensor tiene mala cobertura miente sobre lo que pasa.
 */
export async function preguntarSiYaEntro(configuracion, pase) {
  if (!configuracion?.api || !pase) return { estado: 'sin-respuesta' }

  try {
    const respuesta = await fetch(`${configuracion.api}/api/sesion/espera`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pase }),
    })
    if (!respuesta.ok) {
      // Un pase que el servidor ya no acepta —caducado, o secreto rotado— no se
      // arregla reintentando: se vuelve a la puerta, que es donde se consigue
      // uno nuevo.
      if (respuesta.status === 401) return { estado: 'desconocida' }
      return { estado: 'sin-respuesta' }
    }
    return await respuesta.json()
  } catch {
    return { estado: 'sin-respuesta' }
  }
}
