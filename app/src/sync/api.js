/**
 * Transporte contra la API propia (Worker + D1). Sustituye a `jsonbin.js`.
 *
 * La diferencia de fondo con el transporte anterior no es la URL: antes se
 * subía el documento **entero** del grupo y el merge ocurría en cada móvil;
 * ahora se sube una **cola de cambios** y se recibe la instantánea que el
 * servidor produce al aplicarla. El servidor es la autoridad, y por eso su
 * respuesta sustituye a la copia local en lugar de fusionarse con ella.
 */

import { cargarConfiguracion, estaConfigurada } from '../lib/config.js'
import { borrarSesion, leerSesion } from '../auth/sesion.js'
import { isNative } from '../lib/native.js'
import { uid } from '../lib/ids.js'

const CLAVE_DISPOSITIVO = 'ballena.dispositivo'

/** Identificador estable de este móvil, para que el servidor sepa cuántos hay
 *  y cuándo sincronizó cada uno. No identifica a nadie por sí solo. */
function idDeDispositivo() {
  try {
    let id = localStorage.getItem(CLAVE_DISPOSITIVO)
    if (!id) {
      id = uid('disp')
      localStorage.setItem(CLAVE_DISPOSITIVO, id)
    }
    return id
  } catch {
    return 'disp_efimero'
  }
}

/**
 * ¿Este dispositivo sincroniza con el grupo?
 *
 * Solo la app de iOS. En el navegador y en la PWA instalada, Ballena Ops es una
 * libreta local: no hay forma de entrar —el acceso con Apple vive en la cáscara
 * nativa— y por tanto tampoco se habla con la API.
 */
export async function hayApi() {
  if (!isNative()) return false
  return estaConfigurada(await cargarConfiguracion())
}

class SesionCaducada extends Error {
  constructor() {
    super('La sesión ha caducado. Vuelve a entrar con Apple.')
    this.sesionCaducada = true
  }
}

async function peticion(camino, opciones = {}) {
  const configuracion = await cargarConfiguracion()
  if (!estaConfigurada(configuracion)) throw new Error('sin API configurada')

  const sesion = leerSesion()
  if (!sesion?.token) throw new SesionCaducada()

  const respuesta = await fetch(`${configuracion.api}${camino}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sesion.token}`,
      'X-Dispositivo': idDeDispositivo(),
      'X-Plataforma': opciones.plataforma || 'web',
      ...(opciones.headers || {}),
    },
  })

  if (respuesta.status === 401 || respuesta.status === 403) {
    // El token ya no vale (caducó, o la cuenta se desactivó). Se olvida aquí
    // mismo: dejarlo puesto haría que cada ciclo de sincronización repitiera
    // una petición que nunca va a funcionar.
    borrarSesion()
    throw new SesionCaducada()
  }

  if (!respuesta.ok) {
    // El estado HTTP viaja con el error, y con él lo que el servidor haya
    // explicado. Es lo que separa «la API contestó que no» de «la API no
    // contestó»: un 500 es un fallo suyo, un 404 una dirección equivocada, y no
    // tener número es que la petición no llegó a salir —red, DNS o certificado—.
    // Sin esto, la pantalla acababa diciendo «no se ha podido: error», que es la
    // misma palabra dos veces y no sirve para nada. Idea de `garciadoral-ops`.
    let datos = null
    try { datos = await respuesta.json() } catch { /* no era JSON: da igual */ }
    const explicacion = datos?.error || datos?.motivo
    const error = new Error(
      explicacion
        ? `la API respondió ${respuesta.status}: ${explicacion}`
        : `la API respondió ${respuesta.status}`,
    )
    error.estado = respuesta.status
    error.datos = datos
    throw error
  }
  return respuesta.json()
}

/** Instantánea completa del grupo. */
export const traerInstantanea = () => peticion('/api/sync')

/** Sube la cola y devuelve `{ resultados, instantanea }`. */
export const enviarCambios = (cambios) =>
  peticion('/api/cambios', { method: 'POST', body: JSON.stringify({ cambios }) })

/** Cuentas del grupo (solo para administradores). */
export const listarCuentas = () => peticion('/api/cuentas')

export const gestionarCuenta = (cuerpo) =>
  peticion('/api/cuentas', { method: 'POST', body: JSON.stringify(cuerpo) })

/** Apunta el token de APNs de este aparato, o lo silencia. */
export const registrarPush = (token, avisos = true) =>
  peticion('/api/push', { method: 'POST', body: JSON.stringify({ token, avisos }) })

/** Qué clave y qué modelo hay puestos. La clave nunca vuelve entera: solo sus
 *  cuatro últimos caracteres y cuándo se guardó. */
export const leerIA = () => peticion('/api/ia')

export const guardarIA = (cuerpo) =>
  peticion('/api/ia', { method: 'POST', body: JSON.stringify(cuerpo) })

/**
 * Elimina la cuenta propia (directriz 5.1.1(v) de la App Store).
 *
 * El código de Apple es opcional: sirve para que el Worker revoque además la
 * autorización ante Apple. Sin él la cuenta se elimina igual y la respuesta lo
 * dice en `revocado_en_apple`, que es lo que la pantalla enseña.
 */
export const eliminarMiCuenta = (codigoApple = null) =>
  peticion('/api/cuenta/baja', {
    method: 'POST',
    plataforma: 'ios',
    body: JSON.stringify({ codigo_apple: codigoApple }),
  })
