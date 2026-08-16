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
 *   POST /api/sesion/espera · «¿ya me han dejado entrar?», con el pase y sin Apple
 *   POST /api/sesion/enlace · canjea el pase de un enlace de acceso, para quien no tiene iPhone
 *   GET  /api/sync      · instantánea completa del grupo
 *   POST /api/cambios   · aplica la cola del dispositivo y devuelve la instantánea
 *   GET  /api/cuentas   · quién tiene acceso (administradores)
 *   POST /api/cuentas   · enlazar con persona, eliminar, activar, renombrar y generar enlace (administradores)
 *   POST /api/cuenta/baja · eliminar la cuenta propia (directriz 5.1.1(v) de Apple)
 *   POST /api/push      · apunta el token de APNs de este aparato, o lo silencia
 *   POST /api/push/prueba · se manda un aviso a sí mismo, y cuenta qué pasó
 *   GET  /api/avisos    · de qué quiere enterarse esta cuenta
 *   POST /api/avisos    · lo cambia
 *   GET  /api/ia        · qué clave y qué modelo hay puestos (administradores)
 *   POST /api/ia        · los cambia (administradores)
 *   POST /api/importar  · siembra la base desde un volcado de JSONBin (servicio)
 *   GET  /api/mejoras   · las mejoras pendientes, para quien hace el trabajo (servicio)
 *   GET  /api/migraciones  · qué migraciones conoce el código y cuáles le faltan a la base (administradores)
 *   POST /api/migraciones  · aplica la siguiente pendiente (administradores)
 *   POST /api/idea/mejorar · la misma idea, mejor contada por el modelo (IA)
 *   GET  /api/ia/modelos   · los modelos que ofrece Anthropic hoy (administradores)
 *   POST /api/ia/probar    · prueba el par clave+modelo con una llamada de verdad (administradores)
 *   POST /api/plan/sugerir · una tanda de ideas de plan (IA)
 *   POST /api/plato/cantidades · pone cantidades a los ingredientes de un plato (IA)
 *   POST /api/plato/arreglar   · ordena a saco una lista de ingredientes escrita a mano (IA)
 *   POST /api/plato/parecidos  · cinco platos enteros que se le parecen (IA)
 *   POST /api/recados      · una tanda de frases para el final de la lista (IA)
 *   POST /api/estados/sugerir · cinco estados para ponerse, del día que va el viaje (IA)
 *   POST /api/estados/gracia  · el estado que has escrito, con más gracia (IA)
 *   POST /api/bunga/resumen   · el bunga resumido en una frase, con guasa (IA)
 */

import { verificarTokenDeApple } from './apple.js';
import { enviarAviso, hayApnsConfigurado } from './apns.js';
import {
  CLASES_DE_AVISO, ES_CLASE, avisoDeComentario, avisoDeEstado, avisoDeGastoBorrado,
  avisoDeLiquidacion, avisosDeGasto, elGastoMueveElSaldo,
} from './avisos.js';
import {
  coincideEnTiempoConstante, emitirPaseDeEnlace, emitirPaseDeEspera, emitirSesion,
  verificarPaseDeEnlace, verificarPaseDeEspera, verificarSesion,
} from './sesion.js';
import { hayRevocacionConfigurada, revocarEnApple } from './revocacion.js';
import { esCorreoDelAdministrador, esNombreDelAdministrador } from './administrador.js';
import {
  administradoresRestantes, anotarAcceso, anotarDispositivo, aplicarCambio, crearCuenta,
  avisosDeCuenta, cuentaPorApple, cuentaPorId, cuentaPorPersona, darDeBajaCuenta, eliminarCuenta,
  enlazarCuentaConPersona, guardarAvisosDeCuenta, ponerJtiDeEnlace, tokensParaAviso,
  hayAdministradorActivo, hayAlgunaCuenta, importarInstantanea, leerInstantanea,
  leerMejorasPendientes, listarCuentas,
  configuracionIAPublica, guardarConfiguracionIA, leerConfiguracionIA,
  guardarTokenPush, olvidarTokenPush, promoverCuentaAAdministrador, silenciarDispositivo,
  tokensDeAdministradores, tokensDeCuenta, leerRecadosGuardados, guardarRecados,
} from './repositorio.js';

import { materialDelViaje, pedirPropuestas } from './sugerencias.js';
import {
  materialDelViaje as materialDeRecados, pedirRecados, sigueSirviendo,
} from './recados.js';
import { claveDeEncargo, claveDeModelo, esEncargoConocido } from './encargos.js';
import { materialDelPlato, pedirCantidades } from './cantidades.js';
import { materialDeLaLista, materialDelPlatoParecido, pedirArreglo, pedirParecidos } from './receta.js';
import { materialDeLaIdea, pedirMejora } from './idea.js';
import { materialDeEstados, materialDeUnEstado, pedirEstados, pedirGracia } from './estados.js';
import { materialDelBunga, pedirResumen } from './bunga.js';
import { conModeloVigente, listarModelos, masCercano, probar } from './ia.js';
import { aplicarMigracion, estadoDeMigraciones } from './migrador.js';

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

/**
 * Lo que un móvil guarda de su propia cuenta. `personId` viaja porque es lo que
 * siembra «quién eres» en el aparato (SPECS §14.41): al enlazar una cuenta con
 * una persona, el siguiente canje o sincronización se lo lleva puesto y el
 * móvil elige la identidad solo, sin pasearse por Ajustes.
 */
function cuentaPublica(cuenta) {
  return { id: cuenta.id, nombre: cuenta.nombre, rol: cuenta.rol, personId: cuenta.personId ?? null };
}

