import test from 'node:test';
import assert from 'node:assert/strict';

import { baseDePrueba } from './d1.js';
import {
  administradoresRestantes, anotarDispositivo, crearCuenta, cuentaPorApple, cuentaPorId,
  darDeBajaCuenta, leerInstantanea, aplicarCambio,
} from '../src/repositorio.js';
import { hayRevocacionConfigurada, revocarEnApple } from '../src/revocacion.js';

/**
 * La baja de la cuenta, que es lo que exige la directriz 5.1.1(v) de la App
 * Store. Lo que se prueba aquí no es la comodidad: es que **se vaya de verdad**
 * lo que identifica a una persona y que **no se vaya** lo que es del grupo, que
 * son las dos maneras de hacer esto mal.
 */

// ---------------------------------------------------------------------------
// Qué se va y qué se queda
// ---------------------------------------------------------------------------

test('la baja elimina la cuenta y sus dispositivos', async () => {
  const db = baseDePrueba();
  await crearCuenta(db, { id: 'cta_1', appleSub: '000123.abc', nombre: 'Curro', email: 'curro@ejemplo.es' });
  await anotarDispositivo(db, { id: 'disp_1', cuentaId: 'cta_1', plataforma: 'ios' });
  await anotarDispositivo(db, { id: 'disp_2', cuentaId: 'cta_1', plataforma: 'ios' });

  await darDeBajaCuenta(db, 'cta_1');

  assert.equal(await cuentaPorId(db, 'cta_1'), null);
  // El identificador de Apple tampoco puede quedarse marcado: una fila con
  // `borrado = 1` seguiría guardando el `sub` de quien ha pedido que se le
  // olvide, que es justo lo contrario de lo que pide la directriz.
  assert.equal(await cuentaPorApple(db, '000123.abc'), null);
  const { results } = await db.prepare('SELECT * FROM dispositivo WHERE cuentaId = ?').bind('cta_1').all();
  assert.equal(results.length, 0);
});

test('la baja no toca los hechos del grupo', async () => {
  const db = baseDePrueba();
  await crearCuenta(db, { id: 'cta_1', appleSub: '000123.abc', nombre: 'Curro' });
  await aplicarCambio(db, {
    tabla: 'expenses',
    id: 'exp_1',
    op: 'upsert',
    campos: { eventId: 'ev_1', description: 'Gasolina ida', amountCents: 6000 },
    updatedAt: '2026-08-09T10:00:00.000Z',
  });

  await darDeBajaCuenta(db, 'cta_1');

  // Los gastos son del grupo, no de la cuenta: borrarlos descuadraría los saldos
  // de todos los demás, que siguen debiendo o cobrando ese mismo dinero.
  const { tables } = await leerInstantanea(db);
  assert.equal(tables.expenses.length, 1);
  assert.equal(tables.expenses[0].description, 'Gasolina ida');
});

test('irse dos veces no revienta', async () => {
  const db = baseDePrueba();
  await crearCuenta(db, { id: 'cta_1', appleSub: '000123.abc' });
  await darDeBajaCuenta(db, 'cta_1');
  await darDeBajaCuenta(db, 'cta_1');
  assert.equal(await cuentaPorId(db, 'cta_1'), null);
});

// ---------------------------------------------------------------------------
// El aviso de que el grupo se queda sin administración
// ---------------------------------------------------------------------------

test('administradoresRestantes cuenta las activas sin contar a quien se va', async () => {
  const db = baseDePrueba();
  await crearCuenta(db, { id: 'cta_1', appleSub: 'a', rol: 'administrador' });
  await crearCuenta(db, { id: 'cta_2', appleSub: 'b', rol: 'administrador' });
  await crearCuenta(db, { id: 'cta_3', appleSub: 'c', rol: 'miembro' });

  assert.equal(await administradoresRestantes(db, 'cta_1'), 1);
  assert.equal(await administradoresRestantes(db, 'cta_3'), 2);
});

test('una administradora desactivada no cuenta como administración restante', async () => {
  const db = baseDePrueba();
  await crearCuenta(db, { id: 'cta_1', appleSub: 'a', rol: 'administrador' });
  await crearCuenta(db, { id: 'cta_2', appleSub: 'b', rol: 'administrador' });
  await db.prepare('UPDATE cuenta SET activa = 0 WHERE id = ?').bind('cta_2').run();

  // Que se vaya la última administradora es legítimo —impedirlo incumpliría la
  // 5.1.1(v)—, pero el grupo tiene que enterarse de que se queda sin nadie que
  // pueda dar de alta a otros desde la app.
  assert.equal(await administradoresRestantes(db, 'cta_1'), 0);
});

// ---------------------------------------------------------------------------
// La revocación ante Apple, que nunca puede impedir la baja
// ---------------------------------------------------------------------------

test('hayRevocacionConfigurada pide las tres piezas', () => {
  assert.equal(hayRevocacionConfigurada({}), false);
  assert.equal(hayRevocacionConfigurada({ APPLE_CLAVE_P8: 'x', APPLE_CLAVE_ID: 'y' }), false);
  assert.equal(
    hayRevocacionConfigurada({ APPLE_CLAVE_P8: 'x', APPLE_CLAVE_ID: 'y', APPLE_EQUIPO: 'z' }),
    true,
  );
});

test('sin código de Apple la revocación se salta, y lo dice', async () => {
  const resultado = await revocarEnApple({ APPLE_CLAVE_P8: 'x', APPLE_CLAVE_ID: 'y', APPLE_EQUIPO: 'z' }, {});
  assert.deepEqual(resultado, { revocado: false, motivo: 'sin_codigo' });
});

test('sin clave configurada la revocación se salta, y lo dice', async () => {
  const resultado = await revocarEnApple({}, { codigo: 'c0d1g0' });
  assert.deepEqual(resultado, { revocado: false, motivo: 'sin_clave' });
});

test('una clave ilegible no lanza: devuelve el motivo y deja seguir la baja', async () => {
  // Es la garantía que sostiene todo lo demás. Quien llama está a mitad de una
  // baja de cuenta, y una excepción aquí dejaría a alguien sin poder irse.
  const resultado = await revocarEnApple(
    { APPLE_CLAVE_P8: 'esto no es un PEM', APPLE_CLAVE_ID: 'ABC1234567', APPLE_EQUIPO: 'TEAM123456', APPLE_AUD_IOS: 'com.ejemplo.app' },
    { codigo: 'c0d1g0' },
  );
  assert.equal(resultado.revocado, false);
  assert.equal(resultado.motivo, 'error');
});
