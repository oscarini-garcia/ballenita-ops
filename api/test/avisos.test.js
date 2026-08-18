import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASES_DE_AVISO, ES_CLASE, avisoDeComentario, avisoDeEstado, avisoDeGasto, avisoDeGastoBorrado, avisoDeLiquidacion, avisosDeGasto, contables, deQueEs, destinoDeAncla, elGastoMueveElSaldo, familiasDeUnGasto, importe, diaEnLetras,
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

// ── Quién lleva las cuentas (§14.58) ──
const gente = [
  { id: 'curro', familyId: 'garcia' },
  { id: 'ana', familyId: 'perez', llevaLasCuentas: true },
  { id: 'luis', familyId: 'perez' },
  { id: 'pablo', familyId: 'solteros', llevaLasCuentas: true },
];
const familias = [
  { id: 'garcia', name: 'García' },
  { id: 'perez', name: 'Pérez' },
  { id: 'solteros', name: 'Solteros' },
];
const gasto = {
  id: 'exp1',
  description: 'Cañas',
  amountCents: 2430,
  payers: [{ familyId: 'garcia', amountCents: 2430 }],
  participantIds: ['curro'],
};

test('§14.58 · manda dos sobres: el de siempre y el de los contables que no estaban', () => {
  const sobres = avisosDeGasto(gasto, { personas: gente, familias, autor: null });
  assert.equal(sobres.length, 2);
  assert.equal(sobres[0].clase, 'dinero');
  assert.deepEqual(sobres[0].personIds, ['curro']);
  // Ana lleva las cuentas y el gasto no le toca; Pablo igual. Van en el
  // segundo, con su clase propia.
  assert.equal(sobres[1].clase, 'gastoTodos');
  assert.deepEqual(sobres[1].personIds, ['ana', 'pablo']);
});

test('§14.58 · a quien le toca el gasto **y** lleva las cuentas le llega uno solo', () => {
  // El gasto es de los Pérez, así que a Ana ya le llega por saldo.
  const suyo = { ...gasto, participantIds: ['ana'], payers: [{ familyId: 'perez', amountCents: 2430 }] };
  const sobres = avisosDeGasto(suyo, { personas: gente, familias, autor: null });
  assert.ok(sobres[0].personIds.includes('ana'));
  // Y no se repite en el segundo: dos avisos del mismo hecho en el mismo
  // teléfono es lo que hace que se apaguen los avisos enteros.
  const segundo = sobres.find((s) => s.clase === 'gastoTodos');
  assert.deepEqual(segundo.personIds, ['pablo']);
});

test('§14.58 · el aviso del contable dice por qué le llega', () => {
  const sobres = avisosDeGasto(gasto, { personas: gente, familias, autor: null });
  assert.match(sobres[1].cuerpo, /llevas las cuentas/);
  assert.match(sobres[0].cuerpo, /Te mueve el saldo/);
});

test('§14.58 · nunca a quien lo hizo, tampoco por llevar las cuentas', () => {
  const sobres = avisosDeGasto(gasto, { personas: gente, familias, autor: 'ana' });
  const todos = sobres.flatMap((s) => s.personIds);
  assert.ok(!todos.includes('ana'));
});

test('§14.58 · sin nadie marcado, sigue habiendo un solo sobre y es el de siempre', () => {
  const solos = gente.map(({ llevaLasCuentas, ...p }) => p);
  const sobres = avisosDeGasto(gasto, { personas: solos, familias, autor: null });
  assert.equal(sobres.length, 1);
  assert.equal(sobres[0].clase, 'dinero');
});

test('§14.58 · un gasto borrado avisa solo a los contables', () => {
  const sobre = avisoDeGastoBorrado(gasto, { personas: gente, autor: null });
  assert.deepEqual(sobre.personIds, ['ana', 'pablo']);
  assert.equal(sobre.clase, 'gastoTodos');
  assert.match(sobre.cuerpo, /ya no está/);
  assert.match(sobre.cuerpo, /2?4,30 €/);
});

test('§14.58 · un gasto borrado sin contables no avisa a nadie', () => {
  const solos = gente.map(({ llevaLasCuentas, ...p }) => p);
  assert.equal(avisoDeGastoBorrado(gasto, { personas: solos }), null);
});

test('§14.58 · un gasto sin descripción se nombra por su importe', () => {
  const anonimo = { ...gasto, description: '' };
  const sobre = avisoDeGastoBorrado(anonimo, { personas: gente });
  assert.match(sobre.cuerpo, /^Un gasto de 24,30 €/);
});

// ── Comentarios (§14.55) ──

const PLANES = [{ id: 'p1', titulo: 'Kayaks en la cala', votos: { curro: '👍', ana: '🤷' } }];
const GENTE = [
  { id: 'curro', familyId: 'garcia' },
  { id: 'ana', familyId: 'perez' },
  { id: 'luis', familyId: 'perez' },
  { id: 'pablo', familyId: 'solteros' },
];

test('§14.55 · un comentario en un plan avisa a quien lo votó', () => {
  const sobre = avisoDeComentario(
    { id: 'c1', ancla: 'plan:p1', texto: '¿A qué hora?', autorId: 'pablo' },
    { personas: GENTE, planes: PLANES, autor: 'pablo' },
  );
  // Curro y Ana votaron; Luis no dijo nada, así que no se le despierta.
  assert.deepEqual(sobre.personIds.sort(), ['ana', 'curro']);
  assert.equal(sobre.clase, 'comentario');
  assert.match(sobre.titulo, /ha comentado en «Kayaks en la cala»/);
});