/**
 * ¿Es este el administrador? Dos llaves, de distinta fuerza (`administrador.js`).
 *
 * El **correo** vale siempre: viene dentro del token que firma Apple, no lo
 * elige quien llama. El **nombre** solo vale cuando **no queda ningún
 * administrador activo** —el estado del cerrojo—, porque no lo firma nadie: lo
 * manda la app. Hace falta porque el correo puede no servir de llave: con
 * «Ocultar mi correo», Apple entrega una dirección de relé y no la de verdad.
 */
async function esLaLlaveDelAdministrador(env, { correo, nombre }) {
  if (esCorreoDelAdministrador(correo)) return true;
  if (!esNombreDelAdministrador(nombre)) return false;
  return !(await hayAdministradorActivo(env.DB));
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

  // El administrador no espera en su propia sala (SPECS §14.15): la sala solo
  // la abre un administrador, así que si el único que hay sale de la cuenta, al
  // volver no queda nadie dentro que pueda enlazarle. Si trae su llave —el
  // correo, o el nombre cuando no queda administrador—, la cuenta nace o vuelve
  // administradora, activa y enlazada con su persona.
  const esElAdministrador = await esLaLlaveDelAdministrador(env, {
    correo: email ?? cuenta?.email,
    nombre: nombre || cuenta?.nombre,
  });

  if (esElAdministrador) {
    if (!cuenta) {
      cuenta = await crearCuenta(env.DB, {
        id: idDeCuenta(), appleSub: sub, nombre, email, rol: 'administrador',
      });
    }
    if (!cuenta.activa || cuenta.rol !== 'administrador' || !cuenta.personId) {
      cuenta = await promoverCuentaAAdministrador(env.DB, cuenta.id);
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
          // Con esto el móvil puede volver a preguntar sin pasar otra vez por la
          // hoja de Apple, y entrar solo en cuanto le enlacen.
          pase: await emitirPaseDeEspera(env.SESION_SECRETO, espera.id),
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
          pase: await emitirPaseDeEspera(env.SESION_SECRETO, cuenta.id),
        },
        403,
      );
    }
    return json({ error: 'cuenta_desactivada', mensaje: 'Tu acceso al grupo está desactivado.' }, 403);
  }

  await anotarAcceso(env.DB, cuenta.id);
  const token = await emitirSesion(env.SESION_SECRETO, cuenta, plataforma);

  return json({ token, cuenta: cuentaPublica(cuenta) });
}

/**
 * «¿Ya me han dejado entrar?», preguntado sin Apple.
 *
 * Es la mitad que le faltaba a la sala de espera. Antes, la única forma de
 * saberlo era volver a canjear un token de Apple, o sea sacar la hoja del
 * sistema por encima de la app: eso se puede hacer cuando alguien pulsa un
 * botón, pero no cada veinte segundos. Con el pase, esto es una petición normal
 * y el móvil puede quedarse mirando y entrar solo en cuanto le enlacen.
 *
 * Devuelve **la sesión** en cuanto la cuenta está activa, y ahí acaba la espera.
 * Es legítimo: el pase se le entregó a quien ya demostró ante Apple ser el dueño
 * de esa cuenta, y lo que faltaba no era demostrar quién es sino que alguien del
 * grupo le diera acceso. Lo que decide es `activa`, igual que en `abrirSesion`.
 */
async function mirarLaEspera(peticion, env) {
  const { pase } = await peticion.json();
  const cuentaId = await verificarPaseDeEspera(env.SESION_SECRETO, pase);
  let cuenta = await cuentaPorId(env.DB, cuentaId);

  // La cuenta ya no está: la han eliminado desde Ajustes mientras esperaba. El
  // móvil tiene que olvidar el pase y volver a la puerta, no seguir preguntando
  // por algo que ya no existe.
  if (!cuenta) return json({ estado: 'desconocida' });

  // Las mismas llaves que en la puerta (ver `esLaLlaveDelAdministrador`): el
  // correo y el nombre los apuntó `crearCuenta` al abrir la solicitud. Si quien
  // espera es el administrador, se le asciende aquí y este sondeo ya devuelve
  // la sesión: es lo que saca a un móvil clavado en la sala sin volver a pasar
  // por la hoja de Apple.
  if (!cuenta.activa
    && (await esLaLlaveDelAdministrador(env, { correo: cuenta.email, nombre: cuenta.nombre }))) {
    cuenta = await promoverCuentaAAdministrador(env.DB, cuenta.id);
  }

  if (!cuenta.activa) {
    if (!cuenta.personId) return json({ estado: 'espera', nombre: cuenta.nombre });
    return json({ estado: 'desactivada' });
  }

  await anotarAcceso(env.DB, cuenta.id);
  return json({
    estado: 'dentro',
    token: await emitirSesion(env.SESION_SECRETO, cuenta, 'ios'),
    cuenta: cuentaPublica(cuenta),
  });
}

/**
 * Entrar con el pase de un enlace, sin Apple y sin iPhone (SPECS §14.61).
 *
 * Quien administra genera el enlace desde Ajustes → Cuentas y se lo manda a
 * quien no tiene iPhone; abrirlo en cualquier navegador acaba aquí. Lo que
 * devuelve es **la sesión de siempre** —el mismo JWT de noventa días que sale de
 * la puerta de Apple—, porque a partir de este punto no hay nada distinto: la
 * app sincroniza igual y el Worker no tiene por qué acordarse de por dónde
 * entró nadie.
 *
 * Lo que decide es lo mismo que en las otras dos puertas —`activa`— más una
 * comprobación que aquí es la que importa: **que este sea el pase vivo**. La
 * firma dice que el papel salió de este Worker; el `jti` guardado en la cuenta
 * dice que no lo ha canjeado ya alguien y que no se ha generado otro después.
 * Canjearlo lo quema, así que el enlace reenviado a un grupo de WhatsApp no
 * vuelve a abrir nada.
 *
 * Los tres finales se dicen por separado a propósito: «ya se ha usado» se
 * arregla pidiendo otro, «esta cuenta está desactivada» no se arregla desde el
 * navegador, y «el pase no vale» es un enlace roto al copiarlo. Con un solo 401
 * para los tres, quien lo abre no sabe a quién escribirle.
 */
