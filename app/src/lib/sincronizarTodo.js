import { syncNow } from '../sync/engine.js'
import { comprobarActualizacion, UPDATE_STEPS } from './pwa.js'

/**
 * Un botón, y hace las dos cosas en el orden que importa.
 *
 * El patrón es el de `garciadoral-ops`: los datos primero, porque es lo que se
 * suele querer decir y es de lo que se pinta el punto; la app después, porque es
 * lo único que no se aplica hasta recargar. Todo en una sola lista que se lee de
 * arriba abajo **como lo que ha ido pasando**, no como una promesa de lo que
 * pasará: cada fase cierra la suya antes de abrir la siguiente.
 *
 * Antes eran dos sitios distintos —el punto de sincronización por un lado, el
 * «Comprobar versión» de Ajustes por otro—, y entre los dos obligaban a acertar
 * cuál era tu problema antes de dejarte mirar. Nadie llega aquí sabiendo eso: se
 * llega porque algo no está como se esperaba, y «¿han subido mis gastos?» y
 * «¿tengo la versión buena?» son la misma pregunta hecha a capas distintas.
 *
 * Las dependencias se inyectan para poder probarlo sin service worker ni red.
 */

// Por qué no ha podido, dicho como se lo contarías a alguien.
const MOTIVOS = {
  'sin-sesion': 'no has entrado con Apple',
  offline: 'no hay conexión',
  busy: 'ya había una sincronización en marcha',
  'sesion-caducada': 'la sesión ha caducado; vuelve a entrar con Apple',
}

export async function sincronizarTodo({
  sincronizarDatos = syncNow,
  comprobarApp = comprobarActualizacion,
  alAvanzar = () => {},
} = {}) {
  const pasos = []
  const pintar = () => { try { alAvanzar([...pasos]) } catch { /* la UI se cayó */ } }
  const abrir = (texto) => { pasos.push({ texto, estado: 'curso' }); pintar() }
  const cerrar = (texto, estado) => { pasos[pasos.length - 1] = { texto, estado }; pintar() }

  // ── Los datos ──────────────────────────────────────────────────────────────
  abrir('Subiendo lo pendiente y trayendo lo nuevo…')
  let r
  try {
    r = await sincronizarDatos()
  } catch (error) {
    r = { status: 'error', error: String(error?.message ?? error) }
  }

  if (r?.status === 'synced') {
    cerrar('Datos al día: subido lo pendiente y traída la última copia', 'hecho')
  } else if (r?.status === 'no-config') {
    cerrar('Sin sincronización: esta instalación va solo local', 'aviso')
  } else {
    const motivo = MOTIVOS[r?.status] ?? r?.error ?? r?.status ?? 'error'
    cerrar(`No se han podido sincronizar los datos: ${motivo}`, 'fallo')
  }

  // ── La app ─────────────────────────────────────────────────────────────────
  abrir('Buscando si hay versión nueva de la app…')
  const estadoApp = await comprobarApp({
    // Los rótulos de cada fase son los de `pwa.js`, para que el proceso se
    // llame igual aquí que en el resto de la aplicación.
    onStatus: (p) => cerrar(UPDATE_STEPS[p] ?? p, 'curso'),
  })

  if (estadoApp === 'al-dia') cerrar('Ya tienes la última versión de la app', 'hecho')
  else if (estadoApp === 'no-aplica') cerrar('En el navegador la versión es la que sirva el servidor al recargar', 'aviso')
  else if (estadoApp === 'error') cerrar('No he podido comprobar si hay versión nueva', 'fallo')
  else cerrar('Versión nueva instalada: la app se recarga sola', 'hecho')

  return pasos
}
