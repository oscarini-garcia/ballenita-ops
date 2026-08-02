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
 *   POST /api/cuentas   · enlazar con persona, eliminar, activar y renombrar (administradores)
 *   POST /api/cuenta/baja · eliminar la cuenta propia (directriz 5.1.1(v) de Apple)
 *   POST /api/push      · apunta el token de APNs de este aparato, o lo silencia
 *   POST /api/push/prueba · se manda un aviso a sí mismo, y cuenta qué pasó
 *   GET  /api/ia        · qué clave y qué modelo hay puestos (administradores)
 *   POST /api/ia        · los cambia (administradores)
 *   POST /api/importar  · siembra la base desde un volcado de JSONBin (servicio)
 */

import { verificarTokenDeApple } from './apple.js';
import { enviarAviso, hayApnsConfigurado } from './apns.js';
import { coincideEnTiempoConstante, emitirSesion, verificarSesion } from './sesion.js';
import { hayRevocacionConfigurada, revocarEnApple } from './revocacion.js';
import {
  administradoresRestantes, anotarAcceso, anotarDispositivo, aplicarCambio, crearCuenta,
  cuentaPorApple, cuentaPorId, darDeBajaCuenta, eliminarCuenta, enlazarCuentaConPersona,
  hayAlgunaCuenta, importarInstantanea, leerInstantanea, listarCuentas,
  configuracionIAPublica, guardarConfiguracionIA, leerConfiguracionIA,
  guardarTokenPush, olvidarTokenPush, silenciarDispositivo, tokensDeAdministradores,
  tokensDeCuenta,
} from './repositorio.js';

import { materialDelViaje, pedirPropuestas } from './sugerencias.js';
import { conModeloVigente, listarModelos, masCercano, probar } from './ia.js';

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
      // Sala de espera: en vez de un 403 seco con un código que había que
      // copiar y pasarle a alguien, la solicitud **se apunta sola** con el
      // nombre que entrega Apple, y quien administra la ve en Ajustes →
      // Cuentas y la enlaza con una persona. Nace inactiva: enlazar es dar
      // acceso, y hasta entonces no entra.
      const espera = await crearCuenta(env.DB, {
        id: idDeCuenta(), appleSub: sub, nombre, email, rol: 'miembro', activa: 0,
      });
      // A quien administra le llega al teléfono. Si falla, la solicitud queda
      // apuntada igual: el aviso es el recado, no el hecho.
      await avisarDeSolicitud(env, espera.nombre).catch(() => {});
      return json(
        {
          error: 'en_espera',
          mensaje: 'Hemos apuntado tu petición. Quien lleva el grupo tiene que decir quién eres para dejarte entrar.',
          identificador: sub,
          nombre: espera.nombre,
        },
        403,
      );
    }
    cuenta = await crearCuenta(env.DB, { id: idDeCuenta(), appleSub: sub, nombre, email });
  }

  if (!cuenta.activa) {
    // Dos causas, y no dan el mismo mensaje: sin persona enlazada todavía se
    // está esperando; con ella, alguien ha cerrado la puerta a propósito.
    if (!cuenta.personId) {
      return json(
        {
          error: 'en_espera',
          mensaje: 'Tu petición sigue esperando a que quien lleva el grupo diga quién eres.',
          identificador: sub,
          nombre: cuenta.nombre,
        },
        403,
      );
    }
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

  const { accion, identificador, nombre = '', id, rol, personId } = await peticion.json();

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

  if (accion === 'enlazar') {
    // Enlazar con una persona es lo que abre la puerta; con `personId` vacío se
    // deshace el enlace y la cuenta vuelve a la sala de espera.
    if (!id) return json({ error: 'falta el id de la cuenta' }, 400);
    await enlazarCuentaConPersona(env.DB, id, personId || null);
    return json({ ok: true });
  }

  if (accion === 'eliminar') {
    if (!id) return json({ error: 'falta el id de la cuenta' }, 400);
    if (id === cuenta.id) return json({ error: 'no puedes eliminarte a ti mismo desde aquí' }, 400);
    await eliminarCuenta(env.DB, id);
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
 * El aparato dice por dónde se le avisa.
 *
 * Se llama al abrir la app, siempre: el token de APNs **cambia** —al
 * reinstalar, al restaurar una copia— y un token viejo es un aviso que no
 * llega. Con `avisos: false` se silencia sin borrar nada, que es lo que hay que
 * hacer cuando el permiso se retira desde los ajustes de iOS.
 */
async function registroDePush(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);
  const { token = null, avisos = true } = await peticion.json().catch(() => ({}));
  const dispositivoId = peticion.headers.get('X-Dispositivo') || `${cuenta.id}:desconocido`;

  await guardarTokenPush(env.DB, {
    dispositivoId,
    cuentaId: cuenta.id,
    plataforma: peticion.headers.get('X-Plataforma') || 'ios',
    tokenPush: token,
  });
  if (avisos === false) await silenciarDispositivo(env.DB, dispositivoId, false);

  return json({ ok: true, empuja: hayApnsConfigurado(env) });
}

/**
 * Un aviso de prueba, a los aparatos de quien lo pide y a nadie más.
 *
 * Existe porque la cadena tiene seis eslabones —permiso en el móvil, token de
 * APNs, token guardado aquí, claves del Worker, entorno correcto, y Apple— y
 * hasta ahora la única manera de probarla era que **otra persona** entrara con
 * Apple. Con esto se prueba solo.
 *
 * **Devuelve lo que dijo Apple, motivo incluido.** Un «no se pudo» a secas
 * obligaría a venir a preguntarme; con `BadDeviceToken` o `sin-configurar`
 * delante, se sabe cuál de los seis eslabones falta (SPECS §14.9-bis).
 */
async function pruebaDePush(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);
  if (!hayApnsConfigurado(env)) {
    return json({ enviados: 0, motivo: 'El Worker no tiene las claves de APNs puestas.' });
  }

  const tokens = await tokensDeCuenta(env.DB, cuenta.id);
  if (tokens.length === 0) {
    // Sin «vuelve a encender los avisos»: la pantalla ya lo intenta sola antes
    // de llamar aquí (`lib/push.js`), así que si se llega a esta línea es que el
    // identificador no llegó a guardarse, y mandar a pulsar un botón que no está
    // —«Encender» se esconde con el permiso ya dado— era un callejón sin salida.
    return json({ enviados: 0, motivo: 'Este móvil no tiene ningún identificador guardado aquí, ni ha conseguido apuntarlo ahora.' });
  }

  const resultados = [];
  for (const token of tokens) {
    const r = await enviarAviso(env, token, {
      titulo: 'Funciona 🐳',
      cuerpo: 'Si ves esto, los avisos llegan a este móvil.',
      agrupa: 'prueba',
      datos: { ir: 'ajustes/notificaciones' },
    });
    if (r.caducado) await olvidarTokenPush(env.DB, token);
    resultados.push(r);
  }

  const enviados = resultados.filter((r) => r.ok).length;
  return json({
    enviados,
    de: tokens.length,
    motivo: enviados > 0 ? null : (resultados.find((r) => !r.ok)?.motivo ?? 'Apple no lo aceptó.'),
  });
}

