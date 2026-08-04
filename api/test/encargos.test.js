import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENCARGOS, claveDeEncargo, claveDeModelo, encargosDe, encargosPublicos, esEncargoConocido, modelosDe,
} from '../src/encargos.js';
import { INSTRUCCION, pedirPropuestas } from '../src/sugerencias.js';

/**
 * Lo que se le pide al modelo, reescribible desde Ajustes.
 *
 * Un encargo es donde se sube o se baja el tono y donde se le prohíbe lo que se
 * suelta a decir, y eso se descubre usándolo. Si vive en el código, cada retoque
 * es una versión nueva de la app y un OTA.
 */

test('sin nada guardado, el encargo es el de origen', () => {
  const encargos = encargosDe(new Map());
  assert.equal(encargos.ideas, INSTRUCCION);
  assert.equal(encargosPublicos(encargos).find((e) => e.id === 'ideas').esDeOrigen, true);
});

test('lo guardado gana, y deja de ser el de origen', () => {
  const filas = new Map([['ia.encargo:ideas', { valor: 'propón planes de secano' }]]);
  const encargos = encargosDe(filas);
  assert.equal(encargos.ideas, 'propón planes de secano');
  assert.equal(encargosPublicos(encargos).find((e) => e.id === 'ideas').esDeOrigen, false);
});

test('vacío no es un encargo vacío: vuelve el de origen', () => {
  // Borrar la caja es la manera de deshacer, y tiene que estar siempre a mano:
  // quien la ha liado reescribiéndolo no debería pedirle a nadie el texto viejo.
  assert.equal(encargosDe(new Map([['ia.encargo:ideas', { valor: '' }]])).ideas, INSTRUCCION);
});

test('cada encargo sale con su rótulo y su pista, que es lo que lee la pantalla', () => {
  for (const e of encargosPublicos({})) {
    assert.ok(e.titulo, `${e.id} sin rótulo`);
    assert.ok(e.pista, `${e.id} sin pista`);
    assert.ok(e.texto, `${e.id} sin texto`);
  }
  assert.deepEqual(encargosPublicos({}).map((e) => e.id), ENCARGOS.map((e) => e.id));
});

test('solo se reconocen los encargos del catálogo', () => {
  // El filtro no es ceremonia: `guardarConfiguracionIA` escribe la clave que le
  // den, así que sin él un móvil podría machacar `ia.clave` —la credencial de
  // pago— mandando un encargo que se llame así.
  assert.equal(esEncargoConocido('ideas'), true);
  assert.equal(esEncargoConocido('clave'), false);
  assert.equal(esEncargoConocido('modelo'), false);
  assert.equal(claveDeEncargo('ideas'), 'encargo:ideas');
});

test('la llamada usa el encargo que se le pase, y el de origen si no hay ninguno', async () => {
  const vistos = [];
  const buscar = async (url, opciones) => {
    vistos.push(JSON.parse(opciones.body).system);
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{"propuestas":[]}' }] }) };
  };

  await pedirPropuestas({ clave: 'k', modelo: 'm', material: 'x', instruccion: 'el mío', buscar });
  await pedirPropuestas({ clave: 'k', modelo: 'm', material: 'x', buscar });

  assert.deepEqual(vistos, ['el mío', INSTRUCCION]);
});

// ---------------------------------------------------------------------------
// Con qué modelo se le pide cada cosa (§14.16-quinquies)
// ---------------------------------------------------------------------------

test('cada encargo puede llevar su modelo, y «arreglar» viene con haiku puesto', () => {
  // Ordenar una lista de ingredientes es traducción y le sobra el modelo
  // grande; es además el botón que más se va a pulsar.
  const m = modelosDe(new Map(), 'claude-sonnet-4-5');
  assert.equal(m.arreglar, 'claude-haiku-4-5');
  // Los que no traen ninguno usan el general.
  assert.equal(m.ideas, 'claude-sonnet-4-5');
  assert.equal(m.parecidos, 'claude-sonnet-4-5');
});

test('lo guardado gana al de origen y al general', () => {
  const filas = new Map([['ia.modelo:arreglar', { valor: 'claude-opus-5' }]]);
  assert.equal(modelosDe(filas, 'claude-sonnet-4-5').arreglar, 'claude-opus-5');
});

test('vacío vuelve a lo de siempre, que es como se deshace', () => {
  const filas = new Map([['ia.modelo:arreglar', { valor: '' }]]);
  assert.equal(modelosDe(filas, 'claude-sonnet-4-5').arreglar, 'claude-haiku-4-5');
  const filas2 = new Map([['ia.modelo:ideas', { valor: '' }]]);
  assert.equal(modelosDe(filas2, 'claude-sonnet-4-5').ideas, 'claude-sonnet-4-5');
});

test('la pantalla sabe cuál usa y si es suyo o el de arriba', () => {
  const publicos = encargosPublicos({}, modelosDe(new Map(), 'claude-sonnet-4-5'), 'claude-sonnet-4-5');
  const arreglar = publicos.find((e) => e.id === 'arreglar');
  assert.equal(arreglar.modelo, 'claude-haiku-4-5');
  assert.equal(arreglar.modeloPropio, true);
  assert.equal(publicos.find((e) => e.id === 'ideas').modeloPropio, false);
});

test('la clave del modelo de un encargo no choca con la del encargo', () => {
  assert.equal(claveDeModelo('arreglar'), 'modelo:arreglar');
  assert.equal(claveDeEncargo('arreglar'), 'encargo:arreglar');
});

test('el arreglo no corrige la ortografía, y lo dice', () => {
  // «azafran» → «Azafrán» es cómodo hasta que te cambia el nombre raro que
  // habías escrito a propósito.
  const arreglar = ENCARGOS.find((e) => e.id === 'arreglar');
  assert.match(arreglar.origen, /NO corrijas faltas de ortografía/);
  assert.match(arreglar.pista, /como lo escribiste/);
});
