/**
 * Quién administra, y cómo se le reconoce sin que nadie le abra la puerta.
 *
 * Es el gemelo de `app/src/lib/admin.js` —administrador hay **uno y escrito a
 * mano**— y existe por un cerrojo que aquel no podía ver: la sala de espera
 * solo la abre un administrador, así que si el que sale de la cuenta es el
 * único que hay, al volver se queda esperando a que le enlace… él mismo. La
 * única salida era escribir en la base a mano.
 *
 * El ancla es el correo, y no lo elige quien llama: llega **dentro del token
 * que firma Apple** (`apple.js` lo devuelve ya verificado), de modo que
 * presentarse con este correo exige haber pasado por la hoja de Apple con esa
 * cuenta. El nombre sirve para encontrar a su persona en el grupo y enlazarla
 * sola (`promoverCuentaAAdministrador`, en `repositorio.js`).
 */
export const ADMINISTRADOR = {
  nombre: 'Óscar García Chillón',
  correo: 'oscarini@gmail.com',
};

/** ¿Es el correo del administrador? Se normaliza: un correo no distingue
 *  mayúsculas, y Apple lo entrega tal como se escribió en su día. */
export function esCorreoDelAdministrador(correo) {
  return String(correo || '').trim().toLowerCase() === ADMINISTRADOR.correo;
}