/**
 * Avisa a quien administra de que alguien acaba de pedir entrar.
 *
 * Es el primer aviso remoto de la app y el que justifica todo el cable: quien
 * pide acceso se queda mirando una pantalla que dice «ya estás en la lista», y
 * hasta que alguien no abra Ajustes por su cuenta, ahí sigue. No lanza y no se
 * espera: un aviso que no sale **no puede tumbar el alta que lo provocó**.
 */
async function avisarDeSolicitud(env, nombre) {
  if (!hayApnsConfigurado(env)) return;
  const tokens = await tokensDeAdministradores(env.DB);
  for (const token of tokens) {
    const resultado = await enviarAviso(env, token, {
      titulo: 'Alguien quiere entrar 🔑',
      cuerpo: `${nombre || 'Alguien'} ha entrado con Apple y todavía no es nadie del grupo.`,
      categoria: 'solicitud',
      agrupa: 'solicitudes',
      urgente: false,
      datos: { ir: 'ajustes/cuentas' },
    });
    if (resultado.caducado) await olvidarTokenPush(env.DB, token);
  }
}

/**
 * La clave de la IA y el modelo, para quien administra.
 *
 * La clave entra pero no sale: se responde siempre con la versión pública
 * —cuatro últimos caracteres y fecha—, así que ni siquiera quien la puso puede
 * volver a leerla desde la app. Cambiarla es escribir una nueva.
 */
/**
 * Cinco planes propuestos para un viaje (SPECS §14.19).
 *
 * Del cliente llega el evento y lo ya propuesto en esta misma tanda; **el
 * material lo compone el Worker** con lo que hay en la base, así que desde un
 * teléfono no se le puede meter texto al modelo. Y no viajan los nombres: al
 * modelo le llega cuánta gente y de qué edades, no quiénes.
 */
/**
 * Los modelos que la clave guardada puede usar (SPECS §14.16-bis).
 *
 * La pregunta la hace el Worker y no el móvil porque la clave no sale de aquí.
 *
 * **Si el modelo apuntado ya no está en la lista, se cambia aquí mismo por el
 * más cercano y se guarda.** Enseñarlo en la pantalla sin guardarlo dejaría lo
 * que se ve y lo que hay diciendo cosas distintas hasta que alguien pulsara
 * Guardar, y quien abre esta pantalla no tiene por qué saber que hacía falta.
 */
