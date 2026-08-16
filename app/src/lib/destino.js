/**
 * A dónde lleva tocar un aviso (SPECS §14.60,
 * `docs/diseño/donde-vive-el-grupo.html` · R2 · R3 · R4).
 *
 * **Media pieza llevaba escrita desde el principio y nadie la leía.** El sobre
 * de APNs mete fuera de `aps` lo que llegue en `aviso.datos`, y el comentario de
 * `api/src/apns.js` dice literalmente que «es lo que le dice a qué pantalla ir»;
 * el Worker lleva mandando `ir: 'dinero' | 'hoy' | 'ajustes/cuentas'` desde que
 * existen los avisos. Lo que faltaba estaba en el móvil: la app escuchaba
 * `pushNotificationReceived` —el aviso que **llega**— y no
 * `pushNotificationActionPerformed` —el que se **toca**—, así que el destino
 * viajaba en cada aviso y se tiraba a la basura al llegar. Pulsar abría la app
 * donde la hubieras dejado.
 *
 * Aquí solo se decide **qué significa** un destino. Quién escucha está en
 * `lib/native.js` y quién navega en `App.jsx`, que es donde vive el estado de la
 * pestaña — esto es puro para poder probarlo sin cáscara nativa.
 */

/** Las pestañas que existen. Un destino a una que no está lleva a «Hoy». */
const PESTANAS = new Set(['agenda', 'dinero', 'comidas', 'planes', 'grupo', 'ajustes'])

/**
 * `'dinero/gastos/exp_9f2'` → `{ tab: 'dinero', area: 'gastos', fila: 'exp_9f2' }`.
 *
 * Tres niveles y todos opcionales de derecha a izquierda: `'dinero'` es la
 * pestaña entera, `'dinero/gastos'` su área, y con el tercero se abre la fila.
 * Los avisos viejos mandan solo el primero y tienen que seguir valiendo.
 *
 * **Lo que no se reconoce lleva a «Hoy»** y no a ningún sitio: mejor la portada
 * que una pantalla vacía o un toque que no hace nada.
 */
export function leerDestino(ir) {
  const crudo = String(ir ?? '').trim()
  if (!crudo) return null
  const [tab, area = null, ...resto] = crudo.split('/')
  // La fila puede llevar barras —un día es `2026-08-15`, pero un id podría
  // traerlas—, así que lo que sobra se vuelve a unir en vez de perderse.
  const fila = resto.length ? resto.join('/') : null

  if (tab === 'hoy') return { tab: 'agenda', area: 'hoy', fila: null }
  if (!PESTANAS.has(tab)) return { tab: 'agenda', area: 'hoy', fila: null }
  return { tab, area, fila }
}

/**
 * El destino que espera a que la app esté lista (R4).
 *
 * Con la app cerrada, el toque llega **antes** de que haya nada montado y antes
 * de que la sincronización traiga la fila. Sin esto, el destino funcionaría con
 * la app abierta y fallaría justo cuando más se usa, que es a las ocho de la
 * mañana con el teléfono en la mesilla.
 *
 * Vive en memoria del módulo y no en `localStorage` a propósito: es «lo que
 * acaba de pasar», no una preferencia. Si la app muere antes de consumirlo, el
 * aviso sigue en la pantalla de bloqueo y se vuelve a tocar.
 */
let esperando = null

export function guardarDestino(destino) { esperando = destino ?? null }

/** Lo coge quien lo va a usar, y lo deja consumido: solo se navega una vez. */
export function tomarDestino() {
  const puesto = esperando
  esperando = null
  return puesto
}

export const hayDestino = () => Boolean(esperando)

/**
 * Lo que llega en `datos` de un aviso, ya leído: a dónde ir y de qué evento es.
 *
 * **El evento importa tanto como la pantalla** (R3): un aviso de un viaje que no
 * es el que tienes abierto lleva a una pantalla donde esa fila no existe, y eso
 * desde el móvil se lee como que la app se ha perdido. Con `evento` puesto, se
 * cambia antes de navegar.
 */
export function destinoDeAviso(datos) {
  if (!datos || typeof datos !== 'object') return null
  const destino = leerDestino(datos.ir)
  if (!destino) return null
  return { ...destino, eventId: datos.evento ? String(datos.evento) : null }
}