test('§14.55 · y también a quien ya había escrito en el hilo, aunque no votara', () => {
  const hilo = [{ id: 'c0', ancla: 'plan:p1', autorId: 'luis' }];
  const sobre = avisoDeComentario(
    { id: 'c1', ancla: 'plan:p1', texto: 'A las 10', autorId: 'pablo' },
    { personas: GENTE, planes: PLANES, hilo, autor: 'pablo' },
  );
  // Sin esto, contestarle a Luis no le llega — que es lo primero que rompe una
  // conversación.
  assert.ok(sobre.personIds.includes('luis'));
});

test('§14.55 · nunca a quien lo escribe', () => {
  const sobre = avisoDeComentario(
    { id: 'c1', ancla: 'plan:p1', texto: 'Yo voy', autorId: 'curro' },
    { personas: GENTE, planes: PLANES, autor: 'curro' },
  );
  assert.ok(!sobre.personIds.includes('curro'));
});

test('§14.55 · en un gasto son las familias a las que les mueve el saldo', () => {
  const gastos = [{ id: 'g1', description: 'Cañas', participantIds: ['curro'], payers: [{ familyId: 'perez' }] }];
  const sobre = avisoDeComentario(
    { id: 'c1', ancla: 'gasto:g1', texto: '¿Esto qué era?', autorId: 'pablo' },
    { personas: GENTE, gastos, autor: 'pablo' },
  );
  // García (Curro) por entrar en el reparto, y Pérez (Ana, Luis) por pagarlo.
  assert.deepEqual(sobre.personIds.sort(), ['ana', 'curro', 'luis']);
});

test('§14.55 · en un día son todos: un día del viaje es de todos', () => {
  const sobre = avisoDeComentario(
    { id: 'c1', ancla: 'dia:2026-08-15', texto: 'Llego tarde', autorId: 'curro' },
    { personas: GENTE, autor: 'curro' },
  );
  assert.deepEqual(sobre.personIds.sort(), ['ana', 'luis', 'pablo']);
});

/**
 * El día se nombra en palabras (§14.70-bis).
 *
 * Salía el `id` en crudo —«ha comentado en «2026-08-15»»—, que es la fecha tal
 * como la guarda la base y en la pantalla de bloqueo se lee como una avería.
 */
test('§14.70-bis · el aviso de un día lo nombra en palabras, no en ISO', () => {
  const sobre = avisoDeComentario(
    { id: 'c1', ancla: 'dia:2026-08-15', texto: 'Llego tarde', autorId: 'curro' },
    { personas: GENTE, autor: 'curro' },
  );
  // `GENTE` no lleva nombres, así que el autor sale con el «Alguien» de siempre:
  // lo que se prueba aquí es la fecha, no el nombre.
  assert.equal(sobre.titulo, 'Alguien ha comentado en el sábado 15 de agosto');
  // Y sin comillas: entrecomillar una fecha la convierte en el nombre de algo.
  assert.ok(!sobre.titulo.includes('«'));
});

test('§14.70-bis · la fecha se compone a mano, en UTC y sin Intl', () => {
  assert.equal(diaEnLetras('2026-08-15'), 'el sábado 15 de agosto');
  assert.equal(diaEnLetras('2026-01-01'), 'el jueves 1 de enero');
  assert.equal(diaEnLetras('2026-12-31'), 'el jueves 31 de diciembre');
  // Lo que no es una fecha se devuelve tal cual: un titular raro es mejor que
  // un aviso que no sale porque algo reventó al formatear.
  assert.equal(diaEnLetras('mañana'), 'mañana');
  assert.equal(diaEnLetras(''), '');
  assert.equal(diaEnLetras(null), '');
});

test('§14.55 · si no le importa a nadie, no se manda nada', () => {
  const sinVotos = [{ id: 'p1', titulo: 'Kayaks', votos: {} }];
  assert.equal(avisoDeComentario(
    { id: 'c1', ancla: 'plan:p1', texto: 'Hola', autorId: 'curro' },
    { personas: GENTE, planes: sinVotos, autor: 'curro' },
  ), null);
});

test('§14.55 · se agrupa por hilo: seis mensajes dejan un aviso, no seis', () => {
  const sobre = avisoDeComentario(
    { id: 'c9', ancla: 'plan:p1', texto: 'Vale', autorId: 'pablo' },
    { personas: GENTE, planes: PLANES, autor: 'pablo' },
  );
  assert.equal(sobre.agrupa, 'comentario:plan:p1');
});

test('§14.60 · el aviso lleva a dónde ir, y lo desconocido lleva a Hoy', () => {
  assert.equal(destinoDeAncla('plan:abc'), 'planes/planes/abc');
  assert.equal(destinoDeAncla('gasto:def'), 'dinero/gastos/def');
  assert.equal(destinoDeAncla('dia:2026-08-15'), 'agenda/dias/2026-08-15');
  // Mejor la portada que una pantalla vacía.
  assert.equal(destinoDeAncla('cosa-rara:1'), 'hoy');
  assert.equal(destinoDeAncla(null), 'hoy');
});

test('§14.55 · los votos llegan como texto desde SQLite y se leen igual', () => {
  const comoEnD1 = [{ id: 'p1', titulo: 'Kayaks', votos: '{"curro":"👍"}' }];
  const sobre = avisoDeComentario(
    { id: 'c1', ancla: 'plan:p1', texto: 'Hola', autorId: 'pablo' },
    { personas: GENTE, planes: comoEnD1, autor: 'pablo' },
  );
  assert.deepEqual(sobre.personIds, ['curro']);
});
