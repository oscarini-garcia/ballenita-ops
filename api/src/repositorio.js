/**
 * Lectura y escritura del registro del grupo sobre D1.
 *
 * El servidor es la autoridad: los móviles suben una cola de cambios y reciben
 * de vuelta la instantánea que resulta de aplicarla. Eso sustituye al merge por
 * última escritura que antes ocurría en cada cliente contra un documento de
 * JSONBin, y con él desaparecen las lápidas: un borrado es un cambio más de la
 * cola, y la fila queda marcada en la base sin transmitirse nunca más.
 *
 * Lo que NO cambia es la regla de oro del proyecto: aquí solo viven hechos
 * —gastos, liquidaciones, cenas, planes—. Ningún saldo se guarda ni se
 * transmite; los calcula `lib/reparto.js` en cada dispositivo.
 */

import { NOMBRES, TABLAS, existeTabla, filaAObjeto, objetoAColumnas } from './tablas.js';
import { encargosDe, encargosPublicos, modelosDe } from './encargos.js';

const ahoraISO = () => new Date().toISOString();

async function filas(db, sql, ...parametros) {
  const { results } = await db.prepare(sql).bind(...parametros).all();
  return results || [];
}

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------

export function cuentaPorApple(db, appleSub) {
  return db.prepare('SELECT * FROM cuenta WHERE appleSub = ?').bind(appleSub).first();
}

export function cuentaPorId(db, id) {
  return db.prepare('SELECT * FROM cuenta WHERE id = ?').bind(id).first();
}

export async function hayAlgunaCuenta(db) {
  const fila = await db.prepare('SELECT COUNT(*) AS total FROM cuenta').first();
  return (fila?.total ?? 0) > 0;
}

/**
 * Da de alta una cuenta. La primera de todas nace administradora: sin esa
 * excepción no habría manera de entrar en una instalación recién desplegada
 * salvo escribiendo en la base a mano.
 */
