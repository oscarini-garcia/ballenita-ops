/**
 * Acceso con Sign in with Apple.
 *
 * El cliente obtiene de Apple un token de identidad y la API lo canjea por una
 * sesión propia. De dónde sale ese token depende de dónde corra la app, y esa
 * es la única diferencia entre los dos caminos:
 *
 * - **En el navegador**, del SDK de Apple en ventana emergente, con el Services
 *   ID como cliente y el dominio de la PWA como URL de retorno.
 * - **Dentro de la cáscara de iOS**, de la hoja nativa. Allí el origen es
 *   `capacitor://localhost`, que no se puede registrar como URL de retorno, de
 *   modo que el flujo web sencillamente no cabe.
 *
 * El canje contra la API es idéntico en los dos casos: el Worker admite las dos
 * audiencias y devuelve la misma cuenta.
 */

import { isNative } from '../lib/native.js'

const SDK = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/es_ES/appleid.auth.js'

function cargarSdkDeApple() {
  if (window.AppleID) return Promise.resolve()
  return new Promise((resolver, rechazar) => {
    const guion = document.createElement('script')
    guion.src = SDK
    guion.onload = resolver
    guion.onerror = () => rechazar(new Error('No se pudo cargar el acceso de Apple.'))
    document.head.append(guion)
  })
}

async function tokenPorLaWeb(configuracion) {
  if (!configuracion.appleClienteWeb) {
    throw new Error('Esta instalación todavía no tiene configurado el acceso de Apple.')
  }

  await cargarSdkDeApple()
  window.AppleID.auth.init({
    clientId: configuracion.appleClienteWeb,
    scope: 'name',
    redirectURI: configuracion.redireccion || window.location.origin,
    usePopup: true,
  })

  const respuesta = await window.AppleID.auth.signIn()
  return {
    idToken: respuesta?.authorization?.id_token ?? null,
    nombre: [respuesta?.user?.name?.firstName, respuesta?.user?.name?.lastName].filter(Boolean).join(' '),
  }
}

/**
 * Hoja nativa de iOS. El plugin solo existe dentro de la cáscara; si la
 * compilación es anterior a que se añadiera, no basta con una actualización
 * OTA —el plugin es código nativo— y hay que subir un binario nuevo.
 */
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
  if (!configuracion?.api) {
    throw new Error('Esta instalación todavía no tiene configurada la API.')
  }

  const plataforma = isNative() ? 'ios' : 'web'

  let idToken = null
  let nombre = ''
  try {
    const obtenido = isNative() ? await tokenPorLaCascara() : await tokenPorLaWeb(configuracion)
    idToken = obtenido.idToken
    nombre = obtenido.nombre
  } catch (error) {
    if (plataforma === 'ios') {
      throw new Error(
        'Esta versión de la app no trae el acceso con Apple. Hace falta una compilación nueva; no basta con una actualización por OTA.',
      )
    }
    throw error
  }

  if (!idToken) throw new Error('Apple no devolvió un token de identidad.')

  const canje = await fetch(`${configuracion.api}/api/sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken, plataforma, nombre }),
  })

  const datos = await canje.json().catch(() => ({}))

  if (!canje.ok) {
    const error = new Error(datos.mensaje || datos.error || `La API respondió ${canje.status}.`)
    error.identificador = datos.identificador
    throw error
  }

  return datos
}
