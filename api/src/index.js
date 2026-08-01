/**
 * API de Ballena Ops sobre Cloudflare Workers y D1. 🐳
 *
 * Sustituye al documento compartido de JSONBin. El cambio de fondo no es el
 * transporte, sino quién manda: antes cada móvil fusionaba el documento entero
 * por última escritura y lo devolvía; ahora sube una cola de cambios y recibe
 * la instantánea que resulta de aplicarla. El servidor es la autoridad.
 *
 * Lo que se gana, por orden de importancia:
 *   1. La credencial deja de viajar en el bundle. Con JSONBin, la clave maestra
 *      se horneaba en el JavaScript de una web pública.
 *   2. Los conflictos se resuelven campo a campo y no fila a fila.
 *   3. Hay copias, migraciones y consultas de verdad.
 *
 * Rutas:
 *   GET  /api/salud     · comprobación sin autenticar
 *   POST /api/sesion    · canjea un token de Apple por una sesión propia
 *   GET  /api/sync      · instantánea completa del grupo
 *   POST /api/cambios   · aplica la cola del dispositivo y devuelve la instantánea
 *   GET  /api/cuentas   · quién tiene acceso (administradores)
 *   POST /api/cuentas   · alta, alta por invitación y baja (administradores)
 *   POST /api/cuenta/baja · eliminar la cuenta propia (directriz 5.1.1(v) de Apple)
 *   POST /api/importar  · siembra la base desde un volcado de JSONBin (servicio)
 */

import { verificarTokenDeApple } from './apple.js';
import { coincideEnTiempoConstante, emitirSesion, verificarSesion } from './sesion.js';
import { hayRevocacionConfigurada, revocarEnApple } from './revocacion.js';
import {
  administradoresRestantes, anotarAcceso, anotarDispositivo, aplicarCambio, crearCuenta,
  cuentaPorApple, cuentaPorId, darDeBajaCuenta, hayAlgunaCuenta, importarInstantanea,
  leerInstantanea, listarCuentas,
} from './repositorio.js';

const TIPO_JSON = { 'content-type': 'application/json; charset=utf-8' };

function json(cuerpo, estado = 200, cabeceras = {}) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...TIPO_JSON, ...cabeceras } });
}

/**
 * Solo se emiten cabeceras CORS para los orígenes declarados. Sin coincidencia
 * no hay cabecera, y una web ajena no puede hablar con esta API desde el
 * navegador de nadie.
 */
