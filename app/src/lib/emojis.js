/**
 * Contar y cortar emoji **por dibujos**, y no por unidades de texto
 * (SPECS §14.47).
 *
 * Los campos de emoji llevaban `maxLength={4}`, que cuenta unidades UTF-16, y
 * eso hacía dos cosas raras a la vez: dejaba poner **dos** caritas simples
 * —🙂 son dos unidades— y **ninguna** familia, porque 👨‍👩‍👧 son **ocho**: el
 * emoji que viene de fábrica en una familia no se podía escribir a mano.
 *
 * Aquí se agrupa lo que el ojo ve como un dibujo:
 *
 * - Las **banderas** son dos indicadores regionales seguidos (🇪🇸).
 * - El **tono de piel** (🏽), el **selector de variante** (️) y el marco de
 *   tecla (⃣) se pegan al dibujo anterior.
 * - Y el **juntador de ancho cero** (ZWJ, `U+200D`) encadena dibujos en uno:
 *   así se construyen las familias, las profesiones y las banderas de región.
 *
 * Se hace a mano y no con `Intl.Segmenter` porque el binario admite **iOS 15**
 * y el segmentador llega en el 16.4: un camino que a veces existe y a veces no
 * es un camino que se prueba una vez y falla en el móvil de otro.
 */
const ZWJ = 0x200d
const VARIANTE = 0xfe0f
const TECLA = 0x20e3

const esModificador = (cp) => (cp >= 0x1f3fb && cp <= 0x1f3ff) || cp === VARIANTE || cp === TECLA
const esRegional = (cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff

/** El texto partido en dibujos. `['👨‍👩‍👧', '🇪🇸', '🏄🏽']` y no once trozos. */
export function racimos(texto) {
  const puntos = Array.from(String(texto ?? ''))
  const dibujos = []
  let i = 0

  while (i < puntos.length) {
    let dibujo = puntos[i]
    i += 1

    // Una bandera son dos indicadores regionales, y solo dos.
    if (esRegional(dibujo.codePointAt(0)) && puntos[i] && esRegional(puntos[i].codePointAt(0))) {
      dibujo += puntos[i]
      i += 1
    }

    // Y lo que se pega detrás: tonos, variantes y cadenas con ZWJ.
    for (;;) {
      const siguiente = puntos[i]
      if (!siguiente) break
      const cp = siguiente.codePointAt(0)
      if (esModificador(cp)) { dibujo += siguiente; i += 1; continue }
      // El ZWJ solo une si detrás viene algo: uno suelto al final no cuenta.
      if (cp === ZWJ && puntos[i + 1]) { dibujo += siguiente + puntos[i + 1]; i += 2; continue }
      break
    }

    dibujos.push(dibujo)
  }

  return dibujos
}

export const contarEmojis = (texto) => racimos(texto).length

/** Lo que quepa en `max` dibujos, sin partir ninguno por la mitad. */
export const cortarEmojis = (texto, max = 3) => racimos(texto).slice(0, max).join('')

/** Cuántos dibujos se admiten donde se elige uno (§14.47). */
export const TOPE_EMOJIS = 3