async function entrarPorEnlace(peticion, env) {
  const { pase } = await peticion.json();

  let papel;
  try {
    papel = await verificarPaseDeEnlace(env.SESION_SECRETO, pase);
  } catch (error) {
    // Caducado y mal formado se separan porque no se arreglan igual: uno se
    // pide otra vez, el otro se copia otra vez.
    const caducado = /caducad/i.test(String(error.message || error));
    return json({
      estado: 'no-vale',
      mensaje: caducado
        ? 'Este enlace ha caducado. Pídele otro a quien lleva el grupo.'
        : 'Este enlace no vale. Comprueba que lo has copiado entero.',
    }, 401);
  }

  const cuenta = await cuentaPorId(env.DB, papel.cuentaId);
  if (!cuenta) {
    return json({ estado: 'no-vale', mensaje: 'Esta cuenta ya no existe.' }, 401);
  }

  if (!cuenta.enlaceJti || !papel.jti || !coincideEnTiempoConstante(cuenta.enlaceJti, papel.jti)) {
    return json({
      estado: 'usado',
      mensaje: 'Este enlace ya se ha usado o se ha generado otro más nuevo. Pídele uno a quien lleva el grupo.',
    }, 401);
  }

  if (!cuenta.activa) {
    return json({ estado: 'desactivada', mensaje: 'Tu acceso al grupo está desactivado.' }, 403);
  }

  await ponerJtiDeEnlace(env.DB, cuenta.id, null);
  await anotarAcceso(env.DB, cuenta.id);

  return json({
    estado: 'dentro',
    token: await emitirSesion(env.SESION_SECRETO, cuenta, 'web'),
    cuenta: cuentaPublica(cuenta),
  });
}

async function sincronizar(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);

  await anotarDispositivo(env.DB, {
    id: peticion.headers.get('X-Dispositivo') || `${cuenta.id}:desconocido`,
    cuentaId: cuenta.id,
    plataforma: peticion.headers.get('X-Plataforma') || 'web',
  });

  // La instantánea lleva la cuenta al lado (`cuentaPublica`): es lo que hace
  // que un enlace hecho **después** de entrar llegue a los móviles que ya
  // estaban dentro, en su siguiente sincronización y sin volver por Apple.
  return json({ ...(await leerInstantanea(env.DB)), cuenta: cuentaPublica(cuenta) });
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

  const instantanea = await leerInstantanea(env.DB);
  // Los avisos van **después** de haber aplicado todo y con la instantánea ya
  // leída, y no interrumpen la respuesta: lo que se ha guardado ya está
  // guardado, y un APNs lento no puede dejar al móvil esperando su sincronía.
  try {
    await avisarDeLosCambios(env, { cambios, resultados, instantanea, cuenta });
  } catch (error) {
    // Un aviso que no sale no puede tumbar el cambio que lo provocó — pero
    // tragárselo **en silencio** es lo que ya costó cuatro vueltas en este mismo
    // apartado. Sale por el log del Worker (`wrangler tail`), que es donde se
    // mira cuando alguien dice «he cambiado mi estado y no me llega nada».
    console.error('[avisos] no se ha podido avisar de los cambios:', String(error?.message || error));
  }

  return json({ resultados, instantanea, cuenta: cuentaPublica(cuenta) });
}

async function cuentas(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);
  if (cuenta.rol !== 'administrador') return json({ error: 'reservado a administradores' }, 403);

  if (peticion.method === 'GET') return json({ cuentas: await listarCuentas(env.DB) });

  const { accion, identificador, nombre = '', id, rol, personId } = await peticion.json();

  if (accion === 'enlace') {
    // Un enlace de acceso para quien no tiene iPhone (SPECS §14.61). Se pide
    // **por persona** y no por cuenta, porque el caso normal es que esa cuenta
    // todavía no exista: quien no tiene iPhone no ha podido entrar nunca, así
    // que no aparece en la lista de «quién ha pedido entrar». Si ya la tiene
    // —porque se le generó otro enlace antes— se le renueva el pase a esa, y no
    // se crea una segunda cuenta para la misma persona.
    if (!personId) return json({ error: 'falta la persona' }, 400);

    let cuenta = await cuentaPorPersona(env.DB, personId);
    if (!cuenta) {
      // El prefijo lo separa de una cuenta de Apple igual que `invitacion:`, y
      // cumple además con que `appleSub` es NOT NULL UNIQUE. Si esa persona se
      // compra un iPhone algún día, entrará con Apple y aparecerá en la lista
      // como una cuenta nueva, que es donde se decide qué hacer con las dos.
      const nueva = idDeCuenta();
      cuenta = await crearCuenta(env.DB, {
        id: nueva,
        appleSub: `enlace:${nueva}`,
        nombre: String(nombre ?? '').trim(),
        rol: 'miembro',
        activa: 1,
        personId,
      });
    } else if (!cuenta.activa) {
      // Desactivar una cuenta es cerrarle la puerta a propósito. Generarle un
      // enlace la reabriría por la puerta de al lado sin decirlo.
      return json({ error: 'esa cuenta está desactivada: actívala antes de darle un enlace' }, 400);
    }

    const jti = crypto.randomUUID();
    await ponerJtiDeEnlace(env.DB, cuenta.id, jti);
    return json({ pase: await emitirPaseDeEnlace(env.SESION_SECRETO, cuenta.id, jti), id: cuenta.id });
  }

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
    // Salió, pero por el servidor de enfrente: `APNS_ENTORNO` no coincide con
    // cómo está firmado el binario. Ya no rompe nada —antes borraba el token—,
    // pero cuesta una petición de más en cada aviso y hay que corregirlo.
    entornoCruzado: resultados.some((r) => r.ok && r.entornoCruzado) || undefined,
  });
}

