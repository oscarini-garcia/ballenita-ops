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
 * capacidad». Y iOS devuelve ese mismo 1001 en tres situaciones que piden
 * arreglos distintos: la hoja no llega a presentarse, la hoja sale y Apple
 * misma corta el registro («Sign Up Not Completed»), o uno la cierra. Ninguna se
 * distingue desde el código —el `NSError` es idéntico—, así que la pregunta que
 * las separa —¿qué llegaste a ver?— se le hace a quien mira la pantalla, con la
 * salvedad de ordenar cada rama por lo que se puede tocar sin un Mac delante.
 */
export function explicarFalloDeApple(error) {
  const codigo = codigoDeApple(error)
  const motivo = String(error?.message ?? error ?? '').trim()

  if (codigo === 1001 || (codigo === null && /cancel/i.test(motivo))) {
    return (
      'Apple canceló el acceso (error 1001). Apple no dice más, así que va por lo que hayas visto:\n\n' +
      '• La hoja salió y Apple dijo «Registro no completado» → el atasco está en la ' +
      'cuenta, no en la app. Por orden: en developer.apple.com/account, acepta el contrato ' +
      'pendiente si lo hay (uno sin firmar rompe el acceso de todas tus apps a la vez); en ' +
      'Ajustes → tu nombre, acepta los términos de iCloud si te los pide; en Ajustes → tu ' +
      'nombre → Inicio de sesión y seguridad → Iniciar sesión con Apple, si Ballena Ops ya ' +
      'aparece de un intento anterior, deja de usar la cuenta y empieza de cero.\n\n' +
      '• La hoja no llegó a salir → este iPhone no tiene sesión de iCloud, ese Apple ID no ' +
      'tiene la verificación en dos pasos, o Tiempo de uso está restringiendo. Los tres se ' +
      'arreglan en Ajustes. Si aun así no sale, al binario le falta la capacidad «Sign in ' +
      'with Apple» y hace falta compilación nueva (un OTA no basta).\n\n' +
      '• La cerraste tú → vuelve a darle sin más.\n\n' +
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
 * Abre la hoja del sistema y devuelve lo que Apple conteste.
 *
 * Está extraído porque hay **dos** momentos que pasan por la hoja: entrar y
 * darse de baja. El segundo la necesita para conseguir el código con el que el
 * Worker le dice a Apple que el vínculo se acabó (`api/src/revocacion.js`).
 *
 * Que el plugin no exista significa binario antiguo, y eso se distingue aquí; lo
 * demás lo diagnostica `explicarFalloDeApple`, que es donde está el matiz.
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
    throw new Error(explicarFalloDeApple(error))
  }
}

/**
 * Un código de autorización recién emitido, para revocar la sesión ante Apple
 * al darse de baja.
 *
 * Se pide en el momento de la baja y no se guarda de una vez para siempre: el
 * porqué está en `api/src/revocacion.js`. Devuelve `null` en vez de lanzar si
 * algo va mal —sin plugin, hoja cancelada, Apple que no contesta—, porque quien
 * llama está a mitad de una baja de cuenta y **eso no puede fallar**. Quedarse
 * sin avisar a Apple es peor que avisarle, pero muchísimo mejor que dejar a
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
    // `en_espera` no es un fallo del que haya que recuperarse: la solicitud ha
    // quedado apuntada y lo único que falta es que alguien diga quién eres. La
    // pantalla de acceso lo cuenta como una sala de espera y no como un error.
    error.enEspera = datos.error === 'en_espera'
    error.nombre = datos.nombre
    // El pase con el que volver a preguntar sin pasar otra vez por la hoja de
    // Apple. Ver `auth/espera.js`.
    error.pase = datos.pase
    throw error
  }

  return datos
}
