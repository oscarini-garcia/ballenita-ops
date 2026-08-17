/**
 * Sesión propia: un JWT HS256 corto que el dispositivo presenta en cada
 * petición.
 *
 * El token de Apple se verifica una sola vez, al entrar; a partir de ahí el
 * móvil lleva este otro, que solo este Worker sabe firmar. Guarda el
 * identificador de la cuenta, no el de Apple.
 *
 * Portado de `garciadoral-ops`.
 */

const VIGENCIA = 60 * 60 * 24 * 90; // noventa días: un grupo de amigos no entra a diario

function datosABase64url(datos) {
  let binario = '';
  for (const octeto of new Uint8Array(datos)) binario += String.fromCharCode(octeto);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function textoABase64url(texto) {
  return datosABase64url(new TextEncoder().encode(texto));
}

function base64urlATexto(texto) {
  const relleno = '='.repeat((4 - (texto.length % 4)) % 4);
  return atob((texto + relleno).replace(/-/g, '+').replace(/_/g, '/'));
}

async function clave(secreto) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function emitirSesion(secreto, cuenta, plataforma) {
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = textoABase64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const cuerpo = textoABase64url(
    JSON.stringify({
      sub: cuenta.id,
      rol: cuenta.rol,
      plataforma,
      iat: ahora,
      exp: ahora + VIGENCIA,
    }),
  );
  const firma = await crypto.subtle.sign(
    'HMAC',
    await clave(secreto),
    new TextEncoder().encode(`${cabecera}.${cuerpo}`),
  );
  return `${cabecera}.${cuerpo}.${datosABase64url(firma)}`;
}

/**
 * El pase de la sala de espera: con qué vuelve a preguntar «¿ya me han dejado
 * entrar?» quien está apuntado y todavía no tiene sesión.
 *
 * Existe porque sin él la única forma de preguntarlo es **volver a pasar por la
 * hoja de Apple**, y eso no se puede hacer solo cada veinte segundos: saca una
 * hoja del sistema por encima de la app. Con el pase, la pregunta es una
 * petición normal contra este Worker y la app puede entrar sola en cuanto la
 * enlacen, que es lo que de verdad cierra la sala de espera.
 *
 * Va firmado con el mismo secreto que la sesión, así que no se puede fabricar.
 * Lleva **solo** el identificador de la cuenta, y `tipo` lo separa de una
 * sesión: sin esa marca, un pase valdría como sesión —y un pase se emite
 * precisamente a quien **todavía no** tiene acceso, que es justo al revés.
 *
 * Dura menos que una sesión a propósito. Noventa días es lo que dura entrar; la
 * sala de espera se resuelve el mismo día o no se resuelve, y un pase olvidado
 * en un móvil que nunca llegó a entrar no tiene por qué seguir sirviendo un
 * trimestre después.
 */
const VIGENCIA_PASE = 60 * 60 * 24 * 30;

export async function emitirPaseDeEspera(secreto, cuentaId) {
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = textoABase64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const cuerpo = textoABase64url(
    JSON.stringify({ tipo: 'espera', sub: cuentaId, iat: ahora, exp: ahora + VIGENCIA_PASE }),
  );
  const firma = await crypto.subtle.sign(
    'HMAC',
    await clave(secreto),
    new TextEncoder().encode(`${cabecera}.${cuerpo}`),
  );
  return `${cabecera}.${cuerpo}.${datosABase64url(firma)}`;
}

/**
 * Devuelve el identificador de cuenta que lleva el pase, o lanza.
 *
 * Exige `tipo: 'espera'`, y `verificarSesion` exige lo contrario. Las dos
 * comprobaciones son la misma decisión mirada desde sus dos lados: los dos
 * papeles se firman con el mismo secreto, así que sin ellas cada uno valdría
 * como el otro —y el pase se le entrega precisamente a quien **todavía no**
 * tiene acceso, que es justo al revés de lo que hace falta—.
 */
export async function verificarPaseDeEspera(secreto, pase) {
  const datos = await verificarFirmado(secreto, pase);
  if (datos.tipo !== 'espera') throw new Error('el pase de espera no es un pase');
  return datos.sub;
}

/**
 * El pase de enlace: con qué entra quien no tiene iPhone (SPECS §14.61).
 *
 * El acceso de esta app lo firma Apple, y eso deja fuera a quien no tiene un
 * iPhone donde sacar esa hoja — no por una decisión sobre quién entra, sino por
 * dónde vive el botón. Este pase es el otro camino: quien administra lo genera
 * para una persona del grupo y le manda el enlace, y abrirlo en cualquier
 * navegador canjea el pase por una sesión de las de siempre.
 *
 * Tres cosas lo separan del pase de espera, y las tres son porque **esto es una
 * credencial al portador**: quien tenga el enlace entra como esa persona.
 *
 *   1. **Dura tres días.** Los treinta del pase de espera valen para un papel
 *      que solo sirve para preguntar; este abre la puerta.
 *   2. **Se puede revocar**, y de eso no puede encargarse el papel —un JWT no
 *      sabe que alguien ha cambiado de idea—. Lleva un `jti` que se guarda en su
 *      cuenta (`cuenta.enlaceJti`), y generar otro lo sobrescribe: el anterior
 *      deja de valer en el acto, que es lo que hace de «generar» una forma de
 *      revocar.
 *   3. **Viaja en el fragmento** de la URL (`#pase=…`), no en la consulta. El
 *      fragmento no se manda al servidor, así que no acaba en los registros de
 *      nadie ni en la cabecera `Referer` de la primera página que se visite
 *      después.
 *
 * **Lo que ya no es: de un solo uso** (SPECS §14.61-bis). Se quemaba al
 * canjearlo, y lo que eso tiraba abajo no eran ataques sino usos normales —
 * abrirlo dos veces, mirarlo en el móvil y luego en el portátil, o que la vista
 * previa de WhatsApp lo estrene antes que su dueño—. El que se quedaba fuera era
 * quien no tiene iPhone, o sea justo aquel para quien existe esto. Contra el
 * reenvío siguen los otros dos cierres: caduca solo y se revoca a mano.
 *
 * Lo que **no** cambia es el cierre de siempre: `tipo` lo separa de una sesión y
 * `verificarSesion` rechaza cualquier papel que lo lleve.
 */
export const VIGENCIA_ENLACE = 60 * 60 * 24 * 3;

export async function emitirPaseDeEnlace(secreto, cuentaId, jti) {
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = textoABase64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const cuerpo = textoABase64url(
    JSON.stringify({
      tipo: 'enlace', sub: cuentaId, jti, iat: ahora, exp: ahora + VIGENCIA_ENLACE,
    }),
  );
  const firma = await crypto.subtle.sign(
    'HMAC',
    await clave(secreto),
    new TextEncoder().encode(`${cabecera}.${cuerpo}`),
  );
  return `${cabecera}.${cuerpo}.${datosABase64url(firma)}`;
}

/** `{ cuentaId, jti }` del pase de enlace, o lanza. El `jti` lo compara quien
 *  canjea contra el que guarda la cuenta: la firma dice que el papel es bueno,
 *  no que siga sin usarse. */
export async function verificarPaseDeEnlace(secreto, pase) {
  const datos = await verificarFirmado(secreto, pase);
  if (datos.tipo !== 'enlace') throw new Error('el pase de enlace no es un pase de enlace');
  return { cuentaId: datos.sub, jti: datos.jti };
}

/**
 * Firma y vigencia, sin mirar para qué sirve el papel. Lo comparten la sesión y
 * el pase de espera, que es lo único que tienen en común.
 */
async function verificarFirmado(secreto, token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) throw new Error('sesión mal formada');

  const [cabecera, cuerpo, firma] = partes;
  const esperada = await crypto.subtle.sign(
    'HMAC',
    await clave(secreto),
    new TextEncoder().encode(`${cabecera}.${cuerpo}`),
  );
  if (datosABase64url(esperada) !== firma) throw new Error('firma de sesión inválida');

  const datos = JSON.parse(base64urlATexto(cuerpo));
  if (typeof datos.exp !== 'number' || datos.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('sesión caducada');
  }
  return datos;
}

/** Devuelve el cuerpo del token si la firma y la vigencia son correctas. */
export async function verificarSesion(secreto, token) {
  const datos = await verificarFirmado(secreto, token);
  // Un pase de espera **no** es una sesión. Ver `verificarPaseDeEspera`.
  if (datos.tipo) throw new Error('esa credencial no es una sesión');
  return datos;
}

/**
 * Comparación en tiempo constante para los secretos de servicio. Una
 * comparación normal filtra el secreto carácter a carácter.
 */
export function coincideEnTiempoConstante(a, b) {
  const A = new TextEncoder().encode(String(a || ''));
  const B = new TextEncoder().encode(String(b || ''));
  if (A.length !== B.length) return false;
  let diferencia = 0;
  for (let i = 0; i < A.length; i += 1) diferencia |= A[i] ^ B[i];
  return diferencia === 0;
}
