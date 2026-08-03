import test from 'node:test';
import assert from 'node:assert/strict';

import { baseDePrueba } from './d1.js';
import {
  aplicarCambio, crearCuenta, cuentaPorApple, hayAlgunaCuenta,
  importarInstantanea, leerInstantanea,
} from '../src/repositorio.js';
import { filaAObjeto, objetoAColumnas } from '../src/tablas.js';

const GASTO = {
  eventId: 'ev_1',
  description: 'Compra grande Mercadona',
  amountCents: 14800,
  currency: 'EUR',
  amountOriginal: 148,
  rate: 1,
  category: 'compra_general',
  dateISO: '2026-08-09T10:00:00.000Z',
  payers: [{ familyId: 'fam_perez', amountCents: 14800 }],
  participantIds: ['per_1', 'per_2', 'per_3'],
};

const upsert = (tabla, id, campos, updatedAt) => ({ tabla, id, op: 'upsert', campos, updatedAt });

// ---------------------------------------------------------------------------
// Conversión de tipos
// ---------------------------------------------------------------------------

test('objetoAColumnas descarta las claves que no son columnas de la tabla', () => {
  const columnas = objetoAColumnas('expenses', { ...GASTO, malicioso: 1, borrado: 1 });
  assert.ok(!('malicioso' in columnas));
  assert.ok(!('borrado' in columnas), 'borrado no es campo del cliente: lo decide el servidor');
  assert.equal(columnas.description, 'Compra grande Mercadona');
});

test('los campos JSON viajan serializados y vuelven como estructuras', () => {
  const columnas = objetoAColumnas('expenses', GASTO);
  assert.equal(typeof columnas.payers, 'string');

  const vuelta = filaAObjeto('expenses', { id: 'exp_1', ...columnas, borrado: 0 });
  assert.deepEqual(vuelta.payers, GASTO.payers);
  assert.deepEqual(vuelta.participantIds, GASTO.participantIds);
  assert.ok(!('borrado' in vuelta), 'el indicador de borrado no se transmite');
});

test('los indicadores vuelven como booleanos y no como el 0 y el 1 de SQLite', () => {
  const columnas = objetoAColumnas('persons', { name: 'Fran', comeConMayores: true, cuentaComoAdultoReparto: false });
  assert.equal(columnas.comeConMayores, 1);
  assert.equal(columnas.cuentaComoAdultoReparto, 0);

  const vuelta = filaAObjeto('persons', { id: 'per_1', ...columnas });
  assert.equal(vuelta.comeConMayores, true);
  assert.equal(vuelta.cuentaComoAdultoReparto, false);
});

test('un campo JSON ausente vuelve con su forma vacía, no como null', () => {
  const gasto = filaAObjeto('expenses', { id: 'exp_1', payers: null, participantIds: null });
  assert.deepEqual(gasto.payers, []);
  const plan = filaAObjeto('plans', { id: 'plan_1', votos: null });
  assert.deepEqual(plan.votos, {}, 'los votos son un objeto: una lista rompería la pantalla de Planes');
});

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

test('un gasto sobrevive intacto al viaje de ida y vuelta', async () => {
  const db = baseDePrueba();
  const resultado = await aplicarCambio(db, upsert('expenses', 'exp_1', GASTO, '2026-08-09T10:00:00.000Z'));
  assert.equal(resultado.aplicado, true);

  const { tables } = await leerInstantanea(db);
  assert.equal(tables.expenses.length, 1);

  const guardado = tables.expenses[0];
  assert.equal(guardado.id, 'exp_1');
  assert.equal(guardado.amountCents, 14800, 'el dinero sigue en céntimos enteros');
  assert.deepEqual(guardado.payers, GASTO.payers);
  assert.deepEqual(guardado.participantIds, GASTO.participantIds);
});

test('una actualización parcial conserva los campos que no vienen', async () => {
  const db = baseDePrueba();
  await aplicarCambio(db, upsert('expenses', 'exp_1', GASTO, '2026-08-09T10:00:00.000Z'));
  await aplicarCambio(db, upsert('expenses', 'exp_1', { category: 'comida' }, '2026-08-09T11:00:00.000Z'));

  const { tables } = await leerInstantanea(db);
  const guardado = tables.expenses[0];
  assert.equal(guardado.category, 'comida');
  assert.equal(guardado.description, 'Compra grande Mercadona', 'lo que no se toca, no se pierde');
  assert.equal(guardado.amountCents, 14800);
});

