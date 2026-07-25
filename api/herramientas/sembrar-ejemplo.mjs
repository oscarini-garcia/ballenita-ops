#!/usr/bin/env node
/**
 * Siembra la base con el evento de ejemplo «Ballenita 2026», para poder probar
 * la app con datos antes de que entren los de verdad.
 *
 * Los datos viven en `datos-ejemplo.mjs`, que también usan las pruebas: así se
 * comprueba en cada rama que siguen entrando en el esquema real y saliendo
 * íntegros, en vez de descubrirlo al sembrar.
 *
 * Los identificadores son fijos y legibles (`ev_demo`, `fam_garcia`…), a
 * propósito: hacen la siembra idempotente —lanzarla dos veces no duplica nada—
 * y permiten barrer justo esto cuando llegue el momento de ir en serio, sin
 * tocar lo que haya alrededor.
 *
 *   API=https://ballena-ops-api.oscarini.workers.dev  TOKEN_SERVICIO=...  \
 *     node herramientas/sembrar-ejemplo.mjs
 *
 * Con `--simulacro` imprime lo que enviaría y no envía nada.
 *
 * Para barrerlo todo cuando toque, desde `api/`:
 *
 *   npm run borrar:ejemplo
 */

import { instantaneaDeEjemplo } from './datos-ejemplo.mjs';

const { API, TOKEN_SERVICIO } = process.env;
const simulacro = process.argv.includes('--simulacro');

function abortar(mensaje) {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

if (!simulacro && (!API || !TOKEN_SERVICIO)) {
  abortar('faltan API y TOKEN_SERVICIO (o usa --simulacro)');
}

const instantanea = instantaneaDeEjemplo();

console.log('Evento de prueba «Ballenita 2026 (prueba)»:');
for (const [tabla, filas] of Object.entries(instantanea.tables)) {
  console.log(`  ${tabla.padEnd(12)} ${filas.length}`);
}

if (simulacro) {
  console.log('\n— simulacro: no se ha enviado nada —');
  process.exit(0);
}

const envio = await fetch(`${API}/api/importar`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN_SERVICIO}` },
  body: JSON.stringify(instantanea),
});

const resultado = await envio.json().catch(() => ({}));
if (!envio.ok) abortar(`la API respondió ${envio.status}: ${JSON.stringify(resultado)}`);

console.log('\n✓ Sembrado:');
for (const [tabla, cuantos] of Object.entries(resultado.importado ?? {})) {
  console.log(`  ${tabla.padEnd(12)} ${cuantos}`);
}
console.log('\nAbre la app y sincroniza: debería aparecer el evento de prueba.');
