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
import { readFileSync } from 'node:fs';
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

/** Base en memoria con el esquema de `migraciones/0001_esquema.sql` aplicado. */
export function baseDePrueba() {
  const sqlite = new DatabaseSync(':memory:');
  const esquema = readFileSync(
    fileURLToPath(new URL('../migraciones/0001_esquema.sql', import.meta.url)),
    'utf8',
  );
  sqlite.exec(esquema);
  return new BaseDeDatos(sqlite);
}
