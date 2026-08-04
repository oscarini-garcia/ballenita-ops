import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COCINA_DE_ORIGEN, cocinaDe, renglonDeCocina } from '../src/cocina.js';
import { materialDelPlatoParecido } from '../src/receta.js';
import { materialDelViaje } from '../src/sugerencias.js';
import { baseDePrueba } from './d1.js';
import { TABLAS } from '../src/tablas.js';

/**
 * Con qué se cocina (§14.20-quater).
 *
 * Pedirle platos al modelo sin decirle con qué se cocinan es pedírselos a
 * ciegas, y falla en las dos direcciones: propone cosas de horno —que no hay— y
 * no propone las de barbacoa, que es donde se hace casi todo.
 */

test('sin nada escrito vale el de origen, como los encargos', () => {
  assert.equal(cocinaDe(null), COCINA_DE_ORIGEN);
  assert.equal(cocinaDe({}), COCINA_DE_ORIGEN);
  // Vacío y espacios en blanco son lo mismo que no haber escrito nada: si no,
  // borrar el campo dejaría al modelo sin ningún dato en vez de con el de siempre.
  assert.equal(cocinaDe({ cocina: '   ' }), COCINA_DE_ORIGEN);
});

test('lo del evento gana, porque otro año es otro camping', () => {
  assert.equal(cocinaDe({ cocina: 'Solo un hornillo de gas' }), 'Solo un hornillo de gas');
});

test('entra en el material de los platos parecidos, que es quien más lo necesita', () => {
  const m = materialDelPlatoParecido({
    plato: 'Paella mixta',
    ingredientes: ['Arroz', 'Mejillones'],
    yaHay: ['Sandía'],
    evento: { cocina: 'Barbacoa y poco más' },
  });
  assert.match(m, /Con qué se cocina: Barbacoa y poco más/);
  // Y sigue llevando lo que llevaba.
  assert.match(m, /Plato: Paella mixta/);
  assert.match(m, /Ya tienen en el catálogo: Sandía/);
});

test('y en el de las ideas de plan: media hora de barbacoa es un plan', () => {
  const m = materialDelViaje({ evento: { lugar: 'Ballena Alegre' }, personas: [], yaHay: [] });
  assert.match(m, /Con qué se cocina: /);
  assert.match(m, /Barbacoa/);
});

test('sin evento se propone igual, con el de origen', () => {
  // Una app vieja no manda `eventId`, y quedarse sin proponer nada por eso sería
  // peor que proponer con lo de siempre.
  assert.match(materialDelPlatoParecido({ plato: 'Paella' }), /Con qué se cocina: /);
  assert.equal(renglonDeCocina(null), `Con qué se cocina: ${COCINA_DE_ORIGEN}`);
});

test('la columna existe en la base y viaja como texto', async () => {
  // La migración 0011 la añade; `tablas.js` la declara para que la sincronización
  // la mande. Sin lo segundo se escribiría en el móvil y no llegaría nunca.
  assert.ok(TABLAS.events.columnas.includes('cocina'));

  const db = baseDePrueba();
  const { results: columnas } = await db.prepare('PRAGMA table_info(events)').all();
  assert.ok(columnas.map((c) => c.name).includes('cocina'), 'falta la columna cocina en events');
});
