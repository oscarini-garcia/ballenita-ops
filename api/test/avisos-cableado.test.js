import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sobresDeLosCambios } from '../src/index.js';
import { leerInstantanea } from '../src/repositorio.js';
import { baseDePrueba } from './d1.js';

/**
 * **El cableado de los avisos, y no las funciones puras.**
 *
 * `test/avisos.test.js` prueba a quién le toca cada aviso pasándole las listas a
 * mano, y por eso pasaba en verde mientras el Worker no mandaba ninguno: lo que
 * estaba mal era la **forma** de lo que le llega. `leerInstantanea` devuelve
 * `{ v: 1, tables: { persons, … } }` y el que componía los sobres leía
 * `instantanea.persons` — siempre `undefined`—, así que la lista de personas
 * era vacía, `personIds` salía vacío y todo devolvía `null` sin fallar nada.
 *
 * Estos tests usan la instantánea **de verdad**, leída de una base, para que la
 * forma no se pueda volver a torcer sin que se entere nadie.
 */

const GASTO = {
  tabla: 'expenses',
  id: 'exp1',
  op: 'upsert',
  campos: {
    eventId: 'ev1',
    description: 'Cañas',
    amountCents: 2430,
    payers: [{ familyId: 'garcia', amountCents: 2430 }],
    participantIds: ['ana'],
  },
};

async function conGrupo() {
  const db = baseDePrueba();
  await db.prepare('INSERT INTO events (id, name, currency, updatedAt, creadoEn, borrado) VALUES (?,?,?,?,?,0)')
    .bind('ev1', 'Playa', 'EUR', 'x', 'x').run();
  for (const [id, name] of [['garcia', 'García'], ['perez', 'Pérez']]) {
    await db.prepare('INSERT INTO families (id, eventId, name, updatedAt, creadoEn, borrado) VALUES (?,?,?,?,?,0)')
      .bind(id, 'ev1', name, 'x', 'x').run();
  }
  for (const [id, name, fam] of [['curro', 'Curro', 'garcia'], ['ana', 'Ana', 'perez']]) {
    await db.prepare('INSERT INTO persons (id, eventId, name, familyId, updatedAt, creadoEn, borrado) VALUES (?,?,?,?,?,?,0)')
      .bind(id, 'ev1', name, fam, 'x', 'x').run();
  }
  return db;
}

test('un gasto avisa a quien le toca, leyendo la instantánea tal como es', async () => {
  const db = await conGrupo();
  const instantanea = await leerInstantanea(db);

  const sobres = sobresDeLosCambios({
    cambios: [GASTO],
    resultados: [{ aplicado: true, nuevo: true, anterior: null }],
    instantanea,
    autor: 'curro',
  });

  // Esto era `[]` antes del arreglo, y nadie se enteraba.
  assert.equal(sobres.length, 1);
  assert.equal(sobres[0].clase, 'dinero');
  assert.deepEqual(sobres[0].personIds, ['ana']);
  // Y la moneda sale del evento y no del valor por defecto.
  assert.match(sobres[0].cuerpo, /24,30 €/);
});

test('un comentario en un plan avisa a quien lo votó, con la instantánea de verdad', async () => {
  const db = await conGrupo();
  await db.prepare('INSERT INTO plans (id, eventId, titulo, votos, updatedAt, creadoEn, borrado) VALUES (?,?,?,?,?,?,0)')
    .bind('p1', 'ev1', 'Kayaks', '{"ana":"👍"}', 'x', 'x').run();
  const instantanea = await leerInstantanea(db);

  const sobres = sobresDeLosCambios({
    cambios: [{ tabla: 'comentarios', id: 'c1', op: 'upsert', campos: { eventId: 'ev1', ancla: 'plan:p1', texto: '¿A qué hora?', autorId: 'curro' } }],
    resultados: [{ aplicado: true, nuevo: true, anterior: null }],
    instantanea,
    autor: 'curro',
  });

  assert.equal(sobres.length, 1);
  assert.equal(sobres[0].clase, 'comentario');
  assert.deepEqual(sobres[0].personIds, ['ana']);
  assert.equal(sobres[0].ir, 'planes/planes/p1');
});

test('una instantánea sin `tables` no manda nada — y es justo la forma que estaba mal', () => {
  // La forma vieja, la que se leía por error: las listas colgando de la raíz.
  const sobres = sobresDeLosCambios({
    cambios: [GASTO],
    resultados: [{ aplicado: true, nuevo: true, anterior: null }],
    instantanea: { persons: [{ id: 'ana', familyId: 'perez' }], families: [{ id: 'perez' }] },
    autor: 'curro',
  });
  assert.deepEqual(sobres, []);
});

test('la instantánea aguanta una tabla que todavía no existe', async () => {
  const db = await conGrupo();
  await db.prepare('DROP TABLE comentarios').run();

  // Antes esto lanzaba y dejaba `/api/sync` y `/api/cambios` en 500 para todo el
  // grupo durante la ventana entre desplegar el Worker y aplicar la migración.
  const instantanea = await leerInstantanea(db);
  assert.deepEqual(instantanea.tables.comentarios, []);
  assert.ok(instantanea.faltan.includes('comentarios'));
  // Y el resto llega entero, que es lo que permite seguir usando la app.
  assert.equal(instantanea.tables.persons.length, 2);
});
