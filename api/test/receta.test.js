import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leerArreglo, leerParecidos, materialDeLaLista, materialDelPlatoParecido,
} from '../src/receta.js';

/** Los dos encargos del editor: ordenar lo escrito a saco y proponer platos. */

test('al modelo le llegan las líneas numeradas, tal como están', () => {
  const m = materialDeLaLista({
    plato: 'Paella mixta', raciones: 12,
    lineas: [{ cantidad: '1,2 kg', nombre: 'Arroz' }, { cantidad: '', nombre: 'tres pinchos de wagyu' }],
  });
  assert.match(m, /0\. cantidad="1,2 kg" nombre="Arroz"/);
  assert.match(m, /1\. cantidad="" nombre="tres pinchos de wagyu"/);
});

test('«tres pinchos de wagyu» vuelve como 3 · ud · Pinchos de wagyu', () => {
  const r = leerArreglo('{"lineas":[{"i":1,"cantidad":3,"unidad":"ud","nombre":"Pinchos de wagyu"}]}', 2);
  assert.deepEqual(r, [{ i: 1, cantidad: 3, unidad: 'ud', nombre: 'Pinchos de wagyu' }]);
});

test('una línea que no se mandó se descarta: aparecería sola en la receta', () => {
  assert.deepEqual(leerArreglo('{"lineas":[{"i":7,"cantidad":1,"nombre":"Trufa"}]}', 2), []);
});

test('una línea sin nombre se descarta: borraría la que había', () => {
  assert.deepEqual(leerArreglo('{"lineas":[{"i":0,"cantidad":1,"nombre":"  "}]}', 2), []);
});

test('lo que no tiene cantidad se queda sin ella, y con el nombre limpio', () => {
  const r = leerArreglo('{"lineas":[{"i":0,"cantidad":null,"unidad":"","nombre":"Sal"}]}', 1);
  assert.equal(r[0].cantidad, null);
  assert.equal(r[0].nombre, 'Sal');
});

test('si contesta cualquier cosa, no sale ninguna línea en vez de romperse', () => {
  assert.deepEqual(leerArreglo('lo siento', 3), []);
});

test('el plato parecido lleva su nombre, sus ingredientes y lo que ya hay', () => {
  const m = materialDelPlatoParecido({ plato: 'Paella mixta', ingredientes: ['Arroz', 'Mejillones'], yaHay: ['Sandía'] });
  assert.match(m, /Paella mixta/);
  assert.match(m, /Arroz, Mejillones/);
  assert.match(m, /Sandía/);
  assert.doesNotMatch(m, /adultos|niños|Curro/);
});

test('las propuestas llegan enteras: nombre, tipo e ingredientes', () => {
  const r = leerParecidos('{"platos":[{"que":"Fideuá de sepia","porque":"Misma paellera","tipo":"principal","ingredientes":[{"nombre":"Fideos","cantidad":1,"unidad":"kg"}]}]}');
  assert.equal(r[0].que, 'Fideuá de sepia');
  assert.equal(r[0].tipo, 'principal');
  assert.deepEqual(r[0].ingredientes, [{ nombre: 'Fideos', cantidad: 1, unidad: 'kg' }]);
});

test('un tipo que no es del catálogo se queda en «principal»', () => {
  assert.equal(leerParecidos('{"platos":[{"que":"X","tipo":"tapa"}]}')[0].tipo, 'principal');
});

test('nunca más de cinco, aunque conteste diez', () => {
  const diez = Array.from({ length: 10 }, (_, i) => `{"que":"P${i}"}`).join(',');
  assert.equal(leerParecidos(`{"platos":[${diez}]}`).length, 5);
});
