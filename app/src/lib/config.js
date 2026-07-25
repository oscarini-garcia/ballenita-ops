/**
 * Configuración del despliegue, leída **en caliente** de `config.json`.
 *
 * Antes estos valores eran variables `VITE_*` inyectadas en el build. Cambiar
 * cualquiera obligaba a reconstruir y republicar, lo que con las
 * actualizaciones OTA de iOS significa un bundle nuevo para cambiar una URL. Y,
 * lo que era peor, la clave maestra de JSONBin acababa horneada en el
 * JavaScript de una web pública: cualquiera con las herramientas del navegador
 * podía leer y sobrescribir el documento entero del grupo.
 *
 * Aquí no hay ningún secreto: la dirección de la API y el identificador de
 * cliente de Apple son públicos por diseño. Lo único que autoriza es la sesión
 * que el Worker firma después de entrar.
 */

let cache = null

export async function cargarConfiguracion() {
  if (cache) return cache
  try {
    const base = import.meta.env?.BASE_URL ?? '/'
    const respuesta = await fetch(`${base}config.json`, { cache: 'no-cache' })
    if (respuesta.ok) cache = await respuesta.json()
  } catch {
    /* sin configuración la app arranca igual, y lo dice en la cabecera */
  }
  return cache ?? {}
}

/** Solo para los tests, que necesitan partir de cero. */
export function olvidarConfiguracion() {
  cache = null
}

export const estaConfigurada = (configuracion) => Boolean(configuracion?.api)
