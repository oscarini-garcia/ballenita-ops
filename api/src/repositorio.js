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
import { ADMINISTRADOR, normalizarNombre } from './administrador.js';

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

/**
 * ¿Queda alguien que pueda abrir la sala de espera? Es la guarda de la llave
 * débil del administrador (ver `administrador.js`): el nombre solo cuenta
 * cuando la respuesta es que no.
 */
export async function hayAdministradorActivo(db) {
  const fila = await db
    .prepare("SELECT COUNT(*) AS total FROM cuenta WHERE rol = 'administrador' AND activa = 1")
    .first();
  return (fila?.total ?? 0) > 0;
}

/**
 * La persona del grupo que es el administrador, para enlazarle solo.
 *
 * Se busca por nombre en los eventos de verdad —el Demo es arena— admitiendo el
 * nombre completo o el de pila, y prefiriendo el completo; a igualdad, la fila
 * más reciente. La comparación se hace aquí y no en SQL porque va **sin
 * tildes** (`normalizarNombre`): en el grupo puede estar escrito «Oscar», y
 * `LIKE` no sabe que es el mismo nombre. Puede no haber ninguna (una base
 * recién sembrada): entonces se entra sin persona y se elige después en
 * Ajustes → Cuentas, como cualquiera.
 */
export async function personaDelAdministrador(db) {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.name FROM persons p
        JOIN events e ON e.id = p.eventId
       WHERE p.borrado = 0 AND e.borrado = 0 AND e.esDemo = 0
       ORDER BY p.updatedAt DESC`,
    )
    .all();
  const personas = results || [];
  const completo = normalizarNombre(ADMINISTRADOR.nombre);
  const pila = completo.split(' ')[0];
  return (
    personas.find((p) => normalizarNombre(p.name) === completo)
    || personas.find((p) => normalizarNombre(p.name) === pila)
    || personas.find((p) => normalizarNombre(p.name).startsWith(`${pila} `))
    || null
  );
}

/**
 * Asciende una cuenta a administradora y le abre la puerta, enlazándola con su
 * persona si la encuentra. Es la salida del cerrojo de la sala de espera (ver
 * `administrador.js`): quién merece el ascenso lo decide el que llama, que es
 * quien tiene delante el correo verificado del token de Apple.
 *
 * Un enlace que ya exista no se toca: si su persona está puesta —da igual por
 * qué camino—, cambiársela por una búsqueda por nombre solo puede empeorarla.
 */
export async function promoverCuentaAAdministrador(db, cuentaId) {
  const persona = await personaDelAdministrador(db);
  await db
    .prepare("UPDATE cuenta SET rol = 'administrador', activa = 1, personId = COALESCE(personId, ?) WHERE id = ?")
    .bind(persona?.id ?? null, cuentaId)
    .run();
  return cuentaPorId(db, cuentaId);
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
/**
 * ¿Es «esa tabla no existe todavía»? D1 no da código de error, solo el texto.
 *
 * Se distingue a propósito de cualquier otro fallo de la base: una tabla que
 * falta es **la ventana entre desplegar y migrar** y se sabe cómo tratarla; un
 * error de verdad tiene que seguir reventando, porque devolver una lista vacía
 * en su lugar sería decirle al móvil que el grupo no tiene gastos.
 */
const esTablaQueFalta = (error) => /no such table/i.test(String(error?.message ?? error));

/**
 * La instantánea entera del grupo.
 *
 * **Una tabla que aún no existe no puede tumbar la sincronización de todos.**
 * El Worker se publica solo en cada entrada a `main` y las migraciones se
 * aplican **a mano** (§14.23), así que entre las dos cosas hay una ventana —
 * minutos si alguien está mirando, días si no— en la que este `SELECT` nombra
 * tablas que todavía no están. Antes eso lanzaba, `Promise.all` lo propagaba y
 * `/api/sync` y `/api/cambios` contestaban 500: la app entera dejaba de
 * sincronizar para el grupo entero, y desde el móvil eso se lee como que se ha
 * roto todo. Pasó con la tanda de §14.52–§14.60, que trajo cuatro tablas.
 *
 * Ahora la tabla que falta llega vacía —que es exactamente lo que hay en ella—
 * y sale en `faltan`, para que quien administra vea en Ajustes → Actualizar que
 * la base va por detrás en vez de tener que deducirlo de un 500.
 */
export async function leerInstantanea(db) {
  const tables = {};
  const faltan = [];

  const lecturas = await Promise.all(NOMBRES.map(async (tabla) => {
    try {
      return [tabla, await filas(db, `SELECT * FROM ${tabla} WHERE borrado = 0`)];
    } catch (error) {
      if (!esTablaQueFalta(error)) throw error;
      faltan.push(tabla);
      return [tabla, []];
    }
  }));

  for (const [tabla, resultado] of lecturas) {
    tables[tabla] = resultado.map((fila) => filaAObjeto(tabla, fila));
  }

  return faltan.length ? { v: 1, tables, faltan } : { v: 1, tables };
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
      return { aplicado: true, anterior, nuevo: false };
    }
    const asignaciones = claves.map((c) => `${c} = ?`).join(', ');
    await db
      .prepare(`UPDATE ${tabla} SET ${asignaciones}, updatedAt = ?, borrado = 0 WHERE id = ?`)
      .bind(...claves.map((c) => valores[c]), marca, id)
      .run();
    // La fila de antes viaja de vuelta: es lo único con lo que quien llama puede
    // saber si **cambió** el estado de alguien, y volver a leerla después sería
    // leer justo lo que se acaba de escribir.
    return { aplicado: true, anterior, nuevo: false };
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
  return { aplicado: true, anterior: null, nuevo: true };
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
// Recados: la tanda de frases de cada evento (SPECS §14.25)
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
export async function tokensDeAdministradores(db, { clase = null, exceptoCuentaId = null } = {}) {
  const f = await filas(
    db,
    // `c.*` y no `c.avisosClases`: nombrar la columna hace que **toda** la
    // consulta reviente mientras la migración 0014 no esté aplicada, y con ella
    // se caían hasta los avisos que ya funcionaban. Sin nombrarla, la columna
    // que falta llega como `undefined`, que es el caso que ya estaba escrito:
    // lo que no está dicho, está encendido.
    `SELECT d.tokenPush AS token, c.*
       FROM dispositivo d
       JOIN cuenta c ON c.id = d.cuentaId
      WHERE c.rol = 'administrador' AND c.activa = 1
        AND d.avisos = 1 AND d.tokenPush IS NOT NULL AND d.tokenPush != ''`,
  );
  return filtrarPorClase(f, { clase, exceptoCuentaId });
}

// ------------------------------------------- Qué avisos quiere cada cuenta --

/**
 * Las clases apagadas a mano, y nada más (migración 0014).
 *
 * Se guarda lo **apagado** y no lo encendido a propósito: así una clase nueva
 * llega encendida a todo el mundo sin tener que tocar ninguna fila. Guardando la
 * lista de las que sí, cada aviso que se inventara nacería apagado para los que
 * ya estaban, que es la forma más silenciosa de que una función no exista.
 */
export function clasesDeAviso(crudo) {
  try {
    const puesto = typeof crudo === 'string' ? JSON.parse(crudo) : (crudo || {});
    return puesto && typeof puesto === 'object' ? puesto : {};
  } catch {
    return {};
  }
}

/** ¿Le interesa a esta cuenta esta clase de aviso? Lo que no está dicho, sí. */
export const quiereLaClase = (crudo, clase) => clasesDeAviso(crudo)[clase] !== false;

/** Las que ha apagado, para pintarlas en Ajustes. */
export async function avisosDeCuenta(db, cuentaId) {
  // Sin nombrar la columna, por lo mismo: leer las preferencias no puede romper
  // por una migración que todavía no se ha aplicado. Escribirlas sí la necesita,
  // y ahí el error se ve en su sitio (la pantalla de Ajustes lo enseña).
  const fila = await db.prepare('SELECT * FROM cuenta WHERE id = ?').bind(cuentaId).first();
  return clasesDeAviso(fila?.avisosClases);
}

export async function guardarAvisosDeCuenta(db, cuentaId, clases) {
  // Solo se guarda lo apagado: `{estado: true}` no aporta nada y engorda la fila
  // con la respuesta por defecto.
  const apagadas = Object.fromEntries(
    Object.entries(clases || {}).filter(([, quiere]) => quiere === false),
  );
  await db.prepare('UPDATE cuenta SET avisosClases = ? WHERE id = ?')
    .bind(Object.keys(apagadas).length ? JSON.stringify(apagadas) : null, cuentaId)
    .run();
  return apagadas;
}

/**
 * El filtro común: fuera quien apagó la clase, y fuera quien lo provocó.
 *
 * Las filas llegan con `c.*`, así que la cuenta es `id` y sus preferencias son
 * `avisosClases` —que puede no venir si la migración 0014 no está aplicada, y
 * entonces `quiereLaClase` contesta que sí, que es lo correcto—.
 */
function filtrarPorClase(f, { clase, exceptoCuentaId }) {
  return f
    .filter((x) => !exceptoCuentaId || x.id !== exceptoCuentaId)
    .filter((x) => !clase || quiereLaClase(x.avisosClases, clase))
    .map((x) => x.token);
}

/**
 * A qué aparatos les toca un aviso de los que nacen de un cambio.
 *
 * `personIds` acota a quién le interesa —a quién le mueve el saldo un gasto, por
 * ejemplo—; sin lista, es de todo el grupo. **`exceptoCuentaId` no es opcional
 * en la práctica**: quien apunta un gasto no necesita que su propio teléfono le
 * cuente que lo ha apuntado, y avisarse a uno mismo es lo primero que hace que
 * se apaguen los avisos enteros.
 */
export async function tokensParaAviso(db, { clase, personIds = null, exceptoCuentaId = null }) {
  const f = await filas(
    db,
    `SELECT d.tokenPush AS token, c.*
       FROM dispositivo d
       JOIN cuenta c ON c.id = d.cuentaId
      WHERE c.activa = 1 AND c.personId IS NOT NULL
        AND d.avisos = 1 AND d.tokenPush IS NOT NULL AND d.tokenPush != ''`,
  );
  const acotado = personIds ? f.filter((x) => personIds.includes(x.personId)) : f;
  return filtrarPorClase(acotado, { clase, exceptoCuentaId });
}