function cabecerasCors(env, peticion) {
  const permitidos = (env.ORIGENES_PERMITIDOS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const origen = peticion.headers.get('Origin');
  if (!origen || !permitidos.includes(origen)) return {};
  return {
    'Access-Control-Allow-Origin': origen,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Dispositivo, X-Plataforma',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function credencial(peticion) {
  const cabecera = peticion.headers.get('Authorization') || '';
  return cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
}

async function cuentaAutenticada(peticion, env) {
  const sesion = await verificarSesion(env.SESION_SECRETO, credencial(peticion));
  const cuenta = await cuentaPorId(env.DB, sesion.sub);
  if (!cuenta || !cuenta.activa) throw new Error('la sesión ya no corresponde a una cuenta activa');
  return cuenta;
}

function idDeCuenta() {
  return `cta_${crypto.randomUUID()}`;
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

/**
 * Canje del token de Apple por una sesión propia.
 *
 * La primera cuenta de una instalación nueva entra sola y nace administradora;
 * a partir de ahí, un identificador desconocido recibe un 403 con su propio
 * identificador, para que un administrador lo dé de alta desde la app. Es el
 * modelo de garciadoral: la incorporación es por invitación, no por registro
 * abierto, que en un grupo cerrado es justo lo que se quiere.
 */
async function abrirSesion(peticion, env) {
  const { id_token: idToken, plataforma = 'ios', nombre = '' } = await peticion.json();

  // Hoy solo entra la app de iOS, así que `APPLE_AUD_WEB` no está declarada y
  // se descarta sola. Se sigue admitiendo en la lista para que recuperar el
  // acceso web sea declarar una variable, no tocar código.
  const { sub, email } = await verificarTokenDeApple(idToken, [env.APPLE_AUD_IOS, env.APPLE_AUD_WEB]);

  let cuenta = await cuentaPorApple(env.DB, sub);

  // Una invitación es una cuenta que ya existe pero todavía espera a que su
  // dueño entre por primera vez. Al hacerlo, se le pone su identificador real.
  if (!cuenta) {
    const invitada = await cuentaPorApple(env.DB, `invitacion:${sub}`);
    if (invitada) {
      await env.DB.prepare('UPDATE cuenta SET appleSub = ?, email = COALESCE(email, ?) WHERE id = ?')
        .bind(sub, email, invitada.id)
        .run();
      cuenta = { ...invitada, appleSub: sub };
    }
  }

  if (!cuenta) {
    if (await hayAlgunaCuenta(env.DB)) {
      return json(
        {
          error: 'sin_vincular',
          mensaje: 'Este identificador de Apple todavía no tiene acceso al grupo. Pídele a alguien del grupo que te dé de alta con este código.',
          identificador: sub,
        },
        403,
      );
    }
    cuenta = await crearCuenta(env.DB, { id: idDeCuenta(), appleSub: sub, nombre, email });
  }

  if (!cuenta.activa) {
    return json({ error: 'cuenta_desactivada', mensaje: 'Tu acceso al grupo está desactivado.' }, 403);
  }

  await anotarAcceso(env.DB, cuenta.id);
  const token = await emitirSesion(env.SESION_SECRETO, cuenta, plataforma);

  return json({
    token,
    cuenta: { id: cuenta.id, nombre: cuenta.nombre, rol: cuenta.rol },
  });
}

async function sincronizar(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);

  await anotarDispositivo(env.DB, {
    id: peticion.headers.get('X-Dispositivo') || `${cuenta.id}:desconocido`,
    cuentaId: cuenta.id,
    plataforma: peticion.headers.get('X-Plataforma') || 'web',
  });

  return json(await leerInstantanea(env.DB));
}

async function recibirCambios(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);
  const { cambios = [] } = await peticion.json();

  const resultados = [];
  for (const cambio of cambios) {
    try {
      const resultado = await aplicarCambio(env.DB, cambio);
      resultados.push({ tabla: cambio.tabla, id: cambio.id, ...resultado });
    } catch (error) {
      resultados.push({
        tabla: cambio?.tabla,
        id: cambio?.id,
        aplicado: false,
        motivo: String(error.message || error),
      });
    }
  }

  await anotarDispositivo(env.DB, {
    id: peticion.headers.get('X-Dispositivo') || `${cuenta.id}:desconocido`,
    cuentaId: cuenta.id,
    plataforma: peticion.headers.get('X-Plataforma') || 'web',
  });

  return json({ resultados, instantanea: await leerInstantanea(env.DB) });
}

async function cuentas(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);
  if (cuenta.rol !== 'administrador') return json({ error: 'reservado a administradores' }, 403);

  if (peticion.method === 'GET') return json({ cuentas: await listarCuentas(env.DB) });

  const { accion, identificador, nombre = '', id, rol } = await peticion.json();

  if (accion === 'invitar') {
    // Se guarda el identificador que Apple mostró al aspirante, prefijado, para
    // reconocerlo en cuanto vuelva a entrar. Hasta entonces no es una cuenta
    // con la que se pueda hacer nada.
    if (!identificador) return json({ error: 'falta el identificador' }, 400);
    await crearCuenta(env.DB, {
      id: idDeCuenta(),
      appleSub: `invitacion:${identificador}`,
      nombre,
      rol: rol || 'miembro',
    });
    return json({ ok: true });
  }

  if (accion === 'renombrar') {
    // El nombre es solo la etiqueta con la que el grupo se reconoce en la
    // lista. Apple entrega el suyo únicamente en la primera autorización, así
    // que sin esto una cuenta sin nombre se quedaría sin nombre para siempre.
    if (!id) return json({ error: 'falta el id de la cuenta' }, 400);
    await env.DB.prepare('UPDATE cuenta SET nombre = ? WHERE id = ?').bind(String(nombre ?? '').trim(), id).run();
    return json({ ok: true });
  }

  if (accion === 'activar' || accion === 'desactivar') {
    if (!id) return json({ error: 'falta el id de la cuenta' }, 400);
    if (accion === 'desactivar' && id === cuenta.id) {
      return json({ error: 'no puedes desactivarte a ti mismo' }, 400);
    }
    await env.DB.prepare('UPDATE cuenta SET activa = ? WHERE id = ?')
      .bind(accion === 'activar' ? 1 : 0, id)
      .run();
    return json({ ok: true });
  }

  return json({ error: `acción desconocida: ${accion}` }, 400);
}

