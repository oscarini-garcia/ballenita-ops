#!/usr/bin/env node
/**
 * Trae el documento que el grupo tiene en JSONBin y lo siembra en la base nueva.
 *
 * Se lanza una vez, desde un portátil, antes de que nadie empiece a usar la
 * versión con API. La siembra es **idempotente**: el servidor aplica cada fila
 * con su propia marca de tiempo y respeta la regla de última escritura, así que
 * repetirla no deshace nada de lo que se haya hecho entretanto. Eso permite
 * ensayarla, dejar que el grupo siga en la versión vieja unos días y volver a
 * lanzarla el día del corte para arrastrar lo que haya cambiado.
 *
 *   JSONBIN_ID=...  JSONBIN_KEY=...  \
 *   API=https://ballena-ops-api.EJEMPLO.workers.dev  TOKEN_SERVICIO=...  \
 *     node herramientas/sembrar-desde-jsonbin.mjs
 *
 * Con `--simulacro` se imprime lo que se enviaría y no se envía nada.
 */

const { JSONBIN_ID, JSONBIN_KEY, API, TOKEN_SERVICIO } = process.env;
const simulacro = process.argv.includes('--simulacro');

function abortar(mensaje) {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

if (!JSONBIN_ID || !JSONBIN_KEY) abortar('faltan JSONBIN_ID y JSONBIN_KEY');
if (!simulacro && (!API || !TOKEN_SERVICIO)) abortar('faltan API y TOKEN_SERVICIO (o usa --simulacro)');

const respuesta = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`, {
  headers: { 'X-Master-Key': JSONBIN_KEY },
});
if (!respuesta.ok) abortar(`JSONBin respondió ${respuesta.status}`);

const documento = (await respuesta.json()).record;
if (!documento?.tables) abortar('el documento de JSONBin no tiene la forma esperada ({ tables: … })');

console.log('Documento leído de JSONBin:');
for (const [tabla, filas] of Object.entries(documento.tables)) {
  console.log(`  ${tabla.padEnd(12)} ${filas.length}`);
}
console.log(`  ${'(lápidas)'.padEnd(12)} ${(documento.tombstones ?? []).length}`);

if (simulacro) {
  console.log('\n— simulacro: no se ha enviado nada —');
  process.exit(0);
}

const envio = await fetch(`${API}/api/importar`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN_SERVICIO}` },
  body: JSON.stringify(documento),
});

const resultado = await envio.json().catch(() => ({}));
if (!envio.ok) abortar(`la API respondió ${envio.status}: ${JSON.stringify(resultado)}`);

console.log('\n✓ Sembrado:');
for (const [tabla, cuantos] of Object.entries(resultado.importado ?? {})) {
  console.log(`  ${tabla.padEnd(12)} ${cuantos}`);
}
console.log('\nLas filas que no aparecen ya estaban más actualizadas en el servidor.');
