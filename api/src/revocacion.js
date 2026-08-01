/**
 * Revocación del token de Sign in with Apple al darse de baja.
 *
 * Apple no se conforma con que la aplicación olvide a quien se va: exige que se
 * le diga **a Apple** que ese vínculo se ha roto, llamando al endpoint de
 * revocación de su API REST. Es la mitad invisible de la directriz 5.1.1(v) —la
 * que hace que Ballena Ops desaparezca de «Apps que usan tu Apple ID»— y el
 * único punto de todo el sistema que necesita una clave privada.
 *
 * De ahí dos decisiones que no son las evidentes:
 *
 * **El código de autorización se pide en el momento de la baja, no al entrar.**
 * Para revocar hace falta un `refresh_token`, y para obtenerlo hay que canjear
 * un código de autorización de Apple. Lo natural sería canjearlo al abrir sesión
 * y guardarlo; sería también meter una llamada de red más —y un fallo más— en el
 * camino por el que entra todo el mundo todos los días, y guardar en la base un
 * secreto de larga vida por cada persona. Como darse de baja es raro y volver a
 * identificarse antes de algo irreversible es sano, el código se pide allí: el
 * acceso no se toca y no se almacena nada.
 *
 * **Si no hay clave configurada, la baja sigue adelante.** Lo que no se puede
 * incumplir es que eliminar la cuenta sea siempre posible. Que la revocación se
 * haya cursado o no se informa en la respuesta y queda en el log del Worker,
 * pero nunca bloquea la baja.
 *
 * Portado de `garciadoral-ops`, donde ya está en producción. Aquí se simplifica
 * en un punto: no hay acceso con Apple en la web, así que el único cliente
 * posible ante Apple es el identificador del paquete de la app de iOS y no hay
 * URL de retorno que repetir.
 */

import { base64urlADatos } from './apple.js';

const APPLE = 'https://appleid.apple.com';
const VIGENCIA_SECRETO = 300; // Apple admite hasta seis meses; cinco minutos sobran

function datosABase64url(datos) {
  let binario = '';
  for (const octeto of new Uint8Array(datos)) binario += String.fromCharCode(octeto);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function textoABase64url(texto) {
  return datosABase64url(new TextEncoder().encode(texto));
}

/** ¿Están puestos los tres valores que hacen falta para revocar? */
export function hayRevocacionConfigurada(env) {
  return Boolean(env?.APPLE_CLAVE_P8 && env?.APPLE_CLAVE_ID && env?.APPLE_EQUIPO);
}

/**
 * Importa la clave `.p8` que descarga Apple, que viene en PEM PKCS#8.
 *
 * El secreto se registra con `wrangler secret put` y llega con los saltos de
 * línea tal cual o escapados como `\n`, según cómo se haya pegado. Se admiten
 * las dos formas porque la diferencia no se ve al pegarla y el error que produce
 * —una clave que no importa— no se parece en nada a su causa.
 */
function importarClave(pem) {
  const cuerpo = String(pem)
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');

  return crypto.subtle.importKey(
    'pkcs8',
    base64urlADatos(cuerpo),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/**
 * El `client_secret` que Apple pide en sus dos endpoints: un JWT ES256 firmado
 * con la clave del equipo. Lo emite quien va a usarlo, en el momento, y caduca
 * en cinco minutos: no hay ningún secreto de larga vida que rotar.
 */
export async function secretoDeCliente(env, clienteId, ahora = Math.floor(Date.now() / 1000)) {
  const cabecera = textoABase64url(JSON.stringify({ alg: 'ES256', kid: env.APPLE_CLAVE_ID }));
  const cuerpo = textoABase64url(JSON.stringify({
    iss: env.APPLE_EQUIPO,
    iat: ahora,
    exp: ahora + VIGENCIA_SECRETO,
    aud: APPLE,
    sub: clienteId,
  }));

  const firma = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await importarClave(env.APPLE_CLAVE_P8),
    new TextEncoder().encode(`${cabecera}.${cuerpo}`),
  );

  // WebCrypto entrega la firma como r‖s en crudo, que es exactamente lo que
  // espera JOSE para ES256. No hay que envolverla en DER.
  return `${cabecera}.${cuerpo}.${datosABase64url(firma)}`;
}

async function formulario(url, campos) {
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(campos).toString(),
  });
  return { ok: respuesta.ok, estado: respuesta.status, texto: await respuesta.text() };
}

/**
 * Canjea el código de autorización y revoca el token resultante.
 *
 * Devuelve `{ revocado, motivo }` y **no lanza nunca**: quien llama está en
 * mitad de una baja de cuenta y un fallo aquí no puede impedirla. Los motivos
 * son cadenas cortas pensadas para el log, no para enseñárselas a nadie.
 */
export async function revocarEnApple(env, { codigo }) {
  if (!codigo) return { revocado: false, motivo: 'sin_codigo' };
  if (!hayRevocacionConfigurada(env)) return { revocado: false, motivo: 'sin_clave' };

  const clienteId = env.APPLE_AUD_IOS;
  if (!clienteId) return { revocado: false, motivo: 'sin_cliente' };

  try {
    const secreto = await secretoDeCliente(env, clienteId);

    const canje = await formulario(`${APPLE}/auth/token`, {
      client_id: clienteId,
      client_secret: secreto,
      code: codigo,
      grant_type: 'authorization_code',
    });

    if (!canje.ok) return { revocado: false, motivo: `canje_${canje.estado}`, detalle: canje.texto };

    const { refresh_token: refresco, access_token: acceso } = JSON.parse(canje.texto);
    const token = refresco || acceso;
    if (!token) return { revocado: false, motivo: 'canje_sin_token' };

    const baja = await formulario(`${APPLE}/auth/revoke`, {
      client_id: clienteId,
      client_secret: secreto,
      token,
      token_type_hint: refresco ? 'refresh_token' : 'access_token',
    });

    return baja.ok
      ? { revocado: true }
      : { revocado: false, motivo: `revoke_${baja.estado}`, detalle: baja.texto };
  } catch (error) {
    return { revocado: false, motivo: 'error', detalle: String(error.message || error) };
  }
}
