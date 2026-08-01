/**
 * Modo de demostración: la app entera, con datos inventados y sin servidor.
 *
 * Existe por un motivo muy concreto, y conviene que quede escrito para que
 * nadie lo retire pensando que es una comodidad. **El acceso a Ballena Ops es
 * por invitación**: quien pulsa «Entrar con Apple» sin que alguien del grupo lo
 * haya dado de alta recibe un 403 y no ve absolutamente nada. Eso es
 * exactamente lo que le va a pasar al equipo de revisión de Apple, y sin una
 * salida es un rechazo por la directriz 2.1 —«no pudimos acceder a la
 * funcionalidad de la aplicación»— sin que nada esté mal.
 *
 * La salida es esta: desde la pantalla de acceso se entra a la app de verdad,
 * con un evento de ejemplo sembrado en la base local. No hay sesión, así que el
 * motor de sincronización no arranca y no se habla con la API; es el mismo modo
 * solo-local con el que funciona la app en el navegador, con datos dentro.
 *
 * La marca vive en `sessionStorage` y no en `localStorage` a propósito: una
 * demostración se acaba al cerrar la app. Si se quedara pegada, quien la
 * probara una vez tendría que acordarse de salir de ella para poder entrar de
 * verdad con su cuenta.
 */

import { db, olvidarTodo, seedExample } from '../db.js'

const CLAVE = 'ballena.demo'

export function enDemo() {
  try {
    return sessionStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

/**
 * Entra en la demostración y devuelve el id del evento sembrado.
 *
 * Siembra solo si la base está vacía. Quien llega aquí desde la pantalla de
 * acceso no tiene sesión y por tanto no tiene datos del grupo —al salir se
 * olvida todo—, pero la comprobación evita duplicar el evento si alguien vuelve
 * a pulsar el botón.
 */
export async function activarDemo() {
  try {
    sessionStorage.setItem(CLAVE, '1')
  } catch {
    /* sin almacenamiento la demostración dura lo que la pantalla; sigue valiendo */
  }
  const eventos = await db.events.count()
  return eventos ? null : seedExample()
}

/**
 * Sale de la demostración y borra lo sembrado.
 *
 * Se olvida **todo** lo local y no solo el evento de ejemplo: lo que hay en la
 * base durante una demostración es, por construcción, inventado. Dejar rastro
 * mezclaría datos falsos con los del grupo la próxima vez que alguien entre de
 * verdad en este mismo aparato.
 */
export async function salirDemo() {
  try {
    sessionStorage.removeItem(CLAVE)
  } catch {
    /* nada que borrar */
  }
  await olvidarTodo()
}
