/**
 * Poner la base al día desde el propio Worker (SPECS §14.23).
 *
 * Las migraciones siguen sin lanzarse solas —van cuando alguien las pide—,
 * pero ya no exigen un portátil: quien administra ve en Ajustes → Actualizar
 * cuándo la base va por detrás del código y las aplica desde ahí, una a una y
 * viendo el progreso. Antes el único camino era `wrangler` o la consola de D1,
 * y el día que se mergeaba una tabla nueva con el móvil en la mano, la API
 * desplegaba sola y la base se quedaba atrás hasta llegar a un ordenador.
 *
 * No hay tabla de contabilidad de migraciones, a propósito: la base ya existía
 * con nueve aplicadas a mano y ninguna apuntada, y una contabilidad que nace
 * mintiendo hay que sembrarla. En su lugar se mira **el esquema de verdad**:
 * todas las sentencias de `migraciones/` son de tres formas —`CREATE TABLE IF
 * NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` y `ALTER TABLE … ADD COLUMN`— y
 * las tres declaran qué crean, así que «¿está aplicada?» es «¿existe su tabla,
 * su índice o su columna?». El test vigila que ninguna migración futura traiga
 * una forma nueva sin pasar por aquí.
 *
 * Aplicar también va sentencia a sentencia y **salta las que ya están**: una
 * base a medio migrar —la columna sí, la tabla no— se termina en vez de
 * atascarse en el `duplicate column` de la primera.
 */

import { MIGRACIONES } from './migraciones.js';

/**
 * Las sentencias de un fichero, sin comentarios y sin líneas vacías.
 *
 * Se quitan **todas** las líneas de comentario, también las sangradas de
 * dentro de un CREATE TABLE: el corte por `;` es a lo bruto, y hay un
 * comentario en `0001` con un punto y coma dentro que partiría la sentencia
 * por la mitad si se quedara.
 */
export function sentencias(sql) {
  return sql
    .split('\n')
    .map((linea) => (linea.trimStart().startsWith('--') ? '' : linea))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Qué crea una sentencia: `{ tabla }`, `{ tabla, columna }` o `{ indice }`.
 *
 * Devuelve `null` ante una forma desconocida. El test convierte ese `null` en
 * un fallo de la suite: una migración con `UPDATE` o `DROP` no se puede
 * decidir mirando el esquema, y ese día hay que decidir aquí cómo se trata,
 * no descubrirlo en producción.
 */
export function objetivo(sentencia) {
  const tabla = sentencia.match(/^CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
  if (tabla) return { tabla: tabla[1] };
  const indice = sentencia.match(/^CREATE INDEX IF NOT EXISTS\s+(\w+)/i);
  if (indice) return { indice: indice[1] };
  const columna = sentencia.match(/^ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)/i);
  if (columna) return { tabla: columna[1], columna: columna[2] };
  return null;
}

async function hayTabla(db, tabla) {
  const fila = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind(tabla)
    .first();
  return Boolean(fila);
}

async function hayColumna(db, tabla, columna) {
  if (!(await hayTabla(db, tabla))) return false;
  // El nombre viene de nuestro propio SQL, nunca de una petición, y un PRAGMA
  // no admite parámetros: interpolarlo aquí es seguro y es la única forma.
  const { results } = await db.prepare(`PRAGMA table_info(${tabla})`).all();
  return (results || []).some((c) => c.name === columna);
}

async function hayIndice(db, indice) {
  const fila = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
    .bind(indice)
    .first();
  return Boolean(fila);
}

async function yaEsta(db, sentencia) {
  const que = objetivo(sentencia);
  if (!que) return false;
  if (que.indice) return hayIndice(db, que.indice);
  return que.columna ? hayColumna(db, que.tabla, que.columna) : hayTabla(db, que.tabla);
}

/**
 * Qué migraciones conoce el código y cuáles le faltan a esta base, en el orden
 * de los ficheros. No toca las tablas del grupo: funciona igual con la base
 * por detrás, que es exactamente cuándo hace falta.
 */
export async function estadoDeMigraciones(db) {
  const estado = [];
  for (const migracion of MIGRACIONES) {
    const lista = sentencias(migracion.sql);
    let faltan = 0;
    for (const s of lista) if (!(await yaEsta(db, s))) faltan += 1;
    estado.push({ id: migracion.id, pendiente: faltan > 0, sentencias: lista.length, faltan });
  }
  return estado;
}

/**
 * Aplica **una** migración, saltando lo que ya esté. Una a una a propósito: el
 * móvil pide la siguiente en bucle y así el progreso que enseña es el de
 * verdad, no un rótulo que parpadea delante de una única petición larga.
 */
export async function aplicarMigracion(db, id) {
  const migracion = MIGRACIONES.find((m) => m.id === id);
  if (!migracion) throw new Error(`migración desconocida: ${id}`);

  let ejecutadas = 0;
  let saltadas = 0;
  for (const s of sentencias(migracion.sql)) {
    if (await yaEsta(db, s)) { saltadas += 1; continue; }
    try {
      await db.prepare(s).run();
    } catch (error) {
      // Con la sentencia delante: «no such table» sin saber cuál era la orden
      // obliga a reproducirlo en la consola de D1, que es lo que se evita.
      throw new Error(`${id}: ${String(error.message ?? error)} — ${s.slice(0, 80)}`);
    }
    ejecutadas += 1;
  }
  return { id, ejecutadas, saltadas };
}
