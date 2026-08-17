/**
 * El enlace de acceso: entrar sin iPhone (SPECS §14.61).
 *
 * Lo que se prueba aquí no es que el pase funcione —eso es la firma de siempre,
 * ya probada en `sesion.test.js`— sino las tres cosas que lo hacen distinto de
 * los otros dos papeles, porque este **abre la puerta** y va por WhatsApp: que
 * se quema al canjearlo, que generar otro invalida el anterior, y que ni una
 * sesión vale de enlace ni un enlace vale de sesión.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { baseDePrueba } from './d1.js';
import { crearCuenta, cuentaPorId, listarCuentas } from '../src/repositorio.js';
import {
  emitirPaseDeEnlace, emitirSesion, verificarPaseDeEnlace, verificarSesion,
} from '../src/sesion.js';
import trabajador from '../src/index.js';

const SECRETO = 'un secreto de pruebas suficientemente largo';

const entorno = (db) => ({ DB: db, SESION_SECRETO: SECRETO });

const nueva = (db, extra = {}) => crearCuenta(db, {
  id: `cta_${Math.random().toString(16).slice(2)}`,
  appleSub: `sub_${Math.random()}`,
  ...extra,
});

/** Lo que hace quien administra: pedir el enlace de una persona. */
const generar = (env, token, personId, nombre = '') => trabajador.fetch(
  new Request('https://api.test/api/cuentas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ accion: 'enlace', personId, nombre }),
  }),
  env,
);

/** Lo que hace el navegador al abrir el enlace. */
const canjear = (env, pase) => trabajador.fetch(
  new Request('https://api.test/api/sesion/enlace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pase }),
  }),
  env,
);

/** Un administrador con su sesión, que es de donde salen los enlaces. */
async function conAdministrador() {
  const db = baseDePrueba();
  const admin = await nueva(db, { nombre: 'Óscar' });
  const token = await emitirSesion(SECRETO, admin, 'ios');
  return { db, env: entorno(db), admin, token };
}

// ── El pase, como papel ──────────────────────────────────────────────────────

test('un pase de enlace dice de qué cuenta es y cuál es', async () => {
  const pase = await emitirPaseDeEnlace(SECRETO, 'cta_1', 'jti_1');
  assert.deepEqual(await verificarPaseDeEnlace(SECRETO, pase), { cuentaId: 'cta_1', jti: 'jti_1' });
});

test('un pase de enlace no sirve como sesión', async () => {
  const pase = await emitirPaseDeEnlace(SECRETO, 'cta_1', 'jti_1');
  await assert.rejects(() => verificarSesion(SECRETO, pase), /no es una sesión/i);
});

test('una sesión no sirve como pase de enlace', async () => {
  const token = await emitirSesion(SECRETO, { id: 'cta_1', rol: 'miembro' }, 'ios');
  await assert.rejects(() => verificarPaseDeEnlace(SECRETO, token), /no es un pase de enlace/i);
});

test('un pase de enlace firmado con otro secreto se rechaza', async () => {
  const pase = await emitirPaseDeEnlace(SECRETO, 'cta_1', 'jti_1');
  await assert.rejects(() => verificarPaseDeEnlace('otro secreto distinto', pase), /firma/i);
});

// ── Generarlo ────────────────────────────────────────────────────────────────

test('generar un enlace crea la cuenta de quien nunca ha podido entrar', async () => {
  const { db, env, token } = await conAdministrador();

  const respuesta = await generar(env, token, 'per_curro', 'Curro García');
  assert.equal(respuesta.status, 200);
  const { pase, id } = await respuesta.json();

  const cuenta = await cuentaPorId(db, id);
  assert.equal(cuenta.nombre, 'Curro García');
  assert.equal(cuenta.personId, 'per_curro');
  assert.equal(cuenta.activa, 1);
  assert.equal(cuenta.rol, 'miembro');
  // La cuenta existe sin haber pasado nunca por Apple, y se distingue.
  assert.match(cuenta.appleSub, /^enlace:/);
  assert.equal((await verificarPaseDeEnlace(SECRETO, pase)).cuentaId, id);
});