/**
 * De qué quiere enterarse esta cuenta (SPECS §14.39).
 *
 * Es de la **cuenta** y no del aparato: `dispositivo.avisos` es el permiso del
 * sistema, que se da y se quita en iOS y vale solo para ese teléfono; esto es
 * qué te interesa saber, y quien tiene móvil e iPad no quiere apagar «los
 * estados» dos veces.
 *
 * Devuelve siempre **el catálogo entero** con lo que hay puesto, para que la
 * pantalla no tenga que llevar su propia copia de los nombres: una clase que se
 * llame distinto en los dos sitios se apaga en uno y sigue sonando en el otro.
 */
async function avisosQueQuiero(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);

  if (peticion.method === 'POST') {
    const { clases = {} } = await peticion.json();
    // Solo las del catálogo. Sin este filtro, un cliente viejo o equivocado
    // puede llenar la fila de claves que no apaga nada y que nadie limpia.
    const limpias = Object.fromEntries(
      Object.entries(clases).filter(([id]) => ES_CLASE(id)).map(([id, v]) => [id, v !== false ? true : false]),
    );
    await guardarAvisosDeCuenta(env.DB, cuenta.id, limpias);
  }

  const puestas = await avisosDeCuenta(env.DB, cuenta.id);
  return json({
    clases: CLASES_DE_AVISO.map((c) => ({ ...c, quiero: puestas[c.id] !== false })),
    esAdministrador: cuenta.rol === 'administrador',
  });
}

/**
 * Los avisos que nacen de un cambio: un gasto que te mueve el saldo, una deuda
 * pagada, alguien que dice en qué anda.
 *
 * Se llama **después** de aplicar el lote y con la instantánea ya leída, que es
 * lo que da los nombres sin volver a la base. No lanza y no se espera a que
 * termine de mandar: un aviso que no sale no puede tumbar el cambio que lo
 * provocó, que es lo mismo que ya hacía `avisarDeSolicitud`.
 */
/**
 * De un lote de cambios y la instantánea, **qué sobres hay que mandar**.
 *
 * Separado de `avisarDeLosCambios` y exportado por un motivo concreto: aquí es
 * donde estuvo escondido nueve versiones el fallo que dejaba los avisos mudos.
 * `leerInstantanea` devuelve `{ v: 1, tables: { persons, families, … } }` y esto
 * leía `instantanea.persons` — **siempre `undefined`**. Con la lista de personas
 * vacía, `familiasDeUnGasto` no encuentra a nadie, `personIds` sale vacío y
 * todos los avisos de `avisoDeGasto`, `avisoDeLiquidacion` y `avisoDeComentario`
 * devuelven `null`: no se manda nada y **no falla nada**, que es la clase de
 * error que no se nota hasta que alguien pregunta por qué no le llegó.
 *
 * Solo sobrevivía «En qué anda la gente», porque `avisoDeEstado` no mira las
 * personas y su `personIds` es `null` —el grupo entero—. Los tests pasaban
 * porque probaban las funciones puras con las listas puestas a mano; ninguno
 * miraba **la forma de lo que les llega de verdad**. Por eso esto se exporta:
 * para que haya un test que le pase una instantánea con la forma real.
 */
export function sobresDeLosCambios({ cambios, resultados, instantanea, autor = null }) {
  const t = instantanea?.tables ?? {};
  const personas = t.persons ?? [];
  const familias = t.families ?? [];
  const moneda = t.events?.[0]?.currency || 'EUR';

  const sobres = [];
  for (const [i, cambio] of cambios.entries()) {
    const resultado = resultados[i];
    if (!resultado?.aplicado) continue;
    const campos = cambio.campos || {};

    // **Un borrado también avisa, y solo a quien lleva las cuentas** (§14.58 ·
    // L6). Hasta hoy este bucle se saltaba los borrados enteros: la regla era
    // «se avisa de lo que mueve el saldo» y nadie se paró a ver que un gasto
    // borrado lo mueve hacia atrás. Se usa `resultado.anterior`, que es la fila
    // tal como estaba: después de aplicarlo ya no hay de dónde sacar ni el
    // nombre ni el importe.
    if (cambio?.op === 'borrar') {
      if (cambio.tabla === 'expenses' && resultado.anterior) {
        sobres.push(avisoDeGastoBorrado(resultado.anterior, { personas, moneda, autor }));
      }
      continue;
    }

    if (cambio.tabla === 'expenses' && elGastoMueveElSaldo(resultado.anterior, campos)) {
      // Dos sobres como mucho, y nunca dos avisos a la misma persona: quien
      // lleva las cuentas y además le toca el gasto recibe uno solo.
      sobres.push(...avisosDeGasto({ id: cambio.id, ...campos }, { personas, familias, moneda, autor }));
    }
    if (cambio.tabla === 'settlements' && resultado.nuevo) {
      sobres.push(avisoDeLiquidacion({ id: cambio.id, ...campos }, { personas, familias, moneda, autor }));
    }
    if (cambio.tabla === 'persons') {
      sobres.push(avisoDeEstado({ id: cambio.id, ...campos }, resultado.anterior, { autor }));
    }
    // Un comentario **nuevo**, no uno corregido: arreglar una falta de ortografía
    // no es algo de lo que enterar a nadie, y es la misma regla que ya separa un
    // gasto que mueve el saldo de uno al que se le toca la descripción.
    if (cambio.tabla === 'comentarios' && !resultado.anterior) {
      sobres.push(avisoDeComentario({ id: cambio.id, ...campos }, {
        personas,
        planes: t.plans ?? [],
        gastos: t.expenses ?? [],
        bungas: t.bungas ?? [],
        hilo: t.comentarios ?? [],
        autor,
      }));
    }
  }

  return sobres.filter(Boolean);
}

