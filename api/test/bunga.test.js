/**
 * El bunga evaluado en dos frases (SPECS §14.66, §14.66-ter).
 *
 * Lo que se fija aquí es lo de siempre en los encargos de IA: que el material
 * que se le pasa al modelo diga lo que tiene que decir **y nada más** —ni un
 * nombre—, y que lo que vuelve se lea sin fiarse de que venga limpio.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INSTRUCCION, INSTRUCCION_COMENTARIO, TOPE_DEL_COMENTARIO, TOPE_DEL_RESUMEN,
  leerComentario, leerResumen, materialDelBunga, materialDelComentario,
  pedirComentario, pedirResumen,
} from '../src/bunga.js';

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
// respuesta: sin el JSON no sale nada. **Y el chiste se prohíbe a propósito**
// (§14.66-ter): la gracia ya la ponen las notas, y quien lee esto está
// decidiendo con qué bungalow se queda.
test('el encargo pide una evaluación redactada, y prohíbe el chiste y el folleto', () => {
  assert.match(INSTRUCCION, /evaluación \*\*redactada\*\*/);
  assert.match(INSTRUCCION, new RegExp(String(TOPE_DEL_RESUMEN)));
  assert.match(INSTRUCCION, /Ni chistes ni guasa/);
  assert.match(INSTRUCCION, /folleto/);
  assert.match(INSTRUCCION, /decir cómo es el sitio/);
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
  assert.match(visto.cuerpo.system, /evaluación/);
});

test('un error del modelo sube con sus palabras y su estado', async () => {
  const buscar = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'rate limited' } }) });
  await assert.rejects(
    () => pedirResumen({ clave: 'k', modelo: 'm', material: 'x', buscar }),
    (e) => e.message === 'rate limited' && e.estado === 429,
  );
});

// ── El comentario que propone la ballena (§14.66-quater) ─────────────────────

// Lo que se pidió con todas las letras: **que tenga en cuenta lo de cómo es**.
// Sin la evaluación delante, lo que sale vale para cualquier bungalow.
test('el material del comentario lleva la evaluación, las pegatinas y las notas', () => {
  const material = materialDelComentario({
    nombre: 'Bunga 12',
    alias: 'el de la piscina',
    notas: 'la nevera congela mucho',
    pegatinas: ['bichos'],
    resumen: 'La nevera va sobrada; hay bichos en la terraza.',
  });

  assert.match(material, /Cómo es, en una frase: La nevera va sobrada/);
  assert.match(material, /bichos/);
  assert.match(material, /congela mucho/);
});

test('sin evaluación escrita se dice, en vez de callarlo', () => {
  const material = materialDelComentario({ nombre: 'Bunga 3', notas: 'hay grillos' });
  assert.match(material, /ninguna evaluación/i);
});

// Del hilo viaja **lo que se dijo**, nunca quién lo dijo: la regla de todos los
// encargos, y aquí además el autor no aporta nada.
test('el hilo entra para no repetirse, y sin quién lo dijo', () => {
  const material = materialDelComentario({
    nombre: 'Bunga 12',
    notas: 'hay bichos',
    hilo: ['se ha vuelto a ir la luz', '¿os importa cambiarlo?'],
  });

  assert.match(material, /se ha vuelto a ir la luz/);
  assert.match(material, /¿os importa cambiarlo\?/);
  assert.doesNotMatch(material, /Curro|autor/i);
});

// De un hilo de ochenta no se manda el hilo de ochenta: los últimos seis son de
// lo que se está hablando, y lo demás es pagar por contexto viejo.
test('de un hilo largo van los últimos seis', () => {
  const hilo = Array.from({ length: 20 }, (_, i) => `comentario ${i}`);
  const material = materialDelComentario({ nombre: 'Bunga 12', notas: 'x', hilo });

  assert.match(material, /comentario 19/);
  assert.match(material, /comentario 14/);
  assert.doesNotMatch(material, /comentario 13/);
});

// «Añade un botón que genere más»: el segundo toque tiene que traer otro, y lo
// único que lo garantiza es decirle cuáles ya ha traído.
test('lo ya propuesto viaja, para que el segundo toque traiga otro', () => {
  const material = materialDelComentario({
    nombre: 'Bunga 12', notas: 'hay bichos', yaPropuestas: ['¿alguien trae insecticida?'],
  });

  assert.match(material, /no ha valido/);
  assert.match(material, /insecticida/);
});

test('el encargo manda hablar de cómo es el sitio, y no firmar', () => {
  assert.match(INSTRUCCION_COMENTARIO, /hablar de lo que dice cómo es el sitio/);
  assert.match(INSTRUCCION_COMENTARIO, new RegExp(String(TOPE_DEL_COMENTARIO)));
  assert.match(INSTRUCCION_COMENTARIO, /no firmes/);
  assert.match(INSTRUCCION_COMENTARIO, /"comentario"/);
});

test('se lee el comentario del JSON, y un párrafo se corta', () => {
  assert.equal(leerComentario('{"comentario":"¿esta vez alguien mira lo del aire?"}'),
    '¿esta vez alguien mira lo del aire?');
  assert.ok(leerComentario(`{"comentario":"${'a'.repeat(400)}"}`).length <= TOPE_DEL_COMENTARIO + 40);
  assert.equal(leerComentario('{"resumen":"esto es lo otro"}'), null);
  assert.equal(leerComentario('pues no sé'), null);
});

test('el comentario se pide con su encargo, no con el de la evaluación', async () => {
  let visto = null;
  const buscar = async (url, opciones) => {
    visto = JSON.parse(opciones.body);
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{"comentario":"la nevera otra vez"}' }] }) };
  };

  const r = await pedirComentario({
    clave: 'sk-prueba', modelo: 'claude-sonnet-4-5', material: 'Bungalow: Bunga 12.', buscar,
  });

  assert.equal(r, 'la nevera otra vez');
  assert.equal(visto.model, 'claude-sonnet-4-5');
  assert.match(visto.system, /hilo de un bungalow/);
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
