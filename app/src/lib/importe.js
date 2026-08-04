// ─────────────────────────────────────────────────────────────────────────────
// La máquina de teclear un importe (SPECS §14.26, `docs/diseño/gasto-nuevo.html` · A1).
//
// Pura y sin React, como `reparto.js`: aquí no hay estado de pantalla, hay un
// objeto que entra, una tecla, y un objeto que sale. Todo el aparato del pad se
// prueba sin montar nada.
//
// Dos decisiones que conviene tener escritas, porque las dos se pueden discutir
// y las dos ya se han decidido:
//
// 1 · **Se teclea como una caja registradora**: los dígitos entran por la
//    derecha y empujan la coma. `2·4·3·0` son 24,30 €, no 2.430. Es lo que hace
//    que apuntar un gasto sean cuatro toques y no cinco, y sobre todo es lo que
//    quita la duda de si «148» son ciento cuarenta y ocho euros o un euro con
//    cuarenta y ocho. Por eso el pad **no lleva coma**: en registradora no
//    significaría nada. Donde la hoja dibujaba la coma va `C`, que borra la
//    operación entera —`⌫` borra un dígito, y con dos sumandos mal puestos
//    eso son ocho toques—.
//
// 2 · **El total está siempre calculado**, así que `=` confirma pero no revela:
//    lo que se ve en grande es lo que se guardaría si tocaras Guardar ahora.
//    Un gasto real son dos tickets (`18,40 + 5,90`) y salir a la calculadora del
//    móvil es perder lo que llevas escrito.
//
// Todo en **céntimos enteros**, como manda `lib/money.js`: aquí no entra ni un
// número con coma flotante.
// ─────────────────────────────────────────────────────────────────────────────

/** 999.999,99 € — el tope está para que un dedo apoyado no llene la pantalla. */
const TOPE = 99_999_999

/** Nada tecleado: ni términos cerrados, ni signo pendiente, ni cifra en curso. */
export const IMPORTE_VACIO = { terminos: [], signo: 1, cents: 0, tecleando: false }

/** El estado de partida al **corregir** un gasto: la cifra ya puesta, sin operación. */
export function desdeCents(cents) {
  return { terminos: [], signo: 1, cents: Math.max(0, Math.round(cents ?? 0)), tecleando: true }
}

/** Lo que suman los términos ya cerrados más el que se está tecleando. */
export function totalCents(e) {
  const cerrados = e.terminos.reduce((s, t) => s + t.signo * t.cents, 0)
  return cerrados + e.signo * e.cents
}

/** Un importe se puede guardar cuando es positivo: un gasto de 0 € no es un gasto. */
export const guardable = (e) => totalCents(e) > 0

function cerrar(e) {
  // Un signo pendiente sin cifra detrás no cierra nada: `+` seguido de `+` es
  // cambiar de idea sobre el signo, no sumar cero.
  if (!e.tecleando) return e.terminos
  return [...e.terminos, { signo: e.signo, cents: e.cents }]
}

/**
 * Una tecla. `tecla` es lo que se ve escrito en ella:
 * `'0'`…`'9'` · `'00'` · `'⌫'` · `'C'` · `'+'` · `'−'` · `'='`.
 * Cualquier otra cosa devuelve el estado tal cual: el pad no valida, decide aquí.
 */
export function teclear(e, tecla) {
  if (/^\d$/.test(tecla)) {
    const cents = e.cents * 10 + Number(tecla)
    return cents > TOPE ? e : { ...e, cents, tecleando: true }
  }
  if (tecla === '00') {
    const cents = e.cents * 100
    return cents > TOPE ? e : { ...e, cents, tecleando: true }
  }
  if (tecla === 'C') return IMPORTE_VACIO
  if (tecla === '+' || tecla === '−') {
    return { terminos: cerrar(e), signo: tecla === '+' ? 1 : -1, cents: 0, tecleando: false }
  }
  if (tecla === '=') {
    // Confirmar aplana: la cinta se vacía y lo que queda es el resultado, listo
    // para seguir operando sobre él. Un total negativo no se guarda (`guardable`),
    // pero tampoco se esconde: se enseña para que se vea qué se ha tecleado.
    return { terminos: [], signo: 1, cents: totalCents(e), tecleando: true }
  }
  if (tecla === '⌫') {
    if (e.cents > 0) return { ...e, cents: Math.floor(e.cents / 10) }
    // Sin cifra que borrar, `⌫` recupera el último término cerrado en vez de no
    // hacer nada: es la marcha atrás de `+`, que si no sería un viaje de ida.
    if (e.terminos.length) {
      const ultimo = e.terminos.at(-1)
      return { terminos: e.terminos.slice(0, -1), signo: ultimo.signo, cents: ultimo.cents, tecleando: true }
    }
    return e.tecleando ? IMPORTE_VACIO : e
  }
  return e
}

const FORMATO = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** «24,30» — sin el símbolo, que en la ficha va en su propio `span` más pequeño. */
export const enPalabras = (cents) => FORMATO.format((cents ?? 0) / 100)

/**
 * La cinta de arriba: la operación en curso, o cadena vacía si no hay ninguna.
 *
 * `18,40 +` mientras el segundo sumando está por teclear, y `18,40 + 5,90`
 * cuando ya hay algo. Sin términos cerrados no se pinta nada: teclear un importe
 * suelto no es una operación y no necesita explicarse.
 */
export function cinta(e) {
  if (!e.terminos.length) return ''
  const trozos = e.terminos.map((t, i) => (i === 0
    ? (t.signo < 0 ? `− ${enPalabras(t.cents)}` : enPalabras(t.cents))
    : `${t.signo < 0 ? '−' : '+'} ${enPalabras(t.cents)}`))
  trozos.push(e.signo < 0 ? '−' : '+')
  if (e.tecleando) trozos.push(enPalabras(e.cents))
  return trozos.join(' ')
}

/** Las dieciséis teclas, en el orden en que se pintan (4 × 4, A1). */
export const TECLAS = [
  '1', '2', '3', '⌫',
  '4', '5', '6', '+',
  '7', '8', '9', '−',
  'C', '0', '00', '=',
]