/**
 * Los avisos que nacen de un cambio, ya mandados.
 *
 * No lanza y no se espera: un aviso que no sale no puede tumbar el cambio que lo
 * provocó, que es lo mismo que ya hacía `avisarDeSolicitud`.
 */
async function avisarDeLosCambios(env, { cambios, resultados, instantanea, cuenta }) {
  if (!hayApnsConfigurado(env)) return;
  const autor = cuenta.personId || null;
  const sobres = sobresDeLosCambios({ cambios, resultados, instantanea, autor });

  for (const sobre of sobres) {
    const tokens = await tokensParaAviso(env.DB, {
      clase: sobre.clase,
      personIds: sobre.personIds,
      exceptoCuentaId: cuenta.id,
    });
    for (const token of tokens) {
      const r = await enviarAviso(env, token, {
        titulo: sobre.titulo,
        cuerpo: sobre.cuerpo,
        categoria: sobre.clase,
        agrupa: sobre.agrupa,
        urgente: false,
        // **El destino y el evento** (§14.60 · R2·R3). El sobre ya llevaba `ir`
        // desde el primer día y nadie lo leía en el móvil; ahora además va el
        // evento, porque un aviso de un viaje que no es el abierto llevaría a
        // una pantalla donde esa fila no existe.
        datos: {
          ir: sobre.ir || (sobre.clase === 'estado' ? 'hoy' : 'dinero'),
          evento: instantanea?.tables?.events?.[0]?.id ?? undefined,
        },
      });
      if (r.caducado) await olvidarTokenPush(env.DB, token);
    }
  }
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
  // Con su clase: quien administra puede querer los gastos y no las
  // solicitudes. Y sin la cuenta que lo provocó, aunque aquí no se dé —quien
  // pide entrar no administra todavía—, porque la regla es de todos los avisos
  // y una excepción escrita en un sitio y no en otro es la que muerde.
  const tokens = await tokensDeAdministradores(env.DB, { clase: 'solicitud' });
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

  const { clave, modelos, encargos } = await leerConfiguracionIA(env.DB);
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
      modelo: modelos.ideas,
      hacer: (m) => pedirPropuestas({ clave, modelo: m, material, instruccion: encargos.ideas }),
      guardar: (m) => guardarConfiguracionIA(env.DB, { [claveDeModelo('ideas')]: m }),
    });
    return json({ propuestas: resultado, cambiado: cambiado || null });
  } catch (e) {
    return json({ error: String(e.message ?? e) }, 502);
  }
}

/**
 * Las cantidades que le faltan a una receta (SPECS §14.20).
 *
 * El cliente manda **el plato y los ingredientes que le faltan**, y nada más: no
 * viajan los nombres de quién come, que para decir cuánto arroz lleva una paella
 * no aportan. Lo que vuelve es cuánto de cada cosa **para las raciones de la
 * receta** —no para el viaje: estirar es una regla de tres y la hace la app— y
 * en qué envase se compra, que es el dato sin el cual no se puede redondear.
 */
async function cantidadesDeUnPlato(peticion, env) {
  await cuentaAutenticada(peticion, env);

  const { plato = '', raciones = null, ingredientes = [] } = await peticion.json();
  const pedidos = (ingredientes || []).map((x) => String(x ?? '').trim()).filter(Boolean);
  if (!pedidos.length) return json({ error: 'no hay ingredientes que rellenar' }, 400);

  const { clave, modelos, encargos } = await leerConfiguracionIA(env.DB);
  if (!clave) return json({ error: 'no hay clave de IA configurada' }, 409);

  const material = materialDelPlato({ plato, raciones, ingredientes: pedidos });

  try {
    const { resultado, cambiado } = await conModeloVigente({
      clave,
      modelo: modelos.cantidades,
      hacer: (m) => pedirCantidades({ clave, modelo: m, material, pedidos, instruccion: encargos.cantidades }),
      guardar: (m) => guardarConfiguracionIA(env.DB, { [claveDeModelo('cantidades')]: m }),
    });
    return json({ cantidades: resultado, cambiado: cambiado || null });
  } catch (e) {
    return json({ error: String(e.message ?? e) }, 502);
  }
}

/**
 * Ordena una lista de ingredientes escrita a saco (SPECS §14.20-bis).
 *
 * Del móvil salen las líneas tal como están y el nombre del plato; nada más. Lo
 * que vuelve es, por línea, la cantidad, la unidad y el nombre limpio — y solo
 * de las líneas que se mandaron: una línea de más aparecería sola en la receta
 * de alguien.
 */
async function arreglarLaLista(peticion, env) {
  await cuentaAutenticada(peticion, env);

  const { plato = '', raciones = null, lineas = [] } = await peticion.json();
  if (!Array.isArray(lineas) || !lineas.length) return json({ error: 'no hay líneas que ordenar' }, 400);

  const { clave, modelos, encargos } = await leerConfiguracionIA(env.DB);
  if (!clave) return json({ error: 'no hay clave de IA configurada' }, 409);

  const material = materialDeLaLista({ plato, raciones, lineas });
  try {
    const { resultado, cambiado } = await conModeloVigente({
      clave,
      modelo: modelos.arreglar,
      hacer: (m) => pedirArreglo({ clave, modelo: m, material, cuantas: lineas.length, instruccion: encargos.arreglar }),
      guardar: (m) => guardarConfiguracionIA(env.DB, { [claveDeModelo('arreglar')]: m }),
    });
    return json({ lineas: resultado, cambiado: cambiado || null });
  } catch (e) {
    return json({ error: String(e.message ?? e) }, 502);
  }
}

