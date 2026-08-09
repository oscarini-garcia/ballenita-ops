import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseDePrueba } from './d1.js';
import {
  avisosDeCuenta, clasesDeAviso, crearCuenta, enlazarCuentaConPersona, guardarAvisosDeCuenta,
  guardarTokenPush, quiereLaClase, silenciarDispositivo, tokensDeAdministradores, tokensParaAviso,
} from '../src/repositorio.js';

/**
 * Contra el esquema de verdad: quién acaba recibiendo cada aviso es una consulta
 * con cuatro condiciones —cuenta activa, con persona, aparato con permiso, y la
 * clase encendida— y una de menos no se nota hasta que suena un teléfono que no
 * debía.
 */
let n = 0;
const nueva = (db, extra = {}) =>
  crearCuenta(db, { id: `cta_${++n}`, appleSub: `sub_${n}`, ...extra });

async function conAparato(db, cuenta, token) {
  await guardarTokenPush(db, {
    dispositivoId: `disp_${cuenta.id}`, cuentaId: cuenta.id, plataforma: 'ios', tokenPush: token,
  });
}

test('lo que no está apagado, está encendido', () => {
  assert.equal(quiereLaClase(null, 'estado'), true);
  assert.equal(quiereLaClase('{}', 'estado'), true);
  assert.equal(quiereLaClase('{"estado":false}', 'estado'), false);
  assert.equal(quiereLaClase('{"estado":false}', 'dinero'), true);
  // Un JSON roto no apaga nada: preferimos avisar de más que callar por un
  // carácter suelto en una columna.
  assert.deepEqual(clasesDeAviso('esto no es json'), {});
});

test('solo se guarda lo apagado, para que una clase nueva llegue encendida', async () => {
  const db = baseDePrueba();
  const cuenta = await nueva(db, { nombre: 'Óscar' });

  await guardarAvisosDeCuenta(db, cuenta.id, { estado: false, dinero: true });
  assert.deepEqual(await avisosDeCuenta(db, cuenta.id), { estado: false });

  // Y volver a encenderlo deja la fila limpia, no un `{"estado":true}`.
  await guardarAvisosDeCuenta(db, cuenta.id, { estado: true });
  assert.deepEqual(await avisosDeCuenta(db, cuenta.id), {});
});

test('a quien apagó la clase no se le manda, y a quien no la tocó sí', async () => {
  const db = baseDePrueba();
  const admin = await nueva(db, { nombre: 'Óscar' });
  const otra = await nueva(db, { nombre: 'Ana' });
  await enlazarCuentaConPersona(db, admin.id, 'p1');
  await enlazarCuentaConPersona(db, otra.id, 'p2');
  await conAparato(db, admin, 'tok_admin');
  await conAparato(db, otra, 'tok_ana');

  assert.deepEqual((await tokensParaAviso(db, { clase: 'estado' })).sort(), ['tok_admin', 'tok_ana']);

  await guardarAvisosDeCuenta(db, otra.id, { estado: false });
  assert.deepEqual(await tokensParaAviso(db, { clase: 'estado' }), ['tok_admin']);
  // Y solo esa clase: apagar los estados no apaga el dinero.
  assert.deepEqual((await tokensParaAviso(db, { clase: 'dinero' })).sort(), ['tok_admin', 'tok_ana']);
});

/** «Yo, al ser admin, también me llegan los míos.» */
test('nunca se avisa a la cuenta que lo provocó', async () => {
  const db = baseDePrueba();
  const admin = await nueva(db, { nombre: 'Óscar' });
  const otra = await nueva(db, { nombre: 'Ana' });
  await enlazarCuentaConPersona(db, admin.id, 'p1');
  await enlazarCuentaConPersona(db, otra.id, 'p2');
  await conAparato(db, admin, 'tok_admin');
  await conAparato(db, otra, 'tok_ana');

  assert.deepEqual(
    await tokensParaAviso(db, { clase: 'estado', exceptoCuentaId: admin.id }),
    ['tok_ana'],
  );
  // Y también en el aviso de quien administra, que es donde se vio el defecto.
  assert.deepEqual(
    await tokensDeAdministradores(db, { clase: 'solicitud', exceptoCuentaId: admin.id }),
    [],
  );
});

test('acotar por personas deja fuera a quien no le toca', async () => {
  const db = baseDePrueba();
  const admin = await nueva(db, { nombre: 'Óscar' });
  const otra = await nueva(db, { nombre: 'Ana' });
  await enlazarCuentaConPersona(db, admin.id, 'p1');
  await enlazarCuentaConPersona(db, otra.id, 'p2');
  await conAparato(db, admin, 'tok_admin');
  await conAparato(db, otra, 'tok_ana');

  assert.deepEqual(await tokensParaAviso(db, { clase: 'dinero', personIds: ['p2'] }), ['tok_ana']);
});

test('un aparato silenciado en iOS no recibe nada, aunque quiera la clase', async () => {
  const db = baseDePrueba();
  const cuenta = await nueva(db, { nombre: 'Óscar' });
  await enlazarCuentaConPersona(db, cuenta.id, 'p1');
  await conAparato(db, cuenta, 'tok');

  await silenciarDispositivo(db, `disp_${cuenta.id}`, false);
  assert.deepEqual(await tokensParaAviso(db, { clase: 'dinero' }), []);
});

test('una cuenta sin persona no recibe avisos de cambios: no se sabe qué le toca', async () => {
  const db = baseDePrueba();
  await nueva(db, { nombre: 'Óscar' }); // administradora, para que la siguiente no lo sea
  const espera = await nueva(db, { nombre: 'Curro', activa: 1 });
  await conAparato(db, espera, 'tok_curro');

  assert.deepEqual(await tokensParaAviso(db, { clase: 'dinero' }), []);
});
