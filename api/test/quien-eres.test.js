import test from 'node:test';
import assert from 'node:assert/strict';

import { baseDePrueba } from './d1.js';
import { crearCuenta, enlazarCuentaConPersona } from '../src/repositorio.js';
import { emitirPaseDeEspera, emitirSesion } from '../src/sesion.js';
import trabajador from '../src/index.js';

const SECRETO = 'un secreto de pruebas suficientemente largo';
const entorno = (db) => ({ DB: db, SESION_SECRETO: SECRETO });

const nueva = (db, extra = {}) => crearCuenta(db, {
  id: `cta_${Math.random().toString(16).slice(2)}`,
  appleSub: `sub_${Math.random()}`,
  ...extra,
});

const pedir = (db, camino, opciones = {}) => trabajador.fetch(
  new Request(`https://api.test${camino}`, {
    headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
    ...opciones,
  }),
  entorno(db),
);

// La cuenta viaja con lo que el móvil ya pide (SPECS §14.41): el `personId` es
// lo que siembra «quién eres» en el aparato, y tiene que llegar también a quien
// ya estaba dentro cuando le enlazaron — o sea, con la instantánea.

test('al salir de la sala de espera, la sesión dice con qué persona vas', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Primera' });
  const espera = await nueva(db, { nombre: 'Mariona', activa: 0 });
  await enlazarCuentaConPersona(db, espera.id, 'per_mariona');

  const respuesta = await pedir(db, '/api/sesion/espera', {
    method: 'POST',
    body: JSON.stringify({ pase: await emitirPaseDeEspera(SECRETO, espera.id) }),
  });
  const cuerpo = await respuesta.json();

  assert.equal(cuerpo.estado, 'dentro');
  assert.equal(cuerpo.cuenta.personId, 'per_mariona');
});

test('la instantánea lleva la cuenta al lado, con su persona', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Primera' });
  const cuenta = await nueva(db, { nombre: 'Mariona' });
  await enlazarCuentaConPersona(db, cuenta.id, 'per_mariona');

  const respuesta = await pedir(db, '/api/sync', {
    headers: { Authorization: `Bearer ${await emitirSesion(SECRETO, cuenta, 'ios')}` },
  });
  const cuerpo = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.ok(cuerpo.tables, 'la instantánea sigue siendo la instantánea');
  assert.equal(cuerpo.cuenta.personId, 'per_mariona');
  assert.equal(cuerpo.cuenta.rol, 'miembro');
});

test('la respuesta de la cola de cambios también la lleva', async () => {
  const db = baseDePrueba();
  const cuenta = await nueva(db, { nombre: 'Mariona' });
  await enlazarCuentaConPersona(db, cuenta.id, 'per_mariona');

  const respuesta = await pedir(db, '/api/cambios', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await emitirSesion(SECRETO, cuenta, 'ios')}` },
    body: JSON.stringify({ cambios: [] }),
  });
  const cuerpo = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(cuerpo.cuenta.personId, 'per_mariona');
});

test('una cuenta sin enlazar dice personId nulo, no lo esconde', async () => {
  const db = baseDePrueba();
  const cuenta = await nueva(db, { nombre: 'Primera' });

  const respuesta = await pedir(db, '/api/sync', {
    headers: { Authorization: `Bearer ${await emitirSesion(SECRETO, cuenta, 'ios')}` },
  });
  const cuerpo = await respuesta.json();

  assert.equal('personId' in cuerpo.cuenta, true);
  assert.equal(cuerpo.cuenta.personId, null);
});