test('dos móviles que editan campos distintos del mismo gasto no se pisan', async () => {
  const db = baseDePrueba();
  await aplicarCambio(db, upsert('expenses', 'exp_1', GASTO, '2026-08-09T10:00:00.000Z'));

  // Llegan en el mismo lote, de dispositivos distintos.
  await aplicarCambio(db, upsert('expenses', 'exp_1', { category: 'bebida' }, '2026-08-09T10:30:00.000Z'));
  await aplicarCambio(db, upsert('expenses', 'exp_1', { description: 'Birras' }, '2026-08-09T10:31:00.000Z'));

  const { tables } = await leerInstantanea(db);
  assert.equal(tables.expenses[0].category, 'bebida');
  assert.equal(tables.expenses[0].description, 'Birras');
});

test('un cambio más viejo que lo que ya tiene el servidor se descarta', async () => {
  const db = baseDePrueba();
  await aplicarCambio(db, upsert('expenses', 'exp_1', GASTO, '2026-08-09T12:00:00.000Z'));

  const tarde = await aplicarCambio(db, upsert('expenses', 'exp_1', { description: 'viejo' }, '2026-08-09T09:00:00.000Z'));
  assert.equal(tarde.aplicado, false);
  assert.match(tarde.motivo, /más reciente/);

  const { tables } = await leerInstantanea(db);
  assert.equal(tables.expenses[0].description, 'Compra grande Mercadona');
});

test('borrar marca la fila y deja de transmitirse, sin lápidas', async () => {
  const db = baseDePrueba();
  await aplicarCambio(db, upsert('expenses', 'exp_1', GASTO, '2026-08-09T10:00:00.000Z'));
  await aplicarCambio(db, { tabla: 'expenses', id: 'exp_1', op: 'borrar', updatedAt: '2026-08-09T13:00:00.000Z' });

  const { tables } = await leerInstantanea(db);
  assert.equal(tables.expenses.length, 0);

  const fila = await db.prepare('SELECT * FROM expenses WHERE id = ?').bind('exp_1').first();
  assert.equal(fila.borrado, 1, 'la fila sigue ahí marcada: un borrado físico resucitaría con una cola vieja');
});

test('una cola vieja no resucita lo que ya se borró', async () => {
  const db = baseDePrueba();
  await aplicarCambio(db, upsert('expenses', 'exp_1', GASTO, '2026-08-09T10:00:00.000Z'));
  await aplicarCambio(db, { tabla: 'expenses', id: 'exp_1', op: 'borrar', updatedAt: '2026-08-09T13:00:00.000Z' });

  // Un móvil que estuvo sin cobertura sube ahora su edición de las 11:00.
  const rezagado = await aplicarCambio(db, upsert('expenses', 'exp_1', { description: 'editado offline' }, '2026-08-09T11:00:00.000Z'));
  assert.equal(rezagado.aplicado, false);

  const { tables } = await leerInstantanea(db);
  assert.equal(tables.expenses.length, 0, 'sigue borrado');
});

test('una tabla desconocida se rechaza sin tumbar el lote', async () => {
  const db = baseDePrueba();
  const resultado = await aplicarCambio(db, upsert('sql_injection; DROP TABLE expenses', 'x', {}, '2026-01-01T00:00:00.000Z'));
  assert.equal(resultado.aplicado, false);
  assert.match(resultado.motivo, /tabla desconocida/);

  const { tables } = await leerInstantanea(db);
  assert.ok(Array.isArray(tables.expenses), 'la tabla de gastos sigue existiendo');
});

test('un cambio sin id se rechaza', async () => {
  const db = baseDePrueba();
  const resultado = await aplicarCambio(db, { tabla: 'expenses', op: 'upsert', campos: GASTO });
  assert.equal(resultado.aplicado, false);
  assert.match(resultado.motivo, /sin id/);
});

test('la instantánea trae todas las tablas, aunque estén vacías', async () => {
  const { v, tables } = await leerInstantanea(baseDePrueba());
  assert.equal(v, 1);
  for (const tabla of ['events', 'families', 'bungas', 'persons', 'expenses', 'settlements', 'dishes', 'dinners', 'plans', 'shop']) {
    assert.ok(Array.isArray(tables[tabla]), `falta ${tabla}`);
  }
});

