import test from 'node:test';
import assert from 'node:assert/strict';

import { baseDePrueba } from './d1.js';
import worker from '../src/index.js';
import {
  aplicarCambio, leerInstantanea, leerMejorasPendientes, TOPE_DE_MEJORA,
} from '../src/repositorio.js';

const upsert = (tabla, id, campos, updatedAt) => ({ tabla, id, op: 'upsert', campos, updatedAt });

const MEJORA = {
  texto: 'Poder marcar la compra por pasillos del súper',
  hecho: false,
  autorId: 'per_marta',
  apuntadaEl: '2026-08-09T10:00:00.000Z',
};

test('una mejora entra por la cola de siempre y vuelve en la instantánea', async () => {
  const db = baseDePrueba();
  const resultado = await aplicarCambio(db, upsert('mejoras', 'mej_1', MEJORA, '2026-08-09T10:00:00.000Z'));
  assert.equal(resultado.aplicado, true);

  const instantanea = await leerInstantanea(db);
  assert.equal(instantanea.tables.mejoras.length, 1);
  const fila = instantanea.tables.mejoras[0];
  assert.equal(fila.texto, MEJORA.texto);
  // Booleano de verdad, no el 0 y el 1 de SQLite.
  assert.equal(fila.hecho, false);
});

test('el Worker rechaza una mejora que pasa del tope, con motivo y sin parar el lote', async () => {
  const db = baseDePrueba();
  const resultado = await aplicarCambio(
    db,
    upsert('mejoras', 'mej_larga', { ...MEJORA, texto: 'x'.repeat(TOPE_DE_MEJORA + 1) }),
  );
  assert.equal(resultado.aplicado, false);
  assert.match(resultado.motivo, /2000/);

  // El tope justo sí entra: el rechazo es de lo que se pasa, no de lo largo.
  const alLimite = await aplicarCambio(
    db,
    upsert('mejoras', 'mej_limite', { ...MEJORA, texto: 'x'.repeat(TOPE_DE_MEJORA) }),
  );
  assert.equal(alLimite.aplicado, true);
});

test('las pendientes salen con su autor en palabras; lo hecho y lo del Demo, no', async () => {
  const db = baseDePrueba();
  await aplicarCambio(db, upsert('persons', 'per_marta', { eventId: 'ev_1', name: 'Marta' }));

  await aplicarCambio(db, upsert('mejoras', 'mej_1', MEJORA));
  await aplicarCambio(db, upsert('mejoras', 'mej_hecha', { ...MEJORA, texto: 'Buscar por ingrediente', hecho: true }));
  await aplicarCambio(db, upsert('mejoras', 'mej_demo', { ...MEJORA, texto: 'Trasteo del Demo', eventId: 'ev_demo' }));
  // Sin autor —quien la apuntó ya no está en el grupo— la mejora sigue saliendo.
  await aplicarCambio(db, upsert('mejoras', 'mej_sin_autor', {
    texto: 'Un aviso el día antes de que te toque cena',
    autorId: 'per_que_se_fue',
    apuntadaEl: '2026-08-10T10:00:00.000Z',
  }));

  const pendientes = await leerMejorasPendientes(db);
  assert.deepEqual(pendientes.map((m) => m.id), ['mej_1', 'mej_sin_autor']);
  assert.equal(pendientes[0].autor, 'Marta');
  assert.equal(pendientes[1].autor, null);
});

test('GET /api/mejoras va con el token de servicio, como la siembra', async () => {
  const db = baseDePrueba();
  await aplicarCambio(db, upsert('mejoras', 'mej_1', MEJORA));
  const env = { DB: db, TOKEN_SERVICIO: 'secreto-de-prueba' };

  const sinToken = await worker.fetch(new Request('https://api.example/api/mejoras'), env);
  assert.equal(sinToken.status, 401);

  const conToken = await worker.fetch(
    new Request('https://api.example/api/mejoras', { headers: { Authorization: 'Bearer secreto-de-prueba' } }),
    env,
  );
  assert.equal(conToken.status, 200);
  const cuerpo = await conToken.json();
  assert.equal(cuerpo.mejoras.length, 1);
  assert.equal(cuerpo.mejoras[0].texto, MEJORA.texto);
});
