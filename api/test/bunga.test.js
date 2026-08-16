/**
 * El bunga resumido en una frase (SPECS §14.66).
 *
 * Lo que se fija aquí es lo de siempre en los encargos de IA: que el material
 * que se le pasa al modelo diga lo que tiene que decir **y nada más** —ni un
 * nombre—, y que lo que vuelve se lea sin fiarse de que venga limpio.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { INSTRUCCION, TOPE_DEL_RESUMEN, leerResumen, materialDelBunga, pedirResumen } from '../src/bunga.js';

// ── El material ──────────────────────────────────────────────────────────────

test('el material lleva el nombre, el mote, las pegatinas y las notas', () => {
  const material = materialDelBunga({
    nombre: 'Bunga 12',
    alias: 'el de la piscina',
    notas: 'la nevera congela mucho, bájala al 2',
    pegatinas: ['buena nevera', 'bichos'],
  });

  assert.match(material, /Bunga 12/);
  assert.match(material, /el de la piscina/);
  assert.match(material, /buena nevera, bichos/);
  assert.match(material, /congela mucho/);
});

// Un bunga recién apuntado no tiene nada escrito, y el encargo dice qué hacer
// entonces: decirlo con gracia en vez de inventarse cómo es el sitio.
test('sin pegatinas ni notas, se dice que no hay nada en vez de callarlo', () => {
  const material = materialDelBunga({ nombre: 'Bunga 3' });
  assert.match(material, /ninguna pegatina/i);
  assert.match(material, /ninguna nota/i);
});

test('no viajan los nombres: el material no sabe de quién es', () => {
  const material = materialDelBunga({
    nombre: 'Bunga 12', notas: 'hay bichos', pegatinas: ['bichos'],
  });
  assert.doesNotMatch(material, /famil/i);
});

// El encargo es lo que sube o baja el tono, y lo que ata la forma de la
// respuesta: sin el JSON no sale nada, y sin el «di lo que hay» sale un chiste
// que deja la lista igual que estaba.
test('el encargo pide una frase corta, con guasa y que diga cómo es el sitio', () => {
  assert.match(INSTRUCCION, /UNA sola frase/);
  assert.match(INSTRUCCION, new RegExp(String(TOPE_DEL_RESUMEN)));
  assert.match(INSTRUCCION, /guasa/);
  assert.match(INSTRUCCION, /decir lo que hay/);
  assert.match(INSTRUCCION, /"resumen"/);
});

// ── Lo que vuelve ────────────────────────────────────────────────────────────

test('se lee el JSON aunque venga con prosa alrededor', () => {
  assert.equal(
    leerResumen('Claro: {"resumen":"la nevera va sobrada y los bichos también"} ¡espero que sirva!'),
    'la nevera va sobrada y los bichos también',
  );
});

test('un párrafo se corta, y una respuesta sin JSON no es un resumen', () => {
  const largo = leerResumen(`{"resumen":"${'a'.repeat(400)}"}`);
  assert.ok(largo.length <= TOPE_DEL_RESUMEN + 40);
  assert.equal(leerResumen('pues no sé qué decirte'), null);
  assert.equal(leerResumen('{"resumen":"   "}'), null);
  assert.equal(leerResumen(null), null);
});

test('los saltos de línea se aplastan: es un renglón, no un párrafo', () => {
  assert.equal(leerResumen('{"resumen":"buena nevera,\\n  pero con bichos"}'), 'buena nevera, pero con bichos');
});

// ── La llamada ───────────────────────────────────────────────────────────────

test('se pide con la clave, el modelo y el encargo que se le den', async () => {
  let visto = null;
  const buscar = async (url, opciones) => {
    visto = { url, cuerpo: JSON.parse(opciones.body), cabeceras: opciones.headers };
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{"resumen":"va bien"}' }] }) };
  };

  const r = await pedirResumen({
    clave: 'sk-prueba', modelo: 'claude-haiku-4-5', material: 'Bungalow: Bunga 12.', buscar,
  });

  assert.equal(r, 'va bien');
  assert.equal(visto.cabeceras['x-api-key'], 'sk-prueba');
  assert.equal(visto.cuerpo.model, 'claude-haiku-4-5');
  assert.match(visto.cuerpo.system, /UNA sola frase/);
});

test('un error del modelo sube con sus palabras y su estado', async () => {
  const buscar = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'rate limited' } }) });
  await assert.rejects(
    () => pedirResumen({ clave: 'k', modelo: 'm', material: 'x', buscar }),
    (e) => e.message === 'rate limited' && e.estado === 429,
  );
});

// ── El hilo de un bunga (§14.66) ─────────────────────────────────────────────

test('un comentario en un bunga avisa a la familia que duerme ahí, y a nadie más', async () => {
  const { avisoDeComentario, destinoDeAncla } = await import('../src/avisos.js');

  const personas = [
    { id: 'per_curro', name: 'Curro', familyId: 'fam_garcia' },
    { id: 'per_ana', name: 'Ana', familyId: 'fam_perez' },
  ];
  const bungas = [{ id: 'bun_12', name: 'Bunga 12', familyId: 'fam_garcia' }];

  const sobre = avisoDeComentario(
    { id: 'com_1', ancla: 'bunga:bun_12', texto: '¿os importa cambiarlo?', autorId: 'per_ana' },
    { personas, bungas, autor: 'per_ana' },
  );

  assert.deepEqual(sobre.personIds, ['per_curro']);
  assert.match(sobre.titulo, /Bunga 12/);
  // Y tocarlo abre el bunga, no la portada.
  assert.equal(sobre.ir, 'grupo/bungas/bun_12');
  assert.equal(destinoDeAncla('bunga:bun_12'), 'grupo/bungas/bun_12');
});

test('un bunga de nadie no despierta a nadie', async () => {
  const { avisoDeComentario } = await import('../src/avisos.js');
  const sobre = avisoDeComentario(
    { id: 'com_1', ancla: 'bunga:bun_3', texto: 'está libre', autorId: 'per_ana' },
    { personas: [{ id: 'per_ana', familyId: 'fam_perez' }], bungas: [{ id: 'bun_3', name: 'Bunga 3' }], autor: 'per_ana' },
  );
  assert.equal(sobre, null);
});
