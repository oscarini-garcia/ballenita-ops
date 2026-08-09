/**
 * Lo que tiene que estar puesto en el binario para que los avisos existan, leído
 * **después** de haberlo escrito.
 *
 * Esto nace de un fallo que costó cuatro vueltas y que no era ninguna de las
 * cosas que se miraron. El `AppDelegate` del proyecto **no tenía el reenvío de
 * APNs**, y por eso el permiso se concedía, `register()` devolvía bien y no
 * llegaba ni token ni error nunca. Lo que hace que eso dure cuatro vueltas no es
 * la causa: es que `patch-ios.mjs` lo avisaba con un `console.warn` **en medio
 * de un log de compilación**, seguía adelante y terminaba en verde. Un aviso que
 * nadie lee y un `exit 0` dicen exactamente lo mismo que no haber comprobado
 * nada.
 *
 * Así que se comprueba al final, se dice entero, y **si falta algo el script
 * falla**. Archivar un binario que no puede avisar es trabajo perdido que no se
 * descubre hasta tener el teléfono en la mano.
 *
 * Puro a propósito —recibe el texto de los tres ficheros— para que se pruebe sin
 * un proyecto de Xcode delante.
 */

/**
 * Devuelve un renglón por cosa, con `bien` y con **qué hacer** si no lo está.
 *
 * Un fichero que no existe llega como `null` y cuenta como que falta, que es lo
 * que es: no hay diferencia práctica entre no tener el reenvío y no tener el
 * fichero donde va.
 */
export function revisionDeAvisos({ appDelegate = null, entitlements = null, proyecto = null } = {}) {
  return [
    {
      que: 'AppDelegate reenvía las respuestas de APNs',
      bien: Boolean(appDelegate?.includes('didRegisterForRemoteNotificationsWithDeviceToken')),
      // Es el que más veces falta y el único cuyo síntoma es el silencio: sin
      // esto Apple no contesta ni con identificador ni con error.
      arreglo: 'corre «npm run sync:ios» (el script npm, no «npx cap sync ios») y vuelve a instalar desde Xcode',
    },
    {
      que: 'aps-environment en App.entitlements',
      bien: Boolean(entitlements?.includes('aps-environment')),
      arreglo: 'activa «Push Notifications» en Xcode → target App → Signing & Capabilities',
    },
    {
      que: 'El proyecto firma ese fichero (CODE_SIGN_ENTITLEMENTS)',
      bien: Boolean(proyecto?.includes('CODE_SIGN_ENTITLEMENTS')),
      // Un entitlements que existe y no se firma es indistinguible de no
      // tenerlo, y encima el fichero está ahí para desmentirlo.
      arreglo: 'lo escribe este mismo script; si no ha podido, ponlo a mano en Build Settings',
    },
  ]
}

/** Las líneas que se imprimen, para que el formato también se pruebe. */
export function lineasDeRevision(revision) {
  const lineas = ['', '[patch-ios] ── Avisos al móvil ──────────────────────────']
  for (const { que, bien, arreglo } of revision) {
    lineas.push(`[patch-ios] ${bien ? '✅' : '❌'} ${que}`)
    if (!bien) lineas.push(`[patch-ios]    → ${arreglo}`)
  }
  if (revision.every((r) => r.bien)) {
    lineas.push('[patch-ios] Este binario podrá pedir el identificador de APNs.')
  } else {
    lineas.push('[patch-ios] ESTE BINARIO NO PODRÁ AVISAR. No archives hasta arreglarlo.')
  }
  lineas.push('')
  return lineas
}
