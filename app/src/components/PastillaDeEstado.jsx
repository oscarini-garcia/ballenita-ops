import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { personsOf, updatePerson } from '../db.js'
import { now } from '../lib/ids.js'
import { useIdentidad } from '../lib/identidad.js'
import { tap } from '../lib/native.js'
import HojaDeEstado from './HojaDeEstado.jsx'

/**
 * Tu estado, en la segunda línea de la cabecera
 * (`docs/diseño/estado.html` · A3 · V1).
 *
 * De las tres colocaciones que se dibujaron es la única que **no le quita
 * ancho al nombre del evento**: la pastilla al lado del título lo dejaba en
 * 146 pt y recortaba «Ballenita 2026», que pide 188,1. Se paga en alto —la
 * cabecera pasa de 78,8 a 94,1 pt— y en que el objetivo se queda en 32, por
 * debajo de los 44 de iOS: es una pastilla dentro de una barra, no un botón
 * suelto, y va dicho aquí para que no se descubra midiendo.
 *
 * **Los estados largos caben** (§14.36-bis): la pastilla admite **dos líneas**
 * —de 37 letras a 65— y solo crece cuando se usa la segunda: 42 pt con una,
 * 44,9 con dos. Lo que pase de ahí se recorta, que es el único tope que queda.
 *
 * Los dos huecos (V1): con identidad y sin estado **invita** —«+ tu estado»—,
 * porque un botón que no se ve no se estrena; sin identidad en este móvil
 * vuelve el lugar, que es lo que había: no hay estado de nadie que enseñar y
 * la cabecera no es sitio para pedir que te identifiques.
 */
export default function PastillaDeEstado({ eventId, lugar }) {
  const personas = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const { me } = useIdentidad(eventId, personas)
  const [abierto, setAbierto] = useState(false)

  if (!me) return <div className="su">{lugar || 'Ballena Ops'}</div>

  const estado = String(me.estado ?? '').trim()

  return (
    <>
      <button
        type="button"
        className={`su-estado${estado ? '' : ' vacia'}`}
        onClick={() => { tap(); setAbierto(true) }}
      >
        {estado || '+ tu estado'}
      </button>

      {abierto && (
        <HojaDeEstado
          eventId={eventId}
          persona={me}
          onCerrar={() => setAbierto(false)}
          onGuardar={async (nuevo) => {
            // El «cuándo» lo escribe el cliente, como `apuntadaEl` de una idea:
            // así la tira de «Hoy» ordena por novedad desde el primer pintado y
            // sin depender de la sincronización. Vaciar el estado lo borra.
            await updatePerson(me.id, { estado: nuevo, estadoEl: nuevo ? now() : null })
            setAbierto(false)
          }}
        />
      )}
    </>
  )
}