/**
 * Baja de la cuenta, a petición de su titular.
 *
 * La directriz 5.1.1(v) de la App Store exige que quien puede crear una cuenta
 * pueda eliminarla **desde dentro de la aplicación**, sin escribir a nadie ni
 * pasar por una web. Aquí la cuenta es el vínculo entre un identificador de
 * Apple y el acceso al grupo, y eliminarla es deshacer ese vínculo:
 * `darDeBajaCuenta` explica qué se va y qué se queda.
 *
 * El orden importa. Primero se avisa a Apple, mientras todavía se sabe de quién
 * hablamos, y después se deshace el vínculo; al revés, un fallo a mitad dejaría
 * una autorización viva ante Apple sin nada aquí que la identifique. Que la
 * revocación falle, en cambio, no detiene nada: lo que no puede ocurrir es que
 * alguien se quede sin poder darse de baja porque un servidor ajeno no
 * respondió.
 */
async function darDeBaja(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);
  const { codigo_apple: codigo } = await peticion.json().catch(() => ({}));

  const revocacion = await revocarEnApple(env, { codigo });
  if (!revocacion.revocado) {
    console.warn(`baja de ${cuenta.id}: no se revocó en Apple (${revocacion.motivo})`, revocacion.detalle || '');
  }

  const restantes = await administradoresRestantes(env.DB, cuenta.id);
  if (cuenta.rol === 'administrador' && restantes === 0) {
    console.warn(`baja de ${cuenta.id}: era la última cuenta administradora del grupo`);
  }

  await darDeBajaCuenta(env.DB, cuenta.id);

  return json({
    baja: true,
    revocado_en_apple: revocacion.revocado,
    motivo_revocacion: revocacion.revocado ? null : revocacion.motivo,
    revocacion_configurada: hayRevocacionConfigurada(env),
    administradores_restantes: restantes,
  });
}

/**
 * Siembra de la base a partir de un volcado del documento de JSONBin, para no
 * empezar de cero con los eventos que el grupo ya tiene. Va con el token de
 * servicio y no con una sesión: se lanza desde un portátil, una sola vez.
 */
async function importar(peticion, env) {
  if (!env.TOKEN_SERVICIO || !coincideEnTiempoConstante(credencial(peticion), env.TOKEN_SERVICIO)) {
    return json({ error: 'no autorizado' }, 401);
  }
  const instantanea = await peticion.json();
  return json({ ok: true, importado: await importarInstantanea(env.DB, instantanea) });
}

// ---------------------------------------------------------------------------

const RUTAS = [
  ['GET', '/api/salud', async () => json({ estado: 'ok', ahora: new Date().toISOString() })],
  ['POST', '/api/sesion', abrirSesion],
  ['GET', '/api/sync', sincronizar],
  ['POST', '/api/cambios', recibirCambios],
  ['GET', '/api/cuentas', cuentas],
  ['POST', '/api/cuentas', cuentas],
  ['POST', '/api/cuenta/baja', darDeBaja],
  ['POST', '/api/importar', importar],
];

export default {
  async fetch(peticion, env) {
    const cors = cabecerasCors(env, peticion);

    if (peticion.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(peticion.url);
    const ruta = RUTAS.find(([metodo, camino]) => metodo === peticion.method && camino === url.pathname);
    if (!ruta) return json({ error: 'no encontrado' }, 404, cors);

    try {
      const respuesta = await ruta[2](peticion, env);
      for (const [clave, valor] of Object.entries(cors)) respuesta.headers.set(clave, valor);
      return respuesta;
    } catch (error) {
      const mensaje = String(error.message || error);
      const autenticacion = /sesión|token|firma/i.test(mensaje);
      return json({ error: mensaje }, autenticacion ? 401 : 500, cors);
    }
  },
};
