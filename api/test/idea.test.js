import test from 'node:test';
import assert from 'node:assert/strict';

import { INSTRUCCION_MEJORAR, leerMejora, materialDeLaIdea, pedirMejora } from '../src/idea.js';
import { esEncargoConocido } from '../src/encargos.js';

/**
 * El encargo de «Mejorarla» (SPECS §14.24): la misma idea mejor contada, sin
 * inventar y sin guardar nada — lo que vuelve rellena el editor y se deshace.
 */

test('el material lleva la idea campo a campo, y el enlace solo si lo hay', () => {
  assert.equal(
    materialDeLaIdea({ titulo: 'playa cala sur', descripcion: 'llevar sombrilla' }),
    'Título: playa cala sur\nDescripción: llevar sombrilla',
  );
  assert.match(materialDeLaIdea({ titulo: 'Kayak', enlace: 'https://x' }), /Enlace: https:\/\/x/);
  assert.match(materialDeLaIdea({ titulo: 'Kayak' }), /Descripción: \(vacía\)/);
});

test('leerMejora admite solo lo pedido: sin título no hay mejora', () => {
  const buena = leerMejora('bla {"titulo":" Playa de la Cala ","descripcion":" Cala del sur. Llevar sombrilla. "} bla');
  assert.deepEqual(buena, { titulo: 'Playa de la Cala', descripcion: 'Cala del sur. Llevar sombrilla.' });

  // Un título vacío borraría el que había, que es lo contrario de mejorar.
  assert.equal(leerMejora('{"titulo":"","descripcion":"algo"}'), null);
  assert.equal(leerMejora('esto no es JSON'), null);
});

test('pedirMejora habla con la API del modelo y devuelve la idea leída', async () => {
  let visto = null;
  const buscar = async (url, opciones) => {
    visto = { url, cuerpo: JSON.parse(opciones.body) };
    return {
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"titulo":"Playa de la Cala","descripcion":"Cala del sur."}' }] }),
    };
  };

  const idea = await pedirMejora({ clave: 'k', modelo: 'm', material: 'Título: playa', buscar });
  assert.deepEqual(idea, { titulo: 'Playa de la Cala', descripcion: 'Cala del sur.' });
  assert.match(visto.url, /anthropic/);
  assert.equal(visto.cuerpo.system, INSTRUCCION_MEJORAR);
  assert.equal(visto.cuerpo.messages[0].content, 'Título: playa');
});

test('el encargo está en el catálogo: se puede reescribir desde Ajustes y nada más que él', () => {
  assert.ok(esEncargoConocido('mejorarIdea'));
});
