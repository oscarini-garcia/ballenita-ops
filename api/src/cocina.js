/**
 * Con qué se cocina en este viaje (SPECS §14.20-quater).
 *
 * Sin esto, pedirle platos al modelo era pedírselos a ciegas, y fallaba en las
 * dos direcciones: proponía cosas de horno —que no hay— y no proponía las de
 * barbacoa, que es donde se hace casi todo. Con la frase delante, las cinco
 * propuestas son cinco propuestas que se pueden cocinar.
 *
 * Vive en el **evento** y no en la app porque cambia con el sitio: otro año,
 * otro camping y otros cacharros. Y es **texto libre**: una lista de casillas
 * obligaría a decidir de antemano qué cacharros existen, y lo que de verdad hay
 * que contarle es la frase entera —«en el bungaló se puede hacer algo en sartén,
 * pero poco: da mucho calor»—, que ninguna casilla dice.
 *
 * **Vacío no es vacío**, como en los encargos (§14.16-quater): vale el de
 * origen. Así funciona sin que nadie rellene nada, y corregirlo para un viaje
 * concreto no obliga a tocar el de los demás.
 *
 * Solo se lee al componer el material de la IA. No toca la compra, ni las
 * cenas, ni los saldos.
 */
export const COCINA_DE_ORIGEN = [
  'Barbacoa y plancha eléctrica profesional, que es donde se hace casi todo.',
  'Hay una granizadora Ninja.',
  'En el bungaló se puede hacer algo sencillo en sartén, pero poco: da mucho calor.',
].join(' ');

/** La de este evento, y la de siempre si no ha escrito ninguna. */
export const cocinaDe = (evento) => String(evento?.cocina ?? '').trim() || COCINA_DE_ORIGEN;

/** El renglón con el que entra en el material, en las palabras con las que se lee. */
export const renglonDeCocina = (evento) => `Con qué se cocina: ${cocinaDe(evento)}`;
