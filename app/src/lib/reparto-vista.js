// Cómo se cuenta el reparto de un gasto en pantalla, sin pintar nada.
import { formatCents, centsToEuros } from './money.js'
import { expenseFamilyShares } from './reparto.js'

// En un intervalo el símbolo va **una vez**, al final: «de 8,10 a 24,30 €». Es
// la convención de toda la vida y aquí además son dos letras, que con seis
// familias y cifras de cuatro dígitos es justo lo que parte el renglón en dos.
const cifra = (cents) => new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(centsToEuros(cents))

/**
 * El reparto de un gasto que se está apuntando, ya hecho y ordenado
 * (`docs/diseño/cenas-fuera-y-reparto.html` · R1 · R5).
 *
 * Es un envoltorio de `expenseFamilyShares` y no una cuenta nueva: la cuenta ya
 * estaba resuelta, con sus tres modos y sin perder un céntimo, y lo único que
 * faltaba era **enseñarla**. Se le pasa el gasto a medio escribir —lo que hay
 * en la ficha ahora mismo, no una fila de la base— porque la pregunta que se
 * contesta es «¿cómo va a quedar esto si lo guardo?».
 *
 * Sale ordenado de más a menos y **sin las familias a cero**: una casa que no
 * entra en el gasto no es un renglón que diga «0,00 €», es una casa que no está.
 */
export function repartoDeFamilias({ amountCents, participantIds, reparto }, familias, personsById) {
  const porFamilia = expenseFamilyShares(
    { amountCents, participantIds, reparto },
    personsById,
  )
  return [...porFamilia]
    .filter(([, cents]) => cents > 0)
    .map(([id, cents]) => ({
      id,
      cents,
      // Una persona sin familia entra como «familia de uno» con la clave
      // `solo:<personId>` (§3.3), así que el nombre se busca en las dos listas.
      nombre: familias.find((f) => f.id === id)?.name
        ?? personsById[id.replace(/^solo:/, '')]?.name
        ?? 'Sin familia',
    }))
    .sort((a, b) => b.cents - a.cents || a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * El mismo reparto dicho **en una línea** (R1), en trozos con su negrita.
 *
 * Devuelve trozos y no una cadena por lo mismo que `fraseDeLaNoche` (§14.67):
 * lo que va en negrita es el dinero y el número de casas, y componer eso en la
 * pantalla sería volver a partir la frase allí.
 *
 * Tres frases, porque **«a cada una» solo es verdad a veces**:
 *
 *   · una sola familia → se lo lleva entera;
 *   · todas igual      → «X a cada una de las N familias», que es el 90 % de
 *                        los gastos: un pagador y todos dentro;
 *   · repartido fino   → el suelo y el techo. Decir «a cada una» con
 *                        coeficientes distintos sería mentira, y es justo el
 *                        caso en el que hace falta mirar.
 *
 * **Las tres caben en un renglón, y eso no es estilo: es el requisito.** La
 * ficha rápida de §14.26 cabía **exacta** —0 pt de scroll— y su botón de
 * guardar se veía entero. Con la frase en dos líneas pasaba a 41 pt de scroll y
 * el botón se quedaba al 59 % : la línea que se añadió para no tener que abrir
 * nada obligaba a rodar para llegar a Guardar. En una son 19 pt de scroll y el
 * botón vuelve a verse al 100 %. Por eso no dicen «Les toca» ni «Se reparte
 * entre»: cada palabra de cortesía costaba el renglón entero.
 *
 * **Un céntimo de diferencia sigue siendo «igual»**: repartir 10,00 entre tres
 * da 3,34 · 3,33 · 3,33 por resto mayor, y eso es un reparto a partes iguales
 * con el pico colocado, no tres importes distintos. Sin esta holgura, la frase
 * honesta saldría en el caso más normal que hay. Se dice el mayor, y el reparto
 * exacto está en Detalles, que es donde se va a mirar el céntimo.
 */
export function fraseDelReparto(filas, currency = 'EUR') {
  if (!filas.length) return null
  const euros = (c) => formatCents(c, currency)

  if (filas.length === 1) {
    return [{ t: 'Entero para ' }, { t: filas[0].nombre, fuerte: true }]
  }

  const alto = filas[0].cents
  const bajo = filas[filas.length - 1].cents
  const casas = `${filas.length} familias`
  if (alto - bajo <= 1) {
    return [{ t: casas }, { t: ' · ' }, { t: euros(alto), fuerte: true }, { t: ' cada una' }]
  }
  return [
    { t: casas }, { t: ' · de ' },
    { t: cifra(bajo), fuerte: true }, { t: ' a ' }, { t: euros(alto), fuerte: true },
  ]
}
