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

async function tokenPorLaCascara() {
  const { SignInWithApple } = await import('@capacitor-community/apple-sign-in')
  const respuesta = await SignInWithApple.authorize({ scopes: 'name' })
  return {
    idToken: respuesta?.response?.identityToken ?? null,
    nombre: [respuesta?.response?.givenName, respuesta?.response?.familyName].filter(Boolean).join(' '),
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

  let idToken = null
  let nombre = ''
  try {
    const obtenido = await tokenPorLaCascara()
    idToken = obtenido.idToken
    nombre = obtenido.nombre
  } catch {
    throw new Error(
      'Esta versión de la app no trae el acceso con Apple. Hace falta una compilación nueva; no basta con una actualización por OTA.',
    )
  }

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