/**
 * Cinco platos que peguen con el que se está mirando (SPECS §14.20-bis).
 *
 * Tanda de cinco, como los regalos de `garciadoral-ops` y las ideas de plan: lo
 * caro es contarle el contexto, y pasar de una propuesta a otra no vuelve a
 * pedir nada. Llegan enteras —tipo e ingredientes incluidos— porque aceptar una
 * abre el editor con todo puesto.
 */
async function platosParecidos(peticion, env) {
  await cuentaAutenticada(peticion, env);

  const { plato = '', ingredientes = [], yaHay = [], eventId = null } = await peticion.json();
  if (!plato && !ingredientes.length) return json({ error: 'hace falta al menos el nombre o los ingredientes' }, 400);

  const { clave, modelos, encargos } = await leerConfiguracionIA(env.DB);
  if (!clave) return json({ error: 'no hay clave de IA configurada' }, 409);

  // Con qué se cocina es del evento (§14.20-quater), así que se lee aquí y no
  // llega del móvil: el material lo compone el Worker con lo que hay en la base.
  // Sin `eventId` —una app vieja— vale el texto de origen, y se propone igual.
  const evento = eventId
    ? await env.DB.prepare('SELECT * FROM events WHERE id = ? AND borrado = 0').bind(eventId).first()
    : null;

  const material = materialDelPlatoParecido({ plato, ingredientes, yaHay, evento });
  try {
    const { resultado, cambiado } = await conModeloVigente({
      clave,
      modelo: modelos.parecidos,
      hacer: (m) => pedirParecidos({ clave, modelo: m, material, instruccion: encargos.parecidos }),
      guardar: (m) => guardarConfiguracionIA(env.DB, { [claveDeModelo('parecidos')]: m }),
    });
    return json({ platos: resultado, cambiado: cambiado || null });
  } catch (e) {
    return json({ error: String(e.message ?? e) }, 502);
  }
}

/**
 * La misma idea, mejor contada (SPECS §14.24).
 *
 * Del móvil van el título, la descripción y el enlace de esa idea; nada más —
 * los nombres no viajan—. Lo que vuelve **no se guarda aquí**: rellena el
 * editor, se puede deshacer, y guardar sigue siendo el botón de siempre. Es la
 * figura de «Arreglar» de la receta aplicada a una idea.
 */
async function mejorarLaIdea(peticion, env) {
  await cuentaAutenticada(peticion, env);

  const { titulo = '', descripcion = '', enlace = '' } = await peticion.json();
  if (!String(titulo).trim() && !String(descripcion).trim()) return json({ error: 'no hay idea que mejorar' }, 400);

  const { clave, modelos, encargos } = await leerConfiguracionIA(env.DB);
  if (!clave) return json({ error: 'no hay clave de IA configurada' }, 409);

  const material = materialDeLaIdea({ titulo, descripcion, enlace });
  try {
    const { resultado, cambiado } = await conModeloVigente({
      clave,
      modelo: modelos.mejorarIdea,
      hacer: (m) => pedirMejora({ clave, modelo: m, material, instruccion: encargos.mejorarIdea }),
      guardar: (m) => guardarConfiguracionIA(env.DB, { [claveDeModelo('mejorarIdea')]: m }),
    });
    return json({ idea: resultado, cambiado: cambiado || null });
  } catch (e) {
    return json({ error: String(e.message ?? e) }, 502);
  }
}

/**
 * La tanda de estados para ponerse (SPECS §14.36, `docs/diseño/estado.html` · I1).
 *
 * Se pide **solo cuando alguien pulsa** «Otras cinco»: llamar al abrir el modal
 * sería gastar una credencial de pago sin que nadie lo haya pedido, que es lo
 * que se descartó en su día para las ideas de plan. Y **no se guarda**: al revés
 * que los recadillos, un estado es tuyo y compartir la tanda haría que nueve
 * personas se pusieran el mismo.
 */
async function estadosSugeridos(peticion, env) {
  await cuentaAutenticada(peticion, env);

  const { eventId, hoy = new Date().toISOString().slice(0, 10) } = await peticion.json();
  if (!eventId) return json({ error: 'falta el evento' }, 400);

  const { clave, modelos, encargos } = await leerConfiguracionIA(env.DB);
  if (!clave) return json({ estados: [], sinClave: true });

  const evento = await env.DB.prepare('SELECT * FROM events WHERE id = ? AND borrado = 0').bind(eventId).first();
  if (!evento) return json({ error: 'ese evento no existe' }, 404);

  const cuantos = async (tabla, mas = '') => {
    const fila = await env.DB
      .prepare(`SELECT COUNT(*) AS n FROM ${tabla} WHERE eventId = ? AND borrado = 0${mas}`)
      .bind(eventId).first();
    return fila?.n ?? 0;
  };
  const material = materialDeEstados({
    evento,
    hoy,
    cuentas: {
      gastos: await cuantos('expenses'),
      cenas: await cuantos('dinners'),
      planes: await cuantos('plans'),
    },
  });

  try {
    const { resultado, cambiado } = await conModeloVigente({
      clave,
      modelo: modelos.estados,
      hacer: (m) => pedirEstados({ clave, modelo: m, material, instruccion: encargos.estados }),
      guardar: (m) => guardarConfiguracionIA(env.DB, { [claveDeModelo('estados')]: m }),
    });
    return json({ estados: resultado, cambiado: cambiado || null });
  } catch (e) {
    return json({ error: String(e.message ?? e) }, 502);
  }
}

/**
 * «Más gracioso»: el estado que has escrito, mejor contado (§14.36 · I3).
 *
 * La figura de «Mejorarla» de una idea: lo que vuelve **no se guarda**, rellena
 * el campo y Guardar sigue siendo el botón de siempre.
 */
