import test from 'node:test';
import assert from 'node:assert/strict';

import { baseDePrueba } from './d1.js';
import { importarInstantanea, leerInstantanea } from '../src/repositorio.js';
import { instantaneaDeEjemplo } from '../herramientas/datos-ejemplo.mjs';

/**
 * Los datos de prueba se siembran en una base de verdad, así que tienen que
 * caber en el esquema de verdad. Sin esto, un campo mal escrito no se
 * descubriría hasta el momento de sembrar, que es justo cuando menos apetece.
 */

async function baseSembrada() {
  const db = baseDePrueba();
  await importarInstantanea(db, instantaneaDeEjemplo());
  return db;
}

test('el evento de ejemplo entra entero en el esquema real', async () => {
  const { tables } = await leerInstantanea(await baseSembrada());

  assert.equal(tables.events.length, 1);
  assert.equal(tables.families.length, 3);
  assert.equal(tables.bungas.length, 3);
  assert.equal(tables.persons.length, 7);
  assert.equal(tables.expenses.length, 4);
  assert.equal(tables.settlements.length, 1);
  assert.equal(tables.dishes.length, 5);
  assert.equal(tables.dinners.length, 1);
  assert.equal(tables.plans.length, 3);
  assert.equal(tables.shop.length, 4);
});

test('los campos compuestos sobreviven al viaje', async () => {
  const { tables } = await leerInstantanea(await baseSembrada());

  const gasto = tables.expenses.find((e) => e.id === 'exp_demo_compra');
  assert.deepEqual(gasto.payers, [{ familyId: 'fam_perez', amountCents: 14800 }]);
  assert.equal(gasto.participantIds.length, 7);

  const plan = tables.plans.find((p) => p.id === 'plan_demo_cuevas');
  assert.deepEqual(plan.votos, { per_curro: '👍', per_ana: '🤷', per_luis: '👎' });

  const cena = tables.dinners[0];
  assert.equal(cena.platoIds.length, 5);

  const paella = tables.dishes.find((d) => d.id === 'dish_demo_paella');
  assert.deepEqual(paella.ingredientes, ['arroz', 'mejillones', 'pollo']);
  assert.equal(paella.esFavorito, true, 'los indicadores vuelven como booleanos');
});

test('los niños llevan su peso de reparto y los mayores el suyo', async () => {
  const { tables } = await leerInstantanea(await baseSembrada());

  const lucia = tables.persons.find((p) => p.id === 'per_lucia');
  assert.equal(lucia.pesoReparto, 0.5);
  assert.equal(lucia.cuentaComoAdultoReparto, false);

  // Fran es el caso raro a propósito: niño de edad, pero come y paga como mayor.
  const fran = tables.persons.find((p) => p.id === 'per_fran');
  assert.equal(fran.edad, 'niño');
  assert.equal(fran.cuentaComoAdultoReparto, true);
  assert.equal(fran.pesoReparto, 1);
});

test('las referencias entre filas apuntan a algo que existe', async () => {
  const { tables } = await leerInstantanea(await baseSembrada());

  const familias = new Set(tables.families.map((f) => f.id));
  const personas = new Set(tables.persons.map((p) => p.id));
  const bungas = new Set(tables.bungas.map((b) => b.id));
  const platos = new Set(tables.dishes.map((d) => d.id));

  for (const p of tables.persons) assert.ok(familias.has(p.familyId), `persona ${p.id} sin familia`);
  for (const b of tables.bungas) assert.ok(familias.has(b.familyId), `bunga ${b.id} sin familia`);

  for (const g of tables.expenses) {
    for (const pagador of g.payers) assert.ok(familias.has(pagador.familyId), `gasto ${g.id} paga una familia inexistente`);
    for (const id of g.participantIds) assert.ok(personas.has(id), `gasto ${g.id} reparte a alguien inexistente`);
  }

  for (const s of tables.settlements) {
    assert.ok(familias.has(s.fromFamilyId));
    assert.ok(familias.has(s.toFamilyId));
  }

  for (const c of tables.dinners) {
    assert.ok(bungas.has(c.bungaMayoresId));
    assert.ok(bungas.has(c.bungaNinosId));
    for (const id of c.platoIds) assert.ok(platos.has(id), `cena ${c.id} con plato inexistente`);
  }

  for (const p of tables.plans) {
    for (const id of Object.keys(p.votos)) assert.ok(personas.has(id), `plan ${p.id} con votante inexistente`);
  }

  const compra = tables.shop.find((s) => s.compradoPor);
  assert.ok(personas.has(compra.compradoPor));
});

test('sembrar dos veces no duplica nada', async () => {
  const db = baseDePrueba();
  await importarInstantanea(db, instantaneaDeEjemplo());
  await importarInstantanea(db, instantaneaDeEjemplo());

  const { tables } = await leerInstantanea(db);
  assert.equal(tables.expenses.length, 4);
  assert.equal(tables.persons.length, 7);
});

test('las marcas van al pasado, para no pisar lo que se escriba en la app', async () => {
  const { tables } = await leerInstantanea(await baseSembrada());
  const ahora = new Date().toISOString();
  for (const fila of tables.expenses) {
    assert.ok(fila.updatedAt < ahora, `${fila.id} tiene una marca en el futuro`);
  }
});
