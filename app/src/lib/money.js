// Todo el dinero se maneja en CÉNTIMOS enteros para no arrastrar errores de coma flotante.
// La conversión de divisa (§3.6) se hace al crear el gasto: se guarda importeBase en céntimos
// de la moneda base del evento, con el tipo congelado. El motor de reparto solo ve céntimos base.

export function eurosToCents(euros) {
  return Math.round(Number(euros) * 100)
}

export function centsToEuros(cents) {
  return (cents ?? 0) / 100
}

const FORMATTERS = new Map()
function formatter(currency = 'EUR') {
  if (!FORMATTERS.has(currency)) {
    FORMATTERS.set(
      currency,
      new Intl.NumberFormat('es-ES', { style: 'currency', currency }),
    )
  }
  return FORMATTERS.get(currency)
}

export function formatCents(cents, currency = 'EUR') {
  return formatter(currency).format(centsToEuros(cents))
}
