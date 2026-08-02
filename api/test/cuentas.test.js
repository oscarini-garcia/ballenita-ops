import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseDePrueba } from './d1.js';
import {
  crearCuenta, cuentaPorId, eliminarCuenta, enlazarCuentaConPersona, listarCuentas,
} from '../src/repositorio.js';

const nueva = (db, extra = {}) =>
  crearCuenta(db, { id: `cta_${Math.random().toString(16).slice(2)}`, appleSub: `sub_${Math.random()}`, ...extra });

test('la primera cuenta nace administradora y activa', async () => {
  const db = baseDePrueba();
  const primera = await nueva(db, { nombre: 'Óscar' });
  assert.equal(primera.rol, 'administrador');
  assert.equal(primera.activa, 1);
});

test('una solicitud nace inactiva, sin persona y con el nombre que da Apple', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Óscar' });
  const espera = await nueva(db, { nombre: 'Curro García', activa: 0 });

  assert.equal(espera.rol, 'miembro');
  assert.equal(espera.activa, 0);

  const guardada = await cuentaPorId(db, espera.id);
  assert.equal(guardada.nombre, 'Curro García');
  assert.equal(guardada.personId ?? null, null);
});

test('enlazar con una persona es lo que abre la puerta', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Óscar' });
  const espera = await nueva(db, { nombre: 'Curro', activa: 0 });

  await enlazarCuentaConPersona(db, espera.id, 'per_curro');

  const dentro = await cuentaPorId(db, espera.id);
  assert.equal(dentro.personId, 'per_curro');
  assert.equal(dentro.activa, 1);
});

test('desenlazar la devuelve a la sala de espera', async () => {
  const db = baseDePrueba();
  const cuenta = await nueva(db, { nombre: 'Curro' });
  await enlazarCuentaConPersona(db, cuenta.id, 'per_curro');
  await enlazarCuentaConPersona(db, cuenta.id, null);

  const fuera = await cuentaPorId(db, cuenta.id);
  assert.equal(fuera.personId ?? null, null);
  assert.equal(fuera.activa, 0);
});

test('la lista dice con qué persona está enlazada cada cuenta', async () => {
  const db = baseDePrueba();
  const a = await nueva(db, { nombre: 'Óscar' });
  await enlazarCuentaConPersona(db, a.id, 'per_oscar');
  await nueva(db, { nombre: 'Quien sea', activa: 0 });

  const lista = await listarCuentas(db);
  assert.equal(lista.length, 2);
  assert.equal(lista.find((c) => c.id === a.id).personId, 'per_oscar');
  assert.equal(lista.find((c) => c.nombre === 'Quien sea').personId ?? null, null);
});

test('eliminar se lleva la cuenta y sus dispositivos', async () => {
  const db = baseDePrueba();
  const cuenta = await nueva(db, { nombre: 'Fuera' });
  await db.prepare('INSERT INTO dispositivo (id, cuentaId, plataforma) VALUES (?, ?, ?)')
    .bind('disp_1', cuenta.id, 'ios').run();

  await eliminarCuenta(db, cuenta.id);

  assert.equal(await cuentaPorId(db, cuenta.id), null);
  const { results } = await db.prepare('SELECT id FROM dispositivo WHERE cuentaId = ?').bind(cuenta.id).all();
  assert.equal(results.length, 0);
});

test('la clave de la IA entra pero no vuelve entera', async () => {
  const { configuracionIAPublica, guardarConfiguracionIA, leerConfiguracionIA } = await import('../src/repositorio.js');
  const db = baseDePrueba();

  await guardarConfiguracionIA(db, { clave: 'sk-ant-secreta-1234', modelo: 'claude-opus-4-5' });
  const guardada = await leerConfiguracionIA(db);
  assert.equal(guardada.clave, 'sk-ant-secreta-1234');
  assert.equal(guardada.modelo, 'claude-opus-4-5');

  const publica = configuracionIAPublica(guardada);
  assert.equal(publica.hayClave, true);
  assert.equal(publica.cola, '1234');
  assert.ok(!('clave' in publica));
  assert.ok(publica.guardadaEn);
});

test('sin clave puesta, lo público lo dice y no inventa cola', async () => {
  const { configuracionIAPublica, leerConfiguracionIA } = await import('../src/repositorio.js');
  const publica = configuracionIAPublica(await leerConfiguracionIA(baseDePrueba()));
  assert.equal(publica.hayClave, false);
  assert.equal(publica.cola, '');
  assert.equal(publica.modelo, 'claude-sonnet-4-5');
});
