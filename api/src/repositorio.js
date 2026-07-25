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
export async function crearCuenta(db, { id, appleSub, nombre = '', email = null, rol = null }) {
  const primera = !(await hayAlgunaCuenta(db));
  const cuenta = {
    id,
    appleSub,
    nombre,
    email,
    rol: rol || (primera ? 'administrador' : 'miembro'),
    activa: 1,
    creadoEn: ahoraISO(),
  };
  await db
    .prepare(
      `INSERT INTO cuenta (id, appleSub, nombre, email, rol, activa, creadoEn)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(cuenta.id, cuenta.appleSub, cuenta.nombre, cuenta.email, cuenta.rol, 1, cuenta.creadoEn)
    .run();
  return cuenta;
}

export function listarCuentas(db) {
  return filas(db, 'SELECT id, nombre, email, rol, activa, creadoEn, ultimoAcceso FROM cuenta ORDER BY creadoEn');
}

export async function anotarAcceso(db, cuentaId) {
  await db.prepare('UPDATE cuenta SET ultimoAcceso = ? WHERE id = ?').bind(ahoraISO(), cuentaId).run();
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
