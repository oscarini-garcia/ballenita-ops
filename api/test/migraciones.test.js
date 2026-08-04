import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import { baseDePrueba } from './d1.js';
import worker from '../src/index.js';
import { MIGRACIONES } from '../src/migraciones.js';
import { aplicarMigracion, estadoDeMigraciones, objetivo, sentencias } from '../src/migrador.js';
import { crearCuenta } from '../src/repositorio.js';
import { emitirSesion } from '../src/sesion.js';

const dir = fileURLToPath(new URL('../migraciones/', import.meta.url));

/** El adaptador de `d1.js`, pero sobre una base vacía o a medias. */
class Sentencia {
  constructor(sqlite, sql) { this.sqlite = sqlite; this.sql = sql; this.parametros = []; }
  bind(...parametros) { this.parametros = parametros; return this; }
  first() { return this.sqlite.prepare(this.sql).get(...this.parametros) ?? null; }
  all() { return { results: this.sqlite.prepare(this.sql).all(...this.parametros) }; }
  run() { return this.sqlite.prepare(this.sql).run(...this.parametros); }
}
function baseVacia() {
  const sqlite = new DatabaseSync(':memory:');
  return { prepare: (sql) => new Sentencia(sqlite, sql), sqlite };
}

test('lo generado coincide con el directorio de migraciones, fichero a fichero', () => {
  const ficheros = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  assert.deepEqual(
    MIGRACIONES.map((m) => m.id),
    ficheros.map((f) => f.replace(/\.sql$/, '')),
    'falta regenerar: npm run generar:migraciones',
  );
  for (const [i, fichero] of ficheros.entries()) {
    assert.equal(MIGRACIONES[i].sql, readFileSync(dir + fichero, 'utf8'),
      `${fichero} no coincide con lo generado: npm run generar:migraciones`);
  }
});

test('todas las sentencias declaran qué crean; una forma nueva obliga a decidir', () => {
  for (const migracion of MIGRACIONES) {
    for (const s of sentencias(migracion.sql)) {
      assert.ok(objetivo(s),
        `${migracion.id}: el migrador no sabe decidir si «${s.slice(0, 60)}…» está aplicada`);
    }
  }
});

test('sobre una base vacía las aplica todas en orden, y el esquema queda como el de la suite', async () => {
  const db = baseVacia();

  let estado = await estadoDeMigraciones(db);
  assert.ok(estado.every((m) => m.pendiente), 'una base vacía lo tiene todo pendiente');

  // Como las pedirá el móvil: la siguiente, en bucle, hasta que no quede nada.
  let vueltas = 0;
  while (estado.some((m) => m.pendiente)) {
    const siguiente = estado.find((m) => m.pendiente);
    const resultado = await aplicarMigracion(db, siguiente.id);
    assert.ok(resultado.ejecutadas > 0, `${siguiente.id} no ejecutó nada y seguía pendiente`);
    estado = await estadoDeMigraciones(db);
    vueltas += 1;
    assert.ok(vueltas <= MIGRACIONES.length, 'el bucle no converge');
  }

  // El resultado tiene que ser el mismo esquema que deja la suite aplicando
  // los ficheros a pelo: mismas tablas y mismas columnas en cada una.
  const nombres = (sq) => sq
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all().map((t) => t.name);
  const patron = baseDePrueba();
  assert.deepEqual(nombres(db.sqlite), nombres(patron.sqlite));
  for (const tabla of nombres(patron.sqlite)) {
    assert.deepEqual(
      db.sqlite.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name),
      patron.sqlite.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name),
      `las columnas de ${tabla} no coinciden`,
    );
  }
});

test('una base a medias se termina en vez de atascarse en el duplicate column', async () => {
  const db = baseVacia();
  // Todas menos la última: es la situación de siempre al mergear una migración,
  // con la base como estaba y el código ya con la nueva. **Cuál es la última se
  // pregunta al directorio** y no se escribe aquí: escrita, este test se rompe
  // cada vez que se añade una, que es justo cuando más falta hace que pase.
  const ficheros = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const fichero of ficheros.slice(0, -1)) db.sqlite.exec(readFileSync(dir + fichero, 'utf8'));
  const ultima = ficheros[ficheros.length - 1].replace(/\.sql$/, '');

  const antes = await estadoDeMigraciones(db);
  assert.deepEqual(antes.filter((m) => m.pendiente).map((m) => m.id), [ultima]);

  // Y aunque una sentencia suelta ya estuviera —media migración aplicada a
  // mano—, aplicar salta lo hecho y ejecuta el resto.
  const resultado = await aplicarMigracion(db, ultima);
  assert.ok(resultado.ejecutadas > 0);
  const despues = await estadoDeMigraciones(db);
  assert.ok(despues.every((m) => !m.pendiente));

  const otraVez = await aplicarMigracion(db, ultima);
  assert.equal(otraVez.ejecutadas, 0);
  assert.ok(otraVez.saltadas > 0);
});

test('la ruta es de administradores: el resto recibe un 403 y sin sesión no se entra', async () => {
  const db = baseDePrueba();
  const env = { DB: db, SESION_SECRETO: 'secreto-de-prueba' };

  const admin = await crearCuenta(db, { id: 'cta_admin', appleSub: 'sub_admin' }); // la primera nace administradora
  const raso = await crearCuenta(db, { id: 'cta_raso', appleSub: 'sub_raso' });

  const sinSesion = await worker.fetch(new Request('https://api.example/api/migraciones'), env);
  assert.equal(sinSesion.status, 401);

  const deRaso = await worker.fetch(new Request('https://api.example/api/migraciones', {
    headers: { Authorization: `Bearer ${await emitirSesion(env.SESION_SECRETO, raso, 'ios')}` },
  }), env);
  assert.equal(deRaso.status, 403);

  const deAdmin = await worker.fetch(new Request('https://api.example/api/migraciones', {
    headers: { Authorization: `Bearer ${await emitirSesion(env.SESION_SECRETO, admin, 'ios')}` },
  }), env);
  assert.equal(deAdmin.status, 200);
  const { migraciones } = await deAdmin.json();
  assert.equal(migraciones.length, MIGRACIONES.length);
  assert.ok(migraciones.every((m) => !m.pendiente), 'la base de la suite está al día');

  // Y con todo al día, el POST no aplica nada y lo dice.
  const alDia = await worker.fetch(new Request('https://api.example/api/migraciones', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await emitirSesion(env.SESION_SECRETO, admin, 'ios')}` },
  }), env);
  assert.deepEqual(await alDia.json(), { aplicada: null, pendientes: [] });
});
