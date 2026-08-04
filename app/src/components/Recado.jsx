import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { dinnersOf, expensesOf, listDishes, personsOf, plansOf, shopItemsOf } from '../db.js'
import { bolsaDeRecados, elegirRecado, recadosDeDatos } from '../lib/recados.js'
import { leerTanda } from '../lib/tanda.js'

/**
 * Un emoji y una frase, al final de la lista.
 *
 * Opciones **C2 + C4** de `docs/diseño/verano.html`: el sitio donde vive un
 * recado es el pie del *scroll* —donde ya vive la versión— y las pantallas
 * vacías. Los dos cuestan **0 pt permanentes**: mientras se lee la lista, esto
 * no existe. Por eso se descartó el renglón fijo sobre la barra (C1), que se
 * llevaba entre 42,6 y 66,2 pt del cuerpo para siempre y cobraba más caro al
 * que peor ve.
 *
 * De dónde salen las frases, en `lib/recados.js`: de los datos del viaje (D3) y
 * de la tanda que compone el Worker (D2), mezcladas en una bolsa de la que se
 * saca una al azar.
 *
 * **La tanda se lee al montar y no se vuelve a mirar.** Se refresca cada dos
 * horas desde `App.jsx`, y una pantalla que estuviera abierta justo en ese
 * momento enseñaría la de antes hasta que se vuelva a entrar. Escuchar el cambio
 * pediría un contexto o un `store` para algo que se resuelve solo al siguiente
 * toque, y aquí no hay nada que se pierda por esperar.
 */
export function useRecado(evento) {
  const eventId = evento?.id ?? null

  // La semilla se sortea una vez por montaje: sin esto la frase bailaría cada
  // vez que React vuelva a pintar, que en una lista viva es constantemente.
  const [semilla] = useState(() => Math.random())

  const gastos = useLiveQuery(() => (eventId ? expensesOf(eventId) : []), [eventId], [])
  const cenas = useLiveQuery(() => (eventId ? dinnersOf(eventId) : []), [eventId], [])
  const planes = useLiveQuery(() => (eventId ? plansOf(eventId) : []), [eventId], [])
  const compra = useLiveQuery(() => (eventId ? shopItemsOf(eventId) : []), [eventId], [])
  const personas = useLiveQuery(() => (eventId ? personsOf(eventId) : []), [eventId], [])
  const platos = useLiveQuery(() => listDishes(evento), [eventId, evento?.esDemo], [])
  const [tanda] = useState(() => leerTanda(eventId).recados)

  if (!eventId) return null

  const datos = recadosDeDatos({ evento, gastos, cenas, planes, compra, personas, platos })
  return elegirRecado(bolsaDeRecados(datos, tanda), semilla)
}

/**
 * El renglón del pie. Si no hay nada que decir **no pinta nada**: un hueco con
 * un emoji de relleno es peor que el silencio.
 */
export default function Recado({ evento }) {
  const recado = useRecado(evento)
  if (!recado) return null
  return (
    <p className="recado">
      <span className="e">{recado.emoji}</span>
      <span>{recado.texto}</span>
    </p>
  )
}
