import test from 'node:test';
import assert from 'node:assert/strict';

import { coincideEnTiempoConstante, emitirSesion, verificarSesion } from '../src/sesion.js';

const SECRETO = 'un secreto de pruebas suficientemente largo';
const CUENTA = { id: 'cta_1', rol: 'administrador' };

test('una sesión recién emitida se verifica y conserva quién es', async () => {
  const token = await emitirSesion(SECRETO, CUENTA, 'ios');
  const datos = await verificarSesion(SECRETO, token);

  assert.equal(datos.sub, 'cta_1');
  assert.equal(datos.rol, 'administrador');
  assert.equal(datos.plataforma, 'ios');
});

test('una sesión firmada con otro secreto se rechaza', async () => {
  const token = await emitirSesion(SECRETO, CUENTA, 'web');
  await assert.rejects(() => verificarSesion('otro secreto distinto', token), /firma/i);
});

test('un token manipulado se rechaza', async () => {
  const token = await emitirSesion(SECRETO, CUENTA, 'web');
  const [cabecera, , firma] = token.split('.');
  const cuerpoFalso = Buffer.from(JSON.stringify({ sub: 'cta_intruso', rol: 'administrador', exp: 9e9 }))
    .toString('base64url');

  await assert.rejects(() => verificarSesion(SECRETO, `${cabecera}.${cuerpoFalso}.${firma}`), /firma/i);
});

test('una sesión caducada se rechaza aunque la firma sea buena', async () => {
  const original = Date.now;
  Date.now = () => original() - 1000 * 60 * 60 * 24 * 365; // emitida hace un año
  const token = await emitirSesion(SECRETO, CUENTA, 'web');
  Date.now = original;

  await assert.rejects(() => verificarSesion(SECRETO, token), /caducada/i);
});

test('un token con forma inválida se rechaza sin reventar', async () => {
  for (const basura of ['', 'no-es-un-token', 'a.b', null, undefined]) {
    await assert.rejects(() => verificarSesion(SECRETO, basura), /mal formada/i);
  }
});

test('la comparación en tiempo constante distingue igual que la normal', () => {
  assert.equal(coincideEnTiempoConstante('secreto', 'secreto'), true);
  assert.equal(coincideEnTiempoConstante('secreto', 'secretO'), false);
  assert.equal(coincideEnTiempoConstante('secreto', 'secreto-mas-largo'), false);
  assert.equal(coincideEnTiempoConstante('', ''), true);
  assert.equal(coincideEnTiempoConstante(null, undefined), true, 'ambos vacíos');
});
