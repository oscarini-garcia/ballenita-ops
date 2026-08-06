import { syncNow, ultimaSincronizacion } from '../sync/engine.js'
import { informeDelFallo, MOTIVOS } from './sincronizarTodo.js'

/**
 * La primera bajada: traer lo del grupo justo después de entrar por primera vez.
 *
 * Es hermana de `sincronizarTodo` y no la misma por una razón concreta: aquella
 * comprueba además si hay versión nueva de la app y **recarga** si la hay. Eso
 * está bien cuando lo pide alguien desde Ajustes, y está mal aquí — recargar la
 * app en mitad del primer arranque, a los tres segundos de entrar y sin que
 * nadie lo haya pedido, es la peor primera impresión posible. Aquí solo se
 * bajan los datos.
 *
 * Cuenta lo que va pasando con los mismos pasos que el resto de la app
 * (`ListaDePasos`, SPECS §14.9-bis) y devuelve `{ bien }`, que es lo único que
 * necesita saber quien la llama para decidir si ya se puede entrar.
 */
export async function primeraBajada({ sincronizarDatos = syncNow, alAvanzar = () => {} } = {}) {
  const pasos = []
  const pintar = () => { try { alAvanzar([...pasos]) } catch { /* la UI se cayó */ } }
  const abrir = (texto) => { pasos.push({ texto, estado: 'curso' }); pintar() }
  const cerrar = (texto, estado, extra = {}) => {
    pasos[pasos.length - 1] = { texto, estado, ...extra }
    pintar()
  }

  // El primer paso ya está hecho antes de empezar, y se dibuja igual: es lo que
  // convierte «cargando» en «vas por aquí». Sin él, la única marca de la lista
  // sería un punto girando.
  pasos.push({ texto: 'Sesión abierta', estado: 'hecho' })
  abrir('Trayendo el evento, la gente y lo apuntado…')

  let r
  try {
    r = await sincronizarDatos()
  } catch (error) {
    r = { status: 'error', error: String(error?.message ?? error) }
  }

  if (r?.status === 'synced') {
    cerrar('Ya está: el viaje del grupo está en este móvil', 'hecho')
    return { bien: true, pasos }
  }

  // Sin API configurada no hay nada que bajar y tampoco hay ningún problema:
  // esta instalación va solo local y la app funciona igual.
  if (r?.status === 'no-config') {
    cerrar('Esta instalación va solo local: no hay nada que traer', 'aviso')
    return { bien: true, pasos }
  }

  const motivo = MOTIVOS[r?.status] ?? r?.error ?? r?.status ?? 'error'
  cerrar(`No se ha podido traer lo del grupo: ${motivo}`, 'fallo', {
    informe: informeDelFallo({ motivo, estado: r?.estado, ultima: r?.ultima ?? ultimaSincronizacion() }),
  })
  return { bien: false, pasos }
}
