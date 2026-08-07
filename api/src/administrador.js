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

/** Sin tildes, sin mayúsculas y sin espacios de más: Apple guarda «Oscar
 *  García Chillón» sin tilde, y una llave que exige la tilde no abre. */
export function normalizarNombre(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** ¿Es el correo del administrador? Se normaliza: un correo no distingue
 *  mayúsculas, y Apple lo entrega tal como se escribió en su día. */
export function esCorreoDelAdministrador(correo) {
  return String(correo || '').trim().toLowerCase() === ADMINISTRADOR.correo;
}

/**
 * ¿Es el nombre del administrador? Es la **segunda** llave, y más débil que el
 * correo: el nombre no viene firmado por Apple —lo manda la app al abrir
 * sesión—, así que quien la use debe exigir además que **no quede ningún
 * administrador activo** (`hayAdministradorActivo`), que es el estado del
 * cerrojo: la sala de espera no la puede abrir nadie y la alternativa es un
 * grupo cerrado con la llave dentro. El correo, en cambio, vale siempre… si
 * Apple lo entrega: con «Ocultar mi correo» llega una dirección de relé y esta
 * llave es la única que queda.
 */
export function esNombreDelAdministrador(nombre) {
  return normalizarNombre(nombre) === normalizarNombre(ADMINISTRADOR.nombre);
}
