/**
 * Acceso con Sign in with Apple — **solo dentro de la app de iOS**.
 *
 * La decisión es deliberada: la sincronización con el grupo vive únicamente en
 * la cáscara nativa. En el navegador y en la PWA instalada, Ballena Ops
 * funciona como una libreta local de ese dispositivo, sin entrar y sin hablar
 * con la API.
 *
 * Eso ahorra toda la mitad web del montaje de Apple —el Services ID, la
 * verificación del dominio, el fichero `.txt` y el SDK en ventana emergente—,
 * que es justo la parte que más se atasca. A cambio, quien quiera los datos del
 * grupo necesita la app de iOS instalada.
 *
 * El plugin es código nativo: no viaja en las actualizaciones OTA. Una app
 * compilada antes de que se añadiera no puede entrar por mucho que reciba la
 * web nueva, y por eso el error lo dice con esas palabras.
 */

import { isNative } from '../lib/native.js'

/**
 * Abre la hoja del sistema y devuelve lo que Apple conteste.
 *
 * Las dos formas de fallar aquí piden arreglos muy distintos, y confundirlas
 * manda a buscar donde no es. Que el plugin no exista significa binario
 * antiguo; que exista y falle suele ser la capacidad «Sign in with Apple» sin
 * marcar en Xcode, o sencillamente que se canceló la hoja.
 */
async function autorizar() {
  let plugin
  try {
    ;({ SignInWithApple: plugin } = await import('@capacitor-community/apple-sign-in'))
  } catch {
    throw new Error(
      'Esta versión de la app no trae el acceso con Apple. Hace falta una compilación nueva; no basta con una actualización por OTA.',
    )
  }

  try {
    return (await plugin.authorize({ scopes: 'name' }))?.response ?? {}
  } catch (error) {
    const motivo = String(error?.message ?? error ?? '').trim()
    if (/cancel/i.test(motivo)) throw new Error('Has cancelado el acceso con Apple.')
    throw new Error(
      `Apple no completó el acceso${motivo ? `: ${motivo}` : '.'}\n\n` +
        'Lo más habitual es que falte la capacidad «Sign in with Apple» en el proyecto de Xcode (Signing & Capabilities). Tiene que estar marcada ahí y en el App ID del portal de Apple.',
    )
  }
}

/**
 * Un código de autorización recién emitido, para revocar la sesión ante Apple
 * al darse de baja.
 *
 * Se pide en el momento de la baja y no se guarda de una vez para siempre: el
 * porqué está en `api/src/revocacion.js`. Devuelve `null` en vez de lanzar si
 * algo va mal —sin plugin, hoja cancelada, Apple que no contesta—, porque quien
 * llama está a mitad de una baja de cuenta y **eso no puede fallar**. Se queda
 * sin avisar a Apple, que es peor que avisarle, pero muchísimo mejor que dejar a
 * alguien sin poder irse.
 */
export async function codigoDeAutorizacionDeApple() {
  try {
    return (await autorizar()).authorizationCode ?? null
  } catch {
    return null
  }
}

/**
 * Devuelve `{ token, cuenta }` o lanza un error con un mensaje legible. El
 * error de «todavía no tienes acceso» lleva además el identificador que hay que
 * pasarle a quien administre el grupo.
 */
export async function entrarConApple(configuracion) {
  if (!isNative()) {
    throw new Error(
      'Aquí Ballena Ops funciona en local, sin conectarse al grupo. Para compartir gastos con los demás hace falta la app de iOS.',
    )
  }
  if (!configuracion?.api) {
    throw new Error('Esta instalación todavía no tiene configurada la API.')
  }

  const { identityToken: idToken, givenName, familyName } = await autorizar()
  const nombre = [givenName, familyName].filter(Boolean).join(' ')

  if (!idToken) throw new Error('Apple no devolvió un token de identidad.')

  const canje = await fetch(`${configuracion.api}/api/sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken, plataforma: 'ios', nombre }),
  })

  const datos = await canje.json().catch(() => ({}))

  if (!canje.ok) {
    const error = new Error(datos.mensaje || datos.error || `La API respondió ${canje.status}.`)
    error.identificador = datos.identificador
    throw error
  }

  return datos
}
