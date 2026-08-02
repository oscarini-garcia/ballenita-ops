import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCARGOS, claveDeEncargo, encargosDe, encargosPublicos, esEncargoConocido } from '../src/encargos.js';
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
