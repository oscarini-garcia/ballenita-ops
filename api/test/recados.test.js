import { test } from 'node:test';
import assert from 'node:assert/strict';

import { baseDePrueba } from './d1.js';
import { guardarRecados, leerRecadosGuardados } from '../src/repositorio.js';
import {
  POR_TANDA, leerRecados, materialDelViaje, pedirRecados, retratoDelGrupo, sigueSirviendo,
} from '../src/recados.js';

/**
 * Como en `sugerencias.test.js`: no se prueba que las frases tengan gracia —eso
 * no se puede— sino que **lo que se le manda es lo que se quiere mandar**, que
 * lo que devuelva no rompe la app venga como venga, y que la ventana de dos
 * horas hace lo que dice, que es lo que decide lo que cuesta esto.
 */

const EVENTO = { lugar: 'Camping La Ballena Alegre', startDate: '2026-08-01', endDate: '2026-08-08' };

test('el retrato del grupo cuenta cabezas y edades, no nombres', () => {
  assert.equal(retratoDelGrupo([{ edad: 'adulto' }, { edad: 'niño' }]), '2 personas, 1 adulta, 1 niño');
  assert.equal(retratoDelGrupo([]), 'no se sabe cuánta gente va');
});

test('el material lleva el sitio, por qué día van y los números — y ningún nombre', () => {
  const material = materialDelViaje({
    evento: EVENTO,
    personas: [{ edad: 'adulto', name: 'Curro' }, { edad: 'niño', name: 'Fran' }],
    hoy: '2026-08-03',
    cuentas: { gastos: 12, cenas: 3, planes: 2, compra: 5 },
  });

  assert.match(material, /Camping La Ballena Alegre/);
  assert.match(material, /Van por el día 3 de 8/);
  assert.match(material, /2 personas, 1 adulta, 1 niño/);
  assert.match(material, /12 gastos, 3 cenas y 2 planes, y 5 cosas sin comprar/);
  assert.doesNotMatch(material, /Curro|Fran/);
});

test('el material dice si el viaje aún no ha empezado o ya terminó', () => {
  const antes = materialDelViaje({ evento: EVENTO, hoy: '2026-07-20' });
  assert.match(antes, /Todavía no ha empezado/);
  const despues = materialDelViaje({ evento: EVENTO, hoy: '2026-09-01' });
  assert.match(despues, /ya ha terminado/);
  const sinFechas = materialDelViaje({ evento: { lugar: 'x' }, hoy: '2026-08-03' });
  assert.match(sinFechas, /Sin fechas todavía/);
});

test('leerRecados saca la lista aunque el modelo se enrolle antes y después', () => {
  const recados = leerRecados(
    'Claro, aquí van:\n{"recados":[{"emoji":"🍉","texto":"Sandía otra vez."},' +
    '{"emoji":"🧊","texto":"Se acabó el hielo."}]}\n¡Que aproveche!',
  );
  assert.deepEqual(recados, [
    { emoji: '🍉', texto: 'Sandía otra vez.' },
    { emoji: '🧊', texto: 'Se acabó el hielo.' },
  ]);
});

test('leerRecados tira lo que viene sin texto y no revienta con un JSON roto', () => {
  assert.deepEqual(leerRecados('{"recados":[{"emoji":"🍉"},{"texto":"   "},{"texto":"Vale."}]}'), [
    { emoji: '🐳', texto: 'Vale.' },
  ]);
  assert.deepEqual(leerRecados('esto no es un JSON'), []);
  assert.deepEqual(leerRecados('{"otracosa":1}'), []);
});

test('del emoji se coge uno solo, para que la fila no se descuadre', () => {
  const [uno] = leerRecados('{"recados":[{"emoji":"🍉🍉🍉","texto":"Sandía."}]}');
  assert.equal([...uno.emoji].length, 1);
});

test('nunca vuelven más de las de una tanda, diga lo que diga el modelo', () => {
  const muchas = Array.from({ length: 40 }, (_, i) => ({ emoji: '🐳', texto: `Frase ${i}` }));
  assert.equal(leerRecados(JSON.stringify({ recados: muchas })).length, POR_TANDA);
});

test('la llamada manda la clave en su cabecera y el modelo que se le diga', async () => {
  let visto = null;
  await pedirRecados({
    clave: 'sk-prueba',
    modelo: 'claude-haiku-4-5',
    material: 'Sitio: X',
    buscar: async (url, opciones) => {
      visto = { url, opciones };
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{"recados":[]}' }] }) };
    },
  });

  assert.match(visto.url, /\/messages$/);
  assert.equal(visto.opciones.headers['x-api-key'], 'sk-prueba');
  const cuerpo = JSON.parse(visto.opciones.body);
  assert.equal(cuerpo.model, 'claude-haiku-4-5');
  assert.match(cuerpo.system, /recadillos/);
  assert.equal(cuerpo.messages[0].content, 'Sitio: X');
});

test('si el modelo contesta con un error, se cuenta con su estado', async () => {
  await assert.rejects(
    () => pedirRecados({
      clave: 'k', modelo: 'm', material: 'x',
      buscar: async () => ({ ok: false, status: 404, json: async () => ({ error: { message: 'no existe ese modelo' } }) }),
    }),
    (e) => e.estado === 404 && /no existe ese modelo/.test(e.message),
  );
});

test('la ventana de dos horas: dentro sirve, fuera no, y sin hora tampoco', () => {
  const ahora = Date.parse('2026-08-03T14:00:00.000Z');
  assert.equal(sigueSirviendo('2026-08-03T13:00:00.000Z', ahora), true);
  assert.equal(sigueSirviendo('2026-08-03T11:59:00.000Z', ahora), false);
  assert.equal(sigueSirviendo(null, ahora), false);
  assert.equal(sigueSirviendo('pues no sé', ahora), false);
});

test('la tanda se guarda por evento y vuelve entera con su hora', async () => {
  const db = baseDePrueba();
  assert.equal(await leerRecadosGuardados(db, 'ev_1'), null);

  const tanda = [{ emoji: '🍉', texto: 'Sandía otra vez.' }];
  const generadoEn = await guardarRecados(db, 'ev_1', tanda);

  const leida = await leerRecadosGuardados(db, 'ev_1');
  assert.deepEqual(leida.recados, tanda);
  assert.equal(leida.generadoEn, generadoEn);

  // Cada evento la suya: el Demo no puede leer la del viaje de verdad.
  assert.equal(await leerRecadosGuardados(db, 'ev_2'), null);
});

test('guardar otra vez sustituye la anterior y mueve la hora', async () => {
  const db = baseDePrueba();
  await guardarRecados(db, 'ev_1', [{ emoji: '🧊', texto: 'Vieja.' }]);
  await new Promise((r) => setTimeout(r, 5));
  await guardarRecados(db, 'ev_1', [{ emoji: '🍉', texto: 'Nueva.' }]);

  const leida = await leerRecadosGuardados(db, 'ev_1');
  assert.equal(leida.recados.length, 1);
  assert.equal(leida.recados[0].texto, 'Nueva.');
});

// La tanda vive en `configuracion` sin el prefijo `ia.` a propósito: con él,
// `leerConfiguracionIA` se la llevaría por delante junto con la clave.
test('la tanda no se cuela en la configuración de la IA', async () => {
  const db = baseDePrueba();
  await guardarRecados(db, 'ev_1', [{ emoji: '🐳', texto: 'Hola.' }]);
  const { results } = await db.prepare("SELECT clave FROM configuracion WHERE clave LIKE 'ia.%'").all();
  assert.equal(results.length, 0);
});