// ---------------------------------------------------------------------------
// Siembra desde JSONBin
// ---------------------------------------------------------------------------

test('la siembra desde un volcado de JSONBin respeta lápidas y última escritura', async () => {
  const db = baseDePrueba();
  const volcado = {
    v: 1,
    tables: {
      events: [{ id: 'ev_1', name: 'Ballenita 2026', currency: 'EUR', updatedAt: '2026-07-01T00:00:00.000Z' }],
      expenses: [
        { id: 'exp_1', ...GASTO, updatedAt: '2026-08-09T10:00:00.000Z' },
        { id: 'exp_2', ...GASTO, description: 'Gasolina', updatedAt: '2026-08-09T10:00:00.000Z' },
      ],
    },
    tombstones: [{ key: 'expenses:exp_2', table: 'expenses', rowId: 'exp_2', ts: '2026-08-09T12:00:00.000Z' }],
  };

  await importarInstantanea(db, volcado);

  const { tables } = await leerInstantanea(db);
  assert.equal(tables.events.length, 1);
  assert.equal(tables.expenses.length, 1, 'la lápida se tradujo a un borrado');
  assert.equal(tables.expenses[0].id, 'exp_1');
});

test('sembrar dos veces no deshace lo hecho entretanto', async () => {
  const db = baseDePrueba();
  const volcado = { v: 1, tables: { expenses: [{ id: 'exp_1', ...GASTO, updatedAt: '2026-08-09T10:00:00.000Z' }] } };

  await importarInstantanea(db, volcado);
  await aplicarCambio(db, upsert('expenses', 'exp_1', { description: 'corregido en la app' }, '2026-08-10T10:00:00.000Z'));
  await importarInstantanea(db, volcado);

  const { tables } = await leerInstantanea(db);
  assert.equal(tables.expenses[0].description, 'corregido en la app');
});

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------

test('la primera cuenta nace administradora y las siguientes no', async () => {
  const db = baseDePrueba();
  assert.equal(await hayAlgunaCuenta(db), false);

  const primera = await crearCuenta(db, { id: 'cta_1', appleSub: 'apple_1', nombre: 'Óscar' });
  assert.equal(primera.rol, 'administrador');

  const segunda = await crearCuenta(db, { id: 'cta_2', appleSub: 'apple_2', nombre: 'Ana' });
  assert.equal(segunda.rol, 'miembro');

  assert.equal((await cuentaPorApple(db, 'apple_1')).id, 'cta_1');
  assert.equal(await cuentaPorApple(db, 'desconocido'), null);
});

// ---------------------------------------------------------------------------
// El alias de familia y las dos fechas de una idea (migración 0008)
// ---------------------------------------------------------------------------

test('el alias de una familia y las dos fechas de una idea van y vuelven', async () => {
  const db = baseDePrueba();

  await aplicarCambio(db, upsert('families', 'fam_garcia', {
    eventId: 'ev_1', name: 'García', alias: 'GA', color: '#E5544B',
  }, '2026-08-01T10:00:00.000Z'));
  await aplicarCambio(db, upsert('planIdeas', 'idea_1', {
    titulo: 'Playa de la Cala', creadaPor: 'per_curro', apuntadaEl: '2020-08-01T10:00:00.000Z',
  }, '2026-08-01T10:00:00.000Z'));
  await aplicarCambio(db, upsert('plans', 'plan_1', {
    eventId: 'ev_1', titulo: 'Playa de la Cala', ideaId: 'idea_1',
    propuestoEl: '2026-08-01T09:30:00.000Z',
  }, '2026-08-01T10:00:00.000Z'));

  const instantanea = await leerInstantanea(db);
  assert.equal(instantanea.tables.families[0].alias, 'GA');
  // Son dos fechas distintas a propósito: cuándo se apuntó la idea al catálogo
  // —de hace seis agostos— y cuándo se propuso a este viaje.
  assert.equal(instantanea.tables.planIdeas[0].apuntadaEl, '2020-08-01T10:00:00.000Z');
  assert.equal(instantanea.tables.plans[0].propuestoEl, '2026-08-01T09:30:00.000Z');
  // Y ninguna es `creadoEn`, que la pone el servidor al insertar.
  assert.notEqual(instantanea.tables.planIdeas[0].apuntadaEl, instantanea.tables.planIdeas[0].creadoEn);
});
