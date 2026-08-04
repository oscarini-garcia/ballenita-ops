import { teclear, totalCents, cinta, enPalabras, TECLAS } from '../lib/importe.js'
import { tap } from '../lib/native.js'

/**
 * La cifra grande y el pad de dieciséis teclas
 * (`docs/diseño/gasto-nuevo.html` · A1, SPECS §14.26).
 *
 * Todo lo que piensa está en `lib/importe.js`; aquí solo se pinta y se pasa la
 * tecla. Es la razón de que la aritmética tenga test sin montar un solo
 * componente.
 *
 * Tres cosas del dibujo que no son de gusto:
 *
 * · **Cuatro columnas y no tres.** Un pad de tres da teclas de 104 pt en vez de
 *   76 y es mejor pad, sin discusión — pero cuesta una fila de 48 más su hueco,
 *   y esos 56 pt no existen: la ficha se iría a 689,6 sobre un tope de 658 y
 *   habría que hacer scroll dentro del modal justo para llegar a Guardar, que es
 *   el defecto que se venía a arreglar. 76 pt siguen siendo 1,7 pulgares.
 *
 * · **La cinta ocupa sitio esté o no esté.** Si apareciera solo al tocar `+`,
 *   el pad entero bajaría 26 pt en mitad de la operación y la tecla que ibas a
 *   pulsar dejaría de estar donde la habías mirado.
 *
 * · **`=` no revela nada**, y por eso puede ser la tecla de acento sin mentir:
 *   la cifra grande ya es el total en vivo, o sea lo que se guardaría si tocaras
 *   Guardar ahora mismo. Confirma y aplana la cinta, nada más.
 */
export default function PadDeImporte({ importe, onCambio, moneda = 'EUR' }) {
  const total = totalCents(importe)
  const operacion = cinta(importe)
  const simbolo = { EUR: '€', GBP: '£', USD: '$' }[moneda] ?? moneda

  function pulsar(t) {
    tap()
    onCambio(teclear(importe, t))
  }

  return (
    <div className="pad-importe">
      {/* `aria-live` para que el lector de pantalla cante el total al teclear:
          sin él, el pad son dieciséis botones que no dicen a dónde van. */}
      <div className="pad-cinta" aria-hidden={!operacion}>{operacion || ' '}</div>
      <div className="pad-cifra" aria-live="polite">
        <span className="tnum">{enPalabras(total)}</span>
        <span className="mon">{simbolo}</span>
      </div>
      <div className="pad-teclas">
        {TECLAS.map((t) => (
          <button
            key={t}
            type="button"
            className={`tec${'+−⌫C'.includes(t) ? ' op' : ''}${t === '=' ? ' igual' : ''}`}
            onClick={() => pulsar(t)}
            aria-label={ROTULOS[t] ?? t}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Lo que dice cada tecla en voz alta, que no siempre es lo que lleva escrito. */
const ROTULOS = {
  '⌫': 'Borrar un dígito',
  C: 'Borrar la operación entera',
  '+': 'Sumar',
  '−': 'Restar',
  '=': 'Confirmar la operación',
  '00': 'Dos ceros',
}