/**
 * El bunga, resumido en una frase (SPECS §14.66).
 *
 * El material lo manda el móvil y no se compone aquí, al revés que los
 * recadillos: lo que se resume es exactamente lo que hay escrito en ese bunga
 * —sus pegatinas y sus notas—, que es la misma figura que «Mejorar la redacción
 * de una idea». Lo que no viaja, como en todos los demás, son los nombres: se
 * resume cómo es el sitio, no de quién es este agosto.
 *
 * Lo que vuelve **no se guarda aquí**: sube por la cola de cambios como
 * cualquier otra escritura del grupo, para que el resumen sea del sitio y no de
 * un teléfono.
 */
async function resumenDeBunga(peticion, env) {
  await cuentaAutenticada(peticion, env);

  const { nombre = '', alias = '', notas = '', pegatinas = [] } = await peticion.json();

  const { clave, modelos, encargos } = await leerConfiguracionIA(env.DB);
  if (!clave) return json({ error: 'no hay clave de IA configurada' }, 409);

  const material = materialDelBunga({
    nombre, alias, notas, pegatinas: Array.isArray(pegatinas) ? pegatinas : [],
  });
  try {
    const { resultado, cambiado } = await conModeloVigente({
      clave,
      modelo: modelos.resumenDeBunga,
      hacer: (m) => pedirResumen({ clave, modelo: m, material, instruccion: encargos.resumenDeBunga }),
      guardar: (m) => guardarConfiguracionIA(env.DB, { [claveDeModelo('resumenDeBunga')]: m }),
    });
    return json({ resumen: resultado, cambiado: cambiado || null });
  } catch (e) {
    return json({ error: String(e.message ?? e) }, 502);
  }
}

async function estadoConGracia(peticion, env) {
  await cuentaAutenticada(peticion, env);

  const { emoji = '', texto = '' } = await peticion.json();
  if (!String(texto).trim()) return json({ error: 'no hay estado al que dar gracia' }, 400);

  const { clave, modelos, encargos } = await leerConfiguracionIA(env.DB);
  if (!clave) return json({ error: 'no hay clave de IA configurada' }, 409);

  const material = materialDeUnEstado({ emoji, texto });
  try {
    const { resultado, cambiado } = await conModeloVigente({
      clave,
      modelo: modelos.estadoGracia,
      hacer: (m) => pedirGracia({ clave, modelo: m, material, instruccion: encargos.estadoGracia }),
      guardar: (m) => guardarConfiguracionIA(env.DB, { [claveDeModelo('estadoGracia')]: m }),
    });
    return json({ estado: resultado, cambiado: cambiado || null });
  } catch (e) {
    return json({ error: String(e.message ?? e) }, 502);
  }
}

/**
 * La tanda de recadillos del viaje (SPECS §14.25).
 *
 * Tiene una diferencia con los otros servicios de IA y es la que decide lo que
 * cuesta: **la ventana de dos horas vive aquí, no en el móvil**. El primero que
 * pregunta pasadas las dos horas paga la llamada y los otros ocho teléfonos se
 * llevan la misma tanda de la base. Al revés serían nueve llamadas por ventana
 * —y nueve bromas distintas a la vez, que en un grupo es peor que caro—.
 *
 * Y **sin clave no es un error**: la app tiene sus propias frases sacadas de los
 * datos del viaje, así que aquí se contesta con la lista vacía y se sigue. Un
 * 409 obligaría a la pantalla a distinguir «no hay IA» de «ha fallado algo»,
 * cuando en las dos la respuesta es la misma: enseñar lo que haya.
 */
async function recadosDelViaje(peticion, env) {
  await cuentaAutenticada(peticion, env);

  const { eventId, hoy = new Date().toISOString().slice(0, 10) } = await peticion.json();
  if (!eventId) return json({ error: 'falta el evento' }, 400);

  const guardada = await leerRecadosGuardados(env.DB, eventId);
  if (guardada && sigueSirviendo(guardada.generadoEn)) {
    return json({ recados: guardada.recados, generadoEn: guardada.generadoEn, deLaBase: true });
  }

  const { clave, modelos, encargos } = await leerConfiguracionIA(env.DB);
  if (!clave) return json({ recados: [], generadoEn: null, sinClave: true });

  const evento = await env.DB.prepare('SELECT * FROM events WHERE id = ? AND borrado = 0').bind(eventId).first();
  if (!evento) return json({ error: 'ese evento no existe' }, 404);

  const cuantos = async (tabla, mas = '') => {
    const fila = await env.DB
      .prepare(`SELECT COUNT(*) AS n FROM ${tabla} WHERE eventId = ? AND borrado = 0${mas}`)
      .bind(eventId).first();
    return fila?.n ?? 0;
  };
  const { results: personas } = await env.DB
    .prepare('SELECT edad FROM persons WHERE eventId = ? AND borrado = 0').bind(eventId).all();

  const material = materialDeRecados({
    evento,
    personas: personas || [],
    hoy,
    cuentas: {
      gastos: await cuantos('expenses'),
      cenas: await cuantos('dinners'),
      planes: await cuantos('plans'),
      compra: await cuantos('shop', ' AND comprado = 0'),
    },
  });

  try {
    const { resultado, cambiado } = await conModeloVigente({
      clave,
      modelo: modelos.recados,
      hacer: (m) => pedirRecados({ clave, modelo: m, material, instruccion: encargos.recados }),
      guardar: (m) => guardarConfiguracionIA(env.DB, { [claveDeModelo('recados')]: m }),
    });

    // Una tanda vacía —el encargo reescrito sin JSON— no se guarda: guardarla
    // dejaría dos horas sin recados y sin manera de saber por qué.
    if (!resultado.length) return json({ recados: [], generadoEn: null, cambiado: cambiado || null });

    const generadoEn = await guardarRecados(env.DB, eventId, resultado);
    return json({ recados: resultado, generadoEn, cambiado: cambiado || null });
  } catch (e) {
    // Si falla la llamada se devuelve lo viejo antes que nada: una tanda de hace
    // cinco horas sigue teniendo gracia, y quedarse en blanco no.
    if (guardada) return json({ recados: guardada.recados, generadoEn: guardada.generadoEn, caducada: true });
    return json({ error: String(e.message ?? e) }, 502);
  }
}