export async function crearCuenta(db, { id, appleSub, nombre = '', email = null, rol = null, activa = 1 }) {
  const primera = !(await hayAlgunaCuenta(db));
  const cuenta = {
    id,
    appleSub,
    nombre,
    email,
    rol: rol || (primera ? 'administrador' : 'miembro'),
    activa,
    creadoEn: ahoraISO(),
  };
  await db
    .prepare(
      `INSERT INTO cuenta (id, appleSub, nombre, email, rol, activa, creadoEn)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(cuenta.id, cuenta.appleSub, cuenta.nombre, cuenta.email, cuenta.rol, cuenta.activa, cuenta.creadoEn)
    .run();
  return cuenta;
}

export function listarCuentas(db) {
  return filas(
    db,
    `SELECT id, nombre, email, rol, activa, personId, creadoEn, ultimoAcceso
       FROM cuenta ORDER BY creadoEn`,
  );
}

/**
 * Enlaza una cuenta con una persona del grupo, **y con eso le da acceso**.
 *
 * Las dos cosas van juntas a propósito: una cuenta sin persona no es «alguien
 * con permisos a medias», es alguien de quien no sabemos quién es, y en una app
 * donde todo —el reparto, las cenas, los planes— cuelga de una persona, entrar
 * sin serlo no lleva a ninguna pantalla útil. `personId = null` la deja otra vez
 * esperando en la sala.
 */
export async function enlazarCuentaConPersona(db, cuentaId, personId) {
  await db
    .prepare('UPDATE cuenta SET personId = ?, activa = ? WHERE id = ?')
    .bind(personId || null, personId ? 1 : 0, cuentaId)
    .run();
}

/** Se va la fila entera: es del servidor, no se sincroniza y no deja huella en
 *  la instantánea. Quien vuelva a entrar con Apple pedirá acceso de nuevo. */
export async function eliminarCuenta(db, cuentaId) {
  await db.prepare('DELETE FROM dispositivo WHERE cuentaId = ?').bind(cuentaId).run();
  await db.prepare('DELETE FROM cuenta WHERE id = ?').bind(cuentaId).run();
}

export async function anotarAcceso(db, cuentaId) {
  await db.prepare('UPDATE cuenta SET ultimoAcceso = ? WHERE id = ?').bind(ahoraISO(), cuentaId).run();
}

/**
 * Cuántas cuentas administradoras quedarían si esta se fuera.
 *
 * Se consulta **antes** de la baja, mientras su titular todavía figura. Que se
 * vaya la última administradora es legítimo —impedirlo no lo es, la 5.1.1(v) no
 * admite excepciones— pero deja al grupo sin nadie que pueda dar de alta a otros
 * desde la app, y cuando eso se note nadie recordará que ocurrió. Queda dicho en
 * la respuesta y en el log.
 */
export async function administradoresRestantes(db, exceptoId) {
  const fila = await db
    .prepare("SELECT COUNT(*) AS total FROM cuenta WHERE rol = 'administrador' AND activa = 1 AND id != ?")
    .bind(exceptoId)
    .first();
  return fila?.total ?? 0;
}

/**
 * Baja de una cuenta, a petición de su titular (directriz 5.1.1(v)).
 *
 * Se va **todo lo que identifica a esa persona ante este servidor**: la fila de
 * `cuenta` —con su `appleSub`, su nombre y su correo— y los dispositivos desde
 * los que sincronizaba. Aquí sí es un borrado físico y no un `borrado = 1`: una
 * fila marcada seguiría guardando el identificador de Apple de alguien que ha
 * pedido que se le olvide, que es exactamente lo contrario de lo que pide la
 * directriz. Y puede serlo porque `cuenta` no se sincroniza con los móviles: no
 * hay ninguna cola vieja que pueda resucitarla, que es lo que obliga a las
 * lápidas en el registro del grupo.
 *
 * Lo que **no** se va son los hechos del grupo: los gastos que pagó, las cenas
 * que cocinó, los planes que votó. No son datos de su cuenta, son del grupo —los
 * demás siguen debiéndole o debiéndole a ella el mismo dinero— y borrarlos
 * descuadraría los saldos de todos los demás. Lo que desaparece es el vínculo
 * entre esos hechos y un identificador de Apple.
 */
export async function darDeBajaCuenta(db, cuentaId) {
  await db.prepare('DELETE FROM dispositivo WHERE cuentaId = ?').bind(cuentaId).run();
  await db.prepare('DELETE FROM cuenta WHERE id = ?').bind(cuentaId).run();
  return { baja: true };
}

export async function anotarDispositivo(db, { id, cuentaId, plataforma }) {
  await db
    .prepare(
      `INSERT INTO dispositivo (id, cuentaId, plataforma, ultimaSincronizacion)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET ultimaSincronizacion = excluded.ultimaSincronizacion,
                                     plataforma           = excluded.plataforma`,
    )
    .bind(id, cuentaId, plataforma || 'web', ahoraISO())
    .run();
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

/** Lo que cabe en una mejora. El mismo número que corta el móvil (`db.js`). */
export const TOPE_DE_MEJORA = 2000;

/**
 * Las mejoras pendientes, con su autor en palabras, para la ruta de servicio
 * (`GET /api/mejoras`, SPECS §14.22).
 *
 * Es la mitad que le faltaba a `garciadoral-ops`: allí quien hace las mejoras
 * lee el repositorio y no la instantánea, así que el transporte era una
 * persona. Aquí el Worker tiene la lista y la sirve; la sesión de Claude que
 * abre un encargo la lee al empezar, y lo apuntado en el camping aparece solo
 * donde se decide qué se hace.
 *
 * Salen solo las pendientes del grupo de verdad —lo hecho ya no es trabajo, y
 * lo del Demo es arena—, con el nombre del autor resuelto aquí: al otro lado no
 * hay tabla de personas contra la que cruzarlo.
 */
export async function leerMejorasPendientes(db) {
  const lista = await filas(
    db,
    `SELECT m.id, m.texto, m.apuntadaEl, p.name AS autor
       FROM mejoras m
       LEFT JOIN persons p ON p.id = m.autorId
      WHERE m.borrado = 0 AND m.hecho = 0 AND m.eventId IS NULL
      ORDER BY m.apuntadaEl`,
  );
  return lista.map((m) => ({ ...m, autor: m.autor || null }));
}

/**
 * Instantánea completa de lo vivo, con la forma exacta que `importSnapshot`
 * espera en el cliente. Se lee entera y sin filtrar por lector: en Ballena Ops
 * todo el grupo ve lo mismo, que es justo lo contrario del caso de una agenda
 * con regalos sorpresa.
 */
export async function leerInstantanea(db) {
  const tables = {};

  const lecturas = await Promise.all(
    NOMBRES.map(async (tabla) => [tabla, await filas(db, `SELECT * FROM ${tabla} WHERE borrado = 0`)]),
  );

  for (const [tabla, resultado] of lecturas) {
    tables[tabla] = resultado.map((fila) => filaAObjeto(tabla, fila));
  }

  return { v: 1, tables };
}

/**
 * Aplica un cambio de la cola de un dispositivo.
 *
 * Devuelve `{ aplicado, motivo }`. Un cambio rechazado no interrumpe el lote:
 * la cola del móvil tiene que poder vaciarse aunque una de sus entradas haya
 * quedado obsoleta, o se quedaría reintentándola para siempre.
 */
export async function aplicarCambio(db, cambio) {
  const { tabla, id, op = 'upsert', campos = {}, updatedAt } = cambio || {};

  if (!existeTabla(tabla)) return { aplicado: false, motivo: `tabla desconocida: ${tabla}` };
  if (!id || typeof id !== 'string') return { aplicado: false, motivo: 'cambio sin id' };

  // Una mejora es un cuaderno, no un adjunto. Sin tope, un pegado largo entra
  // en la instantánea del grupo entero y se descarga en cada sincronización,
  // para siempre. El móvil corta antes de guardar (`db.js`) y aquí se rechaza,
  // que es lo que hace que siga siendo verdad cuando el que escribe no es esa
  // pantalla. El rechazo no interrumpe el lote y le llega al móvil con motivo.
  if (tabla === 'mejoras' && typeof campos.texto === 'string' && campos.texto.length > TOPE_DE_MEJORA) {
    return { aplicado: false, motivo: `una mejora son ${TOPE_DE_MEJORA} caracteres como mucho` };
  }

  const marca = updatedAt || ahoraISO();
  const anterior = await db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).bind(id).first();

  // Última escritura gana, comparando marcas ISO —que ordenan como texto—. Si
  // el servidor ya tiene algo más nuevo, este cambio llegó tarde y se descarta.
  if (anterior && String(anterior.updatedAt) > String(marca)) {
    return { aplicado: false, motivo: 'el servidor tiene una versión más reciente' };
  }

  if (op === 'borrar') {
    if (!anterior) return { aplicado: true, motivo: 'ya no existía' };
    await db.prepare(`UPDATE ${tabla} SET borrado = 1, updatedAt = ? WHERE id = ?`).bind(marca, id).run();
    return { aplicado: true };
  }

  if (op !== 'upsert') return { aplicado: false, motivo: `operación desconocida: ${op}` };

  const valores = objetoAColumnas(tabla, campos);
  const claves = Object.keys(valores);

  if (anterior) {
    // Solo se tocan los campos que vienen; el resto de la fila se conserva. Así
    // dos móviles que editan cosas distintas del mismo gasto no se pisan.
    if (!claves.length) {
      await db.prepare(`UPDATE ${tabla} SET updatedAt = ? WHERE id = ?`).bind(marca, id).run();
      return { aplicado: true };
    }
    const asignaciones = claves.map((c) => `${c} = ?`).join(', ');
    await db
      .prepare(`UPDATE ${tabla} SET ${asignaciones}, updatedAt = ?, borrado = 0 WHERE id = ?`)
      .bind(...claves.map((c) => valores[c]), marca, id)
      .run();
    return { aplicado: true };
  }

  const columnas = ['id', ...claves, 'updatedAt', 'creadoEn', 'borrado'];
  const parametros = [id, ...claves.map((c) => valores[c]), marca, marca, 0];
  await db
    .prepare(
      `INSERT INTO ${tabla} (${columnas.join(', ')})
       VALUES (${columnas.map(() => '?').join(', ')})`,
    )
    .bind(...parametros)
    .run();
  return { aplicado: true };
}

/**
 * Importa una instantánea entera, que es como se siembra la base con lo que ya
 * había en JSONBin. Respeta la regla de última escritura, de modo que lanzarla
 * dos veces no deshace nada de lo que se haya hecho entretanto.
 */
export async function importarInstantanea(db, instantanea) {
  const resumen = {};

  for (const tabla of NOMBRES) {
    const lista = instantanea?.tables?.[tabla];
    if (!Array.isArray(lista) || !lista.length) continue;

    let aplicados = 0;
    for (const fila of lista) {
      const { id, updatedAt, ...campos } = fila;
      const resultado = await aplicarCambio(db, {
        tabla,
        id,
        op: 'upsert',
        campos,
        updatedAt: updatedAt || ahoraISO(),
      });
      if (resultado.aplicado) aplicados += 1;
    }
    resumen[tabla] = aplicados;
  }

  // Las lápidas del modelo anterior se traducen a borrados del nuevo.
  for (const lapida of instantanea?.tombstones ?? []) {
    if (!existeTabla(lapida.table)) continue;
    await aplicarCambio(db, {
      tabla: lapida.table,
      id: lapida.rowId,
      op: 'borrar',
      updatedAt: lapida.ts || ahoraISO(),
    });
  }

  return resumen;
}

export { TABLAS, NOMBRES };

// ---------------------------------------------------------------------------
// Configuración del servidor (hoy: la IA)
// ---------------------------------------------------------------------------

/**
 * La clave de la IA vive aquí y **no vuelve entera**: de la de verdad solo
 * salen sus cuatro últimos caracteres y cuándo se guardó, que es lo justo para
 * reconocer cuál está puesta sin poder copiarla de la pantalla de nadie. Es la
 * regla de `garciadoral-ops`, y el motivo de que la llamada al modelo salga del
 * Worker: una credencial de pago no viaja a un móvil.
 */
export async function leerConfiguracionIA(db) {
  const { results } = await db
    .prepare("SELECT clave, valor, actualizadoEn FROM configuracion WHERE clave LIKE 'ia.%'")
    .all();
  const filas = new Map((results || []).map((f) => [f.clave, f]));
  const clave = filas.get('ia.clave');
  return {
    clave: clave?.valor || '',
    guardadaEn: clave?.actualizadoEn || null,
    modelo: filas.get('ia.modelo')?.valor || 'claude-sonnet-4-5',
    // Lo que se le pide a ese modelo, por encargo. Reescribible desde Ajustes;
    // sin nada guardado, el de origen (`encargos.js`).
    encargos: encargosDe(filas),
    // Y **con qué modelo** se le pide cada cosa: la clave es de la instalación,
    // el modelo no tiene por qué (§14.16-quinquies).
    modelos: modelosDe(filas, filas.get('ia.modelo')?.valor || 'claude-sonnet-4-5'),
  };
}

/** Lo que se le puede enseñar a un administrador. */
export function configuracionIAPublica(configuracion) {
  return {
    hayClave: Boolean(configuracion.clave),
    cola: configuracion.clave ? configuracion.clave.slice(-4) : '',
    guardadaEn: configuracion.guardadaEn,
    modelo: configuracion.modelo,
    // Los encargos no son secretos —son el texto que se va a poder editar—, así
    // que salen enteros, con su rótulo y su pista.
    encargos: encargosPublicos(configuracion.encargos, configuracion.modelos, configuracion.modelo),
  };
}

export async function guardarConfiguracionIA(db, campos = {}) {
  const ahora = ahoraISO();
  for (const [nombre, valor] of Object.entries(campos)) {
    if (valor === undefined || valor === null) continue;
    await db
      .prepare(
        `INSERT INTO configuracion (clave, valor, actualizadoEn) VALUES (?, ?, ?)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizadoEn = excluded.actualizadoEn`,
      )
      .bind(`ia.${nombre}`, String(valor), ahora)
      .run();
  }
}

// ---------------------------------------------------------------------------
// Recados: la tanda de frases de cada evento (SPECS §14.24)
// ---------------------------------------------------------------------------

/**
 * La tanda vive en la misma tabla `configuracion`, con la clave `recados:<id>`.
 *
 * No lleva el prefijo `ia.` **a propósito**: `leerConfiguracionIA` se lleva todo
 * lo que empieza por ahí, y una tanda de bromas no es configuración de nadie.
 * Tampoco hace falta tabla nueva ni migración: es un valor por evento que se
 * puede tirar entero sin perder nada.
 */
const claveDeRecados = (eventId) => `recados:${eventId}`;

/** Lo guardado, o `null` si no hay nada o si está roto. */
export async function leerRecadosGuardados(db, eventId) {
  const fila = await db
    .prepare('SELECT valor, actualizadoEn FROM configuracion WHERE clave = ?')
    .bind(claveDeRecados(eventId))
    .first();
  if (!fila?.valor) return null;
  try {
    const recados = JSON.parse(fila.valor);
    if (!Array.isArray(recados) || !recados.length) return null;
    return { recados, generadoEn: fila.actualizadoEn };
  } catch {
    return null;
  }
}

/** Guarda la tanda con su hora, que es lo que decide si sigue sirviendo. */
export async function guardarRecados(db, eventId, recados) {
  const ahora = ahoraISO();
  await db
    .prepare(
      `INSERT INTO configuracion (clave, valor, actualizadoEn) VALUES (?, ?, ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizadoEn = excluded.actualizadoEn`,
    )
    .bind(claveDeRecados(eventId), JSON.stringify(recados), ahora)
    .run();
  return ahora;
}

// ---------------------------------------------------------------------------
// Avisos: a qué aparatos hay que empujar
// ---------------------------------------------------------------------------

/**
 * Apunta el token de APNs de este aparato.
 *
 * El mismo token puede aparecer en otra fila si alguien se fue y entró otro en
 * el mismo teléfono: se limpia antes de escribirlo, porque un token duplicado
 * significa avisar dos veces a un aparato y, peor, avisar de lo de otro.
 */
export async function guardarTokenPush(db, { dispositivoId, cuentaId, plataforma, tokenPush }) {
  if (tokenPush) {
    await db.prepare('UPDATE dispositivo SET tokenPush = NULL WHERE tokenPush = ? AND id != ?')
      .bind(tokenPush, dispositivoId).run();
  }
  await db
    .prepare(
      `INSERT INTO dispositivo (id, cuentaId, plataforma, tokenPush, avisos)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET cuentaId = excluded.cuentaId,
                                     plataforma = COALESCE(excluded.plataforma, dispositivo.plataforma),
                                     tokenPush = excluded.tokenPush`,
    )
    .bind(dispositivoId, cuentaId, plataforma || null, tokenPush || null)
    .run();
}

/** Deja de avisar a este aparato, sin borrarlo: el permiso se retira en el
 *  teléfono y se vuelve a conceder ahí mismo. */
export async function silenciarDispositivo(db, dispositivoId, avisos) {
  await db.prepare('UPDATE dispositivo SET avisos = ? WHERE id = ?')
    .bind(avisos ? 1 : 0, dispositivoId).run();
}

/** Un token muerto no se reintenta: se borra y el teléfono se vuelve a dar de
 *  alta solo la próxima vez que abra (ver `apns.js`). */
export async function olvidarTokenPush(db, tokenPush) {
  await db.prepare('UPDATE dispositivo SET tokenPush = NULL WHERE tokenPush = ?').bind(tokenPush).run();
}

/** Los aparatos de una cuenta, para mandarle un aviso a quien lo pide. */
export async function tokensDeCuenta(db, cuentaId) {
  return filas(
    db,
    `SELECT tokenPush AS token FROM dispositivo
      WHERE cuentaId = ? AND avisos = 1 AND tokenPush IS NOT NULL AND tokenPush != ''`,
    cuentaId,
  ).then((f) => f.map((x) => x.token));
}

/** Los aparatos de quien administra, que son los que reciben las peticiones de
 *  acceso. Sin token o silenciados no cuentan. */
export async function tokensDeAdministradores(db) {
  return filas(
    db,
    `SELECT d.tokenPush AS token
       FROM dispositivo d
       JOIN cuenta c ON c.id = d.cuentaId
      WHERE c.rol = 'administrador' AND c.activa = 1
        AND d.avisos = 1 AND d.tokenPush IS NOT NULL AND d.tokenPush != ''`,
  ).then((f) => f.map((x) => x.token));
}
