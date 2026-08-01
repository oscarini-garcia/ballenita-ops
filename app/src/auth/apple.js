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
 * Código numérico de `ASAuthorizationError`, que es lo único que de verdad
 * distingue un fallo de otro. El puente de Capacitor entrega el `NSError` ya
 * aplanado a texto («…AuthorizationError error 1001.»), así que se busca en el
 * mensaje cuando no viene suelto.
 */
export function codigoDeApple(error) {
  const suelto = Number(error?.code)
  if (Number.isFinite(suelto) && suelto >= 1000 && suelto <= 1099) return suelto
  const texto = String(error?.message ?? error ?? '')
  const encontrado = texto.match(/AuthorizationError error (\d+)/) ?? texto.match(/\b(10\d\d)\b/)
  return encontrado ? Number(encontrado[1]) : null
}

/**
 * Traduce el fallo de la hoja de Apple a algo accionable.
 *
 * El matiz que costó una tarde: **1001 es «cancelado»**, no «falta la
 * capacidad». Y iOS devuelve ese mismo 1001 tanto cuando uno cierra la hoja
 * como cuando la petición ni siquiera llega a presentarse —sin sesión de
 * iCloud, sin verificación en dos pasos, con Tiempo de uso restringiendo, o con
 * el binario sin la capacidad «Sign in with Apple»—. Como desde el móvil no se
 * puede saber cuál de los dos fue, la pregunta que lo separa —¿llegó a salir la
 * hoja de Apple?— se le hace a quien está mirando la pantalla.
 */
export function explicarFalloDeApple(error) {
  const codigo = codigoDeApple(error)
  const motivo = String(error?.message ?? error ?? '').trim()

  if (codigo === 1001 || (codigo === null && /cancel/i.test(motivo))) {
    return (
      'Apple canceló el acceso (error 1001).\n\n' +
      '¿Llegó a salir la hoja de «Continuar con Apple»?\n\n' +
      '• Si NO salió, el fallo no es tuyo: normalmente es que este iPhone no tiene ' +
      'sesión de iCloud iniciada, que ese Apple ID no tiene la verificación en dos ' +
      'pasos activada, o que Tiempo de uso está restringiendo el acceso. Los tres se ' +
      'arreglan desde Ajustes del iPhone. Si aun así no sale, es que al binario le ' +
      'falta la capacidad «Sign in with Apple» y hace falta compilación nueva (un OTA no basta).\n\n' +
      '• Si SÍ salió y la cerraste, vuelve a darle sin más.\n\n' +
      'Mientras tanto puedes seguir en este móvil sin entrar: lo que apuntes se sube entero cuando entres.'
    )
  }

  return (
    `Apple no completó el acceso${motivo ? `: ${motivo}` : '.'}\n\n` +
    'Lo más habitual es que falte la capacidad «Sign in with Apple» en el proyecto de Xcode ' +
    '(Signing & Capabilities). Tiene que estar marcada ahí y en el App ID del portal de Apple.'
  )
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

  // Las dos formas de fallar aquí piden arreglos muy distintos, y confundirlas
  // manda a buscar donde no es. Que el plugin no exista significa binario
  // antiguo; que exista y falle suele ser la capacidad «Sign in with Apple» sin
  // marcar en Xcode, o sencillamente que se canceló la hoja.
  let plugin
  try {
    ;({ SignInWithApple: plugin } = await import('@capacitor-community/apple-sign-in'))
  } catch {
    throw new Error(
      'Esta versión de la app no trae el acceso con Apple. Hace falta una compilación nueva; no basta con una actualización por OTA.',
    )
  }

  let idToken = null
  let nombre = ''
  try {
    const respuesta = await plugin.authorize({ scopes: 'name' })
    idToken = respuesta?.response?.identityToken ?? null
    nombre = [respuesta?.response?.givenName, respuesta?.response?.familyName].filter(Boolean).join(' ')
  } catch (error) {
    throw new Error(explicarFalloDeApple(error))
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