async function configuracionIA(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);
  if (cuenta.rol !== 'administrador') return json({ error: 'reservado a administradores' }, 403);

  if (peticion.method === 'POST') {
    const { clave, modelo, encargos = {}, modelos = {} } = await peticion.json();
    await guardarConfiguracionIA(env.DB, { clave, modelo });

    // Los encargos se guardan **uno a uno y solo los conocidos**. Sin este
    // filtro, `guardarConfiguracionIA` escribe la clave que le den —incluida
    // `ia.clave`—, y entonces un móvil podría machacar la credencial de pago
    // mandando un encargo que se llame así.
    for (const [id, texto] of Object.entries(encargos)) {
      if (!esEncargoConocido(id)) continue;
      // Vacío no borra la fila: guarda «», y al leer eso vuelve el de origen.
      await guardarConfiguracionIA(env.DB, { [claveDeEncargo(id)]: String(texto ?? '').trim() });
    }
    // Y con qué modelo se le pide cada cosa. Mismo filtro y por lo mismo: sin
    // él, un «modelo» llamado `clave` machacaría la credencial de pago.
    for (const [id, cual] of Object.entries(modelos)) {
      if (!esEncargoConocido(id)) continue;
      await guardarConfiguracionIA(env.DB, { [claveDeModelo(id)]: String(cual ?? '').trim() });
    }
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

/**
 * Las mejoras pendientes, para quien hace el trabajo (SPECS §14.22, F2 de
 * `docs/diseño/mejoras.html`).
 *
 * Va con el token de servicio y no con una sesión: quien la llama no es un
 * móvil del grupo sino la sesión de Claude que abre un encargo, y así lo
 * apuntado desde el camping aparece solo donde se decide qué se hace. Es la
 * pregunta que `garciadoral-ops` dejó abierta —su transporte era una persona—
 * y aquí se cierra porque el Worker tiene la lista.
 */
async function mejorasPendientes(peticion, env) {
  if (!env.TOKEN_SERVICIO || !coincideEnTiempoConstante(credencial(peticion), env.TOKEN_SERVICIO)) {
    return json({ error: 'no autorizado' }, 401);
  }
  return json({ mejoras: await leerMejorasPendientes(env.DB) });
}

/**
 * Poner la base al día desde Ajustes → Actualizar (SPECS §14.23).
 *
 * Reservado a administradores, como la IA. El SQL que se ejecuta es **solo el
 * que viaja dentro del Worker** (`migraciones.js`): del móvil no llega ninguna
 * sentencia, llega «aplica la siguiente». Y funciona con la base por detrás
 * —no toca las tablas del grupo—, que es exactamente cuándo hace falta:
 * `/api/sync` ya estaría fallando.
 *
 * El POST aplica **una** y devuelve lo que queda: el móvil lo llama en bucle y
 * el progreso que pinta es el de verdad.
 */
async function migraciones(peticion, env) {
  const cuenta = await cuentaAutenticada(peticion, env);
  if (cuenta.rol !== 'administrador') return json({ error: 'reservado a administradores' }, 403);

  if (peticion.method === 'POST') {
    const estado = await estadoDeMigraciones(env.DB);
    const siguiente = estado.find((m) => m.pendiente);
    if (!siguiente) return json({ aplicada: null, pendientes: [] });
    const resultado = await aplicarMigracion(env.DB, siguiente.id);
    const despues = await estadoDeMigraciones(env.DB);
    return json({ aplicada: resultado, pendientes: despues.filter((m) => m.pendiente).map((m) => m.id) });
  }

  return json({ migraciones: await estadoDeMigraciones(env.DB) });
}

// ---------------------------------------------------------------------------

const RUTAS = [
  ['GET', '/api/salud', async () => json({ estado: 'ok', ahora: new Date().toISOString() })],
  ['POST', '/api/sesion', abrirSesion],
  ['POST', '/api/sesion/espera', mirarLaEspera],
  ['POST', '/api/sesion/enlace', entrarPorEnlace],
  ['GET', '/api/sync', sincronizar],
  ['POST', '/api/cambios', recibirCambios],
  ['GET', '/api/cuentas', cuentas],
  ['POST', '/api/cuentas', cuentas],
  ['POST', '/api/cuenta/baja', darDeBaja],
  ['POST', '/api/push', registroDePush],
  ['POST', '/api/push/prueba', pruebaDePush],
  ['GET', '/api/avisos', avisosQueQuiero],
  ['POST', '/api/avisos', avisosQueQuiero],
  ['GET', '/api/ia', configuracionIA],
  ['POST', '/api/ia', configuracionIA],
  ['GET', '/api/ia/modelos', modelosDeIA],
  ['POST', '/api/ia/probar', probarIA],
  ['POST', '/api/plan/sugerir', sugerirPlanes],
  ['POST', '/api/plato/cantidades', cantidadesDeUnPlato],
  ['POST', '/api/plato/arreglar', arreglarLaLista],
  ['POST', '/api/plato/parecidos', platosParecidos],
  ['POST', '/api/idea/mejorar', mejorarLaIdea],
  ['POST', '/api/estados/sugerir', estadosSugeridos],
  ['POST', '/api/estados/gracia', estadoConGracia],
  ['POST', '/api/bunga/resumen', resumenDeBunga],
  ['POST', '/api/recados', recadosDelViaje],
  ['POST', '/api/importar', importar],
  ['GET', '/api/mejoras', mejorasPendientes],
  ['GET', '/api/migraciones', migraciones],
  ['POST', '/api/migraciones', migraciones],
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