async function modelosDeIA(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);
  if (cuenta.rol !== 'administrador') return json({ error: 'reservado a administradores' }, 403);

  const { clave, modelo } = await leerConfiguracionIA(env.DB);
  if (!clave) return json({ error: 'no hay clave de IA configurada' }, 409);

  try {
    const modelos = await listarModelos({ clave });
    const nuevo = masCercano(modelo, modelos);
    if (nuevo) await guardarConfiguracionIA(env.DB, { modelo: nuevo.id });
    return json({
      modelos,
      modelo: nuevo ? nuevo.id : modelo,
      sustituto: nuevo ? { antes: modelo, ahora: nuevo.id } : null,
    });
  } catch (e) {
    return json({ error: String(e.message ?? e) }, e.estado || 502);
  }
}

/**
 * Probar la clave y el modelo con una llamada de verdad y un token de respuesta.
 *
 * Se prueba el par entero: una clave buena con un modelo retirado falla igual, y
 * eso antes no se veía hasta que alguien pulsaba «¿Qué podríamos hacer?» meses
 * después. Y si el modelo ya no existe no se contesta «no funciona»: se cambia
 * por el más cercano y se prueba ese, que es lo que iba a hacer quien lo leyera.
 */
async function probarIA(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);
  if (cuenta.rol !== 'administrador') return json({ error: 'reservado a administradores' }, 403);

  const { clave, modelo } = await leerConfiguracionIA(env.DB);
  if (!clave) return json({ error: 'no hay clave de IA configurada' }, 409);

  try {
    const { resultado, cambiado } = await conModeloVigente({
      clave,
      modelo,
      hacer: (m) => probar({ clave, modelo: m }),
      guardar: (m) => guardarConfiguracionIA(env.DB, { modelo: m }),
    });
    return json({ ...resultado, cambiado: cambiado || null });
  } catch (e) {
    return json({ error: String(e.message ?? e) }, e.estado || 502);
  }
}

async function sugerirPlanes(peticion, env) {
  await cuentaAutenticada(peticion, env);

  const { eventId, descartadas = [] } = await peticion.json();
  if (!eventId) return json({ error: 'falta el evento' }, 400);

  const { clave, modelo } = await leerConfiguracionIA(env.DB);
  // Sin clave no se falla a mitad: se dice que no está puesta, y la app esconde
  // el botón en vez de ofrecer algo que no puede hacer.
  if (!clave) return json({ error: 'no hay clave de IA configurada' }, 409);

  const evento = await env.DB.prepare('SELECT * FROM events WHERE id = ? AND borrado = 0').bind(eventId).first();
  if (!evento) return json({ error: 'ese evento no existe' }, 404);

  const { results: personas } = await env.DB
    .prepare('SELECT edad FROM persons WHERE eventId = ? AND borrado = 0').bind(eventId).all();
  const { results: planes } = await env.DB
    .prepare('SELECT titulo FROM plans WHERE eventId = ? AND borrado = 0').bind(eventId).all();
  const { results: ideas } = await env.DB
    .prepare('SELECT titulo FROM planIdeas WHERE borrado = 0 AND (eventId IS NULL OR eventId = ?)').bind(eventId).all();

  const yaHay = [
    ...(planes || []).map((p) => p.titulo),
    ...(ideas || []).map((i) => i.titulo),
    ...descartadas,
  ].filter(Boolean);

  const material = materialDelViaje({ evento, personas: personas || [], yaHay });

  try {
    // Si el modelo apuntado ya no existe, se propone con el más cercano en vez
    // de no proponer nada: aquí hay alguien esperando cinco ideas, y «ese modelo
    // no existe» no es algo que pueda arreglar quien pulsó el botón.
    const { resultado, cambiado } = await conModeloVigente({
      clave,
      modelo,
      hacer: (m) => pedirPropuestas({ clave, modelo: m, material }),
      guardar: (m) => guardarConfiguracionIA(env.DB, { modelo: m }),
    });
    return json({ propuestas: resultado, cambiado: cambiado || null });
  } catch (e) {
    return json({ error: String(e.message ?? e) }, 502);
  }
}

async function configuracionIA(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);
  if (cuenta.rol !== 'administrador') return json({ error: 'reservado a administradores' }, 403);

  if (peticion.method === 'POST') {
    const { clave, modelo } = await peticion.json();
    await guardarConfiguracionIA(env.DB, { clave, modelo });
  }

  return json({ ia: configuracionIAPublica(await leerConfiguracionIA(env.DB)) });
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
  ['POST', '/api/push', registroDePush],
  ['POST', '/api/push/prueba', pruebaDePush],
  ['GET', '/api/ia', configuracionIA],
  ['POST', '/api/ia', configuracionIA],
  ['GET', '/api/ia/modelos', modelosDeIA],
  ['POST', '/api/ia/probar', probarIA],
  ['POST', '/api/plan/sugerir', sugerirPlanes],
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
