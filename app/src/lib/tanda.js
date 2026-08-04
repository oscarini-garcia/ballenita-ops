/**
 * Cuándo se pide la tanda de recadillos, y dónde se guarda mientras tanto.
 *
 * La regla es la del encargo: **cada dos horas**. Si la app está abierta, al
 * cumplirse; si estaba cerrada, al abrirla, siempre que hayan pasado dos horas
 * desde la última. Que es lo mismo dicho de dos maneras: se mira si la que hay
 * ha caducado, y se mira **al abrir, al volver del fondo y cada cinco minutos**.
 *
 * Tres decisiones:
 *
 * - **La ventana se cumple dos veces, aquí y en el Worker.** Esta de aquí evita
 *   la petición; la de allí evita la llamada al modelo. Con nueve móviles hacen
 *   falta las dos: sin la del servidor, nueve teléfonos que abren la app a la
 *   vez son nueve llamadas de pago; sin esta, son nueve peticiones que el
 *   servidor contesta con lo mismo. Ni una sola de las dos sobra.
 * - **Se guarda en `localStorage`, no en Dexie.** No es un hecho del grupo: es
 *   una copia de algo que el servidor ya tiene y que se puede tirar entera sin
 *   perder nada. En la cola de cambios no pinta nada.
 * - **Un fallo no se cuenta.** Si no hay red o no hay clave, se sigue con lo que
 *   haya guardado —una tanda de ayer sigue teniendo gracia— y no se avisa de
 *   nada: nadie ha pedido esto, nadie está esperando una respuesta.
 */

import { hoyISO } from './dias.js'

/**
 * El transporte se trae **cuando hace falta**, no al cargar el módulo.
 *
 * `db.js` llama aquí para olvidar las tandas al salir de la cuenta, así que un
 * `import` de arriba metería `sync/api.js` —y con él la configuración y la
 * sesión— dentro de la capa de datos, que no tiene por qué saber que existe una
 * red. De paso, en el navegador y en la PWA, donde esto no se usa nunca, el
 * transporte no se carga siquiera.
 */
const transporte = () => import('../sync/api.js')

const CLAVE = 'ballena.recados'

/** Dos horas, la misma ventana que cumple el Worker (`api/src/recados.js`). */
export const VENTANA_MS = 2 * 60 * 60 * 1000

/** Cada cuánto se comprueba si tocaba. No es cada cuánto se pide. */
export const LATIDO_MS = 5 * 60 * 1000

const clave = (eventId) => `${CLAVE}.${eventId}`

/** Lo guardado de este evento, o una tanda vacía si no hay nada o está roto. */
export function leerTanda(eventId) {
  try {
    const crudo = localStorage.getItem(clave(eventId))
    if (!crudo) return { recados: [], pedidaEn: 0 }
    const { recados, pedidaEn } = JSON.parse(crudo)
    return { recados: Array.isArray(recados) ? recados : [], pedidaEn: Number(pedidaEn) || 0 }
  } catch {
    return { recados: [], pedidaEn: 0 }
  }
}

function guardarTanda(eventId, recados, pedidaEn) {
  try {
    localStorage.setItem(clave(eventId), JSON.stringify({ recados, pedidaEn }))
  } catch { /* sin sitio en el disco: se vive sin tanda */ }
}

/** ¿Toca pedir? Sin haber pedido nunca, sí; pasadas las dos horas, también. */
export const tocaPedir = (pedidaEn, ahora = Date.now()) => ahora - (pedidaEn || 0) >= VENTANA_MS

/**
 * Pide la tanda si toca, y devuelve la que quede vigente.
 *
 * **La hora se apunta aunque la respuesta venga vacía.** Sin eso, una
 * instalación sin clave de IA preguntaría en cada latido para siempre: cinco
 * minutos, otra vez, y otra. Vacío es una respuesta.
 */
export async function asegurarTanda(eventId, { ahora = Date.now() } = {}) {
  if (!eventId) return { recados: [], pedidaEn: 0 }

  const tanda = leerTanda(eventId)
  if (!tocaPedir(tanda.pedidaEn, ahora)) return tanda

  const { hayApi, traerRecados } = await transporte()
  if (!(await hayApi())) return tanda

  try {
    const { recados } = await traerRecados(eventId, hoyISO())
    // Una tanda vacía no borra la que había: si el servidor se quedó sin decir
    // nada, mejor las de ayer que ninguna.
    const quedan = recados.length ? recados : tanda.recados
    guardarTanda(eventId, quedan, ahora)
    return { recados: quedan, pedidaEn: ahora }
  } catch {
    return tanda
  }
}

/** Se lleva las tandas de todos los eventos. Lo usa `olvidarTodo()` al salir. */
export function olvidarTandas() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(`${CLAVE}.`)) localStorage.removeItem(k)
  } catch { /* nada que olvidar */ }
}
