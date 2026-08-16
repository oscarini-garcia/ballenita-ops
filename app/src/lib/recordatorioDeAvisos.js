/**
 * Volver a acordarse de los avisos, cada tanto (SPECS §14.65).
 *
 * El permiso se pide en Ajustes → Notificaciones y no al arrancar (§14.17), que
 * es lo correcto: un permiso que se pide en el primer segundo se contesta que
 * no. El precio es que quien no pasa por ahí no lo enciende nunca, y entonces no
 * se entera de un gasto, de una cena ni de que alguien quiere entrar — y no lo
 * echa de menos, porque nunca lo tuvo.
 *
 * **Lo que se puede hacer no es lo mismo en los dos casos**, y de ahí sale todo
 * lo de aquí:
 *
 *   · `prompt` — nadie ha contestado todavía. La hoja de iOS **sale**, así que
 *     el recordatorio puede llevar el botón que la abre.
 *   · `denied` — ya se contestó que no. **iOS enseña su hoja una sola vez en la
 *     vida de la instalación** (`lib/native.js`: `requestPermissions()` con el
 *     permiso denegado devuelve «denied» sin abrir nada), así que aquí no hay
 *     botón que valga: lo único cierto que se puede decir es dónde se enciende,
 *     que es en los Ajustes de iOS. Poner un botón que «pide» sería un botón que
 *     no hace nada.
 *
 * Y dos que **no** se recuerdan: `granted`, que no hay nada que pedir, y
 * `sin-plugin`, que no se arregla desde el teléfono —hace falta instalar un
 * binario nuevo— y recordarlo cada semana es dar la lata con algo que quien
 * sostiene el móvil no puede resolver.
 */

export const CADA_MS = 7 * 24 * 60 * 60 * 1000

const CLAVE = 'ballena.avisos.recordado'

/** Cuándo se recordó por última vez, o `null`. */
export function ultimoRecordatorio() {
  try {
    const guardado = Number(localStorage.getItem(CLAVE))
    return Number.isFinite(guardado) && guardado > 0 ? guardado : null
  } catch {
    return null
  }
}

export function apuntarRecordatorio(ahora = Date.now()) {
  try {
    localStorage.setItem(CLAVE, String(ahora))
  } catch {
    /* sin almacenamiento: se recordará otra vez, que es el fallo bueno */
  }
}

/**
 * Qué se puede decir y qué se puede ofrecer, según lo que conteste iOS. `null`
 * es que no hay nada que recordar.
 */
export function queDecir(permiso) {
  if (permiso === 'prompt' || permiso === 'prompt-with-rationale') {
    return {
      titulo: 'Enciende los avisos',
      texto: 'Sin ellos no te enteras de un gasto nuevo, de la cena de esta noche ni de quién quiere entrar.',
      verbo: 'Encender los avisos',
    }
  }
  if (permiso === 'denied') {
    return {
      titulo: 'Los avisos están apagados',
      texto: 'Dijiste que no una vez, y iOS ya no vuelve a preguntar. Se encienden en los Ajustes '
        + 'del iPhone → Ballena Ops → Notificaciones.',
      // Sin verbo a propósito: desde aquí no se puede abrir esa hoja, y un botón
      // que no hace nada es peor que no tenerlo.
      verbo: null,
    }
  }
  return null
}

/**
 * ¿Toca recordarlo?
 *
 * `estrenado` es si este móvil ya ha usado la app —ha sincronizado alguna vez—:
 * el recordatorio no sale en el primer arranque, que es el mismo motivo por el
 * que el permiso no se pide ahí. Después, cada `CADA_MS`; y «Ahora no» vuelve a
 * poner el reloj a cero, así que posponer es de verdad posponer.
 */
export function tocaRecordar({ permiso, ultimo = null, estrenado = true, ahora = Date.now() }) {
  if (!queDecir(permiso)) return false
  if (!estrenado) return false
  if (ultimo === null) return true
  return ahora - ultimo >= CADA_MS
}
