import test from 'node:test';
import assert from 'node:assert/strict';

import { baseDePrueba } from './d1.js';
import { crearCuenta, cuentaPorId, enlazarCuentaConPersona } from '../src/repositorio.js';
import {
  emitirPaseDeEspera, emitirSesion, verificarPaseDeEspera, verificarSesion,
} from '../src/sesion.js';
import trabajador from '../src/index.js';

const SECRETO = 'un secreto de pruebas suficientemente largo';

const entorno = (db) => ({ DB: db, SESION_SECRETO: SECRETO });

const preguntar = (env, pase) => trabajador.fetch(
  new Request('https://api.test/api/sesion/espera', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pase }),
  }),
  env,
);

const nueva = (db, extra = {}) => crearCuenta(db, {
  id: `cta_${Math.random().toString(16).slice(2)}`,
  appleSub: `sub_${Math.random()}`,
  ...extra,
});

// ── El pase, como papel ──────────────────────────────────────────────────────

test('un pase recién emitido dice de qué cuenta es', async () => {
  const pase = await emitirPaseDeEspera(SECRETO, 'cta_1');
  assert.equal(await verificarPaseDeEspera(SECRETO, pase), 'cta_1');
});

test('un pase firmado con otro secreto se rechaza', async () => {
  const pase = await emitirPaseDeEspera(SECRETO, 'cta_1');
  await assert.rejects(() => verificarPaseDeEspera('otro secreto distinto', pase), /firma/i);
});

// Las dos direcciones del mismo cierre: los dos papeles se firman con el mismo
// secreto, así que sin la marca de `tipo` cada uno valdría como el otro — y el
// pase se le da precisamente a quien todavía no tiene acceso.
test('un pase de espera no sirve como sesión', async () => {
  const pase = await emitirPaseDeEspera(SECRETO, 'cta_1');
  await assert.rejects(() => verificarSesion(SECRETO, pase), /no es una sesión/i);
});

test('una sesión no sirve como pase de espera', async () => {
  const token = await emitirSesion(SECRETO, { id: 'cta_1', rol: 'miembro' }, 'ios');
  await assert.rejects(() => verificarPaseDeEspera(SECRETO, token), /no es un pase/i);
});

test('un pase caducado se rechaza aunque la firma sea buena', async () => {
  const original = Date.now;
  Date.now = () => original() - 1000 * 60 * 60 * 24 * 31; // emitido hace 31 días
  const pase = await emitirPaseDeEspera(SECRETO, 'cta_1');
  Date.now = original;

  await assert.rejects(() => verificarPaseDeEspera(SECRETO, pase), /caducada/i);
});

// ── La ruta ──────────────────────────────────────────────────────────────────

test('quien sigue esperando recibe «espera» y su nombre, no una sesión', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Óscar' });
  const espera = await nueva(db, { nombre: 'Ana Doral', activa: 0 });

  const respuesta = await preguntar(entorno(db), await emitirPaseDeEspera(SECRETO, espera.id));
  const cuerpo = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(cuerpo.estado, 'espera');
  assert.equal(cuerpo.nombre, 'Ana Doral');
  assert.equal(cuerpo.token, undefined);
});

test('en cuanto le enlazan, el mismo pase devuelve la sesión', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Óscar' });
  const espera = await nueva(db, { nombre: 'Ana Doral', activa: 0 });
  const pase = await emitirPaseDeEspera(SECRETO, espera.id);

  assert.equal((await (await preguntar(entorno(db), pase)).json()).estado, 'espera');

  await enlazarCuentaConPersona(db, espera.id, 'per_ana');

  const cuerpo = await (await preguntar(entorno(db), pase)).json();
  assert.equal(cuerpo.estado, 'dentro');
  assert.equal(cuerpo.cuenta.nombre, 'Ana Doral');

  // Y lo que devuelve es una sesión de verdad, de esa cuenta.
  const sesion = await verificarSesion(SECRETO, cuerpo.token);
  assert.equal(sesion.sub, espera.id);
});

test('preguntar deja apuntado el acceso, como entrar por la puerta', async () => {
  const db = baseDePrueba();
  const cuenta = await nueva(db, { nombre: 'Óscar' });
  const antes = (await cuentaPorId(db, cuenta.id)).ultimoAcceso ?? null;

  await preguntar(entorno(db), await emitirPaseDeEspera(SECRETO, cuenta.id));

  assert.notEqual((await cuentaPorId(db, cuenta.id)).ultimoAcceso ?? null, antes);
});

test('a quien le han cerrado la puerta se le dice, y no se le deja entrar', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Óscar' });
  const cuenta = await nueva(db, { nombre: 'Ana' });
  // Enlazada —así que ya no está esperando— y luego apagada a propósito, que es
  // lo que distingue «todavía no te toca» de «te han cerrado la puerta».
  await enlazarCuentaConPersona(db, cuenta.id, 'per_ana');
  await db.prepare('UPDATE cuenta SET activa = 0 WHERE id = ?').bind(cuenta.id).run();

  const cuerpo = await (await preguntar(entorno(db), await emitirPaseDeEspera(SECRETO, cuenta.id))).json();
  assert.equal(cuerpo.estado, 'desactivada');
  assert.equal(cuerpo.token, undefined);
});

// Si la cuenta se elimina mientras espera, el móvil tiene que olvidar el pase y
// volver a la puerta en vez de seguir preguntando por algo que ya no existe.
test('si la cuenta ya no existe, se dice y no se revienta', async () => {
  const db = baseDePrueba();
  const cuerpo = await (await preguntar(entorno(db), await emitirPaseDeEspera(SECRETO, 'cta_fantasma'))).json();
  assert.equal(cuerpo.estado, 'desconocida');
});

test('un pase inventado no abre nada', async () => {
  const db = baseDePrueba();
  const respuesta = await preguntar(entorno(db), 'esto.no.esunpase');
  assert.equal(respuesta.status, 401);
});
