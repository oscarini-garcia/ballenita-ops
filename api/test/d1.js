/**
 * Adaptador mínimo de D1 sobre `node:sqlite`, para poder probar el repositorio
 * contra el esquema de verdad en lugar de contra un doble de mentira.
 *
 * D1 y `node:sqlite` hablan SQLite las dos; lo único que difiere es la forma de
 * la interfaz (`bind().all()` frente a `all(...args)`) y que la de D1 es
 * asíncrona. Awaitar un valor que no es promesa funciona igual, así que el
 * adaptador puede ser síncrono por dentro.
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

class Sentencia {
  constructor(sqlite, sql) {
    this.sqlite = sqlite;
    this.sql = sql;
    this.parametros = [];
  }

  bind(...parametros) {
    this.parametros = parametros;
    return this;
  }

  first() {
    return this.sqlite.prepare(this.sql).get(...this.parametros) ?? null;
  }

  all() {
    return { results: this.sqlite.prepare(this.sql).all(...this.parametros) };
  }

  run() {
    return this.sqlite.prepare(this.sql).run(...this.parametros);
  }
}

class BaseDeDatos {
  constructor(sqlite) {
    this.sqlite = sqlite;
  }

  prepare(sql) {
    return new Sentencia(this.sqlite, sql);
  }
}

/**
 * Base en memoria con **todas** las migraciones aplicadas, en orden.
 *
 * Antes cargaba solo `0001_esquema.sql`, y con eso una migración nueva no la
 * probaba nadie: la suite pasaba en verde con un esquema que ya no era el que
 * hay en producción.
 */
export function baseDePrueba() {
  const sqlite = new DatabaseSync(':memory:');
  const dir = fileURLToPath(new URL('../migraciones/', import.meta.url));
  for (const fichero of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(dir + fichero, 'utf8'));
  }
  return new BaseDeDatos(sqlite);
}
