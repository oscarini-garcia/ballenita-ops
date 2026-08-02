import { useEffect, useRef, useState } from 'react'
import { checkForOtaUpdate, isNative, tap, versionInstalada } from '../lib/native.js'
import { forzarActualizacion } from '../lib/pwa.js'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

/** Lo que tarda en volver a decir la versión después de contar en qué quedó. */
const DESCANSO_MS = 4000

/**
 * La versión, abajo del todo y tocable. Figura de `garciadoral-ops`.
 *
 * Dos cosas que parecen una: **decir qué versión hay puesta** y **traer la que
 * falte**. Antes la primera vivía en Ajustes → La app, a cuatro toques y detrás
 * de una solapa, y la pregunta que la lleva —«¿tengo lo nuevo o es que no
 * funciona?»— se hace justo aquí, mirando la pantalla donde se supone que
 * tendría que verse el cambio.
 *
 * Y va tocable porque la respuesta a esa pregunta casi siempre es «actualiza»:
 * un número que no se puede accionar obliga a irse a buscar el botón a otro
 * sitio, que es exactamente el viaje que este pie ahorra.
 *
 * **Dentro de la app, la versión que cuenta no es la del bundle de origen** sino
 * la del paquete OTA que esté aplicado, y esa solo la sabe el complemento. Se
 * enseña la de origen mientras contesta.
 */
export default function PieDeVersion() {
  const [version, setVersion] = useState(APP_VERSION)
  const [estado, setEstado] = useState('reposo') // reposo · curso · fallo
  const [texto, setTexto] = useState(null)
  const reloj = useRef(null)

  useEffect(() => {
    versionInstalada().then((v) => { if (v) setVersion(v) })
    return () => clearTimeout(reloj.current)
  }, [])

  const contar = (t, e = 'curso') => { setTexto(t); setEstado(e) }
  const descansar = () => {
    clearTimeout(reloj.current)
    reloj.current = setTimeout(() => { setTexto(null); setEstado('reposo') }, DESCANSO_MS)
  }

  async function mirar() {
    if (estado === 'curso') return
    tap()
    contar('Buscando…')
    try {
      if (isNative()) {
        const ota = await checkForOtaUpdate({ aplicarYa: true })
        // Si hubo versión nueva la webview ya se está recargando con ella; lo
        // que se pinte aquí no lo llega a ver nadie.
        if (ota.status === 'updated') return
        contar(ota.status === 'error' ? 'No se pudo mirar' : 'Ya tienes lo último', ota.status === 'error' ? 'fallo' : 'reposo')
        descansar()
        return
      }
      // En el navegador termina en recarga, así que no hay reposo al que volver.
      await forzarActualizacion(() => contar('Buscando…'))
    } catch {
      contar('No se pudo mirar', 'fallo')
      descansar()
    }
  }

  return (
    <div className="pie-version">
      <button
        type="button"
        className="version tnum"
        data-estado={estado}
        onClick={mirar}
        aria-label={texto ?? `Versión ${version}. Tocar para buscar una versión nueva.`}
        title="Buscar una versión nueva"
      >
        {texto ?? `Versión ${version}`}
      </button>
    </div>
  )
}
