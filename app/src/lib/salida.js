import { cuantosPendientes as pendientesEnLaCola } from '../db.js'
import { syncNow } from '../sync/engine.js'
import { MOTIVOS } from './sincronizarTodo.js'

/**
 * Salir de la cuenta sin llevarse por delante lo que todavía no ha subido.
 *
 * Salir **borra la copia local entera** —los datos del grupo no se quedan en un
 * móvil que ya no va a poder actualizarlos—, y esa parte está bien. Lo que
 * estaba mal es que se llevaba también **la cola de cambios**: lo apuntado que
 * aún no había llegado al servidor. Al volver a entrar, la instantánea es la
 * única fuente, así que lo que no había subido no vuelve. Desde fuera se ve
 * como «he salido y ha desaparecido el evento», que es exactamente lo que pasó.
 *
 * No es un caso raro. Basta con haber apuntado algo sin cobertura, o venir de
 * «usar solo en este móvil» —donde nada sube hasta que se entra—, o que la
 * última sincronización fallara. La interfaz es optimista: todo eso se vio
 * guardado.
 *
 * Así que antes de borrar nada **se intenta subir**, y solo se sale sin más si
 * la cola queda vacía. Si no lo consigue, no se decide por ti: se dice cuántos
 * cambios se perderían y por qué no han subido, y salir pasa a ser una segunda
 * pulsación. Mismo criterio que el resto de la sincronización (SPECS §14.9-bis):
 * lo que falla se cuenta, no se calla.
 */
export async function comprobarAntesDeSalir({
  sincronizar = syncNow,
  pendientes = pendientesEnLaCola,
} = {}) {
  const antes = await pendientes()
  // Nada que perder: el camino de siempre, sin preguntas de más.
  if (antes === 0) return { seguro: true, pendientes: 0, subidos: 0 }

  const resultado = await sincronizar().catch((e) => ({ status: 'error', error: String(e?.message ?? e) }))
  const quedan = await pendientes()
  if (quedan === 0) return { seguro: true, pendientes: 0, subidos: antes }

  return {
    seguro: false,
    pendientes: quedan,
    motivo: MOTIVOS[resultado?.status] ?? resultado?.error ?? resultado?.status ?? 'no se ha podido subir',
  }
}

/** El aviso, en palabras y con el número delante, que es lo que se decide. */
export function avisoDeSalida({ pendientes, motivo }) {
  const cosas = pendientes === 1 ? '1 cambio' : `${pendientes} cambios`
  const verbo = pendientes === 1 ? 'ha subido' : 'han subido'
  return `${cosas} sin subir: ${motivo}. Si sales ahora se ${pendientes === 1 ? 'pierde' : 'pierden'}, porque al volver a entrar solo vuelve lo que ${verbo} al servidor.`
}
