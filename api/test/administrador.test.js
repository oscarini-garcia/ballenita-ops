import test from 'node:test';
import assert from 'node:assert/strict';

import { baseDePrueba } from './d1.js';
import { ADMINISTRADOR, esCorreoDelAdministrador, esNombreDelAdministrador } from '../src/administrador.js';
import {
  crearCuenta, cuentaPorId, eliminarCuenta, enlazarCuentaConPersona, promoverCuentaAAdministrador,
} from '../src/repositorio.js';
import { emitirPaseDeEspera, verificarSesion } from '../src/sesion.js';
import trabajador from '../src/index.js';

const SECRETO = 'un secreto de pruebas suficientemente largo';

const nueva = (db, extra = {}) => crearCuenta(db, {
  id: `cta_${Math.random().toString(16).slice(2)}`,
  appleSub: `sub_${Math.random()}`,
  ...extra,
});

const sembrarEvento = async (db, id, demo = false) => {
  await db
    .prepare('INSERT OR IGNORE INTO events (id, name, esDemo, updatedAt, creadoEn) VALUES (?, ?, ?, ?, ?)')
    .bind(id, 'Viaje', demo ? 1 : 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
    .run();
};

const sembrarPersona = async (db, { id, nombre, eventId = 'evt_1', demo = false }) => {
  await sembrarEvento(db, eventId, demo);
  await db
    .prepare('INSERT INTO persons (id, eventId, name, updatedAt, creadoEn) VALUES (?, ?, ?, ?, ?)')
    .bind(id, eventId, nombre, '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')
    .run();
};

const preguntar = (db, pase) => trabajador.fetch(
  new Request('https://api.test/api/sesion/espera', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pase }),
  }),
  { DB: db, SESION_SECRETO: SECRETO },
);

// ── El correo, como llave ────────────────────────────────────────────────────

test('el correo del administrador se reconoce sin mirar mayúsculas ni espacios', () => {
  assert.equal(esCorreoDelAdministrador(ADMINISTRADOR.correo), true);
  assert.equal(esCorreoDelAdministrador(` ${ADMINISTRADOR.correo.toUpperCase()} `), true);
});

test('cualquier otro correo, o ninguno, no es la llave', () => {
  assert.equal(esCorreoDelAdministrador('otro@gmail.com'), false);
  assert.equal(esCorreoDelAdministrador(''), false);
  assert.equal(esCorreoDelAdministrador(null), false);
  assert.equal(esCorreoDelAdministrador(undefined), false);
});

test('el nombre se reconoce sin tildes, que es como lo guarda Apple', () => {
  assert.equal(esNombreDelAdministrador(ADMINISTRADOR.nombre), true);
  assert.equal(esNombreDelAdministrador('Oscar Garcia Chillon'), true);
  assert.equal(esNombreDelAdministrador('  oscar  garcía chillón '), true);
  assert.equal(esNombreDelAdministrador('Óscar'), false);
  assert.equal(esNombreDelAdministrador('Otra Persona'), false);
  assert.equal(esNombreDelAdministrador(''), false);
});

// ── El ascenso ───────────────────────────────────────────────────────────────

test('el ascenso abre la puerta, pone el rol y enlaza con su persona', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Primera' }); // que la siguiente no nazca administradora
  await sembrarPersona(db, { id: 'per_oscar', nombre: ADMINISTRADOR.nombre });
  const espera = await nueva(db, { nombre: 'Óscar', email: ADMINISTRADOR.correo, activa: 0 });

  const dentro = await promoverCuentaAAdministrador(db, espera.id);

  assert.equal(dentro.rol, 'administrador');
  assert.equal(dentro.activa, 1);
  assert.equal(dentro.personId, 'per_oscar');
});

test('vale el nombre de pila, pero el nombre completo gana', async () => {
  const db = baseDePrueba();
  await sembrarPersona(db, { id: 'per_pila', nombre: 'Óscar' });
  const soloPila = await nueva(db, { activa: 0 });
  assert.equal((await promoverCuentaAAdministrador(db, soloPila.id)).personId, 'per_pila');

  await sembrarPersona(db, { id: 'per_completo', nombre: ADMINISTRADOR.nombre });
  const conCompleto = await nueva(db, { activa: 0 });
  assert.equal((await promoverCuentaAAdministrador(db, conCompleto.id)).personId, 'per_completo');
});

