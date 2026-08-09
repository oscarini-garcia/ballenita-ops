import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASES_DE_AVISO, ES_CLASE, avisoDeEstado, avisoDeGasto, avisoDeLiquidacion,
  elGastoMueveElSaldo, familiasDeUnGasto, importe,
} from '../src/avisos.js';

/**
 * A quién le importa lo que acaba de pasar. Lo que se prueba aquí no es que se
 * mande nada —eso es `apns.js`— sino las tres reglas que hacen que un aviso se
 * lea en vez de apagarse: nunca al que lo provocó, solo cuando cambia el saldo,
 * y lo que no está apagado está encendido.
 */
const PERSONAS = [
  { id: 'p1', name: 'Ana', familyId: 'f1' },
  { id: 'p2', name: 'Luis', familyId: 'f2' },
  { id: 'p3', name: 'Sara', familyId: 'f3' },
];
const FAMILIAS = [{ id: 'f1', name: 'Pérez' }, { id: 'f2', name: 'Solteros' }, { id: 'f3', name: 'García' }];
const ctx = (extra = {}) => ({ personas: PERSONAS, familias: FAMILIAS, moneda: 'EUR', ...extra });

test('el catálogo se escribe una sola vez y aquí', () => {
  assert.ok(CLASES_DE_AVISO.length >= 3);
  for (const c of CLASES_DE_AVISO) {
    assert.ok(c.id && c.titulo && c.pista, `a «${c.id}» le falta algo que pintar`);
    assert.equal(ES_CLASE(c.id), true);
  }
  assert.equal(ES_CLASE('inventada'), false);
});

test('el importe se lee como en España, sin Intl', () => {
  assert.equal(importe(4860), '48,60 €');
  assert.equal(importe(100, 'GBP'), '1,00 GBP');
  assert.equal(importe(null), '0,00 €');
});

test('sin lista de participantes, un gasto es de todas las familias', () => {
  const gasto = { payers: [{ familyId: 'f1' }] };
  assert.equal(familiasDeUnGasto(gasto, PERSONAS).length, 3);
});

test('con participantes, solo las suyas y la de quien pagó', () => {
  const gasto = { payers: [{ familyId: 'f1' }], participantIds: ['p2'] };
  assert.deepEqual(familiasDeUnGasto(gasto, PERSONAS).sort(), ['f1', 'f2']);
});

test('los campos JSON llegan como texto desde D1 y se leen igual', () => {
  const gasto = { payers: '[{"familyId":"f1"}]', participantIds: '["p2"]' };
  assert.deepEqual(familiasDeUnGasto(gasto, PERSONAS).sort(), ['f1', 'f2']);
});

/**
 * Corregir la descripción de un gasto no le mueve un céntimo a nadie. Sin esta
 * distinción, editar tres veces seguidas son tres avisos a nueve teléfonos.
 */
test('solo avisa el gasto que mueve el dinero o el reparto', () => {
  const anterior = { amountCents: 4860, payers: '[{"familyId":"f1"}]', participantIds: '[]', description: 'Cena' };
  assert.equal(elGastoMueveElSaldo(anterior, { description: 'Cena en el chiringuito' }), false);
  assert.equal(elGastoMueveElSaldo(anterior, { amountCents: 5000 }), true);
  assert.equal(elGastoMueveElSaldo(anterior, { participantIds: ['p1'] }), true);
  // Uno nuevo siempre avisa: no hay nada con lo que compararlo.
  assert.equal(elGastoMueveElSaldo(null, {}), true);
});

test('el aviso de un gasto dice cuánto, quién lo puso y que te toca', () => {
  const gasto = { id: 'e1', description: 'Cena en el chiringuito', amountCents: 4860, payers: [{ familyId: 'f1' }] };
  const aviso = avisoDeGasto(gasto, ctx());
  assert.equal(aviso.clase, 'dinero');
  assert.match(aviso.cuerpo, /Cena en el chiringuito/);
  assert.match(aviso.cuerpo, /48,60 €/);
  assert.match(aviso.cuerpo, /lo puso Pérez/);
  assert.deepEqual(aviso.personIds.sort(), ['p1', 'p2', 'p3']);
});

test('a quien lo apuntó no se le avisa de lo suyo', () => {
  const gasto = { id: 'e1', amountCents: 4860, payers: [{ familyId: 'f1' }] };
  const aviso = avisoDeGasto(gasto, ctx({ autor: 'p1' }));
  assert.ok(!aviso.personIds.includes('p1'));
  assert.equal(aviso.personIds.length, 2);
});

test('un gasto que no le toca a nadie más no genera aviso', () => {
  // Solo Ana dentro, y es quien lo apunta: no queda nadie a quien contárselo.
  const gasto = { id: 'e1', amountCents: 100, payers: [{ familyId: 'f1' }], participantIds: ['p1'] };
  assert.equal(avisoDeGasto(gasto, ctx({ autor: 'p1' })), null);
});

test('una liquidación avisa a las dos familias y dice quién pagó a quién', () => {
  const liq = { id: 's1', fromFamilyId: 'f2', toFamilyId: 'f1', amountCents: 2000 };
  const aviso = avisoDeLiquidacion(liq, ctx());
  assert.equal(aviso.clase, 'dinero');
  assert.match(aviso.cuerpo, /Solteros le ha pagado 20,00 € a Pérez/);
  assert.deepEqual(aviso.personIds.sort(), ['p1', 'p2']);
  // Y no a los García, que no tienen nada que ver con esa deuda.
  assert.ok(!aviso.personIds.includes('p3'));
});

/**
 * El caso que se pidió con esas palabras: «yo al ser admin también, me llegan
 * los míos». Y el que lo acompaña: la app manda la fila entera de la persona al
 * corregir un apodo, así que sin comparar con lo que había, cada retoque sonaría
 * en todos los teléfonos.
 */
test('el estado avisa al grupo, pero nunca a quien lo escribió', () => {
  const persona = { id: 'p1', name: 'Ana', estado: 'En la piscina 🏊' };
  assert.equal(avisoDeEstado(persona, { estado: '' }, { autor: 'p1' }), null);

  const aviso = avisoDeEstado(persona, { estado: '' }, { autor: 'p2' });
  assert.equal(aviso.clase, 'estado');
  assert.match(aviso.titulo, /Ana/);
  assert.equal(aviso.cuerpo, 'En la piscina 🏊');
  // Del grupo entero: no se acota a nadie.
  assert.equal(aviso.personIds, null);
});

test('cambiar el apodo no es cambiar el estado', () => {
  const antes = { estado: 'En la piscina 🏊' };
  const persona = { id: 'p1', name: 'Ana', apodo: 'Anita', estado: 'En la piscina 🏊' };
  assert.equal(avisoDeEstado(persona, antes, { autor: 'p2' }), null);
});

test('borrar el estado tampoco avisa: no hay nada que contar', () => {
  const aviso = avisoDeEstado({ id: 'p1', name: 'Ana', estado: '' }, { estado: 'Algo' }, { autor: 'p2' });
  assert.equal(aviso, null);
});
