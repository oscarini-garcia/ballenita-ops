import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseDePrueba } from './d1.js';
import {
  enviarAviso, hayApnsConfigurado, olvidarTokenDeProveedor, tokenDeProveedor,
} from '../src/apns.js';
import {
  crearCuenta, guardarTokenPush, olvidarTokenPush, silenciarDispositivo, tokensDeAdministradores,
} from '../src/repositorio.js';

/** Una clave P-256 de verdad en PEM PKCS#8, generada al vuelo: firmar de mentira
 *  no probaría lo único que aquí puede salir mal. */
async function claveP8() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', par.privateKey);
  const b64 = Buffer.from(pkcs8).toString('base64').match(/.{1,64}/g).join('\n');
  return { pem: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`, publica: par.publicKey };
}

const entorno = async () => ({
  APNS_CLAVE_P8: (await claveP8()).pem,
  APNS_CLAVE_ID: 'ABC1234567',
  APPLE_EQUIPO: 'TEAM123456',
  APNS_ENTORNO: 'pruebas',
});

test('sin las tres piezas no se empuja, y no pasa nada más', async () => {
  assert.equal(hayApnsConfigurado({}), false);
  assert.equal(hayApnsConfigurado({ APNS_CLAVE_P8: 'x', APNS_CLAVE_ID: 'y' }), false);
  assert.equal(hayApnsConfigurado(await entorno()), true);

  const resultado = await enviarAviso({}, 'token', { titulo: 'x', cuerpo: 'y' });
  assert.deepEqual(resultado, { ok: false, motivo: 'sin-configurar' });
});

test('el token de proveedor es un JWT ES256 con su kid y su equipo', async () => {
  olvidarTokenDeProveedor();
  const env = await entorno();
  const jwt = await tokenDeProveedor(env);
  const [cabecera, cuerpo, firma] = jwt.split('.');

  const decodificar = (t) => JSON.parse(Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
  assert.deepEqual(decodificar(cabecera), { alg: 'ES256', kid: 'ABC1234567' });
  assert.equal(decodificar(cuerpo).iss, 'TEAM123456');
  // La firma cruda de ES256 son dos enteros de 32 octetos: 64 en total.
  assert.equal(Buffer.from(firma.replace(/-/g, '+').replace(/_/g, '/'), 'base64').length, 64);
});

test('el JWT se reutiliza en vez de firmarse en cada aviso', async () => {
  olvidarTokenDeProveedor();
  const env = await entorno();
  assert.equal(await tokenDeProveedor(env), await tokenDeProveedor(env));
});

test('el sobre lleva lo que Apple necesita para no retrasar el aviso', async () => {
  olvidarTokenDeProveedor();
  const env = await entorno();
  let visto = null;
  const fetchDeVerdad = globalThis.fetch;
  globalThis.fetch = async (url, opciones) => {
    visto = { url, ...opciones };
    return { status: 200, json: async () => ({}) };
  };
  try {
    const r = await enviarAviso(env, 'tok123', {
      titulo: 'Alguien quiere entrar 🔑', cuerpo: 'Curro', agrupa: 'solicitudes', datos: { ir: 'ajustes/cuentas' },
    });
    assert.equal(r.ok, true);
  } finally {
    globalThis.fetch = fetchDeVerdad;
  }

  assert.ok(visto.url.endsWith('/3/device/tok123'));
  assert.equal(visto.headers['apns-push-type'], 'alert');
  assert.equal(visto.headers['apns-priority'], '10');
  assert.equal(visto.headers['apns-topic'], 'com.garciadoral.ballenitaops');
  assert.equal(visto.headers['apns-collapse-id'], 'solicitudes');
  const sobre = JSON.parse(visto.body);
  assert.equal(sobre.aps.alert.title, 'Alguien quiere entrar 🔑');
  assert.equal(sobre.ir, 'ajustes/cuentas');
});

test('un token muerto se marca como caducado para poder borrarlo', async () => {
  olvidarTokenDeProveedor();
  const env = await entorno();
  const fetchDeVerdad = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 410, json: async () => ({ reason: 'Unregistered' }) });
  try {
    const r = await enviarAviso(env, 'muerto', { titulo: 'x', cuerpo: 'y' });
    assert.equal(r.ok, false);
    assert.equal(r.caducado, true);
  } finally {
    globalThis.fetch = fetchDeVerdad;
  }
});

test('solo se avisa a los aparatos de quien administra, con token y sin silenciar', async () => {
  const db = baseDePrueba();
  const admin = await crearCuenta(db, { id: 'cta_admin', appleSub: 'a', nombre: 'Óscar' });
  const otra = await crearCuenta(db, { id: 'cta_otra', appleSub: 'b', nombre: 'Curro' });

  await guardarTokenPush(db, { dispositivoId: 'd1', cuentaId: admin.id, plataforma: 'ios', tokenPush: 'tok_admin' });
  await guardarTokenPush(db, { dispositivoId: 'd2', cuentaId: otra.id, plataforma: 'ios', tokenPush: 'tok_otra' });

  assert.deepEqual(await tokensDeAdministradores(db), ['tok_admin']);

  await silenciarDispositivo(db, 'd1', false);
  assert.deepEqual(await tokensDeAdministradores(db), []);
});

test('el mismo token en otro aparato deja de estar en el viejo', async () => {
  const db = baseDePrueba();
  const uno = await crearCuenta(db, { id: 'cta_1', appleSub: 'a', nombre: 'Óscar' });
  await guardarTokenPush(db, { dispositivoId: 'd1', cuentaId: uno.id, tokenPush: 'mismo' });
  await guardarTokenPush(db, { dispositivoId: 'd2', cuentaId: uno.id, tokenPush: 'mismo' });

  const { results } = await db.prepare("SELECT id FROM dispositivo WHERE tokenPush = 'mismo'").all();
  assert.deepEqual(results.map((r) => r.id), ['d2']);
});

test('olvidar un token lo deja en nada sin borrar el aparato', async () => {
  const db = baseDePrueba();
  const uno = await crearCuenta(db, { id: 'cta_1', appleSub: 'a', nombre: 'Óscar' });
  await guardarTokenPush(db, { dispositivoId: 'd1', cuentaId: uno.id, tokenPush: 'muerto' });
  await olvidarTokenPush(db, 'muerto');

  const { results } = await db.prepare("SELECT tokenPush FROM dispositivo WHERE id = 'd1'").all();
  assert.equal(results.length, 1);
  assert.equal(results[0].tokenPush, null);
});

test('los aparatos de una cuenta son los suyos, y solo si quieren avisos', async () => {
  const { tokensDeCuenta } = await import('../src/repositorio.js');
  const db = baseDePrueba();
  const mia = await crearCuenta(db, { id: 'cta_yo', appleSub: 'a', nombre: 'Óscar' });
  const otra = await crearCuenta(db, { id: 'cta_otro', appleSub: 'b', nombre: 'Curro' });

  await guardarTokenPush(db, { dispositivoId: 'movil', cuentaId: mia.id, tokenPush: 'tok_movil' });
  await guardarTokenPush(db, { dispositivoId: 'ipad', cuentaId: mia.id, tokenPush: 'tok_ipad' });
  await guardarTokenPush(db, { dispositivoId: 'suyo', cuentaId: otra.id, tokenPush: 'tok_ajeno' });

  assert.deepEqual((await tokensDeCuenta(db, mia.id)).sort(), ['tok_ipad', 'tok_movil']);

  // Silenciar el iPad lo deja fuera sin tocar el móvil.
  await silenciarDispositivo(db, 'ipad', false);
  assert.deepEqual(await tokensDeCuenta(db, mia.id), ['tok_movil']);
});