test('una persona del Demo no cuenta, y sin persona se entra igual', async () => {
  const db = baseDePrueba();
  await sembrarPersona(db, { id: 'per_demo', nombre: ADMINISTRADOR.nombre, eventId: 'evt_demo', demo: true });
  const cuenta = await nueva(db, { activa: 0 });

  const dentro = await promoverCuentaAAdministrador(db, cuenta.id);

  assert.equal(dentro.personId ?? null, null);
  assert.equal(dentro.rol, 'administrador');
  assert.equal(dentro.activa, 1);
});

test('un enlace que ya existe no se pisa', async () => {
  const db = baseDePrueba();
  await sembrarPersona(db, { id: 'per_oscar', nombre: ADMINISTRADOR.nombre });
  const cuenta = await nueva(db, {});
  await enlazarCuentaConPersona(db, cuenta.id, 'per_otro');
  await db.prepare('UPDATE cuenta SET activa = 0 WHERE id = ?').bind(cuenta.id).run();

  assert.equal((await promoverCuentaAAdministrador(db, cuenta.id)).personId, 'per_otro');
});

// ── La sala de espera, con la llave puesta ───────────────────────────────────

test('el administrador esperando entra en el siguiente sondeo, sin volver por Apple', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Primera' });
  await sembrarPersona(db, { id: 'per_oscar', nombre: ADMINISTRADOR.nombre });
  const espera = await nueva(db, { nombre: 'Óscar', email: ADMINISTRADOR.correo, activa: 0 });

  const cuerpo = await (await preguntar(db, await emitirPaseDeEspera(SECRETO, espera.id))).json();

  assert.equal(cuerpo.estado, 'dentro');
  assert.equal(cuerpo.cuenta.rol, 'administrador');
  assert.equal((await verificarSesion(SECRETO, cuerpo.token)).rol, 'administrador');
  assert.equal((await cuentaPorId(db, espera.id)).personId, 'per_oscar');
});

test('la persona se encuentra aunque en el grupo esté escrita sin tilde', async () => {
  const db = baseDePrueba();
  await sembrarPersona(db, { id: 'per_sintilde', nombre: 'Oscar' });
  const cuenta = await nueva(db, { activa: 0 });

  assert.equal((await promoverCuentaAAdministrador(db, cuenta.id)).personId, 'per_sintilde');
});

test('sin ningún administrador activo, el nombre —aun sin tildes— también es llave', async () => {
  const db = baseDePrueba();
  const primera = await nueva(db, { nombre: 'Primera' }); // nace administradora…
  await sembrarPersona(db, { id: 'per_oscar', nombre: ADMINISTRADOR.nombre });
  const espera = await nueva(db, {
    nombre: 'Oscar Garcia Chillon', email: 'relé@privaterelay.appleid.com', activa: 0,
  });
  await eliminarCuenta(db, primera.id); // …y se da de baja: el cerrojo de verdad

  const cuerpo = await (await preguntar(db, await emitirPaseDeEspera(SECRETO, espera.id))).json();

  assert.equal(cuerpo.estado, 'dentro');
  assert.equal(cuerpo.cuenta.rol, 'administrador');
  assert.equal((await cuentaPorId(db, espera.id)).personId, 'per_oscar');
});

test('con un administrador activo dentro, el nombre solo no abre', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Primera' }); // administradora activa
  const espera = await nueva(db, {
    nombre: 'Oscar Garcia Chillon', email: 'relé@privaterelay.appleid.com', activa: 0,
  });

  const cuerpo = await (await preguntar(db, await emitirPaseDeEspera(SECRETO, espera.id))).json();

  assert.equal(cuerpo.estado, 'espera');
  assert.equal(cuerpo.token, undefined);
  assert.equal((await cuentaPorId(db, espera.id)).rol, 'miembro');
});

test('con otro correo, la sala de espera sigue siendo la sala de espera', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Primera' });
  const espera = await nueva(db, { nombre: 'Ana', email: 'ana@ejemplo.com', activa: 0 });

  const cuerpo = await (await preguntar(db, await emitirPaseDeEspera(SECRETO, espera.id))).json();

  assert.equal(cuerpo.estado, 'espera');
  assert.equal(cuerpo.token, undefined);
  assert.equal((await cuentaPorId(db, espera.id)).rol, 'miembro');
});
