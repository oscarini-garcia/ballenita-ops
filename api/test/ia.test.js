import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conModeloVigente, listarModelos, masCercano, probar } from '../src/ia.js';

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

// ---------------------------------------------------------------------------
// El modelo retirado se cambia solo por el más cercano
// ---------------------------------------------------------------------------

const LISTA = [
  { id: 'claude-opus-5', nombre: 'Claude Opus 5' },
  { id: 'claude-sonnet-4-5', nombre: 'Claude Sonnet 4.5' },
  { id: 'claude-haiku-4-5', nombre: 'Claude Haiku 4.5' },
];

test('el más cercano es el más nuevo de su familia, no el más caro de la lista', () => {
  // Quien puso un Sonnet quería un Sonnet: darle un Opus le multiplica la
  // factura sin que nadie se lo haya pedido.
  assert.equal(masCercano('claude-3-5-sonnet-20241022', LISTA).id, 'claude-sonnet-4-5');
  assert.equal(masCercano('claude-3-haiku-20240307', LISTA).id, 'claude-haiku-4-5');
  assert.equal(masCercano('claude-3-opus-20240229', LISTA).id, 'claude-opus-5');
});

test('sin familia reconocible se coge el primero, que es el último que salió', () => {
  assert.equal(masCercano('claude-sonet-4-5', LISTA).id, 'claude-opus-5');
});

test('un modelo que sigue existiendo no se toca', () => {
  assert.equal(masCercano('claude-sonnet-4-5', LISTA), null);
  // Y sin lista con la que comparar tampoco se inventa nada.
  assert.equal(masCercano('claude-viejo', []), null);
});

test('si el modelo ya no existe, se repite con el más cercano y se guarda', async () => {
  const llamadas = [];
  let guardado = null;
  const hacer = async (m) => {
    llamadas.push(m);
    if (m === 'claude-3-5-sonnet-20241022') {
      const e = new Error('model: claude-3-5-sonnet-20241022');
      e.estado = 404;
      throw e;
    }
    return 'lo que devuelva';
  };
  const buscar = async () => ({ ok: true, json: async () => ({ data: LISTA.map((m) => ({ id: m.id, display_name: m.nombre })) }) });

  const r = await conModeloVigente({
    clave: 'k', modelo: 'claude-3-5-sonnet-20241022', hacer, guardar: async (m) => { guardado = m; }, buscar,
  });

  assert.equal(r.resultado, 'lo que devuelva');
  assert.deepEqual(r.cambiado, { antes: 'claude-3-5-sonnet-20241022', ahora: 'claude-sonnet-4-5' });
  assert.deepEqual(llamadas, ['claude-3-5-sonnet-20241022', 'claude-sonnet-4-5']);
  // Se deja apuntado: si no, la próxima vez vuelve a costar dos llamadas.
  assert.equal(guardado, 'claude-sonnet-4-5');
});

test('lo que no es un modelo inexistente no se reintenta', async () => {
  // Una clave mala o una cuota agotada no se arreglan cambiando de modelo, y
  // reintentar gastaría dos llamadas para dar el mismo error.
  let veces = 0;
  const hacer = async () => {
    veces += 1;
    const e = new Error('invalid x-api-key');
    e.estado = 401;
    throw e;
  };
  await assert.rejects(
    () => conModeloVigente({ clave: 'k', modelo: 'claude-sonnet-4-5', hacer, guardar: async () => {} }),
    (e) => e.estado === 401,
  );
  assert.equal(veces, 1);
});

test('si tampoco se puede traer la lista, sale el error de siempre', async () => {
  const hacer = async () => {
    const e = new Error('model: claude-viejo');
    e.estado = 404;
    throw e;
  };
  const buscar = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(
    () => conModeloVigente({ clave: 'k', modelo: 'claude-viejo', hacer, guardar: async () => {}, buscar }),
    (e) => e.message === 'model: claude-viejo',
  );
});

test('un modelo sin retirar no pasa por la lista siquiera', async () => {
  let listados = 0;
  const r = await conModeloVigente({
    clave: 'k',
    modelo: 'claude-sonnet-4-5',
    hacer: async () => 'bien',
    guardar: async () => {},
    buscar: async () => { listados += 1; return { ok: true, json: async () => ({ data: [] }) }; },
  });
  assert.equal(r.resultado, 'bien');
  assert.equal(r.cambiado, undefined);
  assert.equal(listados, 0);
});
