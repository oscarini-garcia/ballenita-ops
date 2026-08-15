import { useEffect, useRef } from 'react'

/**
 * La pregunta antes de borrar, en su sitio y diciendo qué se lleva.
 *
 * Es la figura elegida en `docs/diseño/borrar-confirmaciones.html` · **A2**, de
 * entre las cuatro que había sobre la mesa. Gana por dos cosas: es la única que
 * **puede nombrar la cascada** sin tapar la fila que se está decidiendo —una
 * capa centrada esconde justo aquello sobre lo que se pregunta, y §14.27-bis ya
 * cerró esa figura al mover «Entre»—, y ya existía escrita en Grupo desde
 * §14.14, con sus colores y su prueba.
 *
 * Vive aquí y no copiada en cada pantalla porque el problema de partida era
 * **tener tres patrones a la vez** —segunda pulsación, bloque en sitio y
 * confirmación en línea dentro de un modal— sin haber elegido ninguno. Un
 * componente es la forma de que la próxima pantalla no invente una cuarta.
 *
 * `queSeLleva` es la frase, y no es opcional: un bloque que solo dice «¿seguro?»
 * es la segunda pulsación con más pasos y más alto. Quien no tenga nada que
 * contar no necesita esto (ver **A1**, la segunda pulsación de la compra).
 */
export default function Confirmar({
  queSeLleva,
  onDejarlo,
  onBorrar,
  dejarlo = 'Dejarlo',
  borrar = 'Sí, borrar',
}) {
  // **Y se enseña sola.** El bloque nace al final de su lista, así que con la
  // lista rodada hacia abajo cae fuera de la ventana: medido en Saldos con un
  // solo pago apuntado y la letra en Enorme, se abría en el 788 y acababa en el
  // 984 de una pantalla de 844. Desde el móvil eso se lee como que el botón no
  // ha hecho nada — y el siguiente toque es otra vez el mismo botón.
  const yo = useRef(null)
  useEffect(() => {
    try { yo.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) } catch { /* jsdom */ }
  }, [])

  return (
    <div className="confirmar" role="alert" ref={yo}>
      <div className="que-se-lleva">{queSeLleva}</div>
      <div className="grid2">
        <button type="button" className="btn ghost" onClick={onDejarlo}>{dejarlo}</button>
        <button type="button" className="btn danger" onClick={onBorrar}>{borrar}</button>
      </div>
    </div>
  )
}
