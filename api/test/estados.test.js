import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INSTRUCCION_GRACIA, INSTRUCCION_TANDA, POR_TANDA,
  leerEstados, leerUnEstado, materialDeEstados, materialDeUnEstado,
  pedirEstados, pedirGracia,
} from '../src/estados.js';
import { esEncargoConocido } from '../src/encargos.js';

/**
 * Los estados para ponerse (SPECS §14.36): una tanda de cinco y el botón que
 * le da gracia al que has escrito. Emoji y frase corta, y **sin nombres**.
 */

test('el material dice dónde, qué día del viaje va y qué hay apuntado — y ni un nombre', () => {
  const material = materialDeEstados({
    evento: { lugar: 'Camping La Ballena Alegre', startDate: '2026-08-08', endDate: '2026-08-15' },
    hoy: '2026-08-10',
    cuentas: { cenas: 2, planes: 3, gastos: 7 },
  });
  assert.match(material, /Camping La Ballena Alegre/);
  assert.match(material, /día 3 de 8/);
  assert.match(material, /2 cenas, 3 planes, 7 gastos/);
});

test('el material sabe decir que el viaje no ha empezado, que ya terminó, o que no tiene fechas', () => {
  const evento = { lugar: 'un camping', startDate: '2026-08-08', endDate: '2026-08-15' };
  assert.match(materialDeEstados({ evento, hoy: '2026-08-01' }), /aún no ha empezado/);
  assert.match(materialDeEstados({ evento, hoy: '2026-08-20' }), /ya terminó/);
  assert.match(materialDeEstados({ evento: { lugar: 'x' }, hoy: '2026-08-10' }), /sin fechas puestas/);
});

test('leerEstados admite emoji y frase, recorta y no repite la misma frase', () => {
  const leidos = leerEstados(`bla {"estados":[
    {"emoji":"🍺","texto":" de resaca "},
    {"emoji":"🏖️","texto":"de resaca"},
    {"emoji":"","texto":"sin emoji"},
    {"emoji":"🤿","texto":""},
    {"emoji":"🧴","texto":"poniéndome    crema"}
  ]} bla`);
  assert.deepEqual(leidos, [
    { emoji: '🍺', texto: 'de resaca' },
    { emoji: '🧴', texto: 'poniéndome crema' },
  ]);
});

test('leerEstados no revienta con lo que no es JSON, y nunca pasa de la tanda', () => {
  assert.deepEqual(leerEstados('el modelo se ha ido por las ramas'), []);
  const muchos = Array.from({ length: 12 }, (_, i) => ({ emoji: '🐳', texto: `frase ${i}` }));
  assert.equal(leerEstados(JSON.stringify({ estados: muchos })).length, POR_TANDA);
});

test('leerUnEstado exige las dos mitades: sin emoji o sin frase no hay estado', () => {
  assert.deepEqual(leerUnEstado('{"emoji":"🍺","texto":" de resaca "}'), { emoji: '🍺', texto: 'de resaca' });
  assert.equal(leerUnEstado('{"emoji":"🍺","texto":""}'), null);
  assert.equal(leerUnEstado('{"texto":"de resaca"}'), null);
  assert.equal(leerUnEstado('nada de esto es JSON'), null);
});

test('materialDeUnEstado manda lo escrito, rotulado para que el modelo sepa qué es', () => {
  assert.equal(materialDeUnEstado({ emoji: '🍺', texto: 'de resaca' }), 'Estado: 🍺 de resaca');
  assert.equal(materialDeUnEstado({ texto: 'de resaca' }), 'Estado: de resaca');
});

test('pedirEstados habla con la API del modelo y devuelve la tanda leída', async () => {
  let visto = null;
  const buscar = async (url, opciones) => {
    visto = { url, cuerpo: JSON.parse(opciones.body) };
    return {
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"estados":[{"emoji":"🍺","texto":"de resaca"}]}' }] }),
    };
  };
  const estados = await pedirEstados({ clave: 'k', modelo: 'm', material: 'Sitio: x', buscar });
  assert.deepEqual(estados, [{ emoji: '🍺', texto: 'de resaca' }]);
  assert.match(visto.url, /\/messages$/);
  assert.equal(visto.cuerpo.model, 'm');
  assert.equal(visto.cuerpo.system, INSTRUCCION_TANDA);
});

test('pedirGracia devuelve el mismo estado mejor contado, y respeta el encargo de Ajustes', async () => {
  let visto = null;
  const buscar = async (url, opciones) => {
    visto = JSON.parse(opciones.body);
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{"emoji":"🧟","texto":"resucitando despacio"}' }] }) };
  };
  const estado = await pedirGracia({
    clave: 'k', modelo: 'm', material: '🍺 de resaca', instruccion: 'el mío', buscar,
  });
  assert.deepEqual(estado, { emoji: '🧟', texto: 'resucitando despacio' });
  assert.equal(visto.system, 'el mío');
});

test('un fallo del modelo sube con su estado HTTP, para que la pantalla lo pueda decir', async () => {
  const buscar = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'demasiadas' } }) });
  await assert.rejects(() => pedirEstados({ clave: 'k', modelo: 'm', material: 'x', buscar }), (e) => {
    assert.equal(e.estado, 429);
    assert.match(e.message, /demasiadas/);
    return true;
  });
});

test('los dos encargos están en el catálogo, así que se pueden reescribir desde Ajustes', () => {
  assert.ok(esEncargoConocido('estados'));
  assert.ok(esEncargoConocido('estadoGracia'));
  // Y los dos piden el JSON que la app sabe leer.
  assert.match(INSTRUCCION_TANDA, /"estados"/);
  assert.match(INSTRUCCION_GRACIA, /"emoji"/);
  // La regla de §14.19-bis, escrita en el propio encargo.
  assert.match(INSTRUCCION_TANDA, /nunca.*nombra a nadie/i);
});
