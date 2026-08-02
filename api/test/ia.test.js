import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listarModelos, probar } from '../src/ia.js';

/**
 * La lista de modelos y la prueba de la clave.
 *
 * Las dos existen porque el modelo se escribía a mano y una errata no se veía al
 * guardar: se veía meses después, cuando alguien pulsaba «¿Qué podríamos hacer?»
 * y no pasaba nada.
 */

test('los modelos llegan con su id y con el nombre que se lee', async () => {
  let visto = null;
  const buscar = async (url, opciones) => {
    visto = { url, opciones };
    return {
      ok: true,
      json: async () => ({
        data: [
          { id: 'claude-opus-5', display_name: 'Claude Opus 5' },
          { id: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5' },
        ],
      }),
    };
  };

  const modelos = await listarModelos({ clave: 'sk-secreta', buscar });

  assert.deepEqual(modelos, [
    { id: 'claude-opus-5', nombre: 'Claude Opus 5' },
    { id: 'claude-haiku-4-5', nombre: 'Claude Haiku 4.5' },
  ]);
  // La clave viaja en su cabecera y no en la URL, que se registra en los logs.
  assert.equal(visto.opciones.headers['x-api-key'], 'sk-secreta');
  assert.doesNotMatch(visto.url, /sk-secreta/);
});

test('un modelo sin nombre se enseña por su id, no vacío', async () => {
  const buscar = async () => ({ ok: true, json: async () => ({ data: [{ id: 'claude-raro' }, { nombre: 'sin id' }] }) });
  assert.deepEqual(await listarModelos({ clave: 'k', buscar }), [{ id: 'claude-raro', nombre: 'claude-raro' }]);
});

test('una clave mala se cuenta con las palabras de Anthropic y su estado', async () => {
  const buscar = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid x-api-key' } }) });
  await assert.rejects(
    () => listarModelos({ clave: 'mala', buscar }),
    (e) => e.message === 'invalid x-api-key' && e.estado === 401,
  );
});

test('probar hace la llamada de verdad, con un token de respuesta', async () => {
  let cuerpo = null;
  const buscar = async (url, opciones) => {
    cuerpo = JSON.parse(opciones.body);
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) };
  };

  const r = await probar({ clave: 'k', modelo: 'claude-haiku-4-5', buscar });

  assert.equal(r.ok, true);
  assert.equal(r.modelo, 'claude-haiku-4-5');
  assert.equal(typeof r.ms, 'number');
  // Se prueba el par entero —clave y modelo—, que es lo que puede estar mal.
  assert.equal(cuerpo.model, 'claude-haiku-4-5');
  assert.equal(cuerpo.max_tokens, 1);
});

test('un modelo que ya no existe falla al probarlo, que es el punto', async () => {
  const buscar = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: { message: 'model: claude-viejo' } }),
  });
  await assert.rejects(
    () => probar({ clave: 'k', modelo: 'claude-viejo', buscar }),
    (e) => e.estado === 404,
  );
});
