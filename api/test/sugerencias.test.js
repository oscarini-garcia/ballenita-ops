import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerPropuestas, materialDelViaje, retratoDelGrupo, pedirPropuestas } from '../src/sugerencias.js';

/**
 * Lo que se prueba aquí no es que el modelo acierte —eso no se puede— sino que
 * **lo que se le manda es lo que se quiere mandar** y que lo que devuelve no
 * rompe la app venga como venga.
 */

test('el retrato del grupo cuenta cabezas y edades, no nombres', () => {
  const personas = [
    { edad: 'adulto' }, { edad: 'adulto' }, { edad: 'adulto' }, { edad: 'adulto' },
    { edad: 'niño' }, { edad: 'niño' },
  ];
  assert.equal(retratoDelGrupo(personas), '6 personas, 4 adultas, 2 niños');
  assert.equal(retratoDelGrupo([{ edad: 'adulto' }]), '1 personas, 1 adulta');
  assert.equal(retratoDelGrupo([]), 'no se sabe cuánta gente va');
});

test('el material lleva sitio, fechas, grupo y lo ya apuntado — y ningún nombre', () => {
  const material = materialDelViaje({
    evento: { lugar: 'Camping La Ballena Alegre', startDate: '2026-08-15', endDate: '2026-08-22' },
    personas: [{ edad: 'adulto', name: 'Curro' }, { edad: 'niño', name: 'Fran' }],
    yaHay: ['Playa de la Cala'],
  });

  assert.match(material, /Camping La Ballena Alegre/);
  assert.match(material, /2026-08-15 a 2026-08-22/);
  assert.match(material, /2 personas, 1 adulta, 1 niño/);
  assert.match(material, /Ya tienen apuntados: Playa de la Cala/);
  // Lo que no puede estar: quiénes son.
  assert.doesNotMatch(material, /Curro|Fran/);
});

test('sin planes todavía lo dice, en vez de mandar una lista vacía', () => {
  const material = materialDelViaje({ evento: {}, personas: [], yaHay: [] });
  assert.match(material, /Todavía no tienen ningún plan apuntado/);
});

test('la respuesta se lee aunque el modelo la envuelva en explicaciones', () => {
  const propuestas = leerPropuestas(
    'Claro, aquí van:\n```json\n{"propuestas":[{"que":"Kayak en la cala","porque":"Hay alquiler a pie de playa"}]}\n```\n¡Que lo disfrutéis!',
  );
  assert.deepEqual(propuestas, [{ que: 'Kayak en la cala', porque: 'Hay alquiler a pie de playa' }]);
});

test('una respuesta que no es JSON no revienta: se queda en nada', () => {
  assert.deepEqual(leerPropuestas('lo siento, no puedo'), []);
  assert.deepEqual(leerPropuestas(''), []);
});

test('nunca salen más de cinco, ni ninguna sin título', () => {
  const muchas = { propuestas: Array.from({ length: 9 }, (_, i) => ({ que: `Plan ${i}`, porque: 'x' })) };
  assert.equal(leerPropuestas(JSON.stringify(muchas)).length, 5);

  const rotas = { propuestas: [{ porque: 'sin qué' }, { que: '  ' }, { que: 'Buena', porque: '' }] };
  assert.deepEqual(leerPropuestas(JSON.stringify(rotas)), [{ que: 'Buena', porque: '' }]);
});

test('la llamada manda la clave en su cabecera y el modelo que se le diga', async () => {
  let visto = null;
  const buscar = async (url, opciones) => {
    visto = { url, opciones };
    return {
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"propuestas":[{"que":"A","porque":"B"}]}' }] }),
    };
  };

  const propuestas = await pedirPropuestas({ clave: 'sk-secreta', modelo: 'claude-haiku-4-5', material: 'x', buscar });

  assert.deepEqual(propuestas, [{ que: 'A', porque: 'B' }]);
  assert.equal(visto.opciones.headers['x-api-key'], 'sk-secreta');
  assert.equal(JSON.parse(visto.opciones.body).model, 'claude-haiku-4-5');
});

test('si el modelo contesta con un error, se cuenta con sus palabras', async () => {
  const buscar = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: { message: 'invalid x-api-key' } }),
  });

  await assert.rejects(
    () => pedirPropuestas({ clave: 'mala', modelo: 'm', material: 'x', buscar }),
    (e) => e.message === 'invalid x-api-key' && e.estado === 401,
  );
});
