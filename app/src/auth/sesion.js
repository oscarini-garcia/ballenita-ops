/**
 * La sesión de este dispositivo: el token que firmó el Worker y a quién
 * corresponde.
 *
 * Vive en `localStorage` y no en la base: no es un hecho del grupo, es de este
 * móvil. Al cerrar sesión se borra junto con la copia local de los datos.
 */

const CLAVE = 'ballena.sesion'
const CLAVE_LOCAL = 'ballena.soloLocal'

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

/**
 * Refresca lo que la sesión sabe de su cuenta, sin tocar el token.
 *
 * El servidor devuelve la cuenta al lado de cada instantánea (SPECS §14.41)
 * porque el dato que importa —con qué persona está enlazada, `personId`— puede
 * cambiar **después** de entrar: el administrador enlaza cuando le pilla bien.
 * Sin este refresco, ese enlace solo llegaría volviendo a pasar por Apple.
 */
export function actualizarCuenta(cuenta) {
  const sesion = leerSesion()
  if (!sesion?.token || !cuenta || (sesion.cuenta?.id && cuenta.id !== sesion.cuenta.id)) return
  guardarSesion({ ...sesion, cuenta: { ...sesion.cuenta, ...cuenta } })
}

/**
 * Modo local en la app de iOS: usar Ballena Ops como libreta de este móvil sin
 * haber entrado.
 *
 * Existe porque el acceso con Apple puede fallar por cosas que no se arreglan
 * desde el móvil —falta la capacidad en el binario, el App ID sin dar de alta—,
 * y quedarse mirando la puerta cerrada mientras empieza el viaje es el peor
 * resultado posible. Los datos que se apunten aquí no se pierden: cada escritura
 * deja su entrada en la cola, así que suben enteros el día que se entre.
 *
 * Es una preferencia de este dispositivo, no un hecho del grupo: vive en
 * `localStorage` como la sesión.
 */
export function modoLocal() {
  try {
    return localStorage.getItem(CLAVE_LOCAL) === '1'
  } catch {
    return false
  }
}

export function activarModoLocal() {
  try {
    localStorage.setItem(CLAVE_LOCAL, '1')
  } catch {
    /* sin almacenamiento: durará lo que la sesión de la app */
  }
}

export function salirDeModoLocal() {
  try {
    localStorage.removeItem(CLAVE_LOCAL)
  } catch {
    /* nada que borrar */
  }
}
