import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerCantidades, materialDelPlato, pedirCantidades } from '../src/cantidades.js';

/**
 * Las cantidades que le faltan a una receta, y en qué se compra cada cosa.
 *
 * Lo segundo es el dato sin el cual no se puede redondear: 1,62 kg no se
 * compran, dos paquetes de uno sí.
 */

test('al modelo le llega el plato y lo que falta, y nada de quién come', () => {
  const material = materialDelPlato({ plato: 'Paella mixta', raciones: 12, ingredientes: ['Mejillones', 'Azafrán'] });
  assert.match(material, /Paella mixta/);
  assert.match(material, /12 raciones/);
  assert.match(material, /Mejillones, Azafrán/);
  // Para decir cuánto arroz lleva una paella, quién come no aporta.
  assert.doesNotMatch(material, /Curro|Ana|adultos|niños/);
});

test('sin saber para cuántos es, se le dice que suponga doce', () => {
  assert.match(materialDelPlato({ plato: 'X', raciones: null, ingredientes: ['sal'] }), /supón 12/);
});

test('solo se admiten los ingredientes que se pidieron', () => {
  // Un nombre que no estaba en la lista es una línea que aparecería sola en la
  // receta de alguien.
  const texto = '{"cantidades":[{"nombre":"Mejillones","cantidad":30,"unidad":"ud"},{"nombre":"Trufa negra","cantidad":1,"unidad":"ud"}]}';
  const r = leerCantidades(texto, ['Mejillones', 'Azafrán']);
  assert.deepEqual(r.map((x) => x.nombre), ['Mejillones']);
});

test('el nombre vuelve como se mandó, aunque el modelo lo escriba de otra forma', () => {
  const r = leerCantidades('{"cantidades":[{"nombre":"mejillones","cantidad":30,"unidad":"ud"}]}', ['Mejillones']);
  assert.equal(r[0].nombre, 'Mejillones');
});

test('el lote viene con su tamaño, que es lo que permite redondear', () => {
  const r = leerCantidades(
    '{"cantidades":[{"nombre":"Arroz","cantidad":1.2,"unidad":"kg","lote":{"tamano":1,"unidad":"kg","nombre":"paquete"}}]}',
    ['Arroz'],
  );
  assert.deepEqual(r[0].lote, { tamano: 1, unidad: 'kg', nombre: 'paquete' });
});

test('lo que se compra suelto se queda sin lote, y no se inventa uno', () => {
  const r = leerCantidades('{"cantidades":[{"nombre":"Azafrán","cantidad":1,"unidad":"g","lote":null}]}', ['Azafrán']);
  assert.equal(r[0].lote, null);
});

test('una cantidad que no es un número se descarta entera', () => {
  const r = leerCantidades('{"cantidades":[{"nombre":"Sal","cantidad":"al gusto"}]}', ['Sal']);
  assert.deepEqual(r, []);
});

test('si contesta cualquier cosa, no sale ninguna cantidad en vez de romperse', () => {
  assert.deepEqual(leerCantidades('lo siento, no puedo', ['Sal']), []);
});

test('el mismo ingrediente dos veces se queda en uno', () => {
  const r = leerCantidades('{"cantidades":[{"nombre":"Sal","cantidad":1,"unidad":"g"},{"nombre":"Sal","cantidad":9,"unidad":"g"}]}', ['Sal']);
  assert.equal(r.length, 1);
  assert.equal(r[0].cantidad, 1);
});

test('la llamada usa el encargo que se le pase', async () => {
  let cuerpo = null;
  const buscar = async (url, opciones) => {
    cuerpo = JSON.parse(opciones.body);
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{"cantidades":[]}' }] }) };
  };
  await pedirCantidades({ clave: 'k', modelo: 'm', material: 'x', pedidos: [], instruccion: 'el mío', buscar });
  assert.equal(cuerpo.system, 'el mío');
});
