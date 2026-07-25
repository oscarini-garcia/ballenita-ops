/**
 * La sesión de este dispositivo: el token que firmó el Worker y a quién
 * corresponde.
 *
 * Vive en `localStorage` y no en la base: no es un hecho del grupo, es de este
 * móvil. Al cerrar sesión se borra junto con la copia local de los datos.
 */

const CLAVE = 'ballena.sesion'

export function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || 'null')
  } catch {
    return null
  }
}

export function guardarSesion(sesion) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion))
  } catch {
    /* almacenamiento no disponible (navegación privada): la sesión durará lo que la pestaña */
  }
}

export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    /* nada que borrar */
  }
}

export const haySesion = () => Boolean(leerSesion()?.token)