test('generar dos veces para la misma persona no deja dos cuentas', async () => {
  const { db, env, token } = await conAdministrador();

  const primera = await (await generar(env, token, 'per_curro', 'Curro')).json();
  const segunda = await (await generar(env, token, 'per_curro', 'Curro')).json();

  assert.equal(primera.id, segunda.id);
  assert.equal((await listarCuentas(db)).length, 2); // el administrador y Curro
});

test('solo quien administra genera enlaces', async () => {
  const { db, env } = await conAdministrador();
  const miembro = await nueva(db, { nombre: 'Curro', rol: 'miembro' });
  const suyo = await emitirSesion(SECRETO, miembro, 'ios');

  assert.equal((await generar(env, suyo, 'per_ana')).status, 403);
});

test('sin persona no se genera nada: un enlace sin dueño no dice quién entra', async () => {
  const { env, token } = await conAdministrador();
  assert.equal((await generar(env, token, null)).status, 400);
});

test('a una cuenta desactivada a propósito no se le abre otra puerta', async () => {
  const { db, env, token } = await conAdministrador();
  const cerrada = await nueva(db, { nombre: 'Curro', activa: 0, personId: 'per_curro' });
  assert.ok(cerrada.id);

  const respuesta = await generar(env, token, 'per_curro');
  assert.equal(respuesta.status, 400);
  assert.match((await respuesta.json()).error, /desactivada/i);
});

// ── Canjearlo ────────────────────────────────────────────────────────────────

test('el enlace canjea una sesión de las de siempre', async () => {
  const { db, env, token } = await conAdministrador();
  const { pase, id } = await (await generar(env, token, 'per_curro', 'Curro')).json();

  const respuesta = await canjear(env, pase);
  assert.equal(respuesta.status, 200);
  const dentro = await respuesta.json();

  assert.equal(dentro.estado, 'dentro');
  assert.equal(dentro.cuenta.personId, 'per_curro');
  const sesion = await verificarSesion(SECRETO, dentro.token);
  assert.equal(sesion.sub, id);
  // Entra por el navegador, y el servidor lo apunta.
  assert.equal(sesion.plataforma, 'web');
  assert.ok((await cuentaPorId(db, id)).ultimoAcceso);
});

/**
 * **El mismo enlace vale las veces que haga falta** (SPECS §14.61-bis).
 *
 * Era de un solo uso, y lo que eso tiraba abajo no eran ataques sino el camino
 * normal: abrirlo dos veces, mirarlo en el móvil y luego en el portátil, o que
 * la vista previa de WhatsApp lo estrene antes que su dueño. El que se quedaba
 * fuera era quien no tiene iPhone, o sea justo aquel para quien existe esto.
 */
test('el mismo enlace vale las veces que haga falta', async () => {
  const { env, token } = await conAdministrador();
  const { pase } = await (await generar(env, token, 'per_curro', 'Curro')).json();

  for (let i = 0; i < 3; i += 1) {
    const respuesta = await canjear(env, pase);
    assert.equal(respuesta.status, 200, `el intento ${i + 1} tenía que entrar`);
    assert.equal((await respuesta.json()).estado, 'dentro');
  }
});

test('generar otro invalida el anterior, que es cómo se revoca', async () => {
  const { env, token } = await conAdministrador();
  const viejo = (await (await generar(env, token, 'per_curro', 'Curro')).json()).pase;
  const nuevo = (await (await generar(env, token, 'per_curro', 'Curro')).json()).pase;

  const conElViejo = await canjear(env, viejo);
  assert.equal(conElViejo.status, 401);
  assert.equal((await conElViejo.json()).estado, 'caducado');

  assert.equal((await canjear(env, nuevo)).status, 200);
});

/**
 * Y revocar sigue funcionando **después** de que lo hayan usado, que es cuando
 * de verdad hace falta: mientras era de un solo uso, un enlace ya canjeado se
 * revocaba solo y esto no se podía ni probar.
 */
