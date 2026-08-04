import { useEffect, useState } from 'react'
import { hayApi } from '../sync/api.js'

/**
 * ¿Se le puede preguntar algo al modelo **ahora mismo**?
 *
 * Decidido en [`docs/diseño/receta-fina.html`](../../../docs/diseño/receta-fina.html)
 * · arreglo 1, de los que no se votan.
 *
 * Los botones de IA se podían pulsar sin red y lo que salía era el error del
 * transporte contado con las palabras del transporte —«Load failed», «sin API
 * configurada»—, que no dice ni qué ha pasado ni si es culpa tuya. Y en el
 * navegador no van a funcionar **nunca**, porque la clave vive en el Worker y
 * `hayApi()` es falso fuera de la app de iOS (§14.9): un botón que nunca puede
 * funcionar no debería poder pulsarse.
 *
 * Devuelve el motivo escrito para leerlo, no para depurarlo. Mientras se sabe si
 * hay API —una lectura de `config.json`— el motivo va vacío: es un pestañeo, y
 * un aviso que aparece y se va molesta más que el botón apagado medio segundo.
 */
export function useIaDisponible() {
  const [conApi, setConApi] = useState(null)
  const [enRed, setEnRed] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  )

  useEffect(() => {
    let vivo = true
    hayApi()
      .then((x) => { if (vivo) setConApi(Boolean(x)) })
      .catch(() => { if (vivo) setConApi(false) })

    if (typeof window === 'undefined') return () => { vivo = false }
    const mirar = () => setEnRed(navigator.onLine !== false)
    window.addEventListener('online', mirar)
    window.addEventListener('offline', mirar)
    return () => {
      vivo = false
      window.removeEventListener('online', mirar)
      window.removeEventListener('offline', mirar)
    }
  }, [])

  if (!enRed) return { puede: false, motivo: 'Sin conexión: la IA vive en el servidor y ahora no se le llega.' }
  if (conApi === null) return { puede: false, motivo: '' }
  if (!conApi) return { puede: false, motivo: 'Esta copia va solo en local, y la IA vive en el servidor.' }
  return { puede: true, motivo: '' }
}
