/**
 * El enlace de acceso, del lado del navegador (SPECS §14.52).
 *
 * Quien no tiene iPhone no puede entrar: la hoja de Apple vive en la cáscara
 * nativa, y sin ella no hay sesión. La salida es un enlace que genera quien
 * administra y que abre la app ya dentro, en cualquier navegador.
 *
 * Dos decisiones viven aquí y las dos son por lo mismo —**un enlace es una
 * credencial al portador**, se reenvía sin pensarlo y se queda escrito donde se
 * pegó—:
 *
 *   · **El pase va en el fragmento** (`#pase=…`) y no en la consulta. El
 *     fragmento no se manda al servidor, así que no aparece en los registros de
 *     Cloudflare, ni en la cabecera `Referer` de la primera página que se visite
 *     después, ni en lo que rastrea nadie. Es la única parte de una URL que se
 *     queda en el navegador.
 *   · **La URL se limpia en cuanto hay respuesta**, para que no se quede en la
 *     barra ni en el historial, ni viaje en la primera captura que alguien haga.
 *     Se limpia con la respuesta y no antes: si lo que falla es la red, la
 *     recarga tiene que poder reintentar con el mismo pase, que el servidor
 *     todavía no ha quemado.
 */

const CLAVE = 'pase'

/** El pase que trae esta URL, o `null`. */
export function paseDeLaUrl(url = globalThis.location?.href) {
  try {
    const trozo = String(url ?? '').split('#')[1]
    if (!trozo) return null
    const pase = new URLSearchParams(trozo).get(CLAVE)
    return pase?.trim() || null
  } catch {
    return null
  }
}

/**
 * Quita el pase de la barra de direcciones sin recargar ni dejar entrada en el
 * historial (`replaceState`), que es lo que separa esto de tocar `location.hash`.
 */
export function limpiarLaUrl() {
  try {
    const { origin, pathname, search } = globalThis.location
    globalThis.history.replaceState(null, '', `${origin}${pathname}${search}`)
  } catch {
    /* sin history: el pase se queda en la barra y ya está, no es motivo para no entrar */
  }
}

/**
 * Canjea el pase por una sesión.
 *
 * Devuelve lo que conteste el Worker, que es una de cinco:
 *   · `{ estado: 'dentro', token, cuenta }` — esto **es** la sesión
 *   · `{ estado: 'usado', mensaje }`        — ya se canjeó, o hay otro más nuevo
 *   · `{ estado: 'no-vale', mensaje }`      — caducado, roto al copiarlo, o de otra base
 *   · `{ estado: 'desactivada', mensaje }`  — le han cerrado la puerta a propósito
 *   · `{ estado: 'sin-respuesta' }`         — la red, y solo la red
 *
 * El último es el único que se reintenta, y por eso está separado de los otros
 * tres fallos: «no hay cobertura» y «este enlace ya no vale» se arreglan en
 * sitios distintos —uno esperando, el otro pidiéndole otro a quien administra— y
 * juntarlos en un «no se pudo entrar» deja mirando la pantalla a quien tendría
 * que estar escribiendo un WhatsApp.
 */
export async function canjearEnlace(configuracion, pase) {
  if (!configuracion?.api || !pase) return { estado: 'sin-respuesta' }

  try {
    const respuesta = await fetch(`${configuracion.api}/api/sesion/enlace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pase }),
    })
    const cuerpo = await respuesta.json().catch(() => null)
    if (!cuerpo?.estado) return { estado: 'sin-respuesta' }
    return cuerpo
  } catch {
    return { estado: 'sin-respuesta' }
  }
}

/**
 * La dirección que se le manda a quien va a entrar.
 *
 * La base sale de `config.json` (`web`) porque quien genera el enlace lo hace
 * **desde el móvil**, dentro de la cáscara nativa, donde `location.origin` es
 * `capacitor://localhost` y no le sirve a nadie. El respaldo es el origen
 * propio, que es el bueno cuando esto corre en el navegador.
 */
export function urlDeEnlace(configuracion, pase) {
  const base = String(configuracion?.web || '').trim() || globalThis.location?.origin || ''
  return `${base.replace(/\/+$/, '')}/#${CLAVE}=${encodeURIComponent(pase)}`
}