test('generar otro revoca el anterior aunque ya se hubiera usado', async () => {
  const { env, token } = await conAdministrador();
  const viejo = (await (await generar(env, token, 'per_curro', 'Curro')).json()).pase;
  assert.equal((await canjear(env, viejo)).status, 200);

  await generar(env, token, 'per_curro', 'Curro');

  const otraVez = await canjear(env, viejo);
  assert.equal(otraVez.status, 401);
  assert.equal((await otraVez.json()).estado, 'caducado');
});

test('un pase caducado se rechaza aunque la firma sea buena, y lo dice', async () => {
  const { db, env } = await conAdministrador();
  const cuenta = await nueva(db, { nombre: 'Curro', personId: 'per_curro' });

  const original = Date.now;
  Date.now = () => original() - 1000 * 60 * 60 * 24 * 4; // emitido hace cuatro días
  const pase = await emitirPaseDeEnlace(SECRETO, cuenta.id, 'jti_1');
  Date.now = original;

  const respuesta = await canjear(env, pase);
  assert.equal(respuesta.status, 401);
  const dicho = await respuesta.json();
  assert.equal(dicho.estado, 'no-vale');
  assert.match(dicho.mensaje, /caducado/i);
});

test('un pase inventado no entra', async () => {
  const { env } = await conAdministrador();
  const respuesta = await canjear(env, 'esto.no.esunpase');
  assert.equal(respuesta.status, 401);
  assert.equal((await respuesta.json()).estado, 'no-vale');
});

// Un pase sin `jti` contra una cuenta sin enlace vivo son dos vacíos, y
// comparar vacío con vacío da igual: sin esta guarda, cualquiera con el id de
// una cuenta y el secreto roto entraría por la puerta de los que no se
// generaron nunca.
test('un pase sin jti no entra en una cuenta sin enlace vivo', async () => {
  const { db, env } = await conAdministrador();
  const cuenta = await nueva(db, { nombre: 'Curro', personId: 'per_curro' });
  const pase = await emitirPaseDeEnlace(SECRETO, cuenta.id, undefined);

  const respuesta = await canjear(env, pase);
  assert.equal(respuesta.status, 401);
  assert.equal((await respuesta.json()).estado, 'caducado');
});

test('si le cierran la puerta entre medias, el enlace no la abre', async () => {
  const { db, env, token } = await conAdministrador();
  const { pase, id } = await (await generar(env, token, 'per_curro', 'Curro')).json();

  await db.prepare('UPDATE cuenta SET activa = 0 WHERE id = ?').bind(id).run();

  const respuesta = await canjear(env, pase);
  assert.equal(respuesta.status, 403);
  assert.equal((await respuesta.json()).estado, 'desactivada');
});

/**
 * `enlaceVivo` contesta **si hay una credencial suelta que abre esta cuenta**, y
 * ya no «si le queda uno sin usar»: desde §14.61-bis canjearlo no lo quema, así
 * que sin la fecha la pastilla se quedaría puesta para siempre — también con el
 * enlace caducado hace meses, que es peor que no tenerla porque miente.
 */
test('la lista dice quién entra por enlace y quién tiene uno suelto', async () => {
  const { db, env, token } = await conAdministrador();
  const { pase, id } = await (await generar(env, token, 'per_curro', 'Curro')).json();

  const antes = (await listarCuentas(db)).find((c) => c.id === id);
  assert.equal(antes.porEnlace, 1);
  assert.equal(antes.enlaceVivo, 1);

  // Usarlo **no** lo apaga: el enlace sigue por ahí y sigue abriendo.
  await canjear(env, pase);
  assert.equal((await listarCuentas(db)).find((c) => c.id === id).enlaceVivo, 1);

  // Lo que lo apaga es que caduque.
  await db.prepare('UPDATE cuenta SET enlaceExpira = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000) - 60, id).run();
  assert.equal((await listarCuentas(db)).find((c) => c.id === id).enlaceVivo, 0);
});
