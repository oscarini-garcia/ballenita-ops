import { useEffect, useState } from 'react'
import { enPalabras, momentoDelDia } from '../lib/sol.js'
import { cieloDelMomento } from '../lib/cielo.js'

/**
 * La línea del horizonte: tres puntos bajo la cabecera que son el día.
 *
 * Opción **A4** de `docs/diseño/verano.html`. No es decoración con forma de sol:
 * es el día dibujado como una barra que se llena de amanecer a anochecer, con el
 * astro de 9 pt como tirador. De un vistazo dice cuánta luz queda, que en un
 * camping es una pregunta de verdad —si da tiempo a la piscina antes de cenar—.
 *
 * Cuesta **3 pt del cuerpo**, el 0,4%. Lo paga la sobriedad: la app ya tiene una
 * barra de progreso —la de sincronizar— y esta se le parece. Lo cura el disco
 * del tirador, que ninguna barra de progreso tiene.
 *
 * **No se anima, salta.** El sol avanza 25,2 pt a la hora, o sea 0,4 pt por
 * minuto: interpolar eso sería gastar batería para mover menos de medio punto.
 * Se recoloca cada minuto y ya. Por eso tampoco necesita entrar en el reparto de
 * `prefers-reduced-motion`: no hay nada que reducir.
 */
export default function LineaDelHorizonte({ ahora = null }) {
  const [momento, setMomento] = useState(() => momentoDelDia(ahora ?? new Date()))

  useEffect(() => {
    if (ahora) return undefined
    const reloj = setInterval(() => setMomento(momentoDelDia(new Date())), 60_000)
    return () => clearInterval(reloj)
  }, [ahora])

  /**
   * Y de paso, **el color del cielo** (A2). Va aquí y no en un componente suyo
   * porque es el mismo dato: quien ya sabe qué hora es del día es quien puede
   * decir de qué color está. `--cielo` se pone en la raíz y lo recoge `.appbar`
   * con el azul de siempre de reserva, así que sin JavaScript —o en la pantalla
   * de eventos, donde esto no se monta— la cabecera sigue siendo la de siempre.
   */
  useEffect(() => {
    const raiz = document.documentElement
    raiz.style.setProperty('--cielo', cieloDelMomento(momento))
    return () => raiz.style.removeProperty('--cielo')
  }, [momento])

  // Solo la fracción, de 0 a 1. Dónde cae eso en píxeles —y que el disco no se
  // salga por los bordes— es cuenta del CSS (`--f` en `theme.css`).
  const f = Math.max(0, Math.min(1, momento.fraccion))
  const queda = enPalabras(momento.quedan)
  const rotulo = momento.fase === 'dia'
    ? (queda ? `Quedan ${queda} de luz` : 'Es de día')
    : (queda ? `Amanece en ${queda}` : 'Es de noche')

  return (
    <div
      className="horizonte"
      data-fase={momento.fase}
      role="img"
      aria-label={rotulo}
      title={rotulo}
      style={{ '--f': f }}
    >
      <i className="recorrido" />
      <b className="astro" />
    </div>
  )
}
